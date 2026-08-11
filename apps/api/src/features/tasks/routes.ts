import type { TaskInput, TaskUpdateInput } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { TaskService } from './service.js';

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

const nullableDateTime = {
  anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
} as const;

const nullableUuid = {
  anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
} as const;

const taskProperties = {
  title: { type: 'string', minLength: 1, maxLength: 240 },
  description: { type: 'string', maxLength: 20_000 },
  status: { type: 'string', enum: ['todo', 'in-progress'] },
  priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
  dueAt: nullableDateTime,
  recurrence: { type: 'string', enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'] },
  parentId: nullableUuid,
} as const;

const taskUpdateProperties = {
  ...taskProperties,
  status: { type: 'string', enum: ['todo', 'in-progress', 'completed'] },
} as const;

export async function registerTaskRoutes(
  app: FastifyInstance,
  service: TaskService,
): Promise<void> {
  app.get<{
    Querystring: {
      status?: 'open' | 'todo' | 'in-progress' | 'completed' | 'archived';
      limit?: number;
    };
  }>(
    '/api/v1/tasks',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: {
              type: 'string',
              enum: ['open', 'todo', 'in-progress', 'completed', 'archived'],
            },
            limit: { type: 'integer', minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/tasks/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: TaskInput }>(
    '/api/v1/tasks',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title'],
          properties: taskProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.put<{ Params: { id: string }; Body: TaskUpdateInput }>(
    '/api/v1/tasks/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...taskUpdateProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/tasks/:id/complete',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.complete(request.params.id, request.body.version),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/tasks/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/tasks/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );

  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/tasks/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
