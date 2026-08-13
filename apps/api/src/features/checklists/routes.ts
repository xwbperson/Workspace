import type {
  ChecklistInput,
  ChecklistItemInput,
  ChecklistItemUpdateInput,
  ChecklistUpdateInput,
} from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { ChecklistService } from './service.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

const itemParams = {
  type: 'object',
  required: ['id', 'itemId'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
  },
} as const;

const checklistProperties = {
  name: { type: 'string', minLength: 1, maxLength: 120 },
  note: { type: 'string', maxLength: 20_000 },
} as const;

const itemProperties = {
  name: { type: 'string', minLength: 1, maxLength: 240 },
  note: { type: 'string', maxLength: 2_000 },
  quantity: {
    anyOf: [{ type: 'number', exclusiveMinimum: 0, maximum: 999_999 }, { type: 'null' }],
  },
  unit: { type: 'string', maxLength: 20 },
  price: { anyOf: [{ type: 'number', minimum: 0, maximum: 10_000_000 }, { type: 'null' }] },
} as const;

const versionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;

export async function registerChecklistRoutes(
  app: FastifyInstance,
  service: ChecklistService,
): Promise<void> {
  app.get<{ Querystring: { status?: 'active' | 'archived'; limit?: number } }>(
    '/api/v1/checklists',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['active', 'archived'] },
            limit: { type: 'integer', minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/checklists/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: ChecklistInput }>(
    '/api/v1/checklists',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: checklistProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.put<{ Params: { id: string }; Body: ChecklistUpdateInput }>(
    '/api/v1/checklists/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...checklistProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/checklists/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/checklists/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );

  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/checklists/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: ChecklistItemInput }>(
    '/api/v1/checklists/:id/items',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: itemProperties,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.addItem(request.params.id, request.body)),
  );

  app.post<{
    Params: { id: string; itemId: string };
    Body: { checked: boolean; version: number };
  }>(
    '/api/v1/checklists/:id/items/:itemId/check',
    {
      config: { authenticated: true },
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['checked', 'version'],
          properties: {
            checked: { type: 'boolean' },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) =>
      service.checkItem(
        request.params.id,
        request.params.itemId,
        request.body.checked,
        request.body.version,
      ),
  );

  app.put<{
    Params: { id: string; itemId: string };
    Body: ChecklistItemUpdateInput;
  }>(
    '/api/v1/checklists/:id/items/:itemId',
    {
      config: { authenticated: true },
      schema: {
        params: itemParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...itemProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updateItem(request.params.id, request.params.itemId, request.body),
  );

  app.delete<{ Params: { id: string; itemId: string }; Body: { version: number } }>(
    '/api/v1/checklists/:id/items/:itemId',
    { config: { authenticated: true }, schema: { params: itemParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteItem(request.params.id, request.params.itemId, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/checklists/:id/reset',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.reset(request.params.id, request.body.version),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/checklists/:id/clear-checked',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.clearChecked(request.params.id, request.body.version),
  );
}
