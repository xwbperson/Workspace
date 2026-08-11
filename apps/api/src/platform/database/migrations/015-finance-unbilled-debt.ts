export const financeUnbilledDebtMigration = {
  id: '015-finance-unbilled-debt',
  sql: `
    CREATE TABLE finance_unbilled_debt_records (
      id uuid PRIMARY KEY,
      platform_id uuid NOT NULL REFERENCES finance_debt_platforms(id) ON DELETE CASCADE,
      year integer NOT NULL CHECK (year BETWEEN 1900 AND 2200),
      amount numeric(16,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      UNIQUE (platform_id, year)
    );

    CREATE INDEX finance_unbilled_debt_records_year_idx
      ON finance_unbilled_debt_records (year, platform_id);
  `,
} as const;
