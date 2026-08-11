export const lifeCountdownMigration = {
  id: '014-life-countdown',
  sql: `
    CREATE TABLE life_profiles (
      id text PRIMARY KEY,
      birth_date date,
      expected_age integer NOT NULL DEFAULT 80 CHECK (expected_age BETWEEN 1 AND 150),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    INSERT INTO life_profiles (id, birth_date, expected_age, version, created_at, updated_at)
    VALUES ('owner', NULL, 80, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    CREATE TABLE life_events (
      id uuid PRIMARY KEY,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
      target_at timestamptz NOT NULL,
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 5000),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );
    CREATE INDEX life_events_status_target_idx ON life_events (status, target_at, updated_at DESC);
  `,
} as const;
