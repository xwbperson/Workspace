import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildApp } from '../apps/api/src/app/build-app.js';
import { loadConfig } from '../apps/api/src/config.js';
import { AuthRepository } from '../apps/api/src/platform/auth/repository.js';
import { AuthService } from '../apps/api/src/platform/auth/service.js';
import { BackupService } from '../apps/api/src/platform/backup/backup-service.js';
import { createDatabase } from '../apps/api/src/platform/database/database.js';
import { runMigrations } from '../apps/api/src/platform/database/migrate.js';
import { initializeWorkspace } from '../apps/api/src/platform/workspace/workspace.js';

if (process.env.CI_POSTGRES_VALIDATION !== 'true') {
  throw new Error('为避免连接错误数据库，只有 CI_POSTGRES_VALIDATION=true 时才允许执行。');
}

const configuredUrl = new URL(process.env.DATABASE_URL ?? '');
if (configuredUrl.pathname !== '/workbench_ci') {
  throw new Error('真实 PostgreSQL 验证只允许使用名为 workbench_ci 的临时数据库。');
}

const baseRoot = await mkdtemp(join(tmpdir(), 'workbench-real-postgres-'));
const activeRoot = join(baseRoot, 'active');
const restoredRoot = join(baseRoot, 'restored');
const config = loadConfig({
  nodeEnv: 'test',
  databaseInMemory: false,
  databaseUrl: configuredUrl.toString(),
  workbenchRoot: activeRoot,
  appOrigin: 'http://localhost:5173',
  cookieSecure: false,
  logLevel: 'silent',
});

