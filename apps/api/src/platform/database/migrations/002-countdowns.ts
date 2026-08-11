export const countdownsMigration = {
  id: '002-countdowns',
  sql: `
    CREATE TABLE countdowns (
      id uuid PRIMARY KEY,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
      target_at timestamptz NOT NULL,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
      priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN 0 AND 100),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );
    CREATE INDEX countdowns_active_target_idx
      ON countdowns (target_at ASC)
      WHERE status = 'active';
    CREATE INDEX countdowns_updated_idx ON countdowns (updated_at DESC);
  `,
} as const;
