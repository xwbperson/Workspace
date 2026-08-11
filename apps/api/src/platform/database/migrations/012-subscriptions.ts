export const subscriptionsMigration = {
  id: '012-subscriptions',
  sql: `
    CREATE TABLE subscriptions (
      id uuid PRIMARY KEY,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 240),
      category text NOT NULL CHECK (category IN ('software', 'membership', 'domain', 'server', 'other')),
      amount numeric(14,2) NOT NULL CHECK (amount >= 0),
      currency text NOT NULL DEFAULT 'CNY' CHECK (char_length(currency) = 3),
      billing_cycle text NOT NULL CHECK (billing_cycle IN ('monthly', 'quarterly', 'yearly')),
      renewal_date date NOT NULL,
      auto_renew boolean NOT NULL DEFAULT false,
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'archived')),
      archived_from_status text,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CHECK (
        (status = 'archived' AND archived_from_status IN ('active', 'expired'))
        OR (status <> 'archived' AND archived_from_status IS NULL)
      )
    );
    CREATE INDEX subscriptions_status_renewal_idx ON subscriptions (status, renewal_date, updated_at DESC);
  `,
} as const;
