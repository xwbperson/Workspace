import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../config.js';
import { createDatabase } from '../database.js';
import type { Database } from '../types.js';
import { inventoryMigration } from './023-inventory.js';

describe('inventory migration', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createDatabase(
      loadConfig({
        nodeEnv: 'test',
        databaseInMemory: true,
        workbenchRoot: '.workbench-inventory-migration-test',
      }),
    );
    await database.query(inventoryMigration.sql);
  });

  afterEach(async () => database.end());

  it('keeps items and clears their group when a group is deleted', async () => {
    const timestamp = '2026-08-30T00:00:00.000Z';
    await database.query(
      `INSERT INTO inventory_groups (id,name,position,version,created_at,updated_at)
       VALUES ('00000000-0000-4000-8000-000000000401','收纳箱',0,1,$1,$1)`,
      [timestamp],
    );
    await database.query(
      `INSERT INTO inventory_items
       (id,group_id,name,purpose,note,quantity,status,version,created_at,updated_at)
       VALUES ('00000000-0000-4000-8000-000000000402',
       '00000000-0000-4000-8000-000000000401','数据线','','',0,'active',1,$1,$1)`,
      [timestamp],
    );

    await database.query(
      `DELETE FROM inventory_groups WHERE id='00000000-0000-4000-8000-000000000401'`,
    );
    const item = await database.query<{ group_id: string | null; quantity: number }>(
      `SELECT group_id,quantity FROM inventory_items
       WHERE id='00000000-0000-4000-8000-000000000402'`,
    );
    expect(item.rows[0]).toEqual({ group_id: null, quantity: 0 });
  });

  it('rejects duplicate group names and negative quantities', async () => {
    const timestamp = '2026-08-30T00:00:00.000Z';
    await database.query(
      `INSERT INTO inventory_groups (id,name,position,version,created_at,updated_at)
       VALUES ('00000000-0000-4000-8000-000000000403','收纳箱',0,1,$1,$1)`,
      [timestamp],
    );
    await expect(
      database.query(
        `INSERT INTO inventory_groups (id,name,position,version,created_at,updated_at)
         VALUES ('00000000-0000-4000-8000-000000000404','收纳箱',1,1,$1,$1)`,
        [timestamp],
      ),
    ).rejects.toThrow();
    await expect(
      database.query(
        `INSERT INTO inventory_items
         (id,name,purpose,note,quantity,status,version,created_at,updated_at)
         VALUES ('00000000-0000-4000-8000-000000000405','错误物品','','',-1,'active',1,$1,$1)`,
        [timestamp],
      ),
    ).rejects.toThrow();
  });
});
