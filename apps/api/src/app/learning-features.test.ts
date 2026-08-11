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

describe('books and courses vertical slices', () => {
  let root: string;
  let database: Database;
  let app: FastifyInstance;
  let config: AppConfig;
  let jar: CookieJar;
  let csrfToken: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'workbench-learning-test-'));
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

  it('manages book metadata, chapter pages, calculated progress and archive lifecycle', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/books',
      payload: {
        title: '深入理解计算机系统',
        author: 'Randal E. Bryant',
        edition: '原书第 3 版',
        isbn: '9787111544937',
        publisher: '机械工业出版社',
        description: '系统学习参考书',
        readingStatus: 'reading',
      },
    });
    expect(created.statusCode).toBe(201);
    const book = created.json<{ id: string; title: string; version: number }>();
    expect(book.title).toBe('深入理解计算机系统');

    const firstChapter = await inject({
      method: 'POST',
      url: `/api/v1/books/${book.id}/chapters`,
      payload: { title: '第 1 章', startPage: 1, endPage: 10, currentPage: 5, notes: '数据表示' },
    });
    expect(firstChapter.statusCode).toBe(201);
    expect(firstChapter.json()).toMatchObject({ readPages: 5, totalPages: 10, percentage: 50 });

    const secondChapter = await inject({
      method: 'POST',
      url: `/api/v1/books/${book.id}/chapters`,
      payload: { title: '第 2 章', startPage: 11, endPage: 20, currentPage: 15 },
    });
    expect(secondChapter.statusCode).toBe(201);
    const chapter = secondChapter.json<{ id: string; version: number }>();

    const detail = await inject({ method: 'GET', url: `/api/v1/books/${book.id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      readingStatus: 'reading',
      progress: { readPages: 10, totalPages: 20, percentage: 50 },
      chapters: [
        { title: '第 1 章', percentage: 50 },
        { title: '第 2 章', percentage: 50 },
      ],
    });

    const chapterPage = await inject({
      method: 'GET',
      url: `/api/v1/books/${book.id}/chapters/${chapter.id}`,
    });
    expect(chapterPage.statusCode).toBe(200);
    expect(chapterPage.json()).toMatchObject({ bookId: book.id, title: '第 2 章' });

    const updatedChapter = await inject({
      method: 'PUT',
      url: `/api/v1/books/${book.id}/chapters/${chapter.id}`,
      payload: { currentPage: 20, version: chapter.version },
    });
    expect(updatedChapter.statusCode).toBe(200);
    expect(updatedChapter.json()).toMatchObject({ percentage: 100 });

    const archived = await inject({
      method: 'POST',
      url: `/api/v1/books/${book.id}/archive`,
      payload: { version: book.version },
    });
    expect(archived.statusCode).toBe(204);

    const archivedList = await inject({ method: 'GET', url: '/api/v1/books?archived=true' });
    expect(archivedList.json().items).toMatchObject([{ id: book.id, archived: true }]);

    const restored = await inject({
      method: 'POST',
      url: `/api/v1/books/${book.id}/restore`,
      payload: { version: 2 },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({
      archived: false,
      readingStatus: 'reading',
      version: 3,
    });

    const activeDelete = await inject({
      method: 'DELETE',
      url: `/api/v1/books/${book.id}`,
      payload: { version: 3 },
    });
    expect(activeDelete.statusCode).toBe(409);

    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/books/${book.id}/archive`,
          payload: { version: 3 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/books/${book.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
    expect((await inject({ method: 'GET', url: `/api/v1/books/${book.id}` })).statusCode).toBe(404);
  });

  it('manages courses with read-only book references, class records and assignments', async () => {
    const bookResponse = await inject({
      method: 'POST',
      url: '/api/v1/books',
      payload: { title: '信息论基础', author: 'Thomas M. Cover', readingStatus: 'to-read' },
    });
    const book = bookResponse.json<{ id: string }>();

    const created = await inject({
      method: 'POST',
      url: '/api/v1/courses',
      payload: {
        name: '信息论及其应用',
        instructor: '张老师',
        courseCode: 'X2CE1050',
        credits: 3,
        totalHours: 48,
        objectives: '掌握信息量度与编码基础',
        description: '研究生专业课',
        schedule: '周三 3-4 节',
        referenceBookIds: [book.id],
      },
    });
    expect(created.statusCode).toBe(201);
    const course = created.json<{ id: string; version: number }>();

    const classRecord = await inject({
      method: 'POST',
      url: `/api/v1/courses/${course.id}/class-records`,
      payload: { occurredAt: '2030-03-06T06:00:00.000Z', content: '熵与互信息' },
    });
    expect(classRecord.statusCode).toBe(201);

    const assignment = await inject({
      method: 'POST',
      url: `/api/v1/courses/${course.id}/assignments`,
      payload: {
        title: '第一次作业',
        description: '完成典型集习题',
        dueAt: '2030-03-13T15:59:00.000Z',
        status: 'pending',
      },
    });
    expect(assignment.statusCode).toBe(201);

    const detail = await inject({ method: 'GET', url: `/api/v1/courses/${course.id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      name: '信息论及其应用',
      referenceBooks: [{ id: book.id, title: '信息论基础', author: 'Thomas M. Cover' }],
      classRecords: [{ content: '熵与互信息' }],
      assignments: [{ title: '第一次作业', status: 'pending' }],
    });

    const search = await inject({
      method: 'GET',
      url: '/api/v1/workbench/search?query=%E4%BF%A1%E6%81%AF%E8%AE%BA',
    });
    expect(search.statusCode).toBe(200);
    expect(search.body).toContain('信息论基础');
    expect(search.body).toContain('信息论及其应用');

    const archived = await inject({
      method: 'POST',
      url: `/api/v1/courses/${course.id}/archive`,
      payload: { version: course.version },
    });
    expect(archived.statusCode).toBe(204);
    const archivedList = await inject({ method: 'GET', url: '/api/v1/courses?archived=true' });
    expect(archivedList.json().items).toMatchObject([{ id: course.id, archived: true }]);

    const restored = await inject({
      method: 'POST',
      url: `/api/v1/courses/${course.id}/restore`,
      payload: { version: 2 },
    });
    expect(restored.statusCode).toBe(200);
    expect(restored.json()).toMatchObject({ archived: false, version: 3 });
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/courses/${course.id}`,
          payload: { version: 3 },
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await inject({
          method: 'POST',
          url: `/api/v1/courses/${course.id}/archive`,
          payload: { version: 3 },
        })
      ).statusCode,
    ).toBe(204);
    expect(
      (
        await inject({
          method: 'DELETE',
          url: `/api/v1/courses/${course.id}`,
          payload: { version: 4 },
        })
      ).statusCode,
    ).toBe(204);
  });

  it('uploads, groups and opens course materials and a syllabus through authenticated storage', async () => {
    const created = await inject({
      method: 'POST',
      url: '/api/v1/courses',
      payload: { name: '网络空间安全数学原理' },
    });
    const course = created.json<{ id: string; version: number }>();

    const syllabusBytes = Buffer.from('%PDF-1.7\nworkbench syllabus\n');
    const syllabusUpload = await upload('教学大纲.pdf', 'application/pdf', syllabusBytes);
    expect(syllabusUpload.statusCode).toBe(201);
    const syllabus = syllabusUpload.json<{
      id: string;
      originalName: string;
      contentUrl: string;
    }>();
    expect(syllabus).toMatchObject({ originalName: '教学大纲.pdf' });

    const unauthenticatedOpen = await app.inject({ method: 'GET', url: syllabus.contentUrl });
    expect(unauthenticatedOpen.statusCode).toBe(401);
    const opened = await inject({ method: 'GET', url: syllabus.contentUrl });
    expect(opened.statusCode).toBe(200);
    expect(opened.headers['content-type']).toContain('application/pdf');
    expect(opened.headers['content-disposition']).toContain('inline');
    expect(opened.rawPayload).toEqual(syllabusBytes);

    const courseWithSyllabus = await inject({
      method: 'PUT',
      url: `/api/v1/courses/${course.id}`,
      payload: { syllabusFileId: syllabus.id, version: course.version },
    });
    expect(courseWithSyllabus.statusCode).toBe(200);
    expect(courseWithSyllabus.json()).toMatchObject({
      syllabus: { id: syllabus.id, originalName: '教学大纲.pdf' },
      version: 2,
    });

    const groupResponse = await inject({
      method: 'POST',
      url: `/api/v1/courses/${course.id}/material-groups`,
      payload: { name: '第 1 章资料' },
    });
    expect(groupResponse.statusCode).toBe(201);
    const group = groupResponse.json<{ id: string }>();

    const notesUpload = await upload(
      '第一讲笔记.md',
      'text/markdown',
      Buffer.from('# 第一讲\n格与密码基础'),
    );
    expect(notesUpload.statusCode).toBe(201);
    const notes = notesUpload.json<{ id: string }>();
    const materialResponse = await inject({
      method: 'POST',
      url: `/api/v1/courses/${course.id}/materials`,
      payload: { fileId: notes.id, groupId: group.id, label: '课堂笔记' },
    });
    expect(materialResponse.statusCode).toBe(201);
    expect(materialResponse.json()).toMatchObject({
      groupId: group.id,
      label: '课堂笔记',
      file: { id: notes.id, originalName: '第一讲笔记.md' },
    });

    const detail = await inject({ method: 'GET', url: `/api/v1/courses/${course.id}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json()).toMatchObject({
      syllabus: { id: syllabus.id },
      materialGroups: [{ id: group.id, name: '第 1 章资料' }],
      materials: [{ groupId: group.id, label: '课堂笔记', file: { id: notes.id } }],
    });
  });
});
