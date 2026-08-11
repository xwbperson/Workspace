import type { FastifyInstance } from 'fastify';
import { createBookContributions } from '../features/books/contributions.js';
import { BookRepository } from '../features/books/repository.js';
import { registerBookRoutes } from '../features/books/routes.js';
import { BookService } from '../features/books/service.js';
import { createCourseContributions } from '../features/courses/contributions.js';
import { CourseRepository } from '../features/courses/repository.js';
import { registerCourseRoutes } from '../features/courses/routes.js';
import { CourseService } from '../features/courses/service.js';
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
import type { FileStorageService } from '../platform/files/service.js';
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
  files: FileStorageService,
): readonly FeatureRegistration[] {
  const books = new BookRepository(database);
  const bookService = new BookService(books, files);
  const courses = new CourseRepository(database);
  const courseService = new CourseService(courses, books, files);
  const countdowns = new CountdownRepository(database);
  const countdownService = new CountdownService(countdowns);

  return [
    {
      featureId: 'books',
      contribution: createBookContributions(books),
      registerRoutes: async (app) => registerBookRoutes(app, bookService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'courses',
      contribution: createCourseContributions(courses),
      registerRoutes: async (app) => registerCourseRoutes(app, courseService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
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
