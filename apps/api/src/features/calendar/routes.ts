import type { CalendarEntryInput, CalendarEntryUpdateInput } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { CalendarService } from './service.js';

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
const properties = {
  type: { type: 'string', enum: ['schedule', 'journal', 'summary'] },
  title: { type: 'string', minLength: 1, maxLength: 240 },
  content: { type: 'string', maxLength: 50_000 },
  entryDate: { type: 'string', format: 'date' },
  startsAt: nullableDateTime,
  endsAt: nullableDateTime,
} as const;

export async function registerCalendarRoutes(
  app: FastifyInstance,
  service: CalendarService,
): Promise<void> {
  app.get<{
    Querystring: { from?: string; to?: string; status?: 'active' | 'archived'; limit?: number };
  }>(
    '/api/v1/calendar-entries',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            from: { type: 'string', format: 'date' },
            to: { type: 'string', format: 'date' },
            status: { type: 'string', enum: ['active', 'archived'] },
            limit: { type: 'integer', minimum: 1, maximum: 1000 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );
  app.get<{ Params: { id: string } }>(
    '/api/v1/calendar-entries/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );
  app.post<{ Body: CalendarEntryInput }>(
    '/api/v1/calendar-entries',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'title', 'entryDate'],
          properties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );
  app.put<{ Params: { id: string }; Body: CalendarEntryUpdateInput }>(
    '/api/v1/calendar-entries/:id',
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
    '/api/v1/calendar-entries/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/calendar-entries/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/calendar-entries/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
