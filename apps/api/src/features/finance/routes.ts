import type {
  FinanceAccountInput,
  FinanceAccountUpdateInput,
  FinanceDebtPlatformInput,
  FinanceDebtPlatformUpdateInput,
  FinanceDebtRecordInput,
} from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { FinanceService } from './service.js';

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
const accountProperties = {
  type: {
    type: 'string',
    enum: ['cash', 'alipay', 'wechat', 'bank', 'credit', 'digital-cny', 'other'],
  },
  name: { type: 'string', minLength: 1, maxLength: 200 },
  balance: { type: 'number' },
  cardNumber: { type: 'string', minLength: 1, maxLength: 100 },
  phone: { type: 'string', minLength: 1, maxLength: 50 },
  creditLimit: { type: 'number', minimum: 0 },
  note: { type: 'string', maxLength: 5000 },
} as const;
const platformProperties = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  billingDay: { anyOf: [{ type: 'integer', minimum: 1, maximum: 31 }, { type: 'null' }] },
  repaymentDay: { anyOf: [{ type: 'integer', minimum: 1, maximum: 31 }, { type: 'null' }] },
  fixedLimit: { type: 'number', minimum: 0 },
  temporaryLimit: { type: 'number', minimum: 0 },
  remainingLimit: { type: 'number', minimum: 0 },
  note: { type: 'string', maxLength: 5000 },
} as const;

export async function registerFinanceRoutes(
  app: FastifyInstance,
  service: FinanceService,
): Promise<void> {
  app.get<{ Querystring: { year: number; month: number } }>(
    '/api/v1/finance/summary',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['year', 'month'],
          properties: {
            year: { type: 'integer', minimum: 1900, maximum: 2200 },
            month: { type: 'integer', minimum: 1, maximum: 12 },
          },
        },
      },
    },
    async (request) => service.summary(request.query.year, request.query.month),
  );
  app.get<{ Querystring: { archived?: boolean } }>(
    '/api/v1/finance/accounts',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { archived: { type: 'boolean' } },
        },
      },
    },
    async (request) => service.listAccounts(request.query.archived),
  );
  app.post<{ Body: FinanceAccountInput }>(
    '/api/v1/finance/accounts',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['type'],
          properties: accountProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createAccount(request.body)),
  );
  app.put<{ Params: { id: string }; Body: FinanceAccountUpdateInput }>(
    '/api/v1/finance/accounts/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...accountProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updateAccount(request.params.id, request.body),
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/accounts/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archiveAccount(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/accounts/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restoreAccount(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/accounts/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteAccount(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.get<{ Querystring: { archived?: boolean } }>(
    '/api/v1/finance/debt-platforms',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { archived: { type: 'boolean' } },
        },
      },
    },
    async (request) => service.listPlatforms(request.query.archived),
  );
  app.post<{ Body: FinanceDebtPlatformInput }>(
    '/api/v1/finance/debt-platforms',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: platformProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createPlatform(request.body)),
  );
  app.put<{ Params: { id: string }; Body: FinanceDebtPlatformUpdateInput }>(
    '/api/v1/finance/debt-platforms/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...platformProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updatePlatform(request.params.id, request.body),
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/debt-platforms/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archivePlatform(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/debt-platforms/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restorePlatform(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/debt-platforms/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePlatform(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.put<{ Body: FinanceDebtRecordInput & { version?: number } }>(
    '/api/v1/finance/debt-records',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['platformId', 'year', 'month', 'amount'],
          properties: {
            platformId: { type: 'string', format: 'uuid' },
            year: { type: 'integer', minimum: 1900, maximum: 2200 },
            month: { type: 'integer', minimum: 0, maximum: 12 },
            amount: { type: 'number', minimum: 0 },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => service.upsertRecord(request.body),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/finance/debt-records/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteRecord(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
