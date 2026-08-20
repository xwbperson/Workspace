import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import type { AppConfig } from '../../config.js';
import { createDatabase } from '../database/database.js';
import { getMigrationVersion, runMigrations } from '../database/migrate.js';
import type { Database } from '../database/types.js';
import { AppError } from '../errors.js';
import { initializeWorkspace } from '../workspace/workspace.js';

export interface BackupManifest {
  formatVersion: 1;
  status: 'complete';
  backupId: string;
  workspaceId: string;
  applicationVersion: string;
  databaseMigrationVersion: string;
  createdAt: string;
  excludedTableData: ['public.auth_sessions', 'public.auth_login_attempts'];
}

export interface RestoreResult {
  backupId: string;
  targetRoot: string;
  databaseMigrationVersion: string;
  restoredObjectCount: number;
  reportPath: string;
}

interface CommandSpec {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

export type CommandRunner = (spec: CommandSpec) => Promise<void>;

const defaultCommandRunner: CommandRunner = async ({ command, args, env }) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env, shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < 8_000) stderr += chunk;
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else
        reject(
          new Error(`${basename(command)} 执行失败（${code ?? 'unknown'}）：${stderr.trim()}`),
        );
    });
  });

function postgresCommand(binary: string, databaseUrl: string, args: string[]): CommandSpec {
  const url = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new AppError(400, 'INVALID_DATABASE_URL', '数据库连接必须使用 PostgreSQL URL。');
  }
  const databaseName = url.pathname.replace(/^\//, '');
  if (!databaseName) throw new AppError(400, 'INVALID_DATABASE_URL', '数据库名称不能为空。');
  return {
    command: binary,
    args: [
      '--host',
      url.hostname,
      '--port',
      url.port || '5432',
      '--username',
      decodeURIComponent(url.username),
      '--dbname',
      decodeURIComponent(databaseName),
      ...args,
    ],
    env: {
      ...process.env,
      PGPASSWORD: decodeURIComponent(url.password),
    },
  };
}

async function collectFiles(root: string, current = root): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const fullPath = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new AppError(400, 'BACKUP_SYMLINK', `备份内容不能包含符号链接：${entry.name}`);
    }
    if (entry.isDirectory()) result.push(...(await collectFiles(root, fullPath)));
    else if (entry.isFile()) result.push(relative(root, fullPath).split(sep).join('/'));
  }
  return result.sort();
}

async function sha256(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path) as AsyncIterable<Buffer>) hash.update(chunk);
  return hash.digest('hex');
}

async function writeChecksums(root: string): Promise<void> {
  const files = (await collectFiles(root)).filter((file) => file !== 'checksums.sha256');
  const lines: string[] = [];
  for (const file of files) lines.push(`${await sha256(join(root, file))}  ${file}`);
  await writeFile(join(root, 'checksums.sha256'), `${lines.join('\n')}\n`, 'utf8');
}

async function copyDirectoryContents(source: string, destination: string): Promise<void> {
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) {
      throw new AppError(400, 'BACKUP_SYMLINK', `恢复内容不能包含符号链接：${entry.name}`);
    }
    await cp(join(source, entry.name), join(destination, entry.name), {
      recursive: entry.isDirectory(),
      force: false,
      errorOnExist: true,
    });
  }
}

function assertChildPath(parent: string, child: string): void {
  const parentPath = resolve(parent);
  const childPath = resolve(child);
  if (childPath === parentPath || !childPath.startsWith(`${parentPath}${sep}`)) {
    throw new AppError(400, 'UNSAFE_BACKUP_PATH', '备份路径必须位于工作区 backups/local 内。');
  }
}

