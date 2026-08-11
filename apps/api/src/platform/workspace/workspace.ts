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

export async function initializeWorkspace(config: AppConfig): Promise<WorkspaceMetadata> {
  await mkdir(config.workbenchRoot, { recursive: true });
  for (const directory of REQUIRED_DIRECTORIES) {
    await mkdir(join(config.workbenchRoot, directory), { recursive: true });
  }

  const metadataPath = join(config.workbenchRoot, WORKSPACE_META);
  let metadata: WorkspaceMetadata;
  try {
    metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as WorkspaceMetadata;
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

  if (metadata.workspaceId !== config.workspaceId) {
    throw new Error(
      `工作区 ID 不匹配：目录为 ${metadata.workspaceId}，配置为 ${config.workspaceId}。`,
    );
  }
  if (metadata.formatVersion !== 1) {
    throw new Error(`不支持的工作区格式版本：${metadata.formatVersion}。`);
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
        features: { countdowns: { enabled: true } },
      }),
      { encoding: 'utf8', flag: 'wx' },
    );
  }

  return metadata;
}

export async function validateWorkspace(config: AppConfig): Promise<WorkspaceMetadata> {
  const metadataPath = join(config.workbenchRoot, WORKSPACE_META);
  const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as WorkspaceMetadata;
  if (metadata.workspaceId !== config.workspaceId) {
    throw new Error(
      `工作区 ID 不匹配：目录为 ${metadata.workspaceId}，配置为 ${config.workspaceId}。`,
    );
  }
  for (const directory of REQUIRED_DIRECTORIES) {
    await access(
      join(config.workbenchRoot, directory),
      directory === 'database/postgres' ? constants.F_OK : constants.R_OK | constants.W_OK,
    );
  }
  return metadata;
}
