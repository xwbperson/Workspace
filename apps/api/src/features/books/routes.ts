import type { FastifyInstance } from 'fastify';
import type {
  BookInput,
  BookService,
  BookUpdateInput,
  ChapterInput,
  ChapterUpdateInput,
} from './service.js';
import type { ReadingStatus } from './repository.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const chapterParams = {
  type: 'object',
  required: ['id', 'chapterId'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    chapterId: { type: 'string', format: 'uuid' },
  },
} as const;

const versionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;

const nullableDate = {
  anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }],
} as const;

const nullableUuid = {
  anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
} as const;

const bookProperties = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  subtitle: { type: 'string', maxLength: 200 },
  originalTitle: { type: 'string', maxLength: 200 },
  author: { type: 'string', maxLength: 200 },
  translator: { type: 'string', maxLength: 200 },
  isbn: { type: 'string', maxLength: 40 },
  publisher: { type: 'string', maxLength: 200 },
  publishDate: nullableDate,
  edition: { type: 'string', maxLength: 100 },
  series: { type: 'string', maxLength: 200 },
  language: { type: 'string', maxLength: 60 },
  format: { type: 'string', maxLength: 60 },
  pageCount: { type: 'integer', minimum: 0, maximum: 1_000_000 },
  description: { type: 'string', maxLength: 10_000 },
  notes: { type: 'string', maxLength: 20_000 },
  readingStatus: {
    type: 'string',
    enum: ['to-read', 'reading', 'read', 'abandoned'],
  },
  startedAt: nullableDate,
  finishedAt: nullableDate,
  coverFileId: nullableUuid,
} as const;

const chapterProperties = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  startPage: { type: 'integer', minimum: 1, maximum: 1_000_000 },
  endPage: { type: 'integer', minimum: 1, maximum: 1_000_000 },
  currentPage: { type: 'integer', minimum: 0, maximum: 1_000_000 },
  notes: { type: 'string', maxLength: 10_000 },
  position: { type: 'integer', minimum: 0, maximum: 1_000_000 },
} as const;

export async function registerBookRoutes(
  app: FastifyInstance,
  service: BookService,
): Promise<void> {
  app.get<{
    Querystring: { archived?: boolean; readingStatus?: ReadingStatus; limit?: number };
  }>(
    '/api/v1/books',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            archived: { type: 'boolean' },
            readingStatus: {
              type: 'string',
              enum: ['to-read', 'reading', 'read', 'abandoned'],
            },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/books/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: BookInput }>(
    '/api/v1/books',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title'],
          properties: bookProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.put<{ Params: { id: string }; Body: BookUpdateInput }>(
    '/api/v1/books/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...bookProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/books/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/books/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );

  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/books/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: ChapterInput }>(
    '/api/v1/books/:id/chapters',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'startPage', 'endPage'],
          properties: chapterProperties,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createChapter(request.params.id, request.body)),
  );

  app.get<{ Params: { id: string; chapterId: string } }>(
    '/api/v1/books/:id/chapters/:chapterId',
    { config: { authenticated: true }, schema: { params: chapterParams } },
    async (request) => service.getChapter(request.params.id, request.params.chapterId),
  );

  app.put<{
    Params: { id: string; chapterId: string };
    Body: ChapterUpdateInput;
  }>(
    '/api/v1/books/:id/chapters/:chapterId',
    {
      config: { authenticated: true },
      schema: {
        params: chapterParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...chapterProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) =>
      service.updateChapter(request.params.id, request.params.chapterId, request.body),
  );

  app.delete<{
    Params: { id: string; chapterId: string };
    Body: { version: number };
  }>(
    '/api/v1/books/:id/chapters/:chapterId',
    { config: { authenticated: true }, schema: { params: chapterParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteChapter(
        request.params.id,
        request.params.chapterId,
        request.body.version,
      );
      return reply.status(204).send();
    },
  );
}
