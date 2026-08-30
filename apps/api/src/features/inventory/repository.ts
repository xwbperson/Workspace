import type {
  InventoryGroup,
  InventoryItem,
  InventoryItemStatus,
  InventoryStockFilter,
} from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface InventoryGroupRow {
  id: string;
  name: string;
  position: number;
  itemCount: number;
  totalQuantity: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InventoryGroupDatabaseRow {
  id: string;
  name: string;
  position: number;
  item_count: number | string;
  total_quantity: number | string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

export interface InventoryItemRow {
  id: string;
  groupId: string | null;
  groupName: string | null;
  name: string;
  purpose: string;
  note: string;
  quantity: number;
  status: InventoryItemStatus;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InventoryItemDatabaseRow {
  id: string;
  group_id: string | null;
  group_name: string | null;
  name: string;
  purpose: string;
  note: string;
  quantity: number;
  status: InventoryItemStatus;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const ITEM_COLUMNS = `i.id,i.group_id,g.name AS group_name,i.name,i.purpose,i.note,i.quantity,
  i.status,i.version,i.created_at,i.updated_at`;

function mapGroup(row: InventoryGroupDatabaseRow): InventoryGroupRow {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    itemCount: Number(row.item_count),
    totalQuantity: Number(row.total_quantity),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: InventoryItemDatabaseRow): InventoryItemRow {
  return {
    id: row.id,
    groupId: row.group_id,
    groupName: row.group_name,
    name: row.name,
    purpose: row.purpose,
    note: row.note,
    quantity: row.quantity,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toInventoryGroup(row: InventoryGroupRow): InventoryGroup {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    id: row.id,
    group: row.groupId && row.groupName ? { id: row.groupId, name: row.groupName } : null,
    name: row.name,
    purpose: row.purpose,
    note: row.note,
    quantity: row.quantity,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class InventoryRepository {
  public constructor(private readonly database: Database) {}

  public async listGroups(): Promise<InventoryGroupRow[]> {
    const result = await this.database.query<InventoryGroupDatabaseRow>(
      `SELECT g.id,g.name,g.position,g.version,g.created_at,g.updated_at,
         COUNT(i.id) FILTER (WHERE i.status='active') AS item_count,
         COALESCE(SUM(i.quantity) FILTER (WHERE i.status='active'),0) AS total_quantity
       FROM inventory_groups g
       LEFT JOIN inventory_items i ON i.group_id=g.id
       GROUP BY g.id,g.name,g.position,g.version,g.created_at,g.updated_at
       ORDER BY g.position,g.created_at,g.id`,
    );
    return result.rows.map(mapGroup);
  }

  public async getGroup(id: string): Promise<InventoryGroupRow | null> {
    const result = await this.database.query<InventoryGroupDatabaseRow>(
      `SELECT g.id,g.name,g.position,g.version,g.created_at,g.updated_at,
         COUNT(i.id) FILTER (WHERE i.status='active') AS item_count,
         COALESCE(SUM(i.quantity) FILTER (WHERE i.status='active'),0) AS total_quantity
       FROM inventory_groups g
       LEFT JOIN inventory_items i ON i.group_id=g.id
       WHERE g.id=$1
       GROUP BY g.id,g.name,g.position,g.version,g.created_at,g.updated_at`,
      [id],
    );
    return result.rows[0] ? mapGroup(result.rows[0]) : null;
  }

  public async findGroupByName(name: string): Promise<InventoryGroupRow | null> {
    const result = await this.database.query<InventoryGroupDatabaseRow>(
      `SELECT g.id,g.name,g.position,g.version,g.created_at,g.updated_at,
         0 AS item_count,0 AS total_quantity
       FROM inventory_groups g WHERE LOWER(g.name)=LOWER($1) LIMIT 1`,
      [name],
    );
    return result.rows[0] ? mapGroup(result.rows[0]) : null;
  }

  public async createGroup(input: {
    id: string;
    name: string;
    createdAt: Date;
  }): Promise<InventoryGroupRow> {
    const result = await this.database.query<InventoryGroupDatabaseRow>(
      `INSERT INTO inventory_groups (id,name,position,version,created_at,updated_at)
       VALUES ($1,$2,(SELECT COALESCE(MAX(position),-1)+1 FROM inventory_groups),1,$3,$3)
       RETURNING id,name,position,version,created_at,updated_at,0 AS item_count,0 AS total_quantity`,
      [input.id, input.name, input.createdAt],
    );
    return mapGroup(result.rows[0]!);
  }

  public async updateGroup(
    id: string,
    name: string,
    version: number,
    updatedAt: Date,
  ): Promise<InventoryGroupRow | null> {
    const result = await this.database.query<InventoryGroupDatabaseRow>(
      `UPDATE inventory_groups SET name=$2,version=version+1,updated_at=$4
       WHERE id=$1 AND version=$3
       RETURNING id,name,position,version,created_at,updated_at,0 AS item_count,0 AS total_quantity`,
      [id, name, version, updatedAt],
    );
    return result.rows[0] ? mapGroup(result.rows[0]) : null;
  }

  public async deleteGroup(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      'DELETE FROM inventory_groups WHERE id=$1 AND version=$2',
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async listItems(input: {
    status: InventoryItemStatus;
    stock: InventoryStockFilter;
    groupId?: string;
    query?: string;
    limit: number;
  }): Promise<InventoryItemRow[]> {
    const values: unknown[] = [input.status];
    const clauses = ['i.status=$1'];
    if (input.stock === 'zero') clauses.push('i.quantity=0');
    if (input.stock === 'positive') clauses.push('i.quantity>0');
    if (input.groupId === 'ungrouped') clauses.push('i.group_id IS NULL');
    else if (input.groupId) {
      values.push(input.groupId);
      clauses.push(`i.group_id=$${values.length}`);
    }
    if (input.query) {
      values.push(`%${input.query.toLocaleLowerCase('zh-CN')}%`);
      const placeholder = `$${values.length}`;
      clauses.push(
        `(LOWER(i.name) LIKE ${placeholder} OR LOWER(i.purpose) LIKE ${placeholder} OR LOWER(i.note) LIKE ${placeholder} OR LOWER(COALESCE(g.name,'')) LIKE ${placeholder})`,
      );
    }
    values.push(input.limit);
    const result = await this.database.query<InventoryItemDatabaseRow>(
      `SELECT ${ITEM_COLUMNS} FROM inventory_items i
       LEFT JOIN inventory_groups g ON g.id=i.group_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY CASE WHEN i.quantity=0 THEN 0 ELSE 1 END,i.updated_at DESC,i.name,i.id
       LIMIT $${values.length}`,
      values,
    );
    return result.rows.map(mapItem);
  }

  public async getItem(id: string): Promise<InventoryItemRow | null> {
    const result = await this.database.query<InventoryItemDatabaseRow>(
      `SELECT ${ITEM_COLUMNS} FROM inventory_items i
       LEFT JOIN inventory_groups g ON g.id=i.group_id WHERE i.id=$1`,
      [id],
    );
    return result.rows[0] ? mapItem(result.rows[0]) : null;
  }

  public async createItem(input: {
    id: string;
    groupId: string | null;
    name: string;
    purpose: string;
    note: string;
    quantity: number;
    createdAt: Date;
  }): Promise<InventoryItemRow> {
    await this.database.query(
      `INSERT INTO inventory_items
       (id,group_id,name,purpose,note,quantity,status,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'active',1,$7,$7)`,
      [
        input.id,
        input.groupId,
        input.name,
        input.purpose,
        input.note,
        input.quantity,
        input.createdAt,
      ],
    );
    return (await this.getItem(input.id))!;
  }

  public async updateItem(
    input: Pick<InventoryItemRow, 'id' | 'groupId' | 'name' | 'purpose' | 'note' | 'quantity'>,
    version: number,
    updatedAt: Date,
  ): Promise<InventoryItemRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE inventory_items SET group_id=$2,name=$3,purpose=$4,note=$5,quantity=$6,
       version=version+1,updated_at=$8
       WHERE id=$1 AND version=$7 AND status='active' RETURNING id`,
      [
        input.id,
        input.groupId,
        input.name,
        input.purpose,
        input.note,
        input.quantity,
        version,
        updatedAt,
      ],
    );
    return result.rows[0] ? this.getItem(input.id) : null;
  }

  public async adjustQuantity(
    id: string,
    delta: -1 | 1,
    updatedAt: Date,
  ): Promise<InventoryItemRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE inventory_items
       SET quantity=CASE
         WHEN quantity+$2<0 THEN 0
         WHEN quantity+$2>999999 THEN 999999
         ELSE quantity+$2
       END,version=version+1,updated_at=$3
       WHERE id=$1 AND status='active' RETURNING id`,
      [id, delta, updatedAt],
    );
    return result.rows[0] ? this.getItem(id) : null;
  }

  public async archiveItem(id: string, version: number, updatedAt: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE inventory_items SET status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='active'`,
      [id, version, updatedAt],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restoreItem(
    id: string,
    version: number,
    updatedAt: Date,
  ): Promise<InventoryItemRow | null> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE inventory_items SET status='active',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived' RETURNING id`,
      [id, version, updatedAt],
    );
    return result.rows[0] ? this.getItem(id) : null;
  }

  public async deleteItemPermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM inventory_items WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async recent(limit: number): Promise<InventoryItemRow[]> {
    const result = await this.database.query<InventoryItemDatabaseRow>(
      `SELECT ${ITEM_COLUMNS} FROM inventory_items i
       LEFT JOIN inventory_groups g ON g.id=i.group_id
       WHERE i.status='active' ORDER BY i.updated_at DESC,i.id LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapItem);
  }

  public async search(query: string, limit: number): Promise<InventoryItemRow[]> {
    return this.listItems({ status: 'active', stock: 'all', query, limit });
  }
}
