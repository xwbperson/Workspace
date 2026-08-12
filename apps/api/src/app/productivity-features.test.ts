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

describe('productivity feature vertical slices', () => {
  let root: string;
  let database: Database;
  let app: FastifyInstance;
  let config: AppConfig;
  let jar: CookieJar;
  let csrfToken: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-productivity-test-'));
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

  const upload = async (filename: string, mimeType: string, contents: Buffer) => {
    const boundary = `----workbench-${Date.now()}-${filename.length}`;
    const payload = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
      ),
      contents,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return inject({
      method: 'POST',
      url: '/api/v1/files',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload,
    });
  };

  it('creates a metric-backed goal and records quick measurements for its trend', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/goals',
      payload: {
        title: '体重降到 70 公斤',
        periodType: 'quarterly',
        periodLabel: '2026 Q3',
        startDate: '2026-07-01',
        endDate: '2026-09-30',
        metric: {
          startValue: 80,
          targetValue: 70,
          currentValue: 78,
          unit: 'kg',
          direction: 'decrease',
        },
        keyResults: [{ id: 'kr-training', title: '每周训练三次', progress: 25, completed: false }],
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const goal = created.json<{ id: string; progress: number; version: number }>();
    expect(goal.progress).toBe(20);
    expect(goal.version).toBe(1);

    const measured = await inject({
      method: 'POST',
      url: `/api/v1/goals/${goal.id}/measurements`,
      payload: { value: 75, note: '晨起空腹', version: goal.version },
    });
    expect(measured.statusCode).toBe(201);
    expect(measured.json()).toMatchObject({
      metric: { currentValue: 75 },
      progress: 50,
      version: 2,
    });

    const detail = await inject({ method: 'GET', url: `/api/v1/goals/${goal.id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().measurements).toMatchObject([
      { value: 78, note: '初始值' },
      { value: 75, note: '晨起空腹' },
    ]);
  });

  it('edits, completes, searches, archives, restores and permanently deletes a goal', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/goals',
      payload: {
        title: '完成工作台第一版',
        periodType: 'annual',
        periodLabel: '2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const goal = created.json<{ id: string; version: number }>();

    const completed = await inject({
      method: 'PUT',
      url: `/api/v1/goals/${goal.id}`,
      payload: {
        status: 'completed',
        keyResults: [{ id: 'kr-release', title: '发布并通过验收', progress: 100, completed: true }],
        version: goal.version,
      },
    });
    expect(completed.statusCode, completed.body).toBe(200);
    expect(completed.json()).toMatchObject({ status: 'completed', progress: 100, version: 2 });

    const conflict = await inject({
      method: 'PUT',
      url: `/api/v1/goals/${goal.id}`,
      payload: { title: '过期修改', version: 1 },
    });
    expect(conflict.statusCode).toBe(409);

    const completedList = await inject({
      method: 'GET',
      url: '/api/v1/goals?status=completed',
    });
    expect(completedList.json().items).toMatchObject([{ id: goal.id, status: 'completed' }]);

    const search = await inject({
      method: 'GET',
      url: '/api/v1/workbench/search?query=%E5%B7%A5%E4%BD%9C%E5%8F%B0',
    });
    expect(search.statusCode).toBe(200);
    expect(search.body).toContain('完成工作台第一版');

    const archived = await inject({
      method: 'POST',
      url: `/api/v1/goals/${goal.id}/archive`,
      payload: { version: 2 },
    });
    expect(archived.statusCode).toBe(204);

    const restored = await inject({
      method: 'POST',
      url: `/api/v1/goals/${goal.id}/restore`,
      payload: { version: 3 },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ status: 'completed', version: 4 });

    const deleteBeforeArchive = await inject({
      method: 'DELETE',
      url: `/api/v1/goals/${goal.id}`,
      payload: { version: 4 },
    });
    expect(deleteBeforeArchive.statusCode).toBe(409);

    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/goals/${goal.id}/archive`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/goals/${goal.id}`,
          payload: { version: 5 },
        })
      ).statusCode,
    ).toBe(204);
    expect((await inject({ method: 'GET', url: `/api/v1/goals/${goal.id}` })).statusCode).toBe(404);
  });

  it('builds a multi-level task tree and generates the next repeated task on completion', async () => {
    const parentResponse = await inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: {
        title: '每周复盘',
        priority: 'high',
        dueAt: '2026-08-16T12:00:00.000Z',
        recurrence: 'weekly',
      },
    });
    expect(parentResponse.statusCode, parentResponse.body).toBe(201);
    const parent = parentResponse.json<{ id: string; version: number }>();

    const childResponse = await inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: '整理本周证据', parentId: parent.id, priority: 'medium' },
    });
    expect(childResponse.statusCode, childResponse.body).toBe(201);
    const child = childResponse.json<{ id: string }>();

    const grandchildResponse = await inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: '归档截图', parentId: child.id, priority: 'low' },
    });
    expect(grandchildResponse.statusCode, grandchildResponse.body).toBe(201);
    expect(grandchildResponse.json()).toMatchObject({ parentId: child.id });

    const completion = await inject({
      method: 'POST',
      url: `/api/v1/tasks/${parent.id}/complete`,
      payload: { version: parent.version },
    });
    expect(completion.statusCode, completion.body).toBe(200);
    expect(completion.json()).toMatchObject({
      completed: { id: parent.id, status: 'completed', version: 2 },
      nextTask: {
        title: '每周复盘',
        status: 'todo',
        priority: 'high',
        dueAt: '2026-08-23T12:00:00.000Z',
        recurrence: 'weekly',
      },
    });

    const openList = await inject({ method: 'GET', url: '/api/v1/tasks?status=open' });
    expect(openList.statusCode).toBe(200);
    expect(openList.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '每周复盘', status: 'todo' }),
        expect.objectContaining({ id: child.id, parentId: parent.id }),
        expect.objectContaining({ title: '归档截图', parentId: child.id }),
      ]),
    );
  });

  it('rejects cyclic task parenting and enforces the archive-before-delete lifecycle', async () => {
    const parentResponse = await inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: '父任务' },
    });
    const parent = parentResponse.json<{ id: string; version: number }>();
    const childResponse = await inject({
      method: 'POST',
      url: '/api/v1/tasks',
      payload: { title: '子任务', parentId: parent.id },
    });
    const child = childResponse.json<{ id: string; version: number }>();

    const cycle = await inject({
      method: 'PUT',
      url: `/api/v1/tasks/${parent.id}`,
      payload: { parentId: child.id, version: parent.version },
    });
    expect(cycle.statusCode).toBe(409);

    const stale = await inject({
      method: 'PUT',
      url: `/api/v1/tasks/${child.id}`,
      payload: { title: '错误版本', version: 99 },
    });
    expect(stale.statusCode).toBe(409);

    const deleteBeforeArchive = await inject({
      method: 'DELETE',
      url: `/api/v1/tasks/${child.id}`,
      payload: { version: child.version },
    });
    expect(deleteBeforeArchive.statusCode).toBe(409);

    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/tasks/${child.id}/archive`,
          payload: { version: child.version },
        })
      ).statusCode,
    ).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/tasks/${child.id}/restore`,
      payload: { version: 2 },
    });
    expect(restored.json()).toMatchObject({ status: 'todo', version: 3 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/tasks/${child.id}/archive`,
          payload: { version: 3 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/tasks/${child.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('places schedules, journal entries and daily summaries on a calendar date range', async () => {
    const schedule = await inject({
      method: 'POST',
      url: '/api/v1/calendar-entries',
      payload: {
        type: 'schedule',
        title: '课题组例会',
        entryDate: '2026-08-18',
        startsAt: '2026-08-18T06:00:00.000Z',
        endsAt: '2026-08-18T07:30:00.000Z',
        content: '汇报本周复现实验',
      },
    });
    expect(schedule.statusCode, schedule.body).toBe(201);
    const scheduleEntry = schedule.json<{ id: string; version: number }>();

    const journal = await inject({
      method: 'POST',
      url: '/api/v1/calendar-entries',
      payload: {
        type: 'journal',
        title: '今日记录',
        entryDate: '2026-08-18',
        content: '完成了数据清洗。',
      },
    });
    expect(journal.statusCode, journal.body).toBe(201);

    const summary = await inject({
      method: 'POST',
      url: '/api/v1/calendar-entries',
      payload: {
        type: 'summary',
        title: '8 月 18 日总结',
        entryDate: '2026-08-18',
        content: '今天的关键进展与明日安排。',
      },
    });
    expect(summary.statusCode, summary.body).toBe(201);

    const month = await inject({
      method: 'GET',
      url: '/api/v1/calendar-entries?from=2026-08-01&to=2026-08-31&status=active',
    });
    expect(month.statusCode).toBe(200);
    expect(month.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: '课题组例会', type: 'schedule' }),
        expect.objectContaining({ title: '今日记录', type: 'journal' }),
        expect.objectContaining({ title: '8 月 18 日总结', type: 'summary' }),
      ]),
    );

    const updated = await inject({
      method: 'PUT',
      url: `/api/v1/calendar-entries/${scheduleEntry.id}`,
      payload: { content: '改为汇报最小复现结果', version: scheduleEntry.version },
    });
    expect(updated.json()).toMatchObject({ content: '改为汇报最小复现结果', version: 2 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/calendar-entries/${scheduleEntry.id}/archive`,
          payload: { version: 2 },
        })
      ).statusCode,
    ).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/calendar-entries/${scheduleEntry.id}/restore`,
      payload: { version: 3 },
    });
    expect(restored.json()).toMatchObject({ status: 'active', version: 4 });
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/calendar-entries/${scheduleEntry.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(409);
  });

  it('collects ideas, links and authenticated files, then marks an item as processed', async () => {
    const uploaded = await upload('跨设备中转.txt', 'text/plain', Buffer.from('temporary note'));
    expect(uploaded.statusCode, uploaded.body).toBe(201);
    const file = uploaded.json<{ id: string; originalName: string }>();

    const ideaResponse = await inject({
      method: 'POST',
      url: '/api/v1/inbox-items',
      payload: { type: 'idea', title: '论文实验的新对照组', content: '增加一个无预训练基线。' },
    });
    expect(ideaResponse.statusCode, ideaResponse.body).toBe(201);

    const linkResponse = await inject({
      method: 'POST',
      url: '/api/v1/inbox-items',
      payload: { type: 'link', title: 'PostgreSQL 文档', url: 'https://www.postgresql.org/docs/' },
    });
    expect(linkResponse.statusCode, linkResponse.body).toBe(201);
    const link = linkResponse.json<{ id: string; version: number }>();

    const fileResponse = await inject({
      method: 'POST',
      url: '/api/v1/inbox-items',
      payload: { type: 'file', title: '跨设备中转', fileId: file.id },
    });
    expect(fileResponse.statusCode, fileResponse.body).toBe(201);
    expect(fileResponse.json()).toMatchObject({
      file: { id: file.id, originalName: '跨设备中转.txt' },
    });
    const downloaded = await inject({ method: 'GET', url: `/api/v1/files/${file.id}/content` });
    expect(downloaded.statusCode).toBe(200);
    expect(downloaded.rawPayload.toString()).toBe('temporary note');

    const processed = await inject({
      method: 'PUT',
      url: `/api/v1/inbox-items/${link.id}`,
      payload: { status: 'processed', version: link.version },
    });
    expect(processed.statusCode).toBe(200);
    expect(processed.json()).toMatchObject({ status: 'processed', version: 2 });

    const inbox = await inject({ method: 'GET', url: '/api/v1/inbox-items?status=inbox' });
    expect(inbox.json().items).toHaveLength(2);
    const search = await inject({
      method: 'GET',
      url: '/api/v1/workbench/search?query=%E5%AF%B9%E7%85%A7%E7%BB%84',
    });
    expect(search.body).toContain('论文实验的新对照组');

    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/inbox-items/${link.id}/archive`,
          payload: { version: 2 },
        })
      ).statusCode,
    ).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/inbox-items/${link.id}/restore`,
      payload: { version: 3 },
    });
    expect(restored.json()).toMatchObject({ status: 'processed', version: 4 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/inbox-items/${link.id}/archive`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/inbox-items/${link.id}`,
          payload: { version: 5 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('collects information and other inbox content types', async () => {
    for (const [type, title] of [
      ['information', '课程调整信息'],
      ['other', '暂未分类内容'],
    ] as const) {
      const response = await inject({
        method: 'POST',
        url: '/api/v1/inbox-items',
        payload: { type, title },
      });
      expect(response.statusCode, response.body).toBe(201);
      expect(response.json()).toMatchObject({ type, title });
    }
  });

  it('tracks subscription cost, billing cycle and renewal lifecycle', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/subscriptions',
      payload: {
        name: '云服务器',
        category: 'server',
        amount: 360,
        currency: 'CNY',
        billingCycle: 'quarterly',
        renewalDate: '2026-09-01',
        autoRenew: true,
        note: '个人工作台部署',
      },
    });
    expect(created.statusCode, created.body).toBe(201);
    const subscription = created.json<{ id: string; monthlyEquivalent: number; version: number }>();
    expect(subscription.monthlyEquivalent).toBe(120);

    const updated = await inject({
      method: 'PUT',
      url: `/api/v1/subscriptions/${subscription.id}`,
      payload: { renewalDate: '2026-12-01', amount: 300, version: subscription.version },
    });
    expect(updated.json()).toMatchObject({
      renewalDate: '2026-12-01',
      monthlyEquivalent: 100,
      version: 2,
    });
    const active = await inject({ method: 'GET', url: '/api/v1/subscriptions?status=active' });
    expect(active.json().items).toMatchObject([{ name: '云服务器', category: 'server' }]);
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/subscriptions/${subscription.id}/archive`,
          payload: { version: 2 },
        })
      ).statusCode,
    ).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/subscriptions/${subscription.id}/restore`,
      payload: { version: 3 },
    });
    expect(restored.json()).toMatchObject({ status: 'active', version: 4 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/subscriptions/${subscription.id}/archive`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/subscriptions/${subscription.id}`,
          payload: { version: 5 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('summarizes savings accounts, debt platforms and monthly debt records', async () => {
    const accountResponse = await inject({
      method: 'POST',
      url: '/api/v1/finance/accounts',
      payload: {
        type: 'bank',
        name: '工资卡',
        cardNumber: '6217000012345678',
        balance: 10000,
      },
    });
    expect(accountResponse.statusCode, accountResponse.body).toBe(201);
    const account = accountResponse.json<{ id: string; version: number }>();

    const platformResponse = await inject({
      method: 'POST',
      url: '/api/v1/finance/debt-platforms',
      payload: {
        name: '信用卡',
        billingDay: 5,
        repaymentDay: 25,
        fixedLimit: 20000,
        temporaryLimit: 0,
        remainingLimit: 17500,
      },
    });
    expect(platformResponse.statusCode, platformResponse.body).toBe(201);
    const platform = platformResponse.json<{ id: string; version: number }>();

    const debt = await inject({
      method: 'PUT',
      url: '/api/v1/finance/debt-records',
      payload: { platformId: platform.id, year: 2026, month: 8, amount: 2500 },
    });
    expect(debt.statusCode, debt.body).toBe(200);
    expect(debt.json()).toMatchObject({ year: 2026, month: 8, amount: 2500, version: 1 });

    const unbilledDebt = await inject({
      method: 'PUT',
      url: '/api/v1/finance/debt-records',
      payload: { platformId: platform.id, year: 2026, month: 0, amount: 300 },
    });
    expect(unbilledDebt.statusCode, unbilledDebt.body).toBe(200);
    expect(unbilledDebt.json()).toMatchObject({ year: 2026, month: 0, amount: 300 });

    const summary = await inject({
      method: 'GET',
      url: '/api/v1/finance/summary?year=2026&month=8',
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json()).toMatchObject({
      totalAssets: 10000,
      currentMonthDebt: 2500,
      yearDebt: 2800,
      netPosition: 7500,
      totalCreditLimit: 20000,
      remainingCredit: 17500,
    });
    const staleDebt = await inject({
      method: 'PUT',
      url: '/api/v1/finance/debt-records',
      payload: { platformId: platform.id, year: 2026, month: 8, amount: 2000 },
    });
    expect(staleDebt.statusCode).toBe(409);
    const updatedDebt = await inject({
      method: 'PUT',
      url: '/api/v1/finance/debt-records',
      payload: { platformId: platform.id, year: 2026, month: 8, amount: 2000, version: 1 },
    });
    expect(updatedDebt.json()).toMatchObject({ amount: 2000, version: 2 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/finance/accounts/${account.id}/archive`,
          payload: { version: account.version },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/finance/debt-platforms/${platform.id}/archive`,
          payload: { version: platform.version },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (await inject({ method: 'GET', url: '/api/v1/finance/summary?year=2026&month=8' })).json(),
    ).toMatchObject({ totalAssets: 0, currentMonthDebt: 0 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/finance/accounts/${account.id}/restore`,
          payload: { version: 2 },
        })
      ).json(),
    ).toMatchObject({ archived: false, version: 3 });
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/finance/debt-platforms/${platform.id}/restore`,
          payload: { version: 2 },
        })
      ).json(),
    ).toMatchObject({ archived: false, version: 3 });
    await inject({
      method: 'POST',
      url: `/api/v1/finance/accounts/${account.id}/archive`,
      payload: { version: 3 },
    });
    await inject({
      method: 'POST',
      url: `/api/v1/finance/debt-platforms/${platform.id}/archive`,
      payload: { version: 3 },
    });
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/finance/accounts/${account.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/finance/debt-platforms/${platform.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('stores type-specific finance account details', async () => {
    const cash = await inject({
      method: 'POST',
      url: '/api/v1/finance/accounts',
      payload: { type: 'cash', balance: 300 },
    });
    expect(cash.statusCode, cash.body).toBe(201);
    expect(cash.json()).toMatchObject({
      type: 'cash',
      name: '现金',
      balance: 300,
      cardNumber: null,
      phone: null,
      creditLimit: null,
    });

    const wechat = await inject({
      method: 'POST',
      url: '/api/v1/finance/accounts',
      payload: { type: 'wechat', phone: '19900001111', balance: 88.6 },
    });
    expect(wechat.statusCode, wechat.body).toBe(201);
    expect(wechat.json()).toMatchObject({
      type: 'wechat',
      name: '微信',
      phone: '19900001111',
      balance: 88.6,
    });

    const digitalCny = await inject({
      method: 'POST',
      url: '/api/v1/finance/accounts',
      payload: {
        type: 'digital-cny',
        name: '建行钱包',
        cardNumber: '0051000012345678',
        balance: 20,
      },
    });
    expect(digitalCny.statusCode, digitalCny.body).toBe(201);
    expect(digitalCny.json()).toMatchObject({
      type: 'digital-cny',
      name: '建行钱包',
      cardNumber: '0051000012345678',
      balance: 20,
    });

    const credit = await inject({
      method: 'POST',
      url: '/api/v1/finance/accounts',
      payload: { type: 'credit', name: '日常信用卡', creditLimit: 15000 },
    });
    expect(credit.statusCode, credit.body).toBe(201);
    expect(credit.json()).toMatchObject({
      type: 'credit',
      name: '日常信用卡',
      balance: 0,
      creditLimit: 15000,
    });
    const updatedCredit = await inject({
      method: 'PUT',
      url: `/api/v1/finance/accounts/${credit.json<{ id: string }>().id}`,
      payload: { name: '大额信用卡', creditLimit: 18000, version: 1 },
    });
    expect(updatedCredit.statusCode, updatedCredit.body).toBe(200);
    expect(updatedCredit.json()).toMatchObject({
      type: 'credit',
      name: '大额信用卡',
      balance: 0,
      creditLimit: 18000,
      version: 2,
    });

    const incompleteBank = await inject({
      method: 'POST',
      url: '/api/v1/finance/accounts',
      payload: { type: 'bank', name: '缺少卡号', balance: 1 },
    });
    expect(incompleteBank.statusCode).toBe(400);
  });

  it('keeps debt platforms in creation order after later platforms are added', async () => {
    const first = await inject({
      method: 'POST',
      url: '/api/v1/finance/debt-platforms',
      payload: { name: '先添加的平台' },
    });
    const second = await inject({
      method: 'POST',
      url: '/api/v1/finance/debt-platforms',
      payload: { name: '后添加的平台' },
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    const firstId = first.json<{ id: string }>().id;
    const secondId = second.json<{ id: string }>().id;
    await database.query(
      `UPDATE finance_debt_platforms
       SET created_at=CASE WHEN id=$1 THEN $3::timestamptz ELSE $4::timestamptz END,
           updated_at=CASE WHEN id=$1 THEN $3::timestamptz ELSE $4::timestamptz END
       WHERE id IN ($1,$2)`,
      [firstId, secondId, '2026-01-01T00:00:00.000Z', '2026-02-01T00:00:00.000Z'],
    );

    const list = await inject({ method: 'GET', url: '/api/v1/finance/debt-platforms' });
    expect(list.statusCode).toBe(200);
    expect(list.json<{ items: Array<{ id: string }> }>().items.map((item) => item.id)).toEqual([
      firstId,
      secondId,
    ]);
  });

  it('calculates a life profile and manages important life events', async () => {
    const initial = await inject({ method: 'GET', url: '/api/v1/life-countdown' });
    expect(initial.statusCode, initial.body).toBe(200);
    expect(initial.json().profile).toMatchObject({ birthDate: null, expectedAge: 80, version: 1 });

    const profile = await inject({
      method: 'PUT',
      url: '/api/v1/life-countdown/profile',
      payload: { birthDate: '1998-05-20', expectedAge: 80, version: 1 },
    });
    expect(profile.statusCode).toBe(200);
    expect(profile.json()).toMatchObject({
      birthDate: '1998-05-20',
      expectedEndDate: '2078-05-20',
      version: 2,
    });

    const event = await inject({
      method: 'POST',
      url: '/api/v1/life-countdown/events',
      payload: {
        title: '研究生毕业',
        targetAt: '2029-06-30T04:00:00.000Z',
        note: '完成论文与答辩',
      },
    });
    expect(event.statusCode, event.body).toBe(201);
    expect(event.json()).toMatchObject({ title: '研究生毕业', status: 'active', version: 1 });
    const lifeEvent = event.json<{ id: string }>();

    const dashboard = await inject({ method: 'GET', url: '/api/v1/life-countdown' });
    expect(dashboard.json().events).toMatchObject([{ title: '研究生毕业' }]);
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/life-countdown/events/${lifeEvent.id}/archive`,
          payload: { version: 1 },
        })
      ).statusCode,
    ).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/life-countdown/events/${lifeEvent.id}/restore`,
      payload: { version: 2 },
    });
    expect(restored.json()).toMatchObject({ status: 'active', version: 3 });
    await inject({
      method: 'POST',
      url: `/api/v1/life-countdown/events/${lifeEvent.id}/archive`,
      payload: { version: 3 },
    });
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/life-countdown/events/${lifeEvent.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('creates an independent timetable semester and expands selected teaching weeks', async () => {
    const semesterResponse = await inject({
      method: 'POST',
      url: '/api/v1/timetable/semesters',
      payload: {
        name: '2026—2027 学年秋季学期',
        shortName: '研一上',
        firstWeekMonday: '2026-09-07',
        totalWeeks: 20,
        makeCurrent: true,
      },
    });
    expect(semesterResponse.statusCode, semesterResponse.body).toBe(201);
    const semester = semesterResponse.json<{
      id: string;
      version: number;
      isCurrent: boolean;
      showWeekend: boolean;
      timeBlocks: Array<{
        id: string;
        label: string;
        sourceLabel: string;
        startTime: string;
        endTime: string;
        position: number;
        version: number;
      }>;
    }>();
    expect(semester.isCurrent).toBe(true);
    expect(semester.showWeekend).toBe(true);
    expect(semester.timeBlocks).toMatchObject([
      { label: '课 1', startTime: '08:30', endTime: '10:05' },
      { label: '课 2', startTime: '10:25', endTime: '12:00' },
      { label: '课 3', startTime: '14:00', endTime: '15:35' },
      { label: '课 4', startTime: '15:55', endTime: '17:30' },
      { label: '课 5', startTime: '19:00', endTime: '21:25' },
    ]);

    const courseResponse = await inject({
      method: 'POST',
      url: '/api/v1/timetable/courses',
      payload: {
        semesterId: semester.id,
        name: '网络空间安全数学原理',
        shortName: '网安数学',
        instructors: ['张老师'],
        color: 'teal',
        notes: '研究生课程',
        meetings: [
          {
            weekday: 3,
            timeBlockId: semester.timeBlocks[0]!.id,
            room: '南校区 G-101',
            instructorOverride: [],
            weekNumbers: [1, 3, 5],
          },
        ],
      },
    });
    expect(courseResponse.statusCode, courseResponse.body).toBe(201);
    expect(courseResponse.json()).toMatchObject({
      name: '网络空间安全数学原理',
      status: 'active',
      meetings: [{ room: '南校区 G-101', weekNumbers: [1, 3, 5] }],
    });

    const firstWeek = await inject({
      method: 'GET',
      url: `/api/v1/timetable/occurrences?semesterId=${semester.id}&week=1`,
    });
    expect(firstWeek.statusCode, firstWeek.body).toBe(200);
    expect(firstWeek.json().items).toMatchObject([
      {
        date: '2026-09-09',
        weekNumber: 1,
        weekday: 3,
        courseName: '网络空间安全数学原理',
        room: '南校区 G-101',
        instructors: ['张老师'],
        timeBlock: { label: '课 1', startTime: '08:30', endTime: '10:05' },
      },
    ]);

    const secondWeek = await inject({
      method: 'GET',
      url: `/api/v1/timetable/occurrences?semesterId=${semester.id}&week=2`,
    });
    expect(secondWeek.statusCode).toBe(200);
    expect(secondWeek.json().items).toEqual([]);

    const movedSemester = await inject({
      method: 'PUT',
      url: `/api/v1/timetable/semesters/${semester.id}`,
      payload: { firstWeekMonday: '2026-09-14', version: semester.version },
    });
    expect(movedSemester.statusCode, movedSemester.body).toBe(200);
    expect(movedSemester.json()).toMatchObject({ firstWeekMonday: '2026-09-14', version: 2 });
    const changedBlocks = semester.timeBlocks.map((block, index) => ({
      ...block,
      ...(index === 0 ? { startTime: '08:45', endTime: '10:15' } : {}),
    }));
    const updatedSchedule = await inject({
      method: 'PUT',
      url: `/api/v1/timetable/semesters/${semester.id}/time-blocks`,
      payload: { semesterVersion: 2, blocks: changedBlocks },
    });
    expect(updatedSchedule.statusCode, updatedSchedule.body).toBe(200);
    expect(updatedSchedule.json()).toMatchObject({ version: 3 });
    expect(updatedSchedule.json().timeBlocks[0]).toMatchObject({
      startTime: '08:45',
      endTime: '10:15',
      version: 2,
    });
    const recalculated = await inject({
      method: 'GET',
      url: `/api/v1/timetable/occurrences?semesterId=${semester.id}&week=1`,
    });
    expect(recalculated.json().items).toMatchObject([
      { date: '2026-09-16', timeBlock: { startTime: '08:45', endTime: '10:15' } },
    ]);
  });

  it('requires explicit confirmation for timetable conflicts and keeps archive deletion safe', async () => {
    const semesterResponse = await inject({
      method: 'POST',
      url: '/api/v1/timetable/semesters',
      payload: {
        name: '2026 秋季学期',
        shortName: '研一上',
        firstWeekMonday: '2026-09-07',
        totalWeeks: 20,
      },
    });
    const semester = semesterResponse.json<{
      id: string;
      timeBlocks: Array<{ id: string }>;
    }>();
    const course = (name: string, allowConflicts = false) => ({
      semesterId: semester.id,
      name,
      instructors: ['王老师'],
      meetings: [
        {
          weekday: 1,
          timeBlockId: semester.timeBlocks[0]!.id,
          room: 'A-101',
          weekNumbers: [1, 2, 3],
        },
      ],
      allowConflicts,
    });
    expect(
      (
        await inject({
          method: 'POST',
          url: '/api/v1/timetable/courses',
          payload: course('课程 A'),
        })
      ).statusCode,
    ).toBe(201);
    const conflict = await inject({
      method: 'POST',
      url: '/api/v1/timetable/courses',
      payload: course('课程 B'),
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.details).toMatchObject({
      code: 'TIMETABLE_CONFLICT_CONFIRMATION_REQUIRED',
    });

    const confirmed = await inject({
      method: 'POST',
      url: '/api/v1/timetable/courses',
      payload: course('课程 B', true),
    });
    expect(confirmed.statusCode, confirmed.body).toBe(201);
    const second = confirmed.json<{ id: string; version: number }>();

    const unrelated = await inject({
      method: 'POST',
      url: '/api/v1/timetable/courses',
      payload: {
        ...course('课程 C'),
        meetings: [
          {
            weekday: 2,
            timeBlockId: semester.timeBlocks[0]!.id,
            room: 'A-102',
            weekNumbers: [1, 2, 3],
          },
        ],
      },
    });
    expect(unrelated.statusCode, unrelated.body).toBe(201);

    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/timetable/courses/${second.id}/archive`,
          payload: { version: second.version },
        })
      ).statusCode,
    ).toBe(204);
    const restored = await inject({
      method: 'POST',
      url: `/api/v1/timetable/courses/${second.id}/restore`,
      payload: { version: 2 },
    });
    expect(restored.json()).toMatchObject({ status: 'active', version: 3 });
    await inject({
      method: 'POST',
      url: `/api/v1/timetable/courses/${second.id}/archive`,
      payload: { version: 3 },
    });
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/timetable/courses/${second.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('reschedules and cancels one timetable occurrence without changing the recurring course', async () => {
    const semesterResponse = await inject({
      method: 'POST',
      url: '/api/v1/timetable/semesters',
      payload: {
        name: '2026 秋季学期',
        shortName: '研一上',
        firstWeekMonday: '2026-09-07',
        totalWeeks: 20,
      },
    });
    const semester = semesterResponse.json<{
      id: string;
      timeBlocks: Array<{ id: string }>;
    }>();
    const courseResponse = await inject({
      method: 'POST',
      url: '/api/v1/timetable/courses',
      payload: {
        semesterId: semester.id,
        name: '无线网络安全',
        instructors: ['李老师'],
        meetings: [
          {
            weekday: 3,
            timeBlockId: semester.timeBlocks[0]!.id,
            room: 'G-201',
            weekNumbers: [1, 2],
          },
        ],
      },
    });
    const course = courseResponse.json<{
      id: string;
      version: number;
      meetings: Array<{ id: string }>;
    }>();
    const adjusted = await inject({
      method: 'POST',
      url: `/api/v1/timetable/courses/${course.id}/adjustments`,
      payload: {
        meetingId: course.meetings[0]!.id,
        originalDate: '2026-09-09',
        type: 'reschedule',
        newDate: '2026-09-10',
        newTimeBlockId: semester.timeBlocks[1]!.id,
        room: 'G-305',
        note: '学院临时调课',
      },
    });
    expect(adjusted.statusCode, adjusted.body).toBe(201);
    const adjustment = adjusted.json<{ id: string; version: number }>();

    const moved = await inject({
      method: 'GET',
      url: `/api/v1/timetable/occurrences?semesterId=${semester.id}&week=1`,
    });
    expect(moved.json().items).toMatchObject([
      {
        date: '2026-09-10',
        originalDate: '2026-09-09',
        room: 'G-305',
        cancelled: false,
        timeBlock: { label: '课 2' },
        adjustment: { type: 'reschedule' },
      },
    ]);

    const cancelled = await inject({
      method: 'PUT',
      url: `/api/v1/timetable/adjustments/${adjustment.id}`,
      payload: {
        type: 'cancel',
        newDate: null,
        newTimeBlockId: null,
        room: null,
        version: adjustment.version,
      },
    });
    expect(cancelled.statusCode, cancelled.body).toBe(200);
    expect(cancelled.json()).toMatchObject({ type: 'cancel', version: 2 });
    const week = await inject({
      method: 'GET',
      url: `/api/v1/timetable/occurrences?semesterId=${semester.id}&week=1`,
    });
    expect(week.json().items).toMatchObject([
      { date: '2026-09-09', originalDate: '2026-09-09', cancelled: true },
    ]);
  });
});
