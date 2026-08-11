import { platformMigration } from './001-platform.js';
import { countdownsMigration } from './002-countdowns.js';
import { countdownLifecycleMigration } from './003-countdown-lifecycle.js';

export interface Migration {
  id: string;
  sql: string;
}

export const migrations: readonly Migration[] = [
  platformMigration,
  countdownsMigration,
  countdownLifecycleMigration,
];
