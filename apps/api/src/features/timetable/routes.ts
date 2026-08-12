import type {
  TimetableAdjustmentInput,
  TimetableAdjustmentUpdateInput,
  TimetableCourseInput,
  TimetableCourseUpdateInput,
  TimetableSemesterInput,
  TimetableSemesterUpdateInput,
  TimetableTimeBlocksUpdateInput,
} from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { TimetableService } from './service.js';

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
} as const;
const courseIdParams = {
  type: 'object',
  required: ['courseId'],
  properties: { courseId: { type: 'string', format: 'uuid' } },
} as const;
const semesterIdParams = {
  type: 'object',
  required: ['semesterId'],
  properties: { semesterId: { type: 'string', format: 'uuid' } },
} as const;
const versionBody = {
  type: 'object',
  additionalProperties: false,
  required: ['version'],
  properties: { version: { type: 'integer', minimum: 1 } },
} as const;
const statusProperty = { type: 'string', enum: ['active', 'archived'] } as const;
const semesterProperties = {
  name: { type: 'string', minLength: 1, maxLength: 120 },
  shortName: { type: 'string', minLength: 1, maxLength: 40 },
  firstWeekMonday: { type: 'string', format: 'date' },
  totalWeeks: { type: 'integer', minimum: 1, maximum: 30 },
  showWeekend: { type: 'boolean' },
  makeCurrent: { type: 'boolean' },
} as const;
const colorProperty = {
  type: 'string',
  enum: ['teal', 'blue', 'violet', 'amber', 'rose', 'slate'],
} as const;
const stringArray = {
  type: 'array',
  maxItems: 12,
  uniqueItems: true,
  items: { type: 'string', minLength: 1, maxLength: 40 },
} as const;
const meetingProperties = {
  id: { type: 'string', format: 'uuid' },
  timeBlockId: { type: 'string', format: 'uuid' },
  weekday: { type: 'integer', minimum: 1, maximum: 7 },
  room: { type: 'string', maxLength: 120 },
  instructorOverride: stringArray,
  weekNumbers: {
    type: 'array',
    minItems: 1,
    maxItems: 30,
    uniqueItems: true,
    items: { type: 'integer', minimum: 1, maximum: 30 },
  },
} as const;
const meetingsProperty = {
  type: 'array',
  minItems: 1,
  maxItems: 20,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['timeBlockId', 'weekday', 'weekNumbers'],
    properties: meetingProperties,
  },
} as const;
const courseProperties = {
  semesterId: { type: 'string', format: 'uuid' },
  name: { type: 'string', minLength: 1, maxLength: 80 },
  shortName: { type: 'string', maxLength: 30 },
  instructors: stringArray,
  color: colorProperty,
  notes: { type: 'string', maxLength: 5000 },
  meetings: meetingsProperty,
  allowConflicts: { type: 'boolean' },
} as const;
const nullableDate = { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] } as const;
const nullableUuid = { anyOf: [{ type: 'string', format: 'uuid' }, { type: 'null' }] } as const;
const nullableString = { anyOf: [{ type: 'string', maxLength: 120 }, { type: 'null' }] } as const;
const nullableNames = { anyOf: [stringArray, { type: 'null' }] } as const;
const adjustmentProperties = {
  meetingId: { type: 'string', format: 'uuid' },
  originalDate: { type: 'string', format: 'date' },
  type: { type: 'string', enum: ['cancel', 'reschedule', 'override'] },
  newDate: nullableDate,
  newTimeBlockId: nullableUuid,
  room: nullableString,
  instructors: nullableNames,
  note: { type: 'string', maxLength: 1000 },
} as const;

