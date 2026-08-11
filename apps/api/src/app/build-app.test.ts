import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig, type AppConfig } from '../config.js';
import { AuthRepository } from '../platform/auth/repository.js';
import { AuthService } from '../platform/auth/service.js';
import { createDatabase } from '../platform/database/database.js';
import { runMigrations } from '../platform/database/migrate.js';
import type { Database } from '../platform/database/types.js';
import { initializeWorkspace } from '../platform/workspace/workspace.js';
import { buildApp } from './build-app.js';

class CookieJar {
  private readonly values = new Map<string, string>();

  public absorb(header: string | string[] | undefined): void {
    for (const cookie of typeof header === 'string' ? [header] : (header ?? [])) {
      const pair = cookie.split(';', 1)[0];
      if (!pair) continue;
      const separator = pair.indexOf('=');
      if (separator < 1) continue;
      this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  public header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

describe('workbench HTTP vertical slice', () => {
  let root: string;
  let database: Database;
  let app: FastifyInstance;
  let config: AppConfig;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-api-test-'));
    config = loadConfig({
      nodeEnv: 'test',
      databaseInMemory: true,
      workbenchRoot: root,
      appOrigin: 'http://localhost:5173',
      cookieSecure: false,
      logLevel: 'silent',
    });
    await initializeWorkspace(config);
    database = await createDatabase(config);
    await runMigrations(database);
    await new AuthService(new AuthRepository(database), config).initializeOwner(
      'correct horse battery staple',
    );
    app = await buildApp({ config, database, startSchedulers: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  it('enforces authentication, origin and CSRF while completing countdown CRUD', async () => {
    const anonymous = await app.inject({ method: 'GET', url: '/api/v1/countdowns' });
    expect(anonymous.statusCode).toBe(401);

    const jar = new CookieJar();
    const csrf = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    expect(csrf.statusCode).toBe(200);
    jar.absorb(csrf.headers['set-cookie']);
    const csrfToken = csrf.json<{ csrfToken: string }>().csrfToken;

    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0',
      },
      payload: { username: 'owner', password: 'correct horse battery staple', remember: true },
    });
    expect(login.statusCode).toBe(200);
    const sessionCookie = login.headers['set-cookie'];
    expect(JSON.stringify(sessionCookie)).toContain('HttpOnly');
    expect(JSON.stringify(sessionCookie)).toContain('Max-Age=');
    jar.absorb(sessionCookie);

    const stored = await database.query<{ current_token_hash: string }>(
      'SELECT current_token_hash FROM auth_sessions LIMIT 1',
    );
    expect(stored.rows[0]?.current_token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(jar.header()).not.toContain(stored.rows[0]?.current_token_hash ?? 'not-present');

    const missingOrigin = await app.inject({
      method: 'POST',
      url: '/api/v1/countdowns',
      headers: { cookie: jar.header(), 'x-csrf-token': csrfToken },
      payload: { title: '论文提交', targetAt: '2030-06-01T01:00:00.000Z' },
    });
    expect(missingOrigin.statusCode).toBe(403);
    expect(missingOrigin.json().error.code).toBe('ORIGIN_MISMATCH');

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/countdowns',
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: {
        title: ' 论文提交 ',
        note: '检查最终 PDF',
        targetAt: '2030-06-01T01:00:00.000Z',
        priority: 80,
      },
    });
    expect(created.statusCode).toBe(201);
    const countdown = created.json<{ id: string; title: string; version: number }>();
    expect(countdown.title).toBe('论文提交');
    expect(countdown.version).toBe(1);

    const listed = await app.inject({
      method: 'GET',
      url: '/api/v1/countdowns?limit=10',
      headers: { cookie: jar.header() },
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);

    const overview = await app.inject({
      method: 'GET',
      url: '/api/v1/workbench/overview',
      headers: { cookie: jar.header() },
    });
    expect(overview.statusCode).toBe(200);
    expect(overview.body).toContain('论文提交');

    const conflict = await app.inject({
      method: 'PUT',
      url: `/api/v1/countdowns/${countdown.id}`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { title: '错误版本', version: 999 },
    });
    expect(conflict.statusCode).toBe(409);

    const updated = await app.inject({
      method: 'PUT',
      url: `/api/v1/countdowns/${countdown.id}`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { status: 'completed', version: 1 },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().status).toBe('completed');

    const search = await app.inject({
      method: 'GET',
      url: '/api/v1/workbench/search?query=%E8%AE%BA%E6%96%87',
      headers: { cookie: jar.header() },
    });
    expect(search.statusCode).toBe(200);
    expect(search.body).toContain('论文提交');

    const archived = await app.inject({
      method: 'POST',
      url: `/api/v1/countdowns/${countdown.id}/archive`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { version: 2 },
    });
    expect(archived.statusCode).toBe(204);

    const archivedList = await app.inject({
      method: 'GET',
      url: '/api/v1/countdowns?status=archived',
      headers: { cookie: jar.header() },
    });
    expect(archivedList.statusCode).toBe(200);
    expect(archivedList.json().items).toMatchObject([
      { id: countdown.id, status: 'archived', version: 3 },
    ]);

    const archivedDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/countdowns/${countdown.id}`,
      headers: { cookie: jar.header() },
    });
    expect(archivedDetail.statusCode).toBe(200);
    expect(archivedDetail.json().status).toBe('archived');

    const restored = await app.inject({
      method: 'POST',
      url: `/api/v1/countdowns/${countdown.id}/restore`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { version: 3 },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ status: 'completed', version: 4 });

    const deleteBeforeArchive = await app.inject({
      method: 'DELETE',
      url: `/api/v1/countdowns/${countdown.id}`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { version: 4 },
    });
    expect(deleteBeforeArchive.statusCode).toBe(409);

    const rearchived = await app.inject({
      method: 'POST',
      url: `/api/v1/countdowns/${countdown.id}/archive`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { version: 4 },
    });
    expect(rearchived.statusCode).toBe(204);

    const permanentlyDeleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/countdowns/${countdown.id}`,
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { version: 5 },
    });
    expect(permanentlyDeleted.statusCode).toBe(204);

    const deletedDetail = await app.inject({
      method: 'GET',
      url: `/api/v1/countdowns/${countdown.id}`,
      headers: { cookie: jar.header() },
    });
    expect(deletedDetail.statusCode).toBe(404);
  });
});
