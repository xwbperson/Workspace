import { constants } from 'node:fs';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import type { AppConfig } from '../../config.js';

const WORKSPACE_META = '.workbench-workspace.json';
const REQUIRED_DIRECTORIES = [
  'config/features',
  'secrets',
  'database/postgres',
  'storage/objects',
  'storage/quarantine',
  'backups/local',
  'exports',
  'logs',
  'migration-reports',
  'runtime',
  'temp',
] as const;

interface WorkspaceMetadata {
  workspaceId: string;
  formatVersion: number;
  createdAt: string;
}

function assertWorkspaceMetadata(
  value: unknown,
  expectedWorkspaceId: string,
): asserts value is WorkspaceMetadata {
  if (!value || typeof value !== 'object') throw new Error('工作区元数据格式无效。');
  const metadata = value as Partial<WorkspaceMetadata>;
  if (metadata.workspaceId !== expectedWorkspaceId) {
    throw new Error(
      `工作区 ID 不匹配：目录为 ${String(metadata.workspaceId)}，配置为 ${expectedWorkspaceId}。`,
    );
  }
  if (metadata.formatVersion !== 1) {
    throw new Error(`不支持的工作区格式版本：${String(metadata.formatVersion)}。`);
  }
  if (typeof metadata.createdAt !== 'string' || Number.isNaN(Date.parse(metadata.createdAt))) {
    throw new Error('工作区创建时间无效。');
  }
}

export async function initializeWorkspace(config: AppConfig): Promise<WorkspaceMetadata> {
  await mkdir(config.workbenchRoot, { recursive: true });
  for (const directory of REQUIRED_DIRECTORIES) {
    await mkdir(join(config.workbenchRoot, directory), { recursive: true });
  }

  const metadataPath = join(config.workbenchRoot, WORKSPACE_META);
  let metadata: WorkspaceMetadata;
  try {
    const storedMetadata: unknown = JSON.parse(await readFile(metadataPath, 'utf8'));
    assertWorkspaceMetadata(storedMetadata, config.workspaceId);
    metadata = storedMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    metadata = {
      workspaceId: config.workspaceId,
      formatVersion: 1,
      createdAt: new Date().toISOString(),
    };
    await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
  }

  const appConfigPath = join(config.workbenchRoot, 'config', 'app.yaml');
  try {
    await access(appConfigPath, constants.F_OK);
  } catch {
    await writeFile(
      appConfigPath,
      stringifyYaml({
        workspaceId: config.workspaceId,
        formatVersion: 1,
      }),
      { encoding: 'utf8', flag: 'wx' },
    );
  }

  return metadata;
}

export async function validateWorkspace(config: AppConfig): Promise<WorkspaceMetadata> {
  const metadataPath = join(config.workbenchRoot, WORKSPACE_META);
  const metadata: unknown = JSON.parse(await readFile(metadataPath, 'utf8'));
  assertWorkspaceMetadata(metadata, config.workspaceId);
  for (const directory of REQUIRED_DIRECTORIES) {
    await access(
      join(config.workbenchRoot, directory),
      directory === 'database/postgres' ? constants.F_OK : constants.R_OK | constants.W_OK,
    );
  }
  return metadata;
}
