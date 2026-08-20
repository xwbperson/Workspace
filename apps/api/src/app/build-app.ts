import { randomUUID } from 'node:crypto';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import swagger from '@fastify/swagger';
import Fastify, { type FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import { AuthRepository } from '../platform/auth/repository.js';
import { registerAuthenticationHooks, registerAuthRoutes } from '../platform/auth/http.js';
import { AuthService } from '../platform/auth/service.js';
import type { Database } from '../platform/database/types.js';
import { AppError } from '../platform/errors.js';
import { registerFileRoutes } from '../platform/files/routes.js';
import { FileStorageService, startFileCleanup } from '../platform/files/service.js';
import { NotificationRepository } from '../platform/notifications/repository.js';
import { PreferencesRepository } from '../platform/preferences/repository.js';
import { registerWorkbenchRoutes } from './workbench-routes.js';
import { WorkbenchService } from './workbench-service.js';
import { createFeatureRegistry } from './feature-registry.js';

export interface BuildAppOptions {
  config: AppConfig;
  database: Database;
  startSchedulers?: boolean;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { config, database } = options;
  const app = Fastify({
    logger: {
      level: config.logLevel,
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.x-csrf-token',
          'request.headers.cookie',
          'request.headers.x-csrf-token',
          '*.password',
          '*.currentPassword',
          '*.newPassword',
        ],
        censor: '[REDACTED]',
      },
    },
    genReqId: () => randomUUID(),
    trustProxy: config.nodeEnv === 'production' ? 1 : false,
    bodyLimit: 1_048_576,
  });

  await app.register(cookie);
  await app.register(multipart, {
    limits: { files: 1, fileSize: 50 * 1024 * 1024, fields: 5 },
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'same-origin' },
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Personal Workbench API',
        description: '固定单账户个人工作台的稳定 HTTP 契约。',
        version: config.version,
      },
      servers: [{ url: '/api/v1' }],
    },
  });

  const authRepository = new AuthRepository(database);
  const authService = new AuthService(authRepository, config);
  const notifications = new NotificationRepository(database, config.workspaceId);
  const files = new FileStorageService(database, config);
  const preferences = new PreferencesRepository(database, config.workspaceId);
  const features = createFeatureRegistry(database, notifications, files);
  const contributions = features.map((feature) => feature.contribution);
  const workbench = new WorkbenchService(contributions, preferences);

  registerAuthenticationHooks(app, config, authService);

  app.get('/health/live', { config: { public: true } }, async () => ({ status: 'ok' }));
  app.get('/health/ready', { config: { public: true } }, async (_request, reply) => {
    try {
      await database.query('SELECT 1');
      const ownerReady = await authService.isOwnerInitialized();
      return reply.status(ownerReady ? 200 : 503).send({
        status: ownerReady ? 'ready' : 'not-ready',
        checks: { database: true, ownerInitialized: ownerReady },
      });
    } catch {
      return reply.status(503).send({
        status: 'not-ready',
        checks: { database: false, ownerInitialized: false },
      });
    }
  });

  await registerAuthRoutes(app, config, authService);
  await registerFileRoutes(app, files);
  for (const feature of features) await feature.registerRoutes(app);
  await registerWorkbenchRoutes(app, {
    config,
    database,
    authService,
    workbench,
    notifications,
    syncFeatureNotifications: async () => {
      await Promise.all(features.map((feature) => feature.syncNotifications()));
    },
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
        requestId: request.id,
      });
    }
    const validation = (error as { validation?: unknown }).validation;
    if (validation) {
      return reply.status(400).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: '请求内容不符合接口要求。',
          details: validation,
        },
        requestId: request.id,
      });
    }
    request.log.error({ err: error }, 'Unhandled request error');
    return reply.status(500).send({
      error: { code: 'INTERNAL_ERROR', message: '服务暂时无法完成请求。' },
      requestId: request.id,
    });
  });

  const stopSchedulers: Array<() => void> = [];
  if (options.startSchedulers !== false) {
    stopSchedulers.push(
      startFileCleanup(files, (error) =>
        app.log.error({ err: error }, 'Unreferenced file cleanup failed'),
      ),
    );
    for (const feature of features) {
      stopSchedulers.push(
        feature.startScheduler((error) =>
          app.log.error({ err: error, featureId: feature.featureId }, 'Feature scheduler failed'),
        ),
      );
    }
  } else {
    await Promise.all(features.map((feature) => feature.syncNotifications()));
  }

  app.addHook('onClose', async () => {
    for (const stopScheduler of stopSchedulers) stopScheduler();
    await database.end();
  });
  return app;
}
