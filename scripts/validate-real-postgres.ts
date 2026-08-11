import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../apps/api/src/app/build-app.js';
import { loadConfig } from '../apps/api/src/config.js';
import { AuthRepository } from '../apps/api/src/platform/auth/repository.js';
import { AuthService } from '../apps/api/src/platform/auth/service.js';
import { BackupService } from '../apps/api/src/platform/backup/backup-service.js';
import { createDatabase } from '../apps/api/src/platform/database/database.js';
import { runMigrations } from '../apps/api/src/platform/database/migrate.js';
import { initializeWorkspace } from '../apps/api/src/platform/workspace/workspace.js';

if (process.env.CI_POSTGRES_VALIDATION !== 'true') {
  throw new Error('为避免连接错误数据库，只有 CI_POSTGRES_VALIDATION=true 时才允许执行。');
}

const configuredUrl = new URL(process.env.DATABASE_URL ?? '');
if (configuredUrl.pathname !== '/workbench_ci') {
  throw new Error('真实 PostgreSQL 验证只允许使用名为 workbench_ci 的临时数据库。');
}

const baseRoot = await mkdtemp(join(tmpdir(), 'workbench-real-postgres-'));
const activeRoot = join(baseRoot, 'active');
const restoredRoot = join(baseRoot, 'restored');
const config = loadConfig({
  nodeEnv: 'test',
  databaseInMemory: false,
  databaseUrl: configuredUrl.toString(),
  workbenchRoot: activeRoot,
  appOrigin: 'http://localhost:5173',
  cookieSecure: false,
  logLevel: 'silent',
});

try {
  await initializeWorkspace(config);
  const database = await createDatabase(config);
  await runMigrations(database);
  await new AuthService(new AuthRepository(database), config).initializeOwner(
    'ci-only-owner-password',
  );
  const app = await buildApp({ config, database, startSchedulers: false });
  await app.ready();

  const csrf = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
  const csrfToken = csrf.json<{ csrfToken: string }>().csrfToken;
  const csrfCookie = String(csrf.headers['set-cookie']).split(';', 1)[0];
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      origin: config.appOrigin,
      cookie: csrfCookie,
      'x-csrf-token': csrfToken,
    },
    payload: {
      username: 'owner',
      password: 'ci-only-owner-password',
      remember: true,
    },
  });
  if (login.statusCode !== 200) throw new Error(`真实数据库登录失败：${login.statusCode}`);
  const sessionCookie = String(login.headers['set-cookie']).split(';', 1)[0];
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/countdowns',
    headers: {
      origin: config.appOrigin,
      cookie: `${csrfCookie}; ${sessionCookie}`,
      'x-csrf-token': csrfToken,
    },
    payload: {
      title: '真实 PostgreSQL 恢复样本',
      note: '这条记录必须在恢复后的新数据库中存在。',
      targetAt: '2032-01-01T00:00:00.000Z',
      priority: 90,
    },
  });
  if (created.statusCode !== 201) throw new Error(`真实数据库写入失败：${created.statusCode}`);
  await app.close();

  await writeFile(
    join(activeRoot, 'storage', 'objects', 'restore-proof.txt'),
    'portable-object-proof\n',
    'utf8',
  );

  const currentDatabase = await createDatabase(config);
  try {
    const backup = new BackupService(config, currentDatabase);
    const backupPath = await backup.create();
    await backup.verify(backupPath);

    const adminUrl = new URL(config.databaseUrl);
    adminUrl.pathname = '/postgres';
    const adminDatabase = await createDatabase({ ...config, databaseUrl: adminUrl.toString() });
    try {
      await adminDatabase.query('DROP DATABASE IF EXISTS workbench_restore_ci WITH (FORCE)');
      await adminDatabase.query('CREATE DATABASE workbench_restore_ci');
    } finally {
      await adminDatabase.end();
    }

    const restoreUrl = new URL(config.databaseUrl);
    restoreUrl.pathname = '/workbench_restore_ci';
    const result = await backup.restore(backupPath, restoredRoot, restoreUrl.toString());
    const restoredDatabase = await createDatabase({
      ...config,
      databaseUrl: restoreUrl.toString(),
      workbenchRoot: restoredRoot,
    });
    try {
      const counts = await restoredDatabase.query<{
        countdowns: number;
        sessions: number;
        attempts: number;
        owners: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM countdowns) AS countdowns,
           (SELECT count(*)::int FROM auth_sessions) AS sessions,
           (SELECT count(*)::int FROM auth_login_attempts) AS attempts,
           (SELECT count(*)::int FROM owner_account WHERE username = 'owner') AS owners`,
      );
      const value = counts.rows[0];
      if (
        !value ||
        value.countdowns !== 1 ||
        value.sessions !== 0 ||
        value.attempts !== 0 ||
        value.owners !== 1
      ) {
        throw new Error(`恢复数据验收失败：${JSON.stringify(value)}`);
      }
    } finally {
      await restoredDatabase.end();
    }

    const objectProof = await readFile(
      join(restoredRoot, 'storage', 'objects', 'restore-proof.txt'),
      'utf8',
    );
    if (objectProof !== 'portable-object-proof\n') throw new Error('恢复后的对象文件内容不一致。');

    process.stdout.write(
      `${JSON.stringify({
        status: 'VERIFIED',
        database: 'PostgreSQL',
        migration: result.databaseMigrationVersion,
        restoredObjects: result.restoredObjectCount,
        authenticationSessionsCleared: true,
        reportCreated: true,
      })}\n`,
    );
  } finally {
    await currentDatabase.end();
  }
} finally {
  await rm(baseRoot, { recursive: true, force: true });
}
