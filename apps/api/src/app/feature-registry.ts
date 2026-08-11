import type { FastifyInstance } from 'fastify';
import { createCountdownContributions } from '../features/countdowns/contributions.js';
import { CountdownRepository } from '../features/countdowns/repository.js';
import { registerCountdownRoutes } from '../features/countdowns/routes.js';
import { CountdownService } from '../features/countdowns/service.js';
import {
  startCountdownNotificationScheduler,
  syncReachedCountdownNotifications,
} from '../platform/notifications/countdown-scheduler.js';
import type { NotificationRepository } from '../platform/notifications/repository.js';
import type { Database } from '../platform/database/types.js';
import type { WorkbenchContributionProvider } from './workbench-contracts.js';

export interface FeatureRegistration {
  featureId: string;
  contribution: WorkbenchContributionProvider;
  registerRoutes(app: FastifyInstance): Promise<void>;
  syncNotifications(): Promise<void>;
  startScheduler(onError: (error: unknown) => void): () => void;
}

export function createFeatureRegistry(
  database: Database,
  notifications: NotificationRepository,
): readonly FeatureRegistration[] {
  const countdowns = new CountdownRepository(database);
  const countdownService = new CountdownService(countdowns);

  return [
    {
      featureId: 'countdowns',
      contribution: createCountdownContributions(countdowns),
      registerRoutes: async (app) => registerCountdownRoutes(app, countdownService),
      syncNotifications: async () => {
        await syncReachedCountdownNotifications(countdowns, notifications);
      },
      startScheduler: (onError) =>
        startCountdownNotificationScheduler(countdowns, notifications, onError),
    },
  ];
}
