import type { InboxItem, InboxItemStatus, InboxItemType } from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface InboxItemRow {
  id: string;
  type: InboxItemType;
  title: string;
  content: string;
  url: string;
  fileId: string | null;
  fileOriginalName: string | null;
  fileMimeType: string | null;
  fileSize: number | null;
  fileCreatedAt: Date | null;
  status: InboxItemStatus;
  archivedFromStatus: Exclude<InboxItemStatus, 'archived'> | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InboxItemDatabaseRow {
  id: string;
  type: InboxItemType;
  title: string;
  content: string;
  url: string;
  file_id: string | null;
  file_original_name: string | null;
  file_mime_type: string | null;
  file_size: string | number | null;
  file_created_at: Date | null;
  status: InboxItemStatus;
  archived_from_status: Exclude<InboxItemStatus, 'archived'> | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `i.id,i.type,i.title,i.content,i.url,i.file_id,
  f.original_name AS file_original_name,f.mime_type AS file_mime_type,
  f.size_bytes AS file_size,f.created_at AS file_created_at,
  i.status,i.archived_from_status,i.version,i.created_at,i.updated_at`;

function mapRow(row: InboxItemDatabaseRow): InboxItemRow {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    url: row.url,
    fileId: row.file_id,
    fileOriginalName: row.file_original_name,
    fileMimeType: row.file_mime_type,
    fileSize: row.file_size === null ? null : Number(row.file_size),
    fileCreatedAt: row.file_created_at,
    status: row.status,
    archivedFromStatus: row.archived_from_status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toInboxItem(row: InboxItemRow): InboxItem {
  const hasFile =
    row.fileId &&
    row.fileOriginalName &&
    row.fileMimeType &&
    row.fileSize !== null &&
    row.fileCreatedAt;
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    url: row.url,
    ...(hasFile
      ? {
          file: {
            id: row.fileId!,
            originalName: row.fileOriginalName!,
            mimeType: row.fileMimeType!,
            size: row.fileSize!,
            createdAt: row.fileCreatedAt!.toISOString(),
            contentUrl: `/api/v1/files/${row.fileId}/content`,
          },
        }
      : {}),
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class InboxRepository {
  public constructor(private readonly database: Database) {}

  public async list(status: InboxItemStatus, limit: number): Promise<InboxItemRow[]> {
    const result = await this.database.query<InboxItemDatabaseRow>(
      `SELECT ${COLUMNS} FROM inbox_items i LEFT JOIN stored_files f ON f.id=i.file_id
       WHERE i.status=$1 ORDER BY i.updated_at DESC,i.id ASC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(mapRow);
  }

  public async get(id: string): Promise<InboxItemRow | null> {
    const result = await this.database.query<InboxItemDatabaseRow>(
      `SELECT ${COLUMNS} FROM inbox_items i LEFT JOIN stored_files f ON f.id=i.file_id WHERE i.id=$1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async create(row: InboxItemRow): Promise<InboxItemRow> {
    await this.database.query(
      `INSERT INTO inbox_items
         (id,type,title,content,url,file_id,status,archived_from_status,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        row.id,
        row.type,
        row.title,
        row.content,
        row.url,
        row.fileId,
        row.status,
        row.archivedFromStatus,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return (await this.get(row.id))!;
  }

  public async update(row: InboxItemRow, version: number): Promise<InboxItemRow | null> {
    const result = await this.database.query(
      `UPDATE inbox_items SET type=$2,title=$3,content=$4,url=$5,file_id=$6,status=$7,
         archived_from_status=NULL,version=version+1,updated_at=$8
       WHERE id=$1 AND version=$9 AND status<>'archived'`,
      [
        row.id,
        row.type,
        row.title,
        row.content,
        row.url,
        row.fileId,
        row.status,
        row.updatedAt,
        version,
      ],
    );
    return (result.rowCount ?? 0) === 1 ? this.get(row.id) : null;
  }

  public async archive(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE inbox_items SET archived_from_status=status,status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status<>'archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restore(id: string, version: number, now: Date): Promise<InboxItemRow | null> {
    const result = await this.database.query(
      `UPDATE inbox_items SET status=archived_from_status,archived_from_status=NULL,
         version=version+1,updated_at=$3 WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1 ? this.get(id) : null;
  }

  public async deletePermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM inbox_items WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async recent(limit: number): Promise<InboxItemRow[]> {
    const result = await this.database.query<InboxItemDatabaseRow>(
      `SELECT ${COLUMNS} FROM inbox_items i LEFT JOIN stored_files f ON f.id=i.file_id WHERE i.status<>'archived' ORDER BY i.updated_at DESC,i.id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async search(query: string, limit: number): Promise<InboxItemRow[]> {
    const pattern = `%${query.toLocaleLowerCase('zh-CN')}%`;
    const result = await this.database.query<InboxItemDatabaseRow>(
      `SELECT ${COLUMNS} FROM inbox_items i LEFT JOIN stored_files f ON f.id=i.file_id WHERE i.status<>'archived' AND (LOWER(i.title) LIKE $1 OR LOWER(i.content) LIKE $1 OR LOWER(i.url) LIKE $1 OR LOWER(COALESCE(f.original_name,'')) LIKE $1) ORDER BY i.updated_at DESC,i.id ASC LIMIT $2`,
      [pattern, limit],
    );
    return result.rows.map(mapRow);
  }
}
