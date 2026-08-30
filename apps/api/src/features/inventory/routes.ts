import type {
  InventoryGroupInput,
  InventoryGroupUpdateInput,
  InventoryItemInput,
  InventoryItemStatus,
  InventoryItemUpdateInput,
  InventoryStockFilter,
} from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { InventoryService } from './service.js';

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
const itemProperties = {
  name: { type: 'string', minLength: 1, maxLength: 120 },
  purpose: { type: 'string', maxLength: 500 },
  note: { type: 'string', maxLength: 2000 },
  quantity: { type: 'integer', minimum: 0, maximum: 999999 },
  groupId: { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] },
} as const;

export async function registerInventoryRoutes(
  app: FastifyInstance,
  service: InventoryService,
): Promise<void> {
  app.get('/api/v1/inventory-groups', { config: { authenticated: true } }, async () =>
    service.listGroups(),
  );
  app.post<{ Body: InventoryGroupInput }>(
    '/api/v1/inventory-groups',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: { name: { type: 'string', minLength: 1, maxLength: 80 } },
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createGroup(request.body)),
  );
  app.put<{ Params: { id: string }; Body: InventoryGroupUpdateInput }>(
    '/api/v1/inventory-groups/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'version'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 80 },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) => service.updateGroup(request.params.id, request.body),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inventory-groups/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteGroup(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.get<{
    Querystring: {
      status?: InventoryItemStatus;
      stock?: InventoryStockFilter;
      groupId?: string;
      query?: string;
      limit?: number;
    };
  }>(
    '/api/v1/inventory-items',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: ['active', 'archived'] },
            stock: { type: 'string', enum: ['all', 'zero', 'positive'] },
            groupId: {
              anyOf: [
                { type: 'string', format: 'uuid' },
                { type: 'string', enum: ['ungrouped'] },
              ],
            },
            query: { type: 'string', maxLength: 200 },
            limit: { type: 'integer', minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (request) => service.listItems(request.query),
  );
  app.get<{ Params: { id: string } }>(
    '/api/v1/inventory-items/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.getItem(request.params.id),
  );
  app.post<{ Body: InventoryItemInput }>(
    '/api/v1/inventory-items',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'quantity'],
          properties: itemProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createItem(request.body)),
  );
  app.put<{ Params: { id: string }; Body: InventoryItemUpdateInput }>(
    '/api/v1/inventory-items/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...itemProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updateItem(request.params.id, request.body),
  );
  app.post<{ Params: { id: string }; Body: { delta: -1 | 1 } }>(
    '/api/v1/inventory-items/:id/adjust-quantity',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['delta'],
          properties: { delta: { type: 'integer', enum: [-1, 1] } },
        },
      },
    },
    async (request) => service.adjustQuantity(request.params.id, request.body.delta),
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inventory-items/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archiveItem(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inventory-items/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restoreItem(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/inventory-items/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteItemPermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
