import type { LifeEventInput, LifeEventUpdateInput, LifeProfileInput } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { LifeCountdownService } from './service.js';
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
const eventProperties = {
  title: { type: 'string', minLength: 1, maxLength: 240 },
  targetAt: { type: 'string', format: 'date-time' },
  note: { type: 'string', maxLength: 5000 },
} as const;
export async function registerLifeCountdownRoutes(
  app: FastifyInstance,
  service: LifeCountdownService,
): Promise<void> {
  app.get<{ Querystring: { status?: 'active' | 'archived' } }>(
    '/api/v1/life-countdown',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { status: { type: 'string', enum: ['active', 'archived'] } },
        },
      },
    },
    async (request) => service.dashboard(request.query.status),
  );
  app.put<{ Body: LifeProfileInput }>(
    '/api/v1/life-countdown/profile',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['birthDate', 'expectedAge', 'version'],
          properties: {
            birthDate: { type: 'string', format: 'date' },
            expectedAge: { type: 'integer', minimum: 1, maximum: 150 },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => service.updateProfile(request.body),
  );
  app.post<{ Body: LifeEventInput }>(
    '/api/v1/life-countdown/events',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'targetAt'],
          properties: eventProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createEvent(request.body)),
  );
  app.put<{ Params: { id: string }; Body: LifeEventUpdateInput }>(
    '/api/v1/life-countdown/events/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...eventProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updateEvent(request.params.id, request.body),
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/life-countdown/events/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archiveEvent(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/life-countdown/events/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restoreEvent(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/life-countdown/events/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteEvent(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
