import type { InboxItemInput, InboxItemUpdateInput } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { InboxService } from './service.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;
const versionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;
const nullableUuid = { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] } as const;
const properties = {
  type: { type: 'string', enum: ['idea', 'inspiration', 'snippet', 'article', 'link', 'file'] },
  title: { type: 'string', minLength: 1, maxLength: 240 },
  content: { type: 'string', maxLength: 50_000 },
  url: { type: 'string', maxLength: 4000 },
  fileId: nullableUuid,
  status: { type: 'string', enum: ['inbox', 'processed'] },
} as const;

export async function registerInboxRoutes(
  app: FastifyInstance,
  service: InboxService,
): Promise<void> {
  app.get<{ Querystring: { status?: 'inbox' | 'processed' | 'archived'; limit?: number } }>(
    '/api/v1/inbox-items',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['inbox', 'processed', 'archived'] },
            limit: { type: 'integer', minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );
  app.get<{ Params: { id: string } }>(
    '/api/v1/inbox-items/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );
  app.post<{ Body: InboxItemInput }>(
    '/api/v1/inbox-items',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title'],
          properties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );
  app.put<{ Params: { id: string }; Body: InboxItemUpdateInput }>(
    '/api/v1/inbox-items/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...properties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inbox-items/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inbox-items/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inbox-items/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
