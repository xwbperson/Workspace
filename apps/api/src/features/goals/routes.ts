import type { GoalInput, GoalMeasurementInput, GoalUpdateInput } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { GoalService } from './service.js';

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

const keyResult = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'progress', 'completed'],
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    progress: { type: 'number', minimum: 0, maximum: 100 },
    completed: { type: 'boolean' },
  },
} as const;

const metric = {
  type: 'object',
  additionalProperties: false,
  required: ['startValue', 'targetValue', 'currentValue', 'unit', 'direction'],
  properties: {
    startValue: { type: 'number' },
    targetValue: { type: 'number' },
    currentValue: { type: 'number' },
    unit: { type: 'string', maxLength: 40 },
    direction: { type: 'string', enum: ['increase', 'decrease'] },
  },
} as const;

const goalProperties = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 10_000 },
  periodType: { type: 'string', enum: ['annual', 'quarterly', 'monthly'] },
  periodLabel: { type: 'string', minLength: 1, maxLength: 80 },
  startDate: { type: 'string', format: 'date' },
  endDate: { type: 'string', format: 'date' },
  status: { type: 'string', enum: ['active', 'completed'] },
  metric: { anyOf: [metric, { type: 'null' }] },
  keyResults: { type: 'array', maxItems: 20, items: keyResult },
} as const;

export async function registerGoalRoutes(
  app: FastifyInstance,
  service: GoalService,
): Promise<void> {
  app.get<{ Querystring: { status?: 'active' | 'completed' | 'archived'; limit?: number } }>(
    '/api/v1/goals',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['active', 'completed', 'archived'] },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/goals/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: GoalInput }>(
    '/api/v1/goals',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'periodType', 'periodLabel', 'startDate', 'endDate'],
          properties: goalProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.put<{ Params: { id: string }; Body: GoalUpdateInput }>(
    '/api/v1/goals/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...goalProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post<{ Params: { id: string }; Body: GoalMeasurementInput }>(
    '/api/v1/goals/:id/measurements',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['value', 'version'],
          properties: {
            value: { type: 'number' },
            note: { type: 'string', maxLength: 500 },
            recordedAt: { type: 'string', format: 'date-time' },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.addMeasurement(request.params.id, request.body)),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/goals/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/goals/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );

  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/goals/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
