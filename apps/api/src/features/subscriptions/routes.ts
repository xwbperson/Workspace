import type {
  SubscriptionInput,
  SubscriptionStatus,
  SubscriptionUpdateInput,
} from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { SubscriptionService } from './service.js';

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
const properties = {
  name: { type: 'string', minLength: 1, maxLength: 240 },
  category: { type: 'string', enum: ['software', 'membership', 'domain', 'server', 'other'] },
  amount: { type: 'number', minimum: 0 },
  currency: { type: 'string', minLength: 3, maxLength: 3 },
  billingCycle: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'] },
  renewalDate: { type: 'string', format: 'date' },
  autoRenew: { type: 'boolean' },
  note: { type: 'string', maxLength: 5000 },
  status: { type: 'string', enum: ['active', 'expired'] },
} as const;

export async function registerSubscriptionRoutes(
  app: FastifyInstance,
  service: SubscriptionService,
): Promise<void> {
  app.get<{ Querystring: { status?: SubscriptionStatus; limit?: number } }>(
    '/api/v1/subscriptions',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['active', 'expired', 'archived'] },
            limit: { type: 'integer', minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );
  app.get<{ Params: { id: string } }>(
    '/api/v1/subscriptions/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );
  app.post<{ Body: SubscriptionInput }>(
    '/api/v1/subscriptions',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'category', 'amount', 'billingCycle', 'renewalDate'],
          properties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );
  app.put<{ Params: { id: string }; Body: SubscriptionUpdateInput }>(
    '/api/v1/subscriptions/:id',
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
    '/api/v1/subscriptions/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/subscriptions/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/subscriptions/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
