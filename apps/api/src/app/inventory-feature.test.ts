import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance, InjectOptions } from 'fastify';
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
      if (separator > 0) this.values.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  public header(): string {
    return [...this.values].map(([name, value]) => `${name}=${value}`).join('; ');
  }
}

describe('inventory feature vertical slice', () => {
  let root: string;
  let database: Database;
  let app: FastifyInstance;
  let config: AppConfig;
  let jar: CookieJar;
  let csrfToken: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-inventory-test-'));
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

    jar = new CookieJar();
    const csrf = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
    jar.absorb(csrf.headers['set-cookie']);
    csrfToken = csrf.json<{ csrfToken: string }>().csrfToken;
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        cookie: jar.header(),
        origin: config.appOrigin,
        'x-csrf-token': csrfToken,
      },
      payload: { username: 'owner', password: 'correct horse battery staple', remember: true },
    });
    expect(login.statusCode).toBe(200);
    jar.absorb(login.headers['set-cookie']);
  });

  afterEach(async () => {
    await app.close();
    await rm(root, { recursive: true, force: true });
  });

  const inject = (options: InjectOptions) =>
    app.inject({
      ...options,
      headers: {
        cookie: jar.header(),
        ...(options.method && options.method !== 'GET'
          ? { origin: config.appOrigin, 'x-csrf-token': csrfToken }
          : {}),
        ...options.headers,
      },
    });

  it('creates grouped and ungrouped items and keeps a zero-quantity item', async () => {
    const groupResponse = await inject({
      method: 'POST',
      url: '/api/v1/inventory-groups',
      payload: { name: '收纳箱' },
    });
    expect(groupResponse.statusCode, groupResponse.body).toBe(201);
    const group = groupResponse.json<{ id: string }>();

    const groupedResponse = await inject({
      method: 'POST',
      url: '/api/v1/inventory-items',
      payload: {
        name: '备用数据线',
        purpose: '连接移动硬盘',
        note: '放在透明袋里',
        quantity: 2,
        groupId: group.id,
      },
    });
    expect(groupedResponse.statusCode, groupedResponse.body).toBe(201);
    const grouped = groupedResponse.json<{ id: string }>();
    expect(groupedResponse.json()).toMatchObject({
      name: '备用数据线',
      purpose: '连接移动硬盘',
      note: '放在透明袋里',
      quantity: 2,
      group: { id: group.id, name: '收纳箱' },
      status: 'active',
      version: 1,
    });

    const ungroupedResponse = await inject({
      method: 'POST',
      url: '/api/v1/inventory-items',
      payload: { name: '空墨盒', quantity: 0 },
    });
    expect(ungroupedResponse.statusCode, ungroupedResponse.body).toBe(201);
    const ungrouped = ungroupedResponse.json<{ id: string }>();
    expect(ungroupedResponse.json()).toMatchObject({ quantity: 0, group: null });

    const decreased = await inject({
      method: 'POST',
      url: `/api/v1/inventory-items/${grouped.id}/adjust-quantity`,
      payload: { delta: -1 },
    });
    expect(decreased.statusCode, decreased.body).toBe(200);
    expect(decreased.json()).toMatchObject({ quantity: 1, version: 2 });

    const stillZero = await inject({
      method: 'POST',
      url: `/api/v1/inventory-items/${ungrouped.id}/adjust-quantity`,
      payload: { delta: -1 },
    });
    expect(stillZero.statusCode, stillZero.body).toBe(200);
    expect(stillZero.json()).toMatchObject({ id: ungrouped.id, quantity: 0, version: 2 });

    const zeroList = await inject({
      method: 'GET',
      url: '/api/v1/inventory-items?status=active&stock=zero',
    });
    expect(zeroList.statusCode, zeroList.body).toBe(200);
    expect(zeroList.json()).toMatchObject({
      summary: { kinds: 1, totalQuantity: 0, zeroQuantity: 1 },
      items: [{ id: ungrouped.id, name: '空墨盒', quantity: 0 }],
    });
  });

  it('updates, archives, restores and permanently deletes an item', async () => {
    const createdResponse = await inject({
      method: 'POST',
      url: '/api/v1/inventory-items',
      payload: { name: '旧名称', purpose: '', note: '', quantity: 3 },
    });
    const created = createdResponse.json<{ id: string; version: number }>();

    const updatedResponse = await inject({
      method: 'PUT',
      url: `/api/v1/inventory-items/${created.id}`,
      payload: {
        name: '螺丝刀',
        purpose: '拆装设备',
        note: '十字头',
        quantity: 4,
        groupId: null,
        version: created.version,
      },
    });
    expect(updatedResponse.statusCode, updatedResponse.body).toBe(200);
    const updated = updatedResponse.json<{ version: number }>();
    expect(updatedResponse.json()).toMatchObject({
      name: '螺丝刀',
      purpose: '拆装设备',
      note: '十字头',
      quantity: 4,
      version: 2,
    });

    const archived = await inject({
      method: 'POST',
      url: `/api/v1/inventory-items/${created.id}/archive`,
      payload: { version: updated.version },
    });
    expect(archived.statusCode, archived.body).toBe(204);

    const archivedList = await inject({
      method: 'GET',
      url: '/api/v1/inventory-items?status=archived',
    });
    const archivedItem = archivedList.json<{ items: Array<{ id: string; version: number }> }>()
      .items[0]!;
    expect(archivedItem.id).toBe(created.id);

    const restore = await inject({
      method: 'POST',
      url: `/api/v1/inventory-items/${created.id}/restore`,
      payload: { version: archivedItem.version },
    });
    expect(restore.statusCode, restore.body).toBe(200);
    expect(restore.json()).toMatchObject({ status: 'active', version: 4 });

    const cannotDeleteActive = await inject({
      method: 'DELETE',
      url: `/api/v1/inventory-items/${created.id}`,
      payload: { version: 4 },
    });
    expect(cannotDeleteActive.statusCode).toBe(409);

    await inject({
      method: 'POST',
      url: `/api/v1/inventory-items/${created.id}/archive`,
      payload: { version: 4 },
    });
    const removed = await inject({
      method: 'DELETE',
      url: `/api/v1/inventory-items/${created.id}`,
      payload: { version: 5 },
    });
    expect(removed.statusCode, removed.body).toBe(204);
    expect(
      (await inject({ method: 'GET', url: `/api/v1/inventory-items/${created.id}` })).statusCode,
    ).toBe(404);
  });

  it('deletes only a group and moves all of its items to ungrouped', async () => {
    const groupResponse = await inject({
      method: 'POST',
      url: '/api/v1/inventory-groups',
      payload: { name: '书桌抽屉' },
    });
    const group = groupResponse.json<{ id: string; version: number }>();
    const itemResponse = await inject({
      method: 'POST',
      url: '/api/v1/inventory-items',
      payload: { name: '订书钉', quantity: 1, groupId: group.id },
    });
    const item = itemResponse.json<{ id: string }>();

    const removed = await inject({
      method: 'DELETE',
      url: `/api/v1/inventory-groups/${group.id}`,
      payload: { version: group.version },
    });
    expect(removed.statusCode, removed.body).toBe(204);

    const preserved = await inject({ method: 'GET', url: `/api/v1/inventory-items/${item.id}` });
    expect(preserved.statusCode, preserved.body).toBe(200);
    expect(preserved.json()).toMatchObject({ id: item.id, group: null, name: '订书钉' });
  });
});
