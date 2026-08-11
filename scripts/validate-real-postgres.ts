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
        referenceBooks: number;
        classRecords: number;
        assignments: number;
        materialGroups: number;
        materials: number;
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
           (SELECT count(*)::int FROM course_reference_books) AS "referenceBooks",
           (SELECT count(*)::int FROM course_class_records) AS "classRecords",
           (SELECT count(*)::int FROM course_assignments) AS assignments,
           (SELECT count(*)::int FROM course_material_groups) AS "materialGroups",
           (SELECT count(*)::int FROM course_materials) AS materials,
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
        value.referenceBooks !== 1 ||
        value.classRecords !== 1 ||
        value.assignments !== 1 ||
        value.materialGroups !== 1 ||
        value.materials !== 1 ||
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
