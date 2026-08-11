import { password as promptPassword } from '@inquirer/prompts';
import { databaseUrlWithPasswordFile, loadConfig } from '../config.js';
import { AuthRepository } from '../platform/auth/repository.js';
import { AuthService } from '../platform/auth/service.js';
import { BackupService } from '../platform/backup/backup-service.js';
import { createDatabase } from '../platform/database/database.js';
import { runMigrations } from '../platform/database/migrate.js';
import { initializeWorkspace, validateWorkspace } from '../platform/workspace/workspace.js';

const [scope, command, ...args] = process.argv.slice(2);
const config = loadConfig();

async function main(): Promise<void> {
  if (scope === 'workspace' && command === 'init') {
    const metadata = await initializeWorkspace(config);
    process.stdout.write(`工作区已就绪：${metadata.workspaceId}\n`);
    return;
  }

  await validateWorkspace(config);
  const database = await createDatabase(config);
  try {
    const migration = await runMigrations(database);
    if (scope === 'db' && command === 'migrate') {
      process.stdout.write(`数据库迁移已完成：${migration}\n`);
      return;
    }

    const auth = new AuthService(new AuthRepository(database), config);
    if (scope === 'auth' && command === 'init-owner') {
      const first = await promptPassword({
        message: '设置 owner 密码（至少 12 个字符）',
        mask: '*',
      });
      const second = await promptPassword({ message: '再次输入密码', mask: '*' });
      if (first !== second) throw new Error('两次输入的密码不一致。');
      await auth.initializeOwner(first);
      process.stdout.write('固定 owner 账户已初始化。\n');
      return;
    }
    if (scope === 'auth' && command === 'reset-owner-password') {
      const first = await promptPassword({ message: '设置新的 owner 密码', mask: '*' });
      const second = await promptPassword({ message: '再次输入新密码', mask: '*' });
      if (first !== second) throw new Error('两次输入的密码不一致。');
      await auth.resetOwnerPassword(first);
      process.stdout.write('密码已重置，全部登录会话已撤销。\n');
      return;
    }

    const backup = new BackupService(config, database);
    if (scope === 'backup' && command === 'create') {
      process.stdout.write(`${await backup.create()}\n`);
      return;
    }
    if (scope === 'backup' && command === 'verify') {
      const backupPath = args[0];
      if (!backupPath) throw new Error('请提供备份目录路径。');
      const manifest = await backup.verify(backupPath);
      process.stdout.write(`备份校验通过：${manifest.backupId}\n`);
      return;
    }
    if (scope === 'backup' && command === 'restore') {
      const backupPath = args[0];
      const targetRoot = args[1];
      const rawTargetDatabaseUrl = process.env.RESTORE_DATABASE_URL;
      const restorePasswordFile = process.env.RESTORE_DATABASE_PASSWORD_FILE;
      if (!backupPath || !targetRoot) {
        throw new Error('请提供备份目录和新的空工作区目录。');
      }
      if (!rawTargetDatabaseUrl) {
        throw new Error('请通过 RESTORE_DATABASE_URL 提供新的空 PostgreSQL 数据库连接。');
      }
      const targetDatabaseUrl = restorePasswordFile
        ? databaseUrlWithPasswordFile(rawTargetDatabaseUrl, restorePasswordFile)
        : rawTargetDatabaseUrl;
      const result = await backup.restore(backupPath, targetRoot, targetDatabaseUrl);
      process.stdout.write(`恢复完成：${result.reportPath}\n`);
      return;
    }

    throw new Error(
      '未知命令。可用命令：workspace init、db migrate、auth init-owner、auth reset-owner-password、backup create、backup verify <path>、backup restore <path> <empty-root>。',
    );
  } finally {
    await database.end();
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : '命令执行失败。'}\n`);
  process.exitCode = 1;
}
