import { mkdtemp, mkdir, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import type { QueryResultRow } from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../config.js';
import { createDatabase } from '../database/database.js';
import { runMigrations } from '../database/migrate.js';
import type { Database } from '../database/types.js';
import { initializeWorkspace } from '../workspace/workspace.js';
import { FileStorageService } from './service.js';

async function readStream(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}

describe('file storage streaming', () => {
  let root: string;
  let config: AppConfig;
  let database: Database;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-files-test-'));
    config = loadConfig({
      nodeEnv: 'test',
      databaseInMemory: true,
      workbenchRoot: root,
      logLevel: 'silent',
    });
    await initializeWorkspace(config);
    database = await createDatabase(config);
    await runMigrations(database);
  });

  afterEach(async () => {
    await database.end();
    await rm(root, { recursive: true, force: true });
  });

  it('streams content to object storage and serves byte ranges without buffering the file', async () => {
    const service = new FileStorageService(
      database,
      config,
      () => new Date('2026-08-20T00:00:00Z'),
    );
    const stored = await service.store({
      stream: Readable.from(Buffer.from('0123456789')),
      filename: '../report.pdf',
      mimeType: 'Application/PDF; charset=binary',
    });

    expect(stored).toMatchObject({
      originalName: 'report.pdf',
      mimeType: 'application/pdf',
      size: 10,
    });
    const opened = await service.open(stored.id);
    expect(opened.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(await readStream(opened.createStream({ start: 2, end: 5 }))).toEqual(
      Buffer.from('2345'),
    );
    expect(await readdir(join(root, 'storage', 'quarantine'))).toEqual([]);
  });

  it('rejects oversized or truncated streams and removes partial quarantine files', async () => {
    const service = new FileStorageService(database, config, () => new Date(), 4);

    await expect(
      service.store({
        stream: Readable.from(Buffer.from('12345')),
        filename: 'large.bin',
        mimeType: 'application/octet-stream',
      }),
    ).rejects.toMatchObject({ statusCode: 413, code: 'FILE_TOO_LARGE' });
    await expect(
      service.store({
        stream: Readable.from(Buffer.from('1234')),
        filename: 'truncated.bin',
        mimeType: 'application/octet-stream',
        isTruncated: () => true,
      }),
    ).rejects.toMatchObject({ statusCode: 413, code: 'FILE_TOO_LARGE' });

    expect(await readdir(join(root, 'storage', 'quarantine'))).toEqual([]);
    const rows = await database.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM stored_files',
    );
    expect(Number(rows.rows[0]?.count)).toBe(0);
  });

  it('rejects empty files without creating metadata or an object', async () => {
    const service = new FileStorageService(database, config);
    await expect(
      service.store({
        stream: Readable.from(Buffer.alloc(0)),
        filename: 'empty.txt',
        mimeType: 'text/plain',
      }),
    ).rejects.toMatchObject({ statusCode: 400, code: 'EMPTY_FILE' });

    expect(await readdir(join(root, 'storage', 'quarantine'))).toEqual([]);
    expect(await readdir(join(root, 'storage', 'objects'))).toEqual([]);
  });

  it('removes expired unreferenced metadata and raw objects without deleting shared content', async () => {
    let current = new Date('2030-01-01T00:00:00.000Z');
    const service = new FileStorageService(database, config, () => current);
    const orphan = await service.store({
      stream: Readable.from(Buffer.from('same contents')),
      filename: 'orphan.txt',
      mimeType: 'text/plain',
    });
    const referenced = await service.store({
      stream: Readable.from(Buffer.from('same contents')),
      filename: 'cover.txt',
      mimeType: 'text/plain',
    });
    const referencedStorage = await database.query<{ storage_key: string }>(
      'SELECT storage_key FROM stored_files WHERE id=$1',
      [referenced.id],
    );
    await database.query('UPDATE stored_files SET storage_key=$2 WHERE id=$1', [
      referenced.id,
      referencedStorage.rows[0]!.storage_key.replaceAll('/', '\\'),
    ]);
    await database.query(
      `INSERT INTO books (id,title,cover_file_id,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$4)`,
      ['00000000-0000-4000-8000-000000000099', '保留附件的书籍', referenced.id, current],
    );

    const rawDirectory = join(root, 'storage', 'objects', 'raw');
    const rawPath = join(rawDirectory, 'untracked-object');
    await mkdir(rawDirectory, { recursive: true });
    await writeFile(rawPath, 'left by an interrupted upload');
    await utimes(rawPath, current, current);

    current = new Date('2030-01-03T00:00:00.000Z');
    const result = await service.cleanupOrphans();

    expect(result).toEqual({ metadataRowsRemoved: 1, objectFilesRemoved: 1 });
    await expect(service.get(orphan.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.open(referenced.id)).resolves.toMatchObject({
      file: { id: referenced.id },
    });
    await expect(statOrMissing(rawPath)).resolves.toBe(false);
  });

  it('does not delete orphan files while a backup owns the maintenance lock', async () => {
    let current = new Date('2030-01-01T00:00:00.000Z');
    const service = new FileStorageService(database, config, () => current);
    const orphan = await service.store({
      stream: Readable.from(Buffer.from('backup must retain this object')),
      filename: 'backup-proof.txt',
      mimeType: 'text/plain',
    });
    current = new Date('2030-01-03T00:00:00.000Z');
    await writeFile(
      join(root, 'runtime', 'backup.lock'),
      `${JSON.stringify({ pid: process.pid, startedAt: current.toISOString() })}\n`,
      'utf8',
    );

    await expect(service.cleanupOrphans()).resolves.toEqual({
      metadataRowsRemoved: 0,
      objectFilesRemoved: 0,
    });
    await expect(service.open(orphan.id)).resolves.toMatchObject({ file: { id: orphan.id } });

    await rm(join(root, 'runtime', 'backup.lock'));
    await expect(service.cleanupOrphans()).resolves.toEqual({
      metadataRowsRemoved: 1,
      objectFilesRemoved: 1,
    });
  });

  it('serializes object cleanup with the final stage of a concurrent upload', async () => {
    let reachedInsert!: () => void;
    const insertReached = new Promise<void>((resolvePromise) => {
      reachedInsert = resolvePromise;
    });
    let releaseInsert!: () => void;
    const insertReleased = new Promise<void>((resolvePromise) => {
      releaseInsert = resolvePromise;
    });
    const coordinatedDatabase: Database = {
      query: async <R extends QueryResultRow>(text: string, values?: readonly unknown[]) => {
        if (text.includes('INSERT INTO stored_files')) {
          reachedInsert();
          await insertReleased;
        }
        return database.query<R>(text, values);
      },
      connect: () => database.connect(),
      end: () => database.end(),
    };
    const service = new FileStorageService(
      coordinatedDatabase,
      config,
      () => new Date('2030-01-01T00:00:00.000Z'),
    );

    const storing = service.store({
      stream: Readable.from(Buffer.from('concurrent contents')),
      filename: 'concurrent.txt',
      mimeType: 'text/plain',
    });
    await insertReached;
    const cleanup = service.cleanupOrphans(0);
    releaseInsert();

    const [stored] = await Promise.all([storing, cleanup]);
    await expect(service.open(stored.id)).resolves.toMatchObject({ file: { id: stored.id } });
  });
});

async function statOrMissing(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}
