import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../../config.js';
import { createDatabase } from '../database.js';
import type { Database } from '../types.js';
import { financeMigration } from './013-finance.js';
import { financeUnbilledDebtMigration } from './015-finance-unbilled-debt.js';
import { financeAccountDetailsMigration } from './017-finance-account-details.js';

describe('finance account details migration', () => {
  let database: Database;

  beforeEach(async () => {
    database = await createDatabase(
      loadConfig({
        nodeEnv: 'test',
        databaseInMemory: true,
        workbenchRoot: '.workbench-finance-migration-test',
      }),
    );
    await database.query(financeMigration.sql);
    await database.query(financeUnbilledDebtMigration.sql);
  });

  afterEach(async () => database.end());

  it('adds nullable account details without changing existing debt values', async () => {
    const accountId = '00000000-0000-4000-8000-000000000101';
    const platformId = '00000000-0000-4000-8000-000000000102';
    const monthlyId = '00000000-0000-4000-8000-000000000103';
    const unbilledId = '00000000-0000-4000-8000-000000000104';
    const timestamp = '2026-08-01T00:00:00.000Z';
    await database.query(
      `INSERT INTO finance_accounts
         (id,type,name,balance,note,archived,version,created_at,updated_at)
       VALUES ($1,'bank','旧银行卡',123.45,'',false,1,$2,$2)`,
      [accountId, timestamp],
    );
    await database.query(
      `INSERT INTO finance_debt_platforms
         (id,name,billing_day,repayment_day,fixed_limit,temporary_limit,remaining_limit,note,archived,version,created_at,updated_at)
       VALUES ($1,'已有平台',10,20,15000,0,12000,'',false,1,$2,$2)`,
      [platformId, timestamp],
    );
    await database.query(
      `INSERT INTO finance_debt_records
         (id,platform_id,year,month,amount,version,created_at,updated_at)
       VALUES ($1,$2,2026,9,151.40,1,$3,$3)`,
      [monthlyId, platformId, timestamp],
    );
    await database.query(
      `INSERT INTO finance_unbilled_debt_records
         (id,platform_id,year,amount,version,created_at,updated_at)
       VALUES ($1,$2,2026,18.35,1,$3,$3)`,
      [unbilledId, platformId, timestamp],
    );

    await database.query(financeAccountDetailsMigration.sql);

    const account = await database.query<{
      account_type: string;
      card_number: string | null;
      phone: string | null;
      credit_limit: string | null;
    }>('SELECT account_type,card_number,phone,credit_limit FROM finance_accounts WHERE id=$1', [
      accountId,
    ]);
    expect(account.rows[0]).toEqual({
      account_type: 'bank',
      card_number: null,
      phone: null,
      credit_limit: null,
    });
    const monthly = await database.query<{ amount: string }>(
      'SELECT amount FROM finance_debt_records WHERE id=$1',
      [monthlyId],
    );
    const unbilled = await database.query<{ amount: string }>(
      'SELECT amount FROM finance_unbilled_debt_records WHERE id=$1',
      [unbilledId],
    );
    expect(Number(monthly.rows[0]?.amount)).toBe(151.4);
    expect(Number(unbilled.rows[0]?.amount)).toBe(18.35);
  });
});
