import type { WorkbenchPreferences } from '@workspace/client-sdk';
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.js';
import type { AuthService } from '../platform/auth/service.js';
import { getMigrationVersion } from '../platform/database/migrate.js';
import type { Database } from '../platform/database/types.js';
import type { NotificationRepository } from '../platform/notifications/repository.js';
import type { WorkbenchService } from './workbench-service.js';

export async function registerWorkbenchRoutes(
  app: FastifyInstance,
  dependencies: {
    config: AppConfig;
    database: Database;
    authService: AuthService;
    workbench: WorkbenchService;
    notifications: NotificationRepository;
    syncFeatureNotifications: () => Promise<void>;
  },
): Promise<void> {
  const { config, database, authService, workbench, notifications, syncFeatureNotifications } =
    dependencies;

  app.get('/api/v1/workbench/features', { config: { authenticated: true } }, async () =>
    workbench.featureStates(),
  );

  app.get('/api/v1/workbench/overview/definitions', { config: { authenticated: true } }, async () =>
    workbench.overviewDefinitions(),
  );

  app.get<{ Querystring: { blockIds?: string } }>(
    '/api/v1/workbench/overview',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { blockIds: { type: 'string', maxLength: 1000 } },
        },
      },
    },
    async (request) =>
      workbench.overview(
        (request.query.blockIds ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
  );

  app.get('/api/v1/workbench/preferences', { config: { authenticated: true } }, async () =>
    workbench.getPreferences(),
  );

  app.put<{ Body: WorkbenchPreferences }>(
    '/api/v1/workbench/preferences',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: [
            'hiddenFeatureIds',
            'overviewBlockIds',
            'theme',
            'dateDisplay',
            'notificationsEnabled',
            'refreshIntervalMinutes',
          ],
          properties: {
            hiddenFeatureIds: { type: 'array', maxItems: 100, items: { type: 'string' } },
            overviewBlockIds: { type: 'array', maxItems: 100, items: { type: 'string' } },
            theme: { type: 'string', enum: ['system', 'light', 'dark'] },
            dateDisplay: { type: 'string', enum: ['relative', 'absolute'] },
            notificationsEnabled: { type: 'boolean' },
            refreshIntervalMinutes: { type: 'integer', enum: [0, 1, 5, 15, 30] },
          },
        },
      },
    },
    async (request) => workbench.savePreferences(request.body),
  );

  app.get<{ Querystring: { query: string } }>(
    '/api/v1/workbench/search',
    {
      config: { authenticated: true },
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['query'],
          properties: { query: { type: 'string', minLength: 1, maxLength: 100 } },
        },
      },
    },
    async (request) => workbench.search(request.query.query.trim()),
  );

  app.get('/api/v1/workbench/quick-actions', { config: { authenticated: true } }, async () =>
    workbench.quickActions(),
  );

  app.get('/api/v1/workbench/notifications', { config: { authenticated: true } }, async () => {
    await syncFeatureNotifications();
    return notifications.list();
  });

  app.put<{ Params: { notificationId: string } }>(
    '/api/v1/workbench/notifications/:notificationId/read',
    {
      config: { authenticated: true },
      schema: {
        params: {
          type: 'object',
          required: ['notificationId'],
          properties: { notificationId: { type: 'string', minLength: 1, maxLength: 200 } },
        },
      },
    },
    async (request, reply) => {
      await notifications.markRead(request.params.notificationId);
      return reply.status(204).send();
    },
  );

  app.put(
    '/api/v1/workbench/notifications/read-all',
    { config: { authenticated: true } },
    async (_request, reply) => {
      await notifications.markAllRead();
      return reply.status(204).send();
    },
  );

  app.get('/api/v1/workbench/system-status', { config: { authenticated: true } }, async () => {
    const ownerReady = await authService.isOwnerInitialized();
    const backups = await database.query<{
      completed_at: Date | null;
      verified_at: Date | null;
      status: string;
    }>(
      `SELECT completed_at, verified_at, status FROM backup_runs
         WHERE status IN ('complete', 'verified', 'restored')
         ORDER BY COALESCE(verified_at, completed_at) DESC LIMIT 1`,
    );
    const backup = backups.rows[0];
    return {
      connected: true,
      ready: ownerReady,
      version: config.version,
      workspaceId: config.workspaceId,
      databaseMigration: await getMigrationVersion(database),
      ...(backup?.completed_at
        ? { lastSuccessfulBackupAt: backup.completed_at.toISOString() }
        : {}),
      ...(backup?.verified_at ? { lastRestoreVerifiedAt: backup.verified_at.toISOString() } : {}),
      storage: { available: true, root: 'configured' },
      checkedAt: new Date().toISOString(),
    };
  });
}
