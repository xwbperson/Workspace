import type { FastifyInstance } from 'fastify';
import { createBookContributions } from '../features/books/contributions.js';
import { BookRepository } from '../features/books/repository.js';
import { registerBookRoutes } from '../features/books/routes.js';
import { BookService } from '../features/books/service.js';
import { createCalendarContributions } from '../features/calendar/contributions.js';
import { CalendarRepository } from '../features/calendar/repository.js';
import { registerCalendarRoutes } from '../features/calendar/routes.js';
import { CalendarService } from '../features/calendar/service.js';
import { createCourseContributions } from '../features/courses/contributions.js';
import { CourseRepository } from '../features/courses/repository.js';
import { registerCourseRoutes } from '../features/courses/routes.js';
import { CourseService } from '../features/courses/service.js';
import { createCountdownContributions } from '../features/countdowns/contributions.js';
import { CountdownRepository } from '../features/countdowns/repository.js';
import { registerCountdownRoutes } from '../features/countdowns/routes.js';
import { CountdownService } from '../features/countdowns/service.js';
import { createGoalContributions } from '../features/goals/contributions.js';
import { GoalRepository } from '../features/goals/repository.js';
import { registerGoalRoutes } from '../features/goals/routes.js';
import { GoalService } from '../features/goals/service.js';
import { createInboxContributions } from '../features/inbox/contributions.js';
import { InboxRepository } from '../features/inbox/repository.js';
import { registerInboxRoutes } from '../features/inbox/routes.js';
import { InboxService } from '../features/inbox/service.js';
import { createFinanceContributions } from '../features/finance/contributions.js';
import { FinanceRepository } from '../features/finance/repository.js';
import { registerFinanceRoutes } from '../features/finance/routes.js';
import { FinanceService } from '../features/finance/service.js';
import { createLifeCountdownContributions } from '../features/life-countdown/contributions.js';
import { LifeCountdownRepository } from '../features/life-countdown/repository.js';
import { registerLifeCountdownRoutes } from '../features/life-countdown/routes.js';
import { LifeCountdownService } from '../features/life-countdown/service.js';
import { createSubscriptionContributions } from '../features/subscriptions/contributions.js';
import { SubscriptionRepository } from '../features/subscriptions/repository.js';
import { registerSubscriptionRoutes } from '../features/subscriptions/routes.js';
import { SubscriptionService } from '../features/subscriptions/service.js';
import { createTaskContributions } from '../features/tasks/contributions.js';
import { TaskRepository } from '../features/tasks/repository.js';
import { registerTaskRoutes } from '../features/tasks/routes.js';
import { TaskService } from '../features/tasks/service.js';
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
  const goals = new GoalRepository(database);
  const goalService = new GoalService(goals);
  const tasks = new TaskRepository(database);
  const taskService = new TaskService(tasks);
  const calendar = new CalendarRepository(database);
  const calendarService = new CalendarService(calendar);
  const inbox = new InboxRepository(database);
  const inboxService = new InboxService(inbox, files);
  const subscriptions = new SubscriptionRepository(database);
  const subscriptionService = new SubscriptionService(subscriptions);
  const finance = new FinanceRepository(database);
  const financeService = new FinanceService(finance);
  const lifeCountdown = new LifeCountdownRepository(database);
  const lifeCountdownService = new LifeCountdownService(lifeCountdown);

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
    {
      featureId: 'goals',
      contribution: createGoalContributions(goals),
      registerRoutes: async (app) => registerGoalRoutes(app, goalService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'tasks',
      contribution: createTaskContributions(tasks),
      registerRoutes: async (app) => registerTaskRoutes(app, taskService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'calendar',
      contribution: createCalendarContributions(calendar),
      registerRoutes: async (app) => registerCalendarRoutes(app, calendarService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'inbox',
      contribution: createInboxContributions(inbox),
      registerRoutes: async (app) => registerInboxRoutes(app, inboxService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'subscriptions',
      contribution: createSubscriptionContributions(subscriptions),
      registerRoutes: async (app) => registerSubscriptionRoutes(app, subscriptionService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'finance',
      contribution: createFinanceContributions(finance),
      registerRoutes: async (app) => registerFinanceRoutes(app, financeService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
    {
      featureId: 'life-countdown',
      contribution: createLifeCountdownContributions(lifeCountdown),
      registerRoutes: async (app) => registerLifeCountdownRoutes(app, lifeCountdownService),
      syncNotifications: async () => {},
      startScheduler: () => () => {},
    },
  ];
}
