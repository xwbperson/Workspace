import { platformMigration } from './001-platform.js';
import { countdownsMigration } from './002-countdowns.js';
import { countdownLifecycleMigration } from './003-countdown-lifecycle.js';
import { fileStorageMigration } from './004-file-storage.js';
import { booksMigration } from './005-books.js';
import { coursesMigration } from './006-courses.js';
import { courseStatusMigration } from './007-course-status.js';
import { goalsMigration } from './008-goals.js';
import { tasksMigration } from './009-tasks.js';
import { calendarMigration } from './010-calendar.js';
import { inboxMigration } from './011-inbox.js';
import { subscriptionsMigration } from './012-subscriptions.js';
import { financeMigration } from './013-finance.js';
import { lifeCountdownMigration } from './014-life-countdown.js';
import { financeUnbilledDebtMigration } from './015-finance-unbilled-debt.js';

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  platformMigration,
  countdownsMigration,
  countdownLifecycleMigration,
  fileStorageMigration,
  booksMigration,
  coursesMigration,
  courseStatusMigration,
  goalsMigration,
  tasksMigration,
  calendarMigration,
  inboxMigration,
  subscriptionsMigration,
  financeMigration,
  lifeCountdownMigration,
  financeUnbilledDebtMigration,
];