async function backupLockIsActive(lockPath: string): Promise<boolean> {
  try {
    const lock = JSON.parse(await readFile(lockPath, 'utf8')) as {
      pid?: unknown;
      startedAt?: unknown;
    };
    if (
      !Number.isInteger(lock.pid) ||
      typeof lock.startedAt !== 'string' ||
      !Number.isFinite(new Date(lock.startedAt).getTime()) ||
      Date.now() - new Date(lock.startedAt).getTime() > 12 * 60 * 60 * 1_000
    ) {
      return false;
    }
    try {
      process.kill(lock.pid as number, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'EPERM';
    }
  } catch {
    return false;
  }
}

export class BackupService {
  public constructor(
    private readonly config: AppConfig,
    private readonly database: Database,
    private readonly runCommand: CommandRunner = defaultCommandRunner,
  ) {}

  public async create(): Promise<string> {
    const lockPath = join(this.config.workbenchRoot, 'runtime', 'backup.lock');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await writeFile(
          lockPath,
          `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
          {
            encoding: 'utf8',
            flag: 'wx',
          },
        );
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (attempt === 0 && !(await backupLockIsActive(lockPath))) {
          await rm(lockPath, { force: true });
          continue;
        }
        throw new AppError(409, 'BACKUP_ALREADY_RUNNING', '已有备份任务正在运行，请稍后重试。');
      }
    }

    try {
      return await this.createUnlocked();
    } finally {
      await rm(lockPath, { force: true });
    }
  }

  private async createUnlocked(): Promise<string> {
    const backupId = randomUUID();
    const startedAt = new Date();
    const backupRoot = join(this.config.workbenchRoot, 'backups', 'local');
    const incompletePath = join(backupRoot, `.incomplete-${backupId}`);
    const finalName = `workbench-backup-${startedAt.toISOString().replace(/[:.]/g, '-')}-${backupId}`;
    const finalPath = join(backupRoot, finalName);
    assertChildPath(backupRoot, incompletePath);
    assertChildPath(backupRoot, finalPath);
    await mkdir(join(incompletePath, 'database'), { recursive: true });
    await mkdir(join(incompletePath, 'storage'), { recursive: true });
    await mkdir(join(incompletePath, 'config'), { recursive: true });
    await this.database.query(
      `INSERT INTO backup_runs (backup_id, status, path, started_at)
       VALUES ($1, 'running', $2, $3)`,
      [backupId, finalPath, startedAt],
    );

    try {
      const dumpPath = join(incompletePath, 'database', 'workbench.dump');
      await this.runCommand(
        postgresCommand(process.env.PG_DUMP_BIN ?? 'pg_dump', this.config.databaseUrl, [
          '--no-owner',
          '--no-acl',
          '--exclude-table-data=public.auth_sessions',
          '--exclude-table-data=public.auth_login_attempts',
          '--format=custom',
          '--file',
          dumpPath,
        ]),
      );

      const objectsPath = join(this.config.workbenchRoot, 'storage', 'objects');
      await cp(objectsPath, join(incompletePath, 'storage', 'objects'), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
      await copyDirectoryContents(
        join(this.config.workbenchRoot, 'config'),
        join(incompletePath, 'config'),
      );

      const manifest: BackupManifest = {
        formatVersion: 1,
        status: 'complete',
        backupId,
        workspaceId: this.config.workspaceId,
        applicationVersion: this.config.version,
        databaseMigrationVersion: await getMigrationVersion(this.database),
        createdAt: startedAt.toISOString(),
        excludedTableData: ['public.auth_sessions', 'public.auth_login_attempts'],
      };
      await writeFile(
        join(incompletePath, 'manifest.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
        'utf8',
      );
      await writeFile(
        join(incompletePath, 'release.json'),
        `${JSON.stringify({ applicationVersion: this.config.version }, null, 2)}\n`,
        'utf8',
      );
      await writeFile(
        join(incompletePath, 'restore-plan.json'),
        `${JSON.stringify({ minimumFormatVersion: 1, requiresEmptyTarget: true }, null, 2)}\n`,
        'utf8',
      );
      await writeChecksums(incompletePath);
      await rename(incompletePath, finalPath);
      await this.database.query(
        `UPDATE backup_runs SET status = 'complete', completed_at = now() WHERE backup_id = $1`,
        [backupId],
      );
      return finalPath;
    } catch (error) {
      try {
        await this.database.query(
          `UPDATE backup_runs SET status = 'failed', completed_at = now(), error_code = $2
           WHERE backup_id = $1`,
          [backupId, error instanceof Error ? error.name : 'UNKNOWN'],
        );
      } finally {
        await rm(incompletePath, { recursive: true, force: true });
      }
      throw error;
    }
  }

  public async verify(backupPath: string): Promise<BackupManifest> {
    const root = await realpath(resolve(backupPath));
    let manifest: BackupManifest;
    try {
      manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8')) as BackupManifest;
    } catch {
      throw new AppError(400, 'BACKUP_MANIFEST_INVALID', '备份清单无法读取。');
    }
    if (
      manifest.formatVersion !== 1 ||
      manifest.status !== 'complete' ||
      manifest.workspaceId !== this.config.workspaceId ||
      typeof manifest.databaseMigrationVersion !== 'string'
    ) {
      throw new AppError(400, 'BACKUP_MANIFEST_INVALID', '备份清单与当前工作区不兼容。');
    }
    const checksumText = await readFile(join(root, 'checksums.sha256'), 'utf8');
    const actualFiles = (await collectFiles(root)).filter((file) => file !== 'checksums.sha256');
    const listedFiles = new Set<string>();
    for (const line of checksumText.split(/\r?\n/).filter(Boolean)) {
      const match = /^([a-f0-9]{64})[ ]{2}(.+)$/.exec(line);
      if (!match?.[1] || !match[2] || match[2].includes('..') || listedFiles.has(match[2])) {
        throw new AppError(400, 'BACKUP_CHECKSUM_INVALID', '备份校验和文件格式无效。');
      }
      listedFiles.add(match[2]);
      const target = resolve(root, match[2]);
      if (!target.startsWith(`${root}${sep}`)) {
        throw new AppError(400, 'BACKUP_CHECKSUM_INVALID', '备份校验目标越过了备份目录。');
      }
      if ((await sha256(target)) !== match[1]) {
        throw new AppError(400, 'BACKUP_CHECKSUM_MISMATCH', `备份文件校验失败：${match[2]}`);
      }
    }
    if (
      actualFiles.some((file) => !listedFiles.has(file)) ||
      [...listedFiles].some((file) => !actualFiles.includes(file)) ||
      !listedFiles.has('database/workbench.dump') ||
      !listedFiles.has('config/app.yaml')
    ) {
      throw new AppError(400, 'BACKUP_CHECKSUM_INCOMPLETE', '备份文件与校验和清单不一致。');
    }
    await this.database.query(
      `UPDATE backup_runs SET status = 'verified', verified_at = now()
       WHERE backup_id = $1 AND status IN ('complete', 'verified')`,
      [manifest.backupId],
    );
    return manifest;
  }

  public async restore(
    backupPath: string,
    targetRoot: string,
    targetDatabaseUrl: string,
  ): Promise<RestoreResult> {
    const manifest = await this.verify(backupPath);
    const backupRoot = await realpath(resolve(backupPath));
    const target = await this.assertEmptyRestoreTarget(targetRoot);
    const targetConfig: AppConfig = {
      ...this.config,
      workbenchRoot: target,
      databaseUrl: targetDatabaseUrl,
      databaseInMemory: false,
    };
    const reportDirectory = join(target, 'migration-reports');
    const reportPath = join(reportDirectory, `restore-${manifest.backupId}.json`);

    try {
      const emptyDatabase = await createDatabase(targetConfig);
      try {
        const tableCount = await emptyDatabase.query<{ count: number }>(
          `SELECT count(*)::int AS count
           FROM pg_catalog.pg_tables
           WHERE schemaname = 'public'`,
        );
        if ((tableCount.rows[0]?.count ?? 0) !== 0) {
          throw new AppError(409, 'RESTORE_DATABASE_NOT_EMPTY', '恢复目标数据库必须是空数据库。');
        }
      } finally {
        await emptyDatabase.end();
      }

      await initializeWorkspace(targetConfig);
      await copyDirectoryContents(
        join(backupRoot, 'storage', 'objects'),
        join(target, 'storage', 'objects'),
      );
      await rm(join(target, 'config'), { recursive: true, force: true });
      await mkdir(join(target, 'config'), { recursive: true });
      await copyDirectoryContents(join(backupRoot, 'config'), join(target, 'config'));

      await this.runCommand(
        postgresCommand(process.env.PG_RESTORE_BIN ?? 'pg_restore', targetDatabaseUrl, [
          '--exit-on-error',
          '--no-owner',
          '--no-acl',
          '--single-transaction',
          join(backupRoot, 'database', 'workbench.dump'),
        ]),
      );

      const restoredDatabase = await createDatabase(targetConfig);
      let databaseMigrationVersion: string;
      try {
        await runMigrations(restoredDatabase);
        await restoredDatabase.query('TRUNCATE public.auth_sessions, public.auth_login_attempts');
        const authState = await restoredDatabase.query<{
          session_count: number;
          attempt_count: number;
          owner_count: number;
        }>(
          `SELECT
             (SELECT count(*)::int FROM public.auth_sessions) AS session_count,
             (SELECT count(*)::int FROM public.auth_login_attempts) AS attempt_count,
             (SELECT count(*)::int FROM public.owner_account WHERE username = 'owner') AS owner_count`,
        );
        const counts = authState.rows[0];
        if (
          !counts ||
          counts.session_count !== 0 ||
          counts.attempt_count !== 0 ||
          counts.owner_count !== 1
        ) {
          throw new AppError(500, 'RESTORE_AUTH_CHECK_FAILED', '恢复后的认证数据检查失败。');
        }
        databaseMigrationVersion = await getMigrationVersion(restoredDatabase);
      } finally {
        await restoredDatabase.end();
      }

      const restoredObjectCount = (await collectFiles(join(target, 'storage', 'objects'))).length;
      const report = {
        status: 'restored',
        backupId: manifest.backupId,
        workspaceId: manifest.workspaceId,
        sourceApplicationVersion: manifest.applicationVersion,
        sourceDatabaseMigrationVersion: manifest.databaseMigrationVersion,
        targetApplicationVersion: this.config.version,
        databaseMigrationVersion,
        restoredObjectCount,
        authentication: { sessions: 0, loginAttempts: 0, ownerAccounts: 1 },
        completedAt: new Date().toISOString(),
      };
      await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
      await this.database.query(
        `UPDATE backup_runs SET status = 'restored', restored_at = now()
         WHERE backup_id = $1`,
        [manifest.backupId],
      );
      return {
        backupId: manifest.backupId,
        targetRoot: target,
        databaseMigrationVersion,
        restoredObjectCount,
        reportPath,
      };
    } catch (error) {
      await mkdir(reportDirectory, { recursive: true });
      await writeFile(
        reportPath,
        `${JSON.stringify(
          {
            status: 'failed',
            backupId: manifest.backupId,
            errorCode: error instanceof AppError ? error.code : 'RESTORE_FAILED',
            failedAt: new Date().toISOString(),
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      throw error;
    }
  }

  public async assertEmptyRestoreTarget(targetRoot: string): Promise<string> {
    const target = resolve(targetRoot);
    if (target === resolve(this.config.workbenchRoot)) {
      throw new AppError(400, 'RESTORE_TARGET_ACTIVE', '不能覆盖当前正在使用的工作区。');
    }
    try {
      const info = await lstat(target);
      if (!info.isDirectory()) throw new Error('target is not directory');
      if ((await readdir(target)).length > 0) {
        throw new AppError(409, 'RESTORE_TARGET_NOT_EMPTY', '恢复目标目录必须为空。');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      await mkdir(target, { recursive: false });
    }
    const parent = await realpath(dirname(target));
    const resolvedTarget = resolve(parent, basename(target));
    if (resolvedTarget !== target) {
      throw new AppError(400, 'RESTORE_TARGET_INVALID', '恢复目标路径解析不一致。');
    }
    return target;
  }

  public async databaseDumpSize(backupPath: string): Promise<number> {
    return (await stat(join(backupPath, 'database', 'workbench.dump'))).size;
  }
}
