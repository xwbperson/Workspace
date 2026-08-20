import type { Checklist, ChecklistItem, ChecklistStatus } from '@workspace/client-sdk';
import type { Database, DatabaseClient } from '../../platform/database/types.js';

export interface ChecklistRow {
  id: string;
  name: string;
  note: string;
  status: ChecklistStatus;
  archivedFromStatus: Exclude<ChecklistStatus, 'archived'> | null;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistItemRow {
  id: string;
  checklistId: string;
  name: string;
  note: string;
  quantity: number | null;
  unit: string;
  priceCents: number | null;
  checkedAt: Date | null;
  position: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ChecklistDatabaseRow {
  id: string;
  name: string;
  note: string;
  status: 'active' | 'archived';
  completed: boolean;
  archived_from_status: Exclude<ChecklistStatus, 'archived'> | null;
  position: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

interface ChecklistItemDatabaseRow {
  id: string;
  checklist_id: string;
  name: string;
  note: string;
  quantity: string | number | null;
  unit: string;
  price_cents: number | null;
  checked_at: Date | null;
  position: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const CHECKLIST_COLUMNS =
  'id,name,note,status,completed,archived_from_status,position,version,created_at,updated_at';
const ITEM_COLUMNS =
  'id,checklist_id,name,note,quantity,unit,price_cents,checked_at,position,version,created_at,updated_at';

function mapChecklist(row: ChecklistDatabaseRow): ChecklistRow {
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    status: row.status === 'archived' ? 'archived' : row.completed ? 'completed' : 'active',
    archivedFromStatus: row.archived_from_status,
    position: row.position,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: ChecklistItemDatabaseRow): ChecklistItemRow {
  return {
    id: row.id,
    checklistId: row.checklist_id,
    name: row.name,
    note: row.note,
    quantity: row.quantity === null ? null : Number(row.quantity),
    unit: row.unit,
    priceCents: row.price_cents,
    checkedAt: row.checked_at,
    position: row.position,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toChecklistItem(row: ChecklistItemRow): ChecklistItem {
  return {
    id: row.id,
    checklistId: row.checklistId,
    name: row.name,
    note: row.note,
    quantity: row.quantity,
    unit: row.unit,
    price: row.priceCents === null ? null : row.priceCents / 100,
    checked: row.checkedAt !== null,
    ...(row.checkedAt ? { checkedAt: row.checkedAt.toISOString() } : {}),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toChecklist(row: ChecklistRow, itemRows: ChecklistItemRow[]): Checklist {
  const items = itemRows.map(toChecklistItem);
  const checked = itemRows.filter((item) => item.checkedAt !== null).length;
  const amountCents = (item: ChecklistItemRow) =>
    item.priceCents === null ? 0 : Math.round(item.priceCents * (item.quantity ?? 1));
  const totalCents = itemRows.reduce((sum, item) => sum + amountCents(item), 0);
  const checkedCents = itemRows.reduce(
    (sum, item) => sum + (item.checkedAt ? amountCents(item) : 0),
    0,
  );
  return {
    id: row.id,
    name: row.name,
    note: row.note,
    status: row.status,
    progress: {
      checked,
      total: items.length,
      percentage: items.length ? Math.round((checked / items.length) * 100) : 0,
    },
    amounts: { checked: checkedCents / 100, total: totalCents / 100 },
    items,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function rollback(client: DatabaseClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original transaction error.
  }
}

export class ChecklistRepository {
  public constructor(private readonly database: Database) {}

  public async list(status: ChecklistStatus, limit: number): Promise<ChecklistRow[]> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `SELECT ${CHECKLIST_COLUMNS} FROM checklists
       WHERE ($1='archived' AND status='archived')
          OR ($1='active' AND status='active' AND completed=FALSE)
          OR ($1='completed' AND status='active' AND completed=TRUE)
       ORDER BY position ASC,updated_at DESC,id ASC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(mapChecklist);
  }

  public async get(id: string): Promise<ChecklistRow | null> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `SELECT ${CHECKLIST_COLUMNS} FROM checklists WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapChecklist(result.rows[0]) : null;
  }

  public async items(checklistId: string): Promise<ChecklistItemRow[]> {
    const result = await this.database.query<ChecklistItemDatabaseRow>(
      `SELECT ${ITEM_COLUMNS} FROM checklist_items WHERE checklist_id=$1
       ORDER BY CASE WHEN checked_at IS NULL THEN 0 ELSE 1 END,position ASC,checked_at ASC,id ASC`,
      [checklistId],
    );
    return result.rows.map(mapItem);
  }

  public async itemsForChecklists(
    checklistIds: readonly string[],
  ): Promise<Map<string, ChecklistItemRow[]>> {
    const itemsByChecklist = new Map(
      checklistIds.map((checklistId) => [checklistId, [] as ChecklistItemRow[]]),
    );
    if (checklistIds.length === 0) return itemsByChecklist;

    const placeholders = checklistIds.map((_, index) => `$${index + 1}`).join(',');
    const result = await this.database.query<ChecklistItemDatabaseRow>(
      `SELECT ${ITEM_COLUMNS} FROM checklist_items WHERE checklist_id IN (${placeholders})
       ORDER BY checklist_id ASC,
         CASE WHEN checked_at IS NULL THEN 0 ELSE 1 END,position ASC,checked_at ASC,id ASC`,
      checklistIds,
    );
    for (const databaseRow of result.rows) {
      const item = mapItem(databaseRow);
      itemsByChecklist.get(item.checklistId)?.push(item);
    }
    return itemsByChecklist;
  }

  public async create(row: ChecklistRow): Promise<ChecklistRow> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `INSERT INTO checklists
         (id,name,note,status,completed,archived_from_status,position,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,(SELECT COALESCE(MAX(position),-1)+1 FROM checklists),$7,$8,$9)
       RETURNING ${CHECKLIST_COLUMNS}`,
      [
        row.id,
        row.name,
        row.note,
        row.status,
        row.status === 'completed',
        row.archivedFromStatus,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapChecklist(result.rows[0]!);
  }

  public async update(row: ChecklistRow, version: number): Promise<ChecklistRow | null> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `UPDATE checklists SET name=$2,note=$3,version=version+1,updated_at=$4
       WHERE id=$1 AND version=$5 AND status='active' RETURNING ${CHECKLIST_COLUMNS}`,
      [row.id, row.name, row.note, row.updatedAt, version],
    );
    return result.rows[0] ? mapChecklist(result.rows[0]) : null;
  }

  public async complete(id: string, version: number, now: Date): Promise<ChecklistRow | null> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `UPDATE checklists SET completed=TRUE,version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active' AND completed=FALSE
       RETURNING ${CHECKLIST_COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapChecklist(result.rows[0]) : null;
  }

  public async reopen(id: string, version: number, now: Date): Promise<ChecklistRow | null> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `UPDATE checklists SET completed=FALSE,version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active' AND completed=TRUE
       RETURNING ${CHECKLIST_COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapChecklist(result.rows[0]) : null;
  }

  public async archive(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE checklists
       SET archived_from_status=CASE WHEN completed THEN 'completed' ELSE 'active' END,
         status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restore(id: string, version: number, now: Date): Promise<ChecklistRow | null> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `UPDATE checklists SET status='active',
         completed=(archived_from_status='completed'),archived_from_status=NULL,
         version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived' RETURNING ${CHECKLIST_COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapChecklist(result.rows[0]) : null;
  }

  public async deletePermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM checklists WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async getItem(checklistId: string, itemId: string): Promise<ChecklistItemRow | null> {
    const result = await this.database.query<ChecklistItemDatabaseRow>(
      `SELECT ${ITEM_COLUMNS} FROM checklist_items WHERE checklist_id=$1 AND id=$2`,
      [checklistId, itemId],
    );
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  public async createItem(row: ChecklistItemRow): Promise<ChecklistItemRow> {
    const result = await this.database.query<ChecklistItemDatabaseRow>(
      `INSERT INTO checklist_items
         (id,checklist_id,name,note,quantity,unit,price_cents,checked_at,position,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,
         (SELECT COALESCE(MAX(position),-1)+1 FROM checklist_items WHERE checklist_id=$2),$9,$10,$11)
       RETURNING ${ITEM_COLUMNS}`,
      [
        row.id,
        row.checklistId,
        row.name,
        row.note,
        row.quantity,
        row.unit,
        row.priceCents,
        row.checkedAt,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    await this.touch(row.checklistId, row.updatedAt);
    return mapItem(result.rows[0]!);
  }

  public async checkItem(
    checklistId: string,
    itemId: string,
    checkedAt: Date | null,
    version: number,
    now: Date,
  ): Promise<ChecklistItemRow | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<ChecklistItemDatabaseRow>(
        `UPDATE checklist_items SET checked_at=$3,version=version+1,updated_at=$5
         WHERE checklist_id=$1 AND id=$2 AND version=$4 RETURNING ${ITEM_COLUMNS}`,
        [checklistId, itemId, checkedAt, version, now],
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      let automaticallyCompleted = false;
      if (checkedAt) {
        const counts = await client.query<{ total: string | number; unchecked: string | number }>(
          `SELECT COUNT(*) AS total,
             SUM(CASE WHEN checked_at IS NULL THEN 1 ELSE 0 END) AS unchecked
           FROM checklist_items WHERE checklist_id=$1`,
          [checklistId],
        );
        const count = counts.rows[0];
        if (count && Number(count.total) > 0 && Number(count.unchecked) === 0) {
          const completed = await client.query(
            `UPDATE checklists SET completed=TRUE,version=version+1,updated_at=$2
             WHERE id=$1 AND status='active' AND completed=FALSE`,
            [checklistId, now],
          );
          automaticallyCompleted = (completed.rowCount ?? 0) === 1;
        }
      }
      if (!automaticallyCompleted) {
        await client.query(`UPDATE checklists SET updated_at=$2 WHERE id=$1`, [checklistId, now]);
      }
      await client.query('COMMIT');
      return mapItem(result.rows[0]);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async updateItem(
    row: ChecklistItemRow,
    version: number,
  ): Promise<ChecklistItemRow | null> {
    const result = await this.database.query<ChecklistItemDatabaseRow>(
      `UPDATE checklist_items SET name=$3,note=$4,quantity=$5,unit=$6,price_cents=$7,
         version=version+1,updated_at=$9
       WHERE checklist_id=$1 AND id=$2 AND version=$8 RETURNING ${ITEM_COLUMNS}`,
      [
        row.checklistId,
        row.id,
        row.name,
        row.note,
        row.quantity,
        row.unit,
        row.priceCents,
        version,
        row.updatedAt,
      ],
    );
    if (result.rows[0]) await this.touch(row.checklistId, row.updatedAt);
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  public async deleteItem(
    checklistId: string,
    itemId: string,
    version: number,
    now: Date,
  ): Promise<boolean> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `DELETE FROM checklist_items WHERE checklist_id=$1 AND id=$2 AND version=$3`,
        [checklistId, itemId, version],
      );
      if ((result.rowCount ?? 0) !== 1) {
        await client.query('ROLLBACK');
        return false;
      }
      const counts = await client.query<{ total: string | number; unchecked: string | number }>(
        `SELECT COUNT(*) AS total,
           SUM(CASE WHEN checked_at IS NULL THEN 1 ELSE 0 END) AS unchecked
         FROM checklist_items WHERE checklist_id=$1`,
        [checklistId],
      );
      const count = counts.rows[0];
      const canComplete = count && Number(count.total) > 0 && Number(count.unchecked) === 0;
      const completed = canComplete
        ? await client.query(
            `UPDATE checklists SET completed=TRUE,version=version+1,updated_at=$2
             WHERE id=$1 AND status='active' AND completed=FALSE`,
            [checklistId, now],
          )
        : undefined;
      if ((completed?.rowCount ?? 0) !== 1) {
        await client.query(`UPDATE checklists SET updated_at=$2 WHERE id=$1`, [checklistId, now]);
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  public async reset(id: string, version: number, now: Date): Promise<ChecklistRow | null> {
    return this.bulkItemChange(id, version, now, async (client) => {
      await client.query(
        `UPDATE checklist_items SET checked_at=NULL,version=version+1,updated_at=$2
         WHERE checklist_id=$1`,
        [id, now],
      );
    });
  }

  public async clearChecked(id: string, version: number, now: Date): Promise<ChecklistRow | null> {
    return this.bulkItemChange(id, version, now, async (client) => {
      await client.query(
        `DELETE FROM checklist_items WHERE checklist_id=$1 AND checked_at IS NOT NULL`,
        [id],
      );
    });
  }

  public async recent(limit: number): Promise<ChecklistRow[]> {
    const result = await this.database.query<ChecklistDatabaseRow>(
      `SELECT ${CHECKLIST_COLUMNS} FROM checklists WHERE status='active' AND completed=FALSE
       ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapChecklist);
  }

  public async search(query: string, limit: number): Promise<ChecklistRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<ChecklistDatabaseRow>(
      `SELECT DISTINCT c.id,c.name,c.note,c.status,c.completed,c.archived_from_status,
         c.position,c.version,c.created_at,c.updated_at
       FROM checklists c LEFT JOIN checklist_items i ON i.checklist_id=c.id
       WHERE c.status='active' AND (LOWER(c.name) LIKE $1 OR LOWER(c.note) LIKE $1
         OR LOWER(COALESCE(i.name,'')) LIKE $1 OR LOWER(COALESCE(i.note,'')) LIKE $1)
       ORDER BY c.updated_at DESC,c.id ASC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapChecklist);
  }

  private async touch(id: string, now: Date): Promise<void> {
    await this.database.query(`UPDATE checklists SET updated_at=$2 WHERE id=$1`, [id, now]);
  }

  private async bulkItemChange(
    id: string,
    version: number,
    now: Date,
    change: (client: DatabaseClient) => Promise<void>,
  ): Promise<ChecklistRow | null> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query<ChecklistDatabaseRow>(
        `UPDATE checklists SET version=version+1,updated_at=$3
         WHERE id=$1 AND version=$2 AND status='active' RETURNING ${CHECKLIST_COLUMNS}`,
        [id, version, now],
      );
      if (!updated.rows[0]) {
        await client.query('ROLLBACK');
        return null;
      }
      await change(client);
      await client.query('COMMIT');
      return mapChecklist(updated.rows[0]);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}
