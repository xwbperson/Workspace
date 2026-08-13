import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../config.js';
import { createDatabase } from '../database.js';
import type { Database } from '../types.js';
import { checklistsMigration } from './019-checklists.js';
import { checklistLifecycleMigration } from './020-checklist-lifecycle.js';

describe('checklist lifecycle migration', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createDatabase(
      loadConfig({
        nodeEnv: 'test',
        databaseInMemory: true,
        workbenchRoot: '.workbench-checklist-migration-test',
      }),
    );
    await database.query(checklistsMigration.sql);
  });

  afterEach(async () => database.end());

  it('preserves checklists archived before the completed state existed', async () => {
    const timestamp = '2026-08-14T00:00:00.000Z';
    await database.query(
      `INSERT INTO checklists
         (id,name,note,status,position,version,created_at,updated_at)
       VALUES ('00000000-0000-4000-8000-000000000301','已有归档','','archived',0,1,$1,$1)`,
      [timestamp],
    );

    await database.query(checklistLifecycleMigration.sql);

    const existing = await database.query<{
      status: string;
      completed: boolean;
      archived_from_status: string | null;
    }>(
      `SELECT status,completed,archived_from_status FROM checklists
       WHERE id='00000000-0000-4000-8000-000000000301'`,
    );
    expect(existing.rows[0]).toEqual({
      status: 'archived',
      completed: false,
      archived_from_status: 'active',
    });
  });
});
