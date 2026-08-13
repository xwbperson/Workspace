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

describe('checklists feature vertical slice', () => {
  let root: string;
  let database: Database;
  let app: FastifyInstance;
  let config: AppConfig;
  let jar: CookieJar;
  let csrfToken: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-checklists-test-'));
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

  it('creates a checklist, records optional shopping details and keeps unchecked items first', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/checklists',
      payload: { name: '周末采购', note: '超市与线上一起核对' },
    });
    expect(created.statusCode, created.body).toBe(201);
    const checklist = created.json<{ id: string; version: number }>();
    expect(created.json()).toMatchObject({
      name: '周末采购',
      note: '超市与线上一起核对',
      status: 'active',
      progress: { checked: 0, total: 0, percentage: 0 },
      amounts: { checked: 0, total: 0 },
      items: [],
      version: 1,
    });

    const milkResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '牛奶', note: '低脂', quantity: 2, unit: '盒', price: 9.9 },
    });
    expect(milkResponse.statusCode, milkResponse.body).toBe(201);
    const milk = milkResponse.json<{ id: string; version: number }>();

    const fruitResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '水果' },
    });
    expect(fruitResponse.statusCode, fruitResponse.body).toBe(201);

    const checked = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items/${milk.id}/check`,
      payload: { checked: true, version: milk.version },
    });
    expect(checked.statusCode, checked.body).toBe(200);
    expect(checked.json()).toMatchObject({ checked: true, version: 2 });

    const detail = await inject({ method: 'GET', url: `/api/v1/checklists/${checklist.id}` });
    expect(detail.statusCode, detail.body).toBe(200);
    expect(detail.json()).toMatchObject({
      progress: { checked: 1, total: 2, percentage: 50 },
      amounts: { checked: 19.8, total: 19.8 },
      items: [
        { name: '水果', checked: false },
        {
          id: milk.id,
          name: '牛奶',
          note: '低脂',
          quantity: 2,
          unit: '盒',
          price: 9.9,
          checked: true,
        },
      ],
    });
  });

  it('automatically completes a fully checked checklist and supports manual lifecycle changes', async () => {
    const automaticResponse = await inject({
      method: 'POST',
      url: '/api/v1/checklists',
      payload: { name: '自动完成清单' },
    });
    const automatic = automaticResponse.json<{ id: string; version: number }>();
    const automaticItemResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${automatic.id}/items`,
      payload: { name: '唯一条目' },
    });
    const automaticItem = automaticItemResponse.json<{ id: string; version: number }>();

    const checked = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${automatic.id}/items/${automaticItem.id}/check`,
      payload: { checked: true, version: automaticItem.version },
    });
    expect(checked.statusCode, checked.body).toBe(200);
    const automaticallyCompleted = await inject({
      method: 'GET',
      url: `/api/v1/checklists/${automatic.id}`,
    });
    expect(automaticallyCompleted.json()).toMatchObject({
      status: 'completed',
      version: 2,
      progress: { checked: 1, total: 1, percentage: 100 },
    });

    const manualResponse = await inject({
      method: 'POST',
      url: '/api/v1/checklists',
      payload: { name: '手动完成清单' },
    });
    const manual = manualResponse.json<{ id: string; version: number }>();
    await inject({
      method: 'POST',
      url: `/api/v1/checklists/${manual.id}/items`,
      payload: { name: '尚未完成的条目' },
    });
    const completed = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${manual.id}/complete`,
      payload: { version: manual.version },
    });
    expect(completed.statusCode, completed.body).toBe(200);
    expect(completed.json()).toMatchObject({
      status: 'completed',
      version: 2,
      progress: { checked: 0, total: 1, percentage: 0 },
    });

    const archived = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${manual.id}/archive`,
      payload: { version: 2 },
    });
    expect(archived.statusCode, archived.body).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${manual.id}/restore`,
      payload: { version: 3 },
    });
    expect(restored.statusCode, restored.body).toBe(200);
    expect(restored.json()).toMatchObject({ status: 'completed', version: 4 });

    const reopened = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${manual.id}/reopen`,
      payload: { version: 4 },
    });
    expect(reopened.statusCode, reopened.body).toBe(200);
    expect(reopened.json()).toMatchObject({ status: 'active', version: 5 });

    const completedList = await inject({
      method: 'GET',
      url: '/api/v1/checklists?status=completed',
    });
    expect(completedList.statusCode, completedList.body).toBe(200);
    expect(completedList.json().items).toMatchObject([{ id: automatic.id, status: 'completed' }]);
  });

  it('automatically completes when deleting the only remaining unchecked item', async () => {
    const createdResponse = await inject({
      method: 'POST',
      url: '/api/v1/checklists',
      payload: { name: '删除后完成' },
    });
    const checklist = createdResponse.json<{ id: string }>();
    const checkedItemResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '已完成项' },
    });
    const checkedItem = checkedItemResponse.json<{ id: string; version: number }>();
    const uncheckedItemResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '将删除项' },
    });
    const uncheckedItem = uncheckedItemResponse.json<{ id: string; version: number }>();
    await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items/${checkedItem.id}/check`,
      payload: { checked: true, version: checkedItem.version },
    });

    const removed = await inject({
      method: 'DELETE',
      url: `/api/v1/checklists/${checklist.id}/items/${uncheckedItem.id}`,
      payload: { version: uncheckedItem.version },
    });
    expect(removed.statusCode, removed.body).toBe(204);
    const detail = await inject({ method: 'GET', url: `/api/v1/checklists/${checklist.id}` });
    expect(detail.json()).toMatchObject({
      status: 'completed',
      version: 2,
      progress: { checked: 1, total: 1, percentage: 100 },
    });
  });

  it('edits items, resets every check and only clears checked items', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/checklists',
      payload: { name: '旅行行李' },
    });
    const checklist = created.json<{ id: string; version: number }>();
    const chargerResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '充电器' },
    });
    const charger = chargerResponse.json<{ id: string; version: number }>();
    const passportResponse = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '护照' },
    });
    const passport = passportResponse.json<{ id: string; version: number }>();

    const edited = await inject({
      method: 'PUT',
      url: `/api/v1/checklists/${checklist.id}/items/${charger.id}`,
      payload: {
        name: 'USB-C 充电器',
        note: '放入随身包',
        quantity: 2,
        unit: '个',
        price: 49.5,
        version: charger.version,
      },
    });
    expect(edited.statusCode, edited.body).toBe(200);
    expect(edited.json()).toMatchObject({ name: 'USB-C 充电器', version: 2 });

    const checkedCharger = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items/${charger.id}/check`,
      payload: { checked: true, version: 2 },
    });
    const checkedPassport = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items/${passport.id}/check`,
      payload: { checked: true, version: passport.version },
    });
    expect(checkedCharger.statusCode).toBe(200);
    expect(checkedPassport.statusCode).toBe(200);

    const reset = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/reset`,
      payload: { version: 2 },
    });
    expect(reset.statusCode, reset.body).toBe(200);
    expect(reset.json()).toMatchObject({
      version: 3,
      status: 'completed',
      progress: { checked: 0, total: 2, percentage: 0 },
      amounts: { checked: 0, total: 99 },
      items: [
        { id: charger.id, checked: false, version: 4 },
        { id: passport.id, checked: false, version: 3 },
      ],
    });

    const checkedAgain = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items/${charger.id}/check`,
      payload: { checked: true, version: 4 },
    });
    expect(checkedAgain.statusCode).toBe(200);

    const cleared = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/clear-checked`,
      payload: { version: 3 },
    });
    expect(cleared.statusCode, cleared.body).toBe(200);
    expect(cleared.json()).toMatchObject({
      version: 4,
      progress: { checked: 0, total: 1, percentage: 0 },
      amounts: { checked: 0, total: 0 },
      items: [{ id: passport.id, name: '护照', checked: false }],
    });
  });

  it('searches item text and enforces archive, restore and permanent deletion', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/checklists',
      payload: { name: '周末片单', note: '适合一个人看的电影' },
    });
    const checklist = created.json<{ id: string; version: number }>();
    await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/items`,
      payload: { name: '攻壳机动队', note: '先看 1995 剧场版' },
    });

    const search = await inject({
      method: 'GET',
      url: '/api/v1/workbench/search?query=%E6%94%BB%E5%A3%B3',
    });
    expect(search.statusCode, search.body).toBe(200);
    expect(search.body).toContain('周末片单');

    const updated = await inject({
      method: 'PUT',
      url: `/api/v1/checklists/${checklist.id}`,
      payload: { name: '经典动画片单', note: '按年代观看', version: checklist.version },
    });
    expect(updated.statusCode, updated.body).toBe(200);
    expect(updated.json()).toMatchObject({ name: '经典动画片单', version: 2 });

    const archived = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/archive`,
      payload: { version: 2 },
    });
    expect(archived.statusCode, archived.body).toBe(204);

    const archivedList = await inject({ method: 'GET', url: '/api/v1/checklists?status=archived' });
    expect(archivedList.json().items).toMatchObject([
      { id: checklist.id, status: 'archived', version: 3, items: [{ name: '攻壳机动队' }] },
    ]);

    const restore = await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/restore`,
      payload: { version: 3 },
    });
    expect(restore.statusCode, restore.body).toBe(200);
    expect(restore.json()).toMatchObject({ status: 'active', version: 4 });

    const prematureDelete = await inject({
      method: 'DELETE',
      url: `/api/v1/checklists/${checklist.id}`,
      payload: { version: 4 },
    });
    expect(prematureDelete.statusCode).toBe(409);

    await inject({
      method: 'POST',
      url: `/api/v1/checklists/${checklist.id}/archive`,
      payload: { version: 4 },
    });
    const removed = await inject({
      method: 'DELETE',
      url: `/api/v1/checklists/${checklist.id}`,
      payload: { version: 5 },
    });
    expect(removed.statusCode, removed.body).toBe(204);
    expect(
      (await inject({ method: 'GET', url: `/api/v1/checklists/${checklist.id}` })).statusCode,
    ).toBe(404);
  });
});
