export const financeMigration = {
  id: '013-finance',
  sql: `
    CREATE TABLE finance_accounts (
      id uuid PRIMARY KEY,
      type text NOT NULL CHECK (type IN ('cash', 'alipay', 'wechat', 'bank', 'digital-cny', 'other')),
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
      balance numeric(16,2) NOT NULL DEFAULT 0,
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE finance_debt_platforms (
      id uuid PRIMARY KEY,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
      billing_day integer,
      repayment_day integer,
      fixed_limit numeric(16,2) NOT NULL DEFAULT 0 CHECK (fixed_limit >= 0),
      temporary_limit numeric(16,2) NOT NULL DEFAULT 0 CHECK (temporary_limit >= 0),
      remaining_limit numeric(16,2) NOT NULL DEFAULT 0 CHECK (remaining_limit >= 0),
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
      archived boolean NOT NULL DEFAULT false,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CHECK (billing_day IS NULL OR billing_day BETWEEN 1 AND 31),
      CHECK (repayment_day IS NULL OR repayment_day BETWEEN 1 AND 31)
    );

    CREATE TABLE finance_debt_records (
      id uuid PRIMARY KEY,
      platform_id uuid NOT NULL REFERENCES finance_debt_platforms(id) ON DELETE CASCADE,
      year integer NOT NULL CHECK (year BETWEEN 1900 AND 2200),
      month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
      amount numeric(16,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      UNIQUE (platform_id, year, month)
    );

    CREATE INDEX finance_accounts_archived_idx ON finance_accounts (archived, updated_at DESC);
    CREATE INDEX finance_platforms_archived_idx ON finance_debt_platforms (archived, updated_at DESC);
    CREATE INDEX finance_debt_records_period_idx ON finance_debt_records (year, month, platform_id);
  `,
} as const;
