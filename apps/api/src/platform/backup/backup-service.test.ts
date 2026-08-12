import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../config.js';
import { createDatabase } from '../database/database.js';
import { runMigrations } from '../database/migrate.js';
import type { Database } from '../database/types.js';
import { initializeWorkspace } from '../workspace/workspace.js';
import { BackupService, type CommandRunner } from './backup-service.js';

describe('portable backup package', () => {
  let root: string;
  let config: AppConfig;
  let database: Database;
  let commandArgs: string[];

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-backup-test-'));
    config = loadConfig({
      nodeEnv: 'test',
      databaseInMemory: true,
      workbenchRoot: root,
      logLevel: 'silent',
    });
    await initializeWorkspace(config);
    database = await createDatabase(config);
    await runMigrations(database);
    commandArgs = [];
  });

  afterEach(async () => {
    await database.end();
    await rm(root, { recursive: true, force: true });
  });

  it('creates and verifies a complete package without authentication session data', async () => {
    const fakeRunner: CommandRunner = async (spec) => {
      commandArgs = spec.args;
      const fileIndex = spec.args.indexOf('--file');
      expect(fileIndex).toBeGreaterThan(-1);
      await writeFile(spec.args[fileIndex + 1]!, 'portable-database-dump', 'utf8');
    };
    const service = new BackupService(config, database, fakeRunner);
    const backupPath = await service.create();
    const manifest = await service.verify(backupPath);

    expect(manifest.status).toBe('complete');
    expect(manifest.databaseMigrationVersion).toBe('018-inbox-content-types');
    expect(commandArgs).toContain('--format=custom');
    expect(commandArgs).toContain('--exclude-table-data=public.auth_sessions');
    expect(commandArgs).toContain('--exclude-table-data=public.auth_login_attempts');
    expect(await service.databaseDumpSize(backupPath)).toBeGreaterThan(0);
    expect(await readFile(join(backupPath, 'checksums.sha256'), 'utf8')).toContain(
      'database/workbench.dump',
    );
  });

  it('rejects a modified file and refuses an active or non-empty restore target', async () => {
    const fakeRunner: CommandRunner = async (spec) => {
      const fileIndex = spec.args.indexOf('--file');
      await writeFile(spec.args[fileIndex + 1]!, 'database-dump', 'utf8');
    };
    const service = new BackupService(config, database, fakeRunner);
    const backupPath = await service.create();
    await writeFile(join(backupPath, 'config', 'app.yaml'), 'tampered: true\n', 'utf8');
    await expect(service.verify(backupPath)).rejects.toMatchObject({
      code: 'BACKUP_CHECKSUM_MISMATCH',
    });
    await expect(service.assertEmptyRestoreTarget(root)).rejects.toMatchObject({
      code: 'RESTORE_TARGET_ACTIVE',
    });

    const occupied = join(root, 'occupied-target');
    await writeFile(occupied, 'not-a-directory', 'utf8');
    await expect(service.assertEmptyRestoreTarget(occupied)).rejects.toThrow();
  });
});
