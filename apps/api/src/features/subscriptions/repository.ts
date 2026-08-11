import type {
  Subscription,
  SubscriptionBillingCycle,
  SubscriptionCategory,
  SubscriptionStatus,
} from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface SubscriptionRow {
  id: string;
  name: string;
  category: SubscriptionCategory;
  amount: number;
  currency: string;
  billingCycle: SubscriptionBillingCycle;
  renewalDate: string;
  autoRenew: boolean;
  note: string;
  status: SubscriptionStatus;
  archivedFromStatus: Exclude<SubscriptionStatus, 'archived'> | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface DatabaseRow {
  id: string;
  name: string;
  category: SubscriptionCategory;
  amount: number | string;
  currency: string;
  billing_cycle: SubscriptionBillingCycle;
  renewal_date: string | Date;
  auto_renew: boolean;
  note: string;
  status: SubscriptionStatus;
  archived_from_status: Exclude<SubscriptionStatus, 'archived'> | null;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const COLUMNS = `id,name,category,amount,currency,billing_cycle,renewal_date,auto_renew,note,status,archived_from_status,version,created_at,updated_at`;

function dateOnly(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function mapRow(row: DatabaseRow): SubscriptionRow {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    billingCycle: row.billing_cycle,
    renewalDate: dateOnly(row.renewal_date),
    autoRenew: row.auto_renew,
    note: row.note,
    status: row.status,
    archivedFromStatus: row.archived_from_status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function subscriptionMonthlyEquivalent(
  row: Pick<SubscriptionRow, 'amount' | 'billingCycle'>,
): number {
  const divisor = row.billingCycle === 'monthly' ? 1 : row.billingCycle === 'quarterly' ? 3 : 12;
  return Math.round((row.amount / divisor) * 100) / 100;
}

export function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    amount: row.amount,
    currency: row.currency,
    billingCycle: row.billingCycle,
    monthlyEquivalent: subscriptionMonthlyEquivalent(row),
    renewalDate: row.renewalDate,
    autoRenew: row.autoRenew,
    note: row.note,
    status: row.status,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class SubscriptionRepository {
  public constructor(private readonly database: Database) {}

  public async list(status: SubscriptionStatus, limit: number): Promise<SubscriptionRow[]> {
    const result = await this.database.query<DatabaseRow>(
      `SELECT ${COLUMNS} FROM subscriptions WHERE status=$1 ORDER BY renewal_date ASC,updated_at DESC,id ASC LIMIT $2`,
      [status, limit],
    );
    return result.rows.map(mapRow);
  }

  public async get(id: string): Promise<SubscriptionRow | null> {
    const result = await this.database.query<DatabaseRow>(
      `SELECT ${COLUMNS} FROM subscriptions WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async create(row: SubscriptionRow): Promise<SubscriptionRow> {
    const result = await this.database.query<DatabaseRow>(
      `INSERT INTO subscriptions
       (id,name,category,amount,currency,billing_cycle,renewal_date,auto_renew,note,status,archived_from_status,version,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING ${COLUMNS}`,
      [
        row.id,
        row.name,
        row.category,
        row.amount,
        row.currency,
        row.billingCycle,
        row.renewalDate,
        row.autoRenew,
        row.note,
        row.status,
        row.archivedFromStatus,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapRow(result.rows[0]!);
  }

  public async update(row: SubscriptionRow, version: number): Promise<SubscriptionRow | null> {
    const result = await this.database.query<DatabaseRow>(
      `UPDATE subscriptions SET name=$2,category=$3,amount=$4,currency=$5,billing_cycle=$6,
       renewal_date=$7,auto_renew=$8,note=$9,status=$10,version=version+1,updated_at=$11
       WHERE id=$1 AND version=$12 AND status<>'archived' RETURNING ${COLUMNS}`,
      [
        row.id,
        row.name,
        row.category,
        row.amount,
        row.currency,
        row.billingCycle,
        row.renewalDate,
        row.autoRenew,
        row.note,
        row.status,
        row.updatedAt,
        version,
      ],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async archive(id: string, version: number, now: Date): Promise<boolean> {
    const result = await this.database.query(
      `UPDATE subscriptions SET archived_from_status=status,status='archived',version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status<>'archived'`,
      [id, version, now],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async restore(id: string, version: number, now: Date): Promise<SubscriptionRow | null> {
    const result = await this.database.query<DatabaseRow>(
      `UPDATE subscriptions SET status=archived_from_status,archived_from_status=NULL,version=version+1,updated_at=$3
       WHERE id=$1 AND version=$2 AND status='archived' RETURNING ${COLUMNS}`,
      [id, version, now],
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }

  public async deletePermanently(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM subscriptions WHERE id=$1 AND version=$2 AND status='archived'`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async recent(limit: number): Promise<SubscriptionRow[]> {
    const result = await this.database.query<DatabaseRow>(
      `SELECT ${COLUMNS} FROM subscriptions WHERE status<>'archived' ORDER BY updated_at DESC,id ASC LIMIT $1`,
      [limit],
    );
    return result.rows.map(mapRow);
  }

  public async upcoming(from: string, to: string, limit: number): Promise<SubscriptionRow[]> {
    const result = await this.database.query<DatabaseRow>(
      `SELECT ${COLUMNS} FROM subscriptions WHERE status='active' AND renewal_date BETWEEN $1 AND $2 ORDER BY renewal_date ASC,id ASC LIMIT $3`,
      [from, to, limit],
    );
    return result.rows.map(mapRow);
  }

  public async search(query: string, limit: number): Promise<SubscriptionRow[]> {
    const result = await this.database.query<DatabaseRow>(
      `SELECT ${COLUMNS} FROM subscriptions WHERE status<>'archived' AND (LOWER(name) LIKE $1 OR LOWER(note) LIKE $1)
       ORDER BY updated_at DESC,id ASC LIMIT $2`,
      [`%${query.toLocaleLowerCase('zh-CN')}%`, limit],
    );
    return result.rows.map(mapRow);
  }
}
