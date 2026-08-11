import { platformMigration } from './001-platform.js';
import { countdownsMigration } from './002-countdowns.js';
import { countdownLifecycleMigration } from './003-countdown-lifecycle.js';
import { fileStorageMigration } from './004-file-storage.js';
import { booksMigration } from './005-books.js';
import { coursesMigration } from './006-courses.js';

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
];
