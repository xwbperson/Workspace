import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../../config.js';
import { createDatabase } from '../database/database.js';
import { runMigrations } from '../database/migrate.js';
import type { Database } from '../database/types.js';
import { initializeWorkspace } from '../workspace/workspace.js';
import { registerFileRoutes } from './routes.js';
import { FileStorageService } from './service.js';

describe('file content delivery', () => {
  let root: string;
  let config: AppConfig;
  let database: Database;
  let files: FileStorageService;
  let app: FastifyInstance;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-file-routes-test-'));
    config = loadConfig({
      nodeEnv: 'test',
      databaseInMemory: true,
      workbenchRoot: root,
      logLevel: 'silent',
    });
    await initializeWorkspace(config);
    database = await createDatabase(config);
    await runMigrations(database);
    files = new FileStorageService(database, config, () => new Date('2026-08-20T00:00:00Z'));
    app = Fastify({ logger: false });
    await app.register(multipart, { limits: { files: 1, fileSize: 50 * 1024 * 1024 } });
    await registerFileRoutes(app, files);
    await app.ready();
  });

  it('accepts a multipart upload and stores the streamed bytes', async () => {
    const boundary = '----workbench-test-boundary';
    const fileContent = Buffer.from('streamed upload content');
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="notes.txt"\r\nContent-Type: text/plain\r\n\r\n`,
      ),
      fileContent,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploaded = await app.inject({
      method: 'POST',
      url: '/api/v1/files',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });

    expect(uploaded.statusCode).toBe(201);
    const body = uploaded.json<{ id: string; originalName: string; size: number }>();
    expect(body).toMatchObject({ originalName: 'notes.txt', size: fileContent.length });
    const downloaded = await app.inject({
      method: 'GET',
      url: `/api/v1/files/${body.id}/content`,
    });
    expect(downloaded.rawPayload).toEqual(fileContent);
  });

  afterEach(async () => {
    await app.close();
    await database.end();
    await rm(root, { recursive: true, force: true });
  });

  it('supports full, conditional and byte-range reads for a PDF', async () => {
    const stored = await files.store({
      stream: Readable.from(Buffer.from('0123456789')),
      filename: '课程资料.pdf',
      mimeType: 'application/pdf',
    });
    const url = `/api/v1/files/${stored.id}/content`;

    const full = await app.inject({ method: 'GET', url });
    expect(full.statusCode).toBe(200);
    expect(full.rawPayload).toEqual(Buffer.from('0123456789'));
    expect(full.headers['accept-ranges']).toBe('bytes');
    expect(full.headers['content-disposition']).toContain('inline');
    expect(full.headers.etag).toMatch(/^"[a-f0-9]{64}"$/);

    const partial = await app.inject({ method: 'GET', url, headers: { range: 'bytes=2-5' } });
    expect(partial.statusCode).toBe(206);
    expect(partial.rawPayload).toEqual(Buffer.from('2345'));
    expect(partial.headers['content-range']).toBe('bytes 2-5/10');
    expect(partial.headers['content-length']).toBe('4');

    const suffix = await app.inject({ method: 'GET', url, headers: { range: 'bytes=-3' } });
    expect(suffix.statusCode).toBe(206);
    expect(suffix.rawPayload).toEqual(Buffer.from('789'));

    const unchanged = await app.inject({
      method: 'GET',
      url,
      headers: { 'if-none-match': String(full.headers.etag) },
    });
    expect(unchanged.statusCode).toBe(304);
    expect(unchanged.rawPayload).toHaveLength(0);
  });

  it('rejects unsatisfiable ranges and downloads active content types as attachments', async () => {
    const stored = await files.store({
      stream: Readable.from(Buffer.from('<script>bad()</script>')),
      filename: "reader's page.html",
      mimeType: 'text/html',
    });
    const url = `/api/v1/files/${stored.id}/content`;

    const unsafe = await app.inject({ method: 'GET', url });
    expect(unsafe.statusCode).toBe(200);
    expect(unsafe.headers['content-disposition']).toContain('attachment');
    expect(unsafe.headers['content-disposition']).toContain('reader%27s%20page.html');
    expect(unsafe.headers['x-content-type-options']).toBe('nosniff');

    const invalid = await app.inject({ method: 'GET', url, headers: { range: 'bytes=99-100' } });
    expect(invalid.statusCode).toBe(416);
    expect(invalid.headers['content-range']).toBe('bytes */22');
  });
});
