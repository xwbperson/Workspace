import type { FastifyInstance } from 'fastify';
import type {
  AssignmentInput,
  AssignmentUpdateInput,
  ClassRecordInput,
  ClassRecordUpdateInput,
  CourseInput,
  CourseService,
  CourseUpdateInput,
} from './service.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;

function childParams(name: string) {
  return {
    type: 'object',
    required: ['id', name],
    properties: {
      id: { type: 'string', format: 'uuid' },
      [name]: { type: 'string', format: 'uuid' },
    },
  } as const;
}

const versionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;

const nullableUuid = {
  anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }],
} as const;

const nullableDateTime = {
  anyOf: [{ type: 'string', format: 'date-time' }, { type: 'null' }],
} as const;

const courseProperties = {
  name: { type: 'string', minLength: 1, maxLength: 200 },
  instructor: { type: 'string', maxLength: 200 },
  courseCode: { type: 'string', maxLength: 80 },
  credits: { type: 'number', minimum: 0, maximum: 100 },
  totalHours: { type: 'integer', minimum: 0, maximum: 10_000 },
  objectives: { type: 'string', maxLength: 20_000 },
  description: { type: 'string', maxLength: 20_000 },
  schedule: { type: 'string', maxLength: 5_000 },
  syllabusFileId: nullableUuid,
  referenceBookIds: {
    type: 'array',
    maxItems: 100,
    uniqueItems: true,
    items: { type: 'string', format: 'uuid' },
  },
} as const;

const assignmentProperties = {
  title: { type: 'string', minLength: 1, maxLength: 200 },
  description: { type: 'string', maxLength: 20_000 },
  dueAt: nullableDateTime,
  status: {
    type: 'string',
    enum: ['pending', 'in-progress', 'completed', 'abandoned'],
  },
} as const;

export async function registerCourseRoutes(
  app: FastifyInstance,
  service: CourseService,
): Promise<void> {
  app.get<{ Querystring: { archived?: boolean; limit?: number } }>(
    '/api/v1/courses',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            archived: { type: 'boolean' },
            limit: { type: 'integer', minimum: 1, maximum: 100 },
          },
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.get<{ Params: { id: string } }>(
    '/api/v1/courses/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.get(request.params.id),
  );

  app.post<{ Body: CourseInput }>(
    '/api/v1/courses',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: courseProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.create(request.body)),
  );

  app.put<{ Params: { id: string }; Body: CourseUpdateInput }>(
    '/api/v1/courses/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...courseProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.update(request.params.id, request.body),
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/courses/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archive(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/courses/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restore(request.params.id, request.body.version),
  );

  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/courses/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deletePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: ClassRecordInput }>(
    '/api/v1/courses/:id/class-records',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['occurredAt', 'content'],
          properties: {
            occurredAt: { type: 'string', format: 'date-time' },
            content: { type: 'string', minLength: 1, maxLength: 20_000 },
          },
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createClassRecord(request.params.id, request.body)),
  );

  app.put<{
    Params: { id: string; recordId: string };
    Body: ClassRecordUpdateInput;
  }>(
    '/api/v1/courses/:id/class-records/:recordId',
    {
      config: { authenticated: true },
      schema: {
        params: childParams('recordId'),
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: {
            occurredAt: { type: 'string', format: 'date-time' },
            content: { type: 'string', minLength: 1, maxLength: 20_000 },
            version: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request) =>
      service.updateClassRecord(request.params.id, request.params.recordId, request.body),
  );

  app.delete<{
    Params: { id: string; recordId: string };
    Body: { version: number };
  }>(
    '/api/v1/courses/:id/class-records/:recordId',
    {
      config: { authenticated: true },
      schema: { params: childParams('recordId'), body: versionBody },
    },
    async (request, reply) => {
      await service.deleteClassRecord(
        request.params.id,
        request.params.recordId,
        request.body.version,
      );
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: AssignmentInput }>(
    '/api/v1/courses/:id/assignments',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['title'],
          properties: assignmentProperties,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createAssignment(request.params.id, request.body)),
  );

  app.put<{
    Params: { id: string; assignmentId: string };
    Body: AssignmentUpdateInput;
  }>(
    '/api/v1/courses/:id/assignments/:assignmentId',
    {
      config: { authenticated: true },
      schema: {
        params: childParams('assignmentId'),
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...assignmentProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) =>
      service.updateAssignment(request.params.id, request.params.assignmentId, request.body),
  );

  app.delete<{
    Params: { id: string; assignmentId: string };
    Body: { version: number };
  }>(
    '/api/v1/courses/:id/assignments/:assignmentId',
    {
      config: { authenticated: true },
      schema: { params: childParams('assignmentId'), body: versionBody },
    },
    async (request, reply) => {
      await service.deleteAssignment(
        request.params.id,
        request.params.assignmentId,
        request.body.version,
      );
      return reply.status(204).send();
    },
  );

  app.post<{ Params: { id: string }; Body: { name: string; position?: number } }>(
    '/api/v1/courses/:id/material-groups',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 200 },
            position: { type: 'integer', minimum: 0, maximum: 1_000_000 },
          },
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createMaterialGroup(request.params.id, request.body)),
  );

  app.delete<{
    Params: { id: string; groupId: string };
    Body: { version: number };
  }>(
    '/api/v1/courses/:id/material-groups/:groupId',
    {
      config: { authenticated: true },
      schema: { params: childParams('groupId'), body: versionBody },
    },
    async (request, reply) => {
      await service.deleteMaterialGroup(
        request.params.id,
        request.params.groupId,
        request.body.version,
      );
      return reply.status(204).send();
    },
  );

  app.post<{
    Params: { id: string };
    Body: { fileId: string; groupId?: string | null; label?: string; position?: number };
  }>(
    '/api/v1/courses/:id/materials',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['fileId'],
          properties: {
            fileId: { type: 'string', format: 'uuid' },
            groupId: nullableUuid,
            label: { type: 'string', maxLength: 240 },
            position: { type: 'integer', minimum: 0, maximum: 1_000_000 },
          },
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createMaterial(request.params.id, request.body)),
  );

  app.delete<{
    Params: { id: string; materialId: string };
    Body: { version: number };
  }>(
    '/api/v1/courses/:id/materials/:materialId',
    {
      config: { authenticated: true },
      schema: { params: childParams('materialId'), body: versionBody },
    },
    async (request, reply) => {
      await service.deleteMaterial(
        request.params.id,
        request.params.materialId,
        request.body.version,
      );
      return reply.status(204).send();
    },
  );
}
