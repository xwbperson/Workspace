import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../config.js';
import { createDatabase } from '../database.js';
import type { Database } from '../types.js';
import { fileStorageMigration } from './004-file-storage.js';
import { inboxMigration } from './011-inbox.js';
import { inboxContentTypesMigration } from './018-inbox-content-types.js';

describe('inbox content types migration', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createDatabase(
      loadConfig({
        nodeEnv: 'test',
        databaseInMemory: true,
        workbenchRoot: '.workbench-inbox-migration-test',
      }),
    );
    await database.query(fileStorageMigration.sql);
    await database.query(inboxMigration.sql);
  });

  afterEach(async () => database.end());

  it('preserves existing types and accepts information and other', async () => {
    const timestamp = '2026-08-01T00:00:00.000Z';
    await database.query(
      `INSERT INTO inbox_items
         (id,type,title,content,url,status,version,created_at,updated_at)
       VALUES ('00000000-0000-4000-8000-000000000201','idea','已有想法','','','inbox',1,$1,$1)`,
      [timestamp],
    );

    await database.query(inboxContentTypesMigration.sql);

    const existing = await database.query<{ content_type: string }>(
      `SELECT content_type FROM inbox_items
       WHERE id='00000000-0000-4000-8000-000000000201'`,
    );
    expect(existing.rows[0]?.content_type).toBe('idea');

    await database.query(
      `INSERT INTO inbox_items
         (id,type,content_type,title,content,url,status,version,created_at,updated_at)
       VALUES
         ('00000000-0000-4000-8000-000000000202','snippet','information','一条信息','','','inbox',1,$1,$1),
         ('00000000-0000-4000-8000-000000000203','idea','other','其他内容','','','inbox',1,$1,$1)`,
      [timestamp],
    );
    const added = await database.query<{ content_type: string }>(
      `SELECT content_type FROM inbox_items
       WHERE id IN (
         '00000000-0000-4000-8000-000000000202',
         '00000000-0000-4000-8000-000000000203'
       ) ORDER BY content_type`,
    );
    expect(added.rows.map((row) => row.content_type)).toEqual(['information', 'other']);
  });
});