try {
  await initializeWorkspace(config);
  const database = await createDatabase(config);
  await runMigrations(database);
  await new AuthService(new AuthRepository(database), config).initializeOwner(
    'ci-only-owner-password',
  );
  const app = await buildApp({ config, database, startSchedulers: false });
  await app.ready();

  const csrf = await app.inject({ method: 'GET', url: '/api/v1/auth/csrf' });
  const csrfToken = csrf.json<{ csrfToken: string }>().csrfToken;
  const csrfCookie = String(csrf.headers['set-cookie']).split(';', 1)[0];
  const login = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    headers: {
      origin: config.appOrigin,
      cookie: csrfCookie,
      'x-csrf-token': csrfToken,
    },
    payload: {
      username: 'owner',
      password: 'ci-only-owner-password',
      remember: true,
    },
  });
  if (login.statusCode !== 200) throw new Error(`真实数据库登录失败：${login.statusCode}`);
  const sessionCookie = String(login.headers['set-cookie']).split(';', 1)[0];
  const authenticatedHeaders = {
    origin: config.appOrigin,
    cookie: `${csrfCookie}; ${sessionCookie}`,
    'x-csrf-token': csrfToken,
  };
  const createApiRecord = async <T extends object>(
    url: string,
    payload: object,
    label: string,
  ): Promise<T> => {
    const response = await app.inject({
      method: 'POST',
      url,
      headers: authenticatedHeaders,
      payload,
    });
    if (response.statusCode !== 201) {
      throw new Error(`真实数据库${label}写入失败：${response.statusCode} ${response.body}`);
    }
    return response.json<T>();
  };
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/countdowns',
    headers: authenticatedHeaders,
    payload: {
      title: '真实 PostgreSQL 恢复样本',
      note: '这条记录必须在恢复后的新数据库中存在。',
      targetAt: '2032-01-01T00:00:00.000Z',
      priority: 90,
    },
  });
  if (created.statusCode !== 201) throw new Error(`真实数据库写入失败：${created.statusCode}`);

  const bookResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/books',
    headers: authenticatedHeaders,
    payload: { title: '真实 PostgreSQL 书籍样本', author: 'CI', readingStatus: 'reading' },
  });
  if (bookResponse.statusCode !== 201)
    throw new Error(`真实数据库书籍写入失败：${bookResponse.statusCode}`);
  const book = bookResponse.json<{ id: string }>();
  const chapterResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/books/${book.id}/chapters`,
    headers: authenticatedHeaders,
    payload: { title: '恢复验收章', startPage: 1, endPage: 10, currentPage: 4 },
  });
  if (chapterResponse.statusCode !== 201)
    throw new Error(`真实数据库章节写入失败：${chapterResponse.statusCode}`);

  const courseResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/courses',
    headers: authenticatedHeaders,
    payload: {
      name: '真实 PostgreSQL 课程样本',
      instructor: 'CI',
      status: 'completed',
      referenceBookIds: [book.id],
    },
  });
  if (courseResponse.statusCode !== 201)
    throw new Error(`真实数据库课程写入失败：${courseResponse.statusCode}`);
  const course = courseResponse.json<{ id: string; version: number }>();
  const classRecordResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${course.id}/class-records`,
    headers: authenticatedHeaders,
    payload: { occurredAt: '2031-03-01T08:00:00.000Z', content: '恢复验收课' },
  });
  if (classRecordResponse.statusCode !== 201)
    throw new Error(`真实数据库上课记录写入失败：${classRecordResponse.statusCode}`);
  const assignmentResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${course.id}/assignments`,
    headers: authenticatedHeaders,
    payload: { title: '恢复验收作业', status: 'in-progress' },
  });
  if (assignmentResponse.statusCode !== 201)
    throw new Error(`真实数据库作业写入失败：${assignmentResponse.statusCode}`);

  await createApiRecord(
    '/api/v1/goals',
    {
      title: '真实 PostgreSQL 目标样本',
      periodType: 'annual',
      periodLabel: '2031',
      startDate: '2031-01-01',
      endDate: '2031-12-31',
      metric: {
        startValue: 0,
        targetValue: 100,
        currentValue: 25,
        unit: '%',
        direction: 'increase',
      },
      keyResults: [{ id: 'kr-ci', title: '恢复关键结果', progress: 20, completed: false }],
    },
    '目标',
  );
  await createApiRecord(
    '/api/v1/tasks',
    {
      title: '真实 PostgreSQL 任务样本',
      priority: 'high',
      dueAt: '2031-06-01T08:00:00.000Z',
      recurrence: 'monthly',
    },
    '任务',
  );
  await createApiRecord(
    '/api/v1/calendar-entries',
    {
      type: 'schedule',
      title: '真实 PostgreSQL 日程样本',
      entryDate: '2031-06-01',
      startsAt: '2031-06-01T08:00:00.000Z',
      content: '恢复验收日程',
    },
    '日历记录',
  );
  await createApiRecord(
    '/api/v1/inbox-items',
    {
      type: 'idea',
      title: '真实 PostgreSQL 收集箱样本',
      content: '恢复验收想法',
    },
    '收集箱记录',
  );
  await createApiRecord(
    '/api/v1/subscriptions',
    {
      name: '真实 PostgreSQL 订阅样本',
      category: 'server',
      amount: 360,
      currency: 'CNY',
      billingCycle: 'quarterly',
      renewalDate: '2031-10-01',
    },
    '订阅',
  );
  await createApiRecord(
    '/api/v1/finance/accounts',
    {
      type: 'bank',
      name: '真实 PostgreSQL 资金账户',
      balance: 10000,
    },
    '资金账户',
  );
  const debtPlatform = await createApiRecord<{ id: string }>(
    '/api/v1/finance/debt-platforms',
    { name: '真实 PostgreSQL 负债平台', fixedLimit: 20000, remainingLimit: 17500 },
    '负债平台',
  );
  const debtRecordResponse = await app.inject({
    method: 'PUT',
    url: '/api/v1/finance/debt-records',
    headers: authenticatedHeaders,
    payload: { platformId: debtPlatform.id, year: 2031, month: 6, amount: 2500 },
  });
  if (debtRecordResponse.statusCode !== 200)
    throw new Error(`真实数据库月度负债写入失败：${debtRecordResponse.statusCode}`);
  const profileResponse = await app.inject({
    method: 'PUT',
    url: '/api/v1/life-countdown/profile',
    headers: authenticatedHeaders,
    payload: { birthDate: '1998-05-20', expectedAge: 80, version: 1 },
  });
  if (profileResponse.statusCode !== 200)
    throw new Error(`真实数据库人生参数写入失败：${profileResponse.statusCode}`);
  await createApiRecord(
    '/api/v1/life-countdown/events',
    {
      title: '真实 PostgreSQL 人生事件',
      targetAt: '2031-06-30T08:00:00.000Z',
      note: '恢复验收事件',
    },
    '人生事件',
  );

  const boundary = '----workbench-real-postgres-validation';
  const attachmentBytes = Buffer.from('%PDF-1.7\nreal-postgres-portable-attachment\n');
  const uploadResponse = await app.inject({
    method: 'POST',
    url: '/api/v1/files',
    headers: {
      ...authenticatedHeaders,
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload: Buffer.concat([
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ci-syllabus.pdf"\r\nContent-Type: application/pdf\r\n\r\n`,
      ),
      attachmentBytes,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]),
  });
  if (uploadResponse.statusCode !== 201)
    throw new Error(`真实数据库附件写入失败：${uploadResponse.statusCode}`);
  const attachment = uploadResponse.json<{ id: string }>();
  const syllabusResponse = await app.inject({
    method: 'PUT',
    url: `/api/v1/courses/${course.id}`,
    headers: authenticatedHeaders,
    payload: { syllabusFileId: attachment.id, version: course.version },
  });
  if (syllabusResponse.statusCode !== 200)
    throw new Error(`真实数据库教学大纲关联失败：${syllabusResponse.statusCode}`);
  const groupResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${course.id}/material-groups`,
    headers: authenticatedHeaders,
    payload: { name: '恢复验收资料组' },
  });
  if (groupResponse.statusCode !== 201)
    throw new Error(`真实数据库资料组写入失败：${groupResponse.statusCode}`);
  const group = groupResponse.json<{ id: string }>();
  const materialResponse = await app.inject({
    method: 'POST',
    url: `/api/v1/courses/${course.id}/materials`,
    headers: authenticatedHeaders,
    payload: { fileId: attachment.id, groupId: group.id, label: '恢复验收资料' },
  });
  if (materialResponse.statusCode !== 201)
    throw new Error(`真实数据库课程资料写入失败：${materialResponse.statusCode}`);
  await app.close();

  await writeFile(
    join(activeRoot, 'storage', 'objects', 'restore-proof.txt'),
    'portable-object-proof\n',
    'utf8',
  );

  const currentDatabase = await createDatabase(config);
  try {
    const backup = new BackupService(config, currentDatabase);
    const backupPath = await backup.create();
    await backup.verify(backupPath);

    const adminUrl = new URL(config.databaseUrl);
    adminUrl.pathname = '/postgres';
    const adminDatabase = await createDatabase({ ...config, databaseUrl: adminUrl.toString() });
    try {
      await adminDatabase.query('DROP DATABASE IF EXISTS workbench_restore_ci WITH (FORCE)');
      await adminDatabase.query('CREATE DATABASE workbench_restore_ci');
    } finally {
      await adminDatabase.end();
    }

    const restoreUrl = new URL(config.databaseUrl);
    restoreUrl.pathname = '/workbench_restore_ci';
    const result = await backup.restore(backupPath, restoredRoot, restoreUrl.toString());
    const restoredDatabase = await createDatabase({
      ...config,
      databaseUrl: restoreUrl.toString(),
      workbenchRoot: restoredRoot,
    });
    try {
      const counts = await restoredDatabase.query<{
        countdowns: number;
        books: number;
        chapters: number;
        courses: number;
        completedCourses: number;
        referenceBooks: number;
        classRecords: number;
        assignments: number;
        materialGroups: number;
        materials: number;
        goals: number;
        goalMeasurements: number;
        tasks: number;
        calendarEntries: number;
        inboxItems: number;
        subscriptions: number;
        financeAccounts: number;
        financePlatforms: number;
        financeRecords: number;
        lifeProfiles: number;
        lifeEvents: number;
        storedFiles: number;
        sessions: number;
        attempts: number;
        owners: number;
      }>(
        `SELECT
           (SELECT count(*)::int FROM countdowns) AS countdowns,
           (SELECT count(*)::int FROM books) AS books,
           (SELECT count(*)::int FROM book_chapters) AS chapters,
           (SELECT count(*)::int FROM courses) AS courses,
           (SELECT count(*)::int FROM courses WHERE status='completed') AS "completedCourses",
           (SELECT count(*)::int FROM course_reference_books) AS "referenceBooks",
           (SELECT count(*)::int FROM course_class_records) AS "classRecords",
           (SELECT count(*)::int FROM course_assignments) AS assignments,
           (SELECT count(*)::int FROM course_material_groups) AS "materialGroups",
           (SELECT count(*)::int FROM course_materials) AS materials,
           (SELECT count(*)::int FROM goals) AS goals,
           (SELECT count(*)::int FROM goal_measurements) AS "goalMeasurements",
           (SELECT count(*)::int FROM tasks) AS tasks,
           (SELECT count(*)::int FROM calendar_entries) AS "calendarEntries",
           (SELECT count(*)::int FROM inbox_items) AS "inboxItems",
           (SELECT count(*)::int FROM subscriptions) AS subscriptions,
           (SELECT count(*)::int FROM finance_accounts) AS "financeAccounts",
           (SELECT count(*)::int FROM finance_debt_platforms) AS "financePlatforms",
           (SELECT count(*)::int FROM finance_debt_records) AS "financeRecords",
           (SELECT count(*)::int FROM life_profiles) AS "lifeProfiles",
           (SELECT count(*)::int FROM life_events) AS "lifeEvents",
           (SELECT count(*)::int FROM stored_files) AS "storedFiles",
           (SELECT count(*)::int FROM auth_sessions) AS sessions,
           (SELECT count(*)::int FROM auth_login_attempts) AS attempts,
           (SELECT count(*)::int FROM owner_account WHERE username = 'owner') AS owners`,
      );
      const value = counts.rows[0];
      if (
        !value ||
        value.countdowns !== 1 ||
        value.books !== 1 ||
        value.chapters !== 1 ||
        value.courses !== 1 ||
        value.completedCourses !== 1 ||
        value.referenceBooks !== 1 ||
        value.classRecords !== 1 ||
        value.assignments !== 1 ||
        value.materialGroups !== 1 ||
        value.materials !== 1 ||
        value.goals !== 1 ||
        value.goalMeasurements !== 1 ||
        value.tasks !== 1 ||
        value.calendarEntries !== 1 ||
        value.inboxItems !== 1 ||
        value.subscriptions !== 1 ||
        value.financeAccounts !== 1 ||
        value.financePlatforms !== 1 ||
        value.financeRecords !== 1 ||
        value.lifeProfiles !== 1 ||
        value.lifeEvents !== 1 ||
        value.storedFiles !== 1 ||
        value.sessions !== 0 ||
        value.attempts !== 0 ||
        value.owners !== 1
      ) {
        throw new Error(`恢复数据验收失败：${JSON.stringify(value)}`);
      }
      const storedFile = await restoredDatabase.query<{ storage_key: string }>(
        'SELECT storage_key FROM stored_files WHERE id=$1',
        [attachment.id],
      );
      const storageKey = storedFile.rows[0]?.storage_key;
      if (!storageKey) throw new Error('恢复后的附件元数据不存在。');
      const restoredAttachment = await readFile(
        join(restoredRoot, 'storage', 'objects', storageKey),
      );
      if (!restoredAttachment.equals(attachmentBytes)) {
        throw new Error('恢复后的课程附件内容不一致。');
      }
    } finally {
      await restoredDatabase.end();
    }

    const objectProof = await readFile(
      join(restoredRoot, 'storage', 'objects', 'restore-proof.txt'),
      'utf8',
    );
    if (objectProof !== 'portable-object-proof\n') throw new Error('恢复后的对象文件内容不一致。');

    process.stdout.write(
      `${JSON.stringify({
        status: 'VERIFIED',
        database: 'PostgreSQL',
        migration: result.databaseMigrationVersion,
        restoredObjects: result.restoredObjectCount,
        authenticationSessionsCleared: true,
        reportCreated: true,
      })}\n`,
    );
  } finally {
    await currentDatabase.end();
  }
} finally {
  await rm(baseRoot, { recursive: true, force: true });
}
