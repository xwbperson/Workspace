import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../config.js';
import { initializeWorkspace, validateWorkspace } from './workspace.js';

describe('workspace metadata validation', () => {
  let root: string | undefined;

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('rejects an unsupported workspace format during production validation', async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-workspace-test-'));
    const config = loadConfig({ nodeEnv: 'test', workbenchRoot: root });
    await initializeWorkspace(config);
    await writeFile(
      join(root, '.workbench-workspace.json'),
      `${JSON.stringify({
        workspaceId: config.workspaceId,
        formatVersion: 999,
        createdAt: new Date().toISOString(),
      })}\n`,
      'utf8',
    );

    await expect(validateWorkspace(config)).rejects.toThrow('不支持的工作区格式版本：999');
  });
});
