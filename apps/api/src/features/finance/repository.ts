import type {
  FinanceAccount,
  FinanceAccountType,
  FinanceDebtPlatform,
  FinanceDebtRecord,
} from '@workspace/client-sdk';
import type { Database } from '../../platform/database/types.js';

export interface FinanceAccountRow {
  id: string;
  type: FinanceAccountType;
  name: string;
  balance: number;
  cardNumber: string | null;
  phone: string | null;
  creditLimit: number | null;
  note: string;
  archived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface FinanceDebtPlatformRow {
  id: string;
  name: string;
  billingDay: number | null;
  repaymentDay: number | null;
  fixedLimit: number;
  temporaryLimit: number;
  remainingLimit: number;
  note: string;
  archived: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}
export interface FinanceDebtRecordRow {
  id: string;
  platformId: string;
  platformName: string;
  year: number;
  month: number;
  amount: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

interface AccountDatabaseRow {
  id: string;
  type: FinanceAccountType;
  name: string;
  balance: number | string;
  card_number: string | null;
  phone: string | null;
  credit_limit: number | string | null;
  note: string;
  archived: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}
interface PlatformDatabaseRow {
  id: string;
  name: string;
  billing_day: number | null;
  repayment_day: number | null;
  fixed_limit: number | string;
  temporary_limit: number | string;
  remaining_limit: number | string;
  note: string;
  archived: boolean;
  version: number;
  created_at: Date;
  updated_at: Date;
}
interface RecordDatabaseRow {
  id: string;
  platform_id: string;
  platform_name: string;
  year: number;
  month: number;
  amount: number | string;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const ACCOUNT_COLUMNS = `id,account_type AS type,name,balance,card_number,phone,credit_limit,note,archived,version,created_at,updated_at`;
const PLATFORM_COLUMNS = `id,name,billing_day,repayment_day,fixed_limit,temporary_limit,remaining_limit,note,archived,version,created_at,updated_at`;
const RECORD_COLUMNS = `r.id,r.platform_id,p.name AS platform_name,r.year,r.month,r.amount,r.version,r.created_at,r.updated_at`;

function mapAccount(row: AccountDatabaseRow): FinanceAccountRow {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    balance: Number(row.balance),
    cardNumber: row.card_number,
    phone: row.phone,
    creditLimit: row.credit_limit === null ? null : Number(row.credit_limit),
    note: row.note,
    archived: row.archived,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function mapPlatform(row: PlatformDatabaseRow): FinanceDebtPlatformRow {
  return {
    id: row.id,
    name: row.name,
    billingDay: row.billing_day,
    repaymentDay: row.repayment_day,
    fixedLimit: Number(row.fixed_limit),
    temporaryLimit: Number(row.temporary_limit),
    remainingLimit: Number(row.remaining_limit),
    note: row.note,
    archived: row.archived,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function mapRecord(row: RecordDatabaseRow): FinanceDebtRecordRow {
  return {
    id: row.id,
    platformId: row.platform_id,
    platformName: row.platform_name,
    year: row.year,
    month: row.month,
    amount: Number(row.amount),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toFinanceAccount(row: FinanceAccountRow): FinanceAccount {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function toFinanceDebtPlatform(row: FinanceDebtPlatformRow): FinanceDebtPlatform {
  return { ...row, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function toFinanceDebtRecord(row: FinanceDebtRecordRow): FinanceDebtRecord {
  return {
    id: row.id,
    platformId: row.platformId,
    platformName: row.platformName,
    year: row.year,
    month: row.month,
    amount: row.amount,
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class FinanceRepository {
  public constructor(private readonly database: Database) {}

  public async listAccounts(archived: boolean): Promise<FinanceAccountRow[]> {
    const result = await this.database.query<AccountDatabaseRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM finance_accounts WHERE archived=$1 ORDER BY updated_at DESC,id ASC`,
      [archived],
    );
    return result.rows.map(mapAccount);
  }
  public async getAccount(id: string): Promise<FinanceAccountRow | null> {
    const result = await this.database.query<AccountDatabaseRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM finance_accounts WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }
  public async createAccount(row: FinanceAccountRow): Promise<FinanceAccountRow> {
    const result = await this.database.query<AccountDatabaseRow>(
      `INSERT INTO finance_accounts (id,type,account_type,name,balance,card_number,phone,credit_limit,note,archived,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING ${ACCOUNT_COLUMNS}`,
      [
        row.id,
        row.type === 'credit' ? 'other' : row.type,
        row.type,
        row.name,
        row.balance,
        row.cardNumber,
        row.phone,
        row.creditLimit,
        row.note,
        row.archived,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapAccount(result.rows[0]!);
  }
  public async updateAccount(
    row: FinanceAccountRow,
    version: number,
  ): Promise<FinanceAccountRow | null> {
    const result = await this.database.query<AccountDatabaseRow>(
      `UPDATE finance_accounts SET type=$2,account_type=$3,name=$4,balance=$5,card_number=$6,phone=$7,credit_limit=$8,note=$9,version=version+1,updated_at=$10 WHERE id=$1 AND version=$11 AND archived=false RETURNING ${ACCOUNT_COLUMNS}`,
      [
        row.id,
        row.type === 'credit' ? 'other' : row.type,
        row.type,
        row.name,
        row.balance,
        row.cardNumber,
        row.phone,
        row.creditLimit,
        row.note,
        row.updatedAt,
        version,
      ],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }
  public async setAccountArchived(
    id: string,
    version: number,
    archived: boolean,
    now: Date,
  ): Promise<FinanceAccountRow | null> {
    const result = await this.database.query<AccountDatabaseRow>(
      `UPDATE finance_accounts SET archived=$3,version=version+1,updated_at=$4 WHERE id=$1 AND version=$2 AND archived<>$3 RETURNING ${ACCOUNT_COLUMNS}`,
      [id, version, archived, now],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }
  public async deleteAccount(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM finance_accounts WHERE id=$1 AND version=$2 AND archived=true`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async listPlatforms(archived: boolean): Promise<FinanceDebtPlatformRow[]> {
    const result = await this.database.query<PlatformDatabaseRow>(
      `SELECT ${PLATFORM_COLUMNS} FROM finance_debt_platforms WHERE archived=$1 ORDER BY created_at ASC,id ASC`,
      [archived],
    );
    return result.rows.map(mapPlatform);
  }
  public async getPlatform(id: string): Promise<FinanceDebtPlatformRow | null> {
    const result = await this.database.query<PlatformDatabaseRow>(
      `SELECT ${PLATFORM_COLUMNS} FROM finance_debt_platforms WHERE id=$1`,
      [id],
    );
    return result.rows[0] ? mapPlatform(result.rows[0]) : null;
  }
  public async createPlatform(row: FinanceDebtPlatformRow): Promise<FinanceDebtPlatformRow> {
    const result = await this.database.query<PlatformDatabaseRow>(
      `INSERT INTO finance_debt_platforms (id,name,billing_day,repayment_day,fixed_limit,temporary_limit,remaining_limit,note,archived,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING ${PLATFORM_COLUMNS}`,
      [
        row.id,
        row.name,
        row.billingDay,
        row.repaymentDay,
        row.fixedLimit,
        row.temporaryLimit,
        row.remainingLimit,
        row.note,
        row.archived,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return mapPlatform(result.rows[0]!);
  }
  public async updatePlatform(
    row: FinanceDebtPlatformRow,
    version: number,
  ): Promise<FinanceDebtPlatformRow | null> {
    const result = await this.database.query<PlatformDatabaseRow>(
      `UPDATE finance_debt_platforms SET name=$2,billing_day=$3,repayment_day=$4,fixed_limit=$5,temporary_limit=$6,remaining_limit=$7,note=$8,version=version+1,updated_at=$9 WHERE id=$1 AND version=$10 AND archived=false RETURNING ${PLATFORM_COLUMNS}`,
      [
        row.id,
        row.name,
        row.billingDay,
        row.repaymentDay,
        row.fixedLimit,
        row.temporaryLimit,
        row.remainingLimit,
        row.note,
        row.updatedAt,
        version,
      ],
    );
    return result.rows[0] ? mapPlatform(result.rows[0]) : null;
  }
  public async setPlatformArchived(
    id: string,
    version: number,
    archived: boolean,
    now: Date,
  ): Promise<FinanceDebtPlatformRow | null> {
    const result = await this.database.query<PlatformDatabaseRow>(
      `UPDATE finance_debt_platforms SET archived=$3,version=version+1,updated_at=$4 WHERE id=$1 AND version=$2 AND archived<>$3 RETURNING ${PLATFORM_COLUMNS}`,
      [id, version, archived, now],
    );
    return result.rows[0] ? mapPlatform(result.rows[0]) : null;
  }
  public async deletePlatform(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM finance_debt_platforms WHERE id=$1 AND version=$2 AND archived=true`,
      [id, version],
    );
    return (result.rowCount ?? 0) === 1;
  }

  public async getRecord(
    platformId: string,
    year: number,
    month: number,
  ): Promise<FinanceDebtRecordRow | null> {
    if (month === 0) {
      const result = await this.database.query<RecordDatabaseRow>(
        `SELECT r.id,r.platform_id,p.name AS platform_name,r.year,0 AS month,r.amount,r.version,r.created_at,r.updated_at FROM finance_unbilled_debt_records r JOIN finance_debt_platforms p ON p.id=r.platform_id WHERE r.platform_id=$1 AND r.year=$2`,
        [platformId, year],
      );
      return result.rows[0] ? mapRecord(result.rows[0]) : null;
    }
    const result = await this.database.query<RecordDatabaseRow>(
      `SELECT ${RECORD_COLUMNS} FROM finance_debt_records r JOIN finance_debt_platforms p ON p.id=r.platform_id WHERE r.platform_id=$1 AND r.year=$2 AND r.month=$3`,
      [platformId, year, month],
    );
    return result.rows[0] ? mapRecord(result.rows[0]) : null;
  }
  public async createRecord(row: FinanceDebtRecordRow): Promise<FinanceDebtRecordRow> {
    if (row.month === 0) {
      await this.database.query(
        `INSERT INTO finance_unbilled_debt_records (id,platform_id,year,amount,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [row.id, row.platformId, row.year, row.amount, row.version, row.createdAt, row.updatedAt],
      );
      return (await this.getRecord(row.platformId, row.year, row.month))!;
    }
    await this.database.query(
      `INSERT INTO finance_debt_records (id,platform_id,year,month,amount,version,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        row.id,
        row.platformId,
        row.year,
        row.month,
        row.amount,
        row.version,
        row.createdAt,
        row.updatedAt,
      ],
    );
    return (await this.getRecord(row.platformId, row.year, row.month))!;
  }
  public async updateRecord(
    row: FinanceDebtRecordRow,
    version: number,
  ): Promise<FinanceDebtRecordRow | null> {
    if (row.month === 0) {
      const result = await this.database.query(
        `UPDATE finance_unbilled_debt_records SET amount=$3,version=version+1,updated_at=$4 WHERE platform_id=$1 AND year=$2 AND version=$5`,
        [row.platformId, row.year, row.amount, row.updatedAt, version],
      );
      if ((result.rowCount ?? 0) !== 1) return null;
      return this.getRecord(row.platformId, row.year, row.month);
    }
    const result = await this.database.query(
      `UPDATE finance_debt_records SET amount=$4,version=version+1,updated_at=$5 WHERE platform_id=$1 AND year=$2 AND month=$3 AND version=$6`,
      [row.platformId, row.year, row.month, row.amount, row.updatedAt, version],
    );
    if ((result.rowCount ?? 0) !== 1) return null;
    return this.getRecord(row.platformId, row.year, row.month);
  }
  public async listRecords(year: number): Promise<FinanceDebtRecordRow[]> {
    const [monthly, unbilled] = await Promise.all([
      this.database.query<RecordDatabaseRow>(
        `SELECT ${RECORD_COLUMNS} FROM finance_debt_records r JOIN finance_debt_platforms p ON p.id=r.platform_id WHERE r.year=$1 ORDER BY r.month ASC,p.name ASC`,
        [year],
      ),
      this.database.query<RecordDatabaseRow>(
        `SELECT r.id,r.platform_id,p.name AS platform_name,r.year,0 AS month,r.amount,r.version,r.created_at,r.updated_at FROM finance_unbilled_debt_records r JOIN finance_debt_platforms p ON p.id=r.platform_id WHERE r.year=$1 ORDER BY p.name ASC`,
        [year],
      ),
    ]);
    return [...monthly.rows, ...unbilled.rows].map(mapRecord);
  }
  public async deleteRecord(id: string, version: number): Promise<boolean> {
    const result = await this.database.query(
      `DELETE FROM finance_debt_records WHERE id=$1 AND version=$2`,
      [id, version],
    );
    if ((result.rowCount ?? 0) === 1) return true;
    const unbilled = await this.database.query(
      `DELETE FROM finance_unbilled_debt_records WHERE id=$1 AND version=$2`,
      [id, version],
    );
    return (unbilled.rowCount ?? 0) === 1;
  }

  public async searchAccounts(query: string, limit: number): Promise<FinanceAccountRow[]> {
    const result = await this.database.query<AccountDatabaseRow>(
      `SELECT ${ACCOUNT_COLUMNS} FROM finance_accounts WHERE archived=false AND (LOWER(name) LIKE $1 OR LOWER(note) LIKE $1 OR LOWER(COALESCE(card_number,'')) LIKE $1 OR LOWER(COALESCE(phone,'')) LIKE $1) ORDER BY updated_at DESC LIMIT $2`,
      [`%${query.toLocaleLowerCase('zh-CN')}%`, limit],
    );
    return result.rows.map(mapAccount);
  }
  public async searchPlatforms(query: string, limit: number): Promise<FinanceDebtPlatformRow[]> {
    const result = await this.database.query<PlatformDatabaseRow>(
      `SELECT ${PLATFORM_COLUMNS} FROM finance_debt_platforms WHERE archived=false AND (LOWER(name) LIKE $1 OR LOWER(note) LIKE $1) ORDER BY updated_at DESC LIMIT $2`,
      [`%${query.toLocaleLowerCase('zh-CN')}%`, limit],
    );
    return result.rows.map(mapPlatform);
  }
}
