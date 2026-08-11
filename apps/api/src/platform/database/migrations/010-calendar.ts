export const calendarMigration = {
  id: '010-calendar',
  sql: `
    CREATE TABLE calendar_entries (
      id uuid PRIMARY KEY,
      type text NOT NULL CHECK (type IN ('schedule', 'journal', 'summary')),
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
      content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 50000),
      entry_date date NOT NULL,
      starts_at timestamptz,
      ends_at timestamptz,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CHECK (ends_at IS NULL OR (starts_at IS NOT NULL AND ends_at >= starts_at))
    );

    CREATE INDEX calendar_entries_date_idx ON calendar_entries (status, entry_date, starts_at, updated_at DESC);
  `,
} as const;