export async function registerTimetableRoutes(
  app: FastifyInstance,
  service: TimetableService,
): Promise<void> {
  app.get<{ Querystring: { status?: 'active' | 'archived' } }>(
    '/api/v1/timetable/semesters',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { status: statusProperty },
        },
      },
    },
    async (request) => service.listSemesters(request.query.status),
  );
  app.get<{ Params: { semesterId: string } }>(
    '/api/v1/timetable/semesters/:semesterId',
    { config: { authenticated: true }, schema: { params: semesterIdParams } },
    async (request) => service.getSemester(request.params.semesterId),
  );
  app.post<{ Body: TimetableSemesterInput }>(
    '/api/v1/timetable/semesters',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'shortName', 'firstWeekMonday', 'totalWeeks'],
          properties: semesterProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createSemester(request.body)),
  );
  app.put<{ Params: { semesterId: string }; Body: TimetableSemesterUpdateInput }>(
    '/api/v1/timetable/semesters/:semesterId',
    {
      config: { authenticated: true },
      schema: {
        params: semesterIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...semesterProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updateSemester(request.params.semesterId, request.body),
  );
  app.put<{ Params: { semesterId: string }; Body: TimetableTimeBlocksUpdateInput }>(
    '/api/v1/timetable/semesters/:semesterId/time-blocks',
    {
      config: { authenticated: true },
      schema: {
        params: semesterIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['semesterVersion', 'blocks'],
          properties: {
            semesterVersion: { type: 'integer', minimum: 1 },
            blocks: {
              type: 'array',
              minItems: 5,
              maxItems: 5,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['id', 'label', 'startTime', 'endTime', 'position', 'version'],
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  label: { type: 'string', minLength: 1, maxLength: 20 },
                  sourceLabel: { type: 'string', maxLength: 40 },
                  startTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
                  endTime: { type: 'string', pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },
                  position: { type: 'integer', minimum: 1, maximum: 5 },
                  version: { type: 'integer', minimum: 1 },
                },
              },
            },
          },
        },
      },
    },
    async (request) => service.updateTimeBlocks(request.params.semesterId, request.body),
  );
  app.post<{ Params: { semesterId: string }; Body: { version: number } }>(
    '/api/v1/timetable/semesters/:semesterId/archive',
    { config: { authenticated: true }, schema: { params: semesterIdParams, body: versionBody } },
    async (request, reply) => {
      await service.archiveSemester(request.params.semesterId, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { semesterId: string }; Body: { version: number } }>(
    '/api/v1/timetable/semesters/:semesterId/restore',
    { config: { authenticated: true }, schema: { params: semesterIdParams, body: versionBody } },
    async (request) => service.restoreSemester(request.params.semesterId, request.body.version),
  );
  app.delete<{ Params: { semesterId: string }; Body: { version: number } }>(
    '/api/v1/timetable/semesters/:semesterId',
    { config: { authenticated: true }, schema: { params: semesterIdParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteSemesterPermanently(request.params.semesterId, request.body.version);
      return reply.status(204).send();
    },
  );

  app.get<{
    Querystring: { semesterId: string; status?: 'active' | 'archived' };
  }>(
    '/api/v1/timetable/courses',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['semesterId'],
          properties: {
            semesterId: { type: 'string', format: 'uuid' },
            status: statusProperty,
          },
        },
      },
    },
    async (request) => service.listCourses(request.query),
  );
  app.get<{ Params: { id: string } }>(
    '/api/v1/timetable/courses/:id',
    { config: { authenticated: true }, schema: { params: idParams } },
    async (request) => service.getCourse(request.params.id),
  );
  app.post<{ Body: TimetableCourseInput }>(
    '/api/v1/timetable/courses',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['semesterId', 'name', 'meetings'],
          properties: courseProperties,
        },
      },
    },
    async (request, reply) => reply.status(201).send(await service.createCourse(request.body)),
  );
  app.put<{ Params: { id: string }; Body: TimetableCourseUpdateInput }>(
    '/api/v1/timetable/courses/:id',
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
    async (request) => service.updateCourse(request.params.id, request.body),
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/timetable/courses/:id/archive',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.archiveCourse(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
  app.post<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/timetable/courses/:id/restore',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request) => service.restoreCourse(request.params.id, request.body.version),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/timetable/courses/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteCoursePermanently(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );

  app.get<{ Querystring: { semesterId?: string; week: number } }>(
    '/api/v1/timetable/occurrences',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['week'],
          properties: {
            semesterId: { type: 'string', format: 'uuid' },
            week: { type: 'integer', minimum: 1, maximum: 30 },
          },
        },
      },
    },
    async (request) => service.occurrences(request.query),
  );

  app.post<{ Params: { courseId: string }; Body: TimetableAdjustmentInput }>(
    '/api/v1/timetable/courses/:courseId/adjustments',
    {
      config: { authenticated: true },
      schema: {
        params: courseIdParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['meetingId', 'originalDate', 'type'],
          properties: adjustmentProperties,
        },
      },
    },
    async (request, reply) =>
      reply.status(201).send(await service.createAdjustment(request.params.courseId, request.body)),
  );
  app.put<{ Params: { id: string }; Body: TimetableAdjustmentUpdateInput }>(
    '/api/v1/timetable/adjustments/:id',
    {
      config: { authenticated: true },
      schema: {
        params: idParams,
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['version'],
          properties: { ...adjustmentProperties, version: { type: 'integer', minimum: 1 } },
        },
      },
    },
    async (request) => service.updateAdjustment(request.params.id, request.body),
  );
  app.delete<{ Params: { id: string }; Body: { version: number } }>(
    '/api/v1/timetable/adjustments/:id',
    { config: { authenticated: true }, schema: { params: idParams, body: versionBody } },
    async (request, reply) => {
      await service.deleteAdjustment(request.params.id, request.body.version);
      return reply.status(204).send();
    },
  );
}
