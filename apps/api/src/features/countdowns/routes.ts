import type { CountdownInput, CountdownUpdateInput } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { CountdownService } from './service.js';

const uuidParamsSchema = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const versionBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;

export async function registerCountdownRoutes(
  app: FastifyInstance,
  service: CountdownService,
): Promise<void> {
  app.get<{
    Querystring: {
      status?: 'active' | 'completed' | 'archived';
      cursor?: string;
      limit?: number;
    };
  }>(
    '/api/v1/countdowns',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['active', 'completed', 'archived'] },
            cursor: { type: 'string', minLength: 1, maxLength: 500 },
            limit: { type: 'integer', minimum: 1, maximum: 50 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/countdowns/:id',
    { config: { authenticated: true }, schema: { params: uuidParamsSchema } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: CountdownInput }>(
    '/api/v1/countdowns',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'targetAt'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            note: { type: 'string', maxLength: 500 },
            targetAt: { type: 'string', format: 'date-time' },
            priority: { type: 'integer', minimum: 0, maximum: 100 },
          },
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.put<{ Params: { id: string }; Body: CountdownUpdateInput }>(
    '/api/v1/countdowns/:id',
    {
      config: { authenticated: true },
      schema: {
        params: uuidParamsSchema,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 120 },
            note: { type: 'string', maxLength: 500 },
            targetAt: { type: 'string', format: 'date-time' },
            status: { type: 'string', enum: ['active', 'completed'] },
            priority: { type: 'integer', minimum: 0, maximum: 100 },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/countdowns/:id/archive',
    {
      config: { authenticated: true },
      schema: {
        params: uuidParamsSchema,
        body: versionBodySchema,
      },
    },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/countdowns/:id/restore',
    {
      config: { authenticated: true },
      schema: { params: uuidParamsSchema, body: versionBodySchema },
    },
    async (request) => service.restore(request.params.id, request.body.version),
  );

  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/countdowns/:id',
    {
      config: { authenticated: true },
      schema: { params: uuidParamsSchema, body: versionBodySchema },
    },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
