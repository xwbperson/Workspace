export const goalsMigration = {
  id: '008-goals',
  sql: `
    CREATE TABLE goals (
      id uuid PRIMARY KEY,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
      description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 10000),
      period_type text NOT NULL CHECK (period_type IN ('annual', 'quarterly', 'monthly')),
      period_label text NOT NULL CHECK (char_length(period_label) BETWEEN 1 AND 80),
      start_date date NOT NULL,
      end_date date NOT NULL,
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
      archived_from_status text,
      start_value numeric,
      target_value numeric,
      current_value numeric,
      metric_unit text NOT NULL DEFAULT '' CHECK (char_length(metric_unit) <= 40),
      metric_direction text,
      key_results jsonb NOT NULL DEFAULT '[]'::jsonb,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CHECK (end_date >= start_date),
      CHECK (
        (status = 'archived' AND archived_from_status IN ('active', 'completed'))
        OR (status <> 'archived' AND archived_from_status IS NULL)
      ),
      CHECK (
        (start_value IS NULL AND target_value IS NULL AND current_value IS NULL AND metric_direction IS NULL)
        OR
        (start_value IS NOT NULL AND target_value IS NOT NULL AND current_value IS NOT NULL
          AND metric_direction IN ('increase', 'decrease'))
      )
    );

    CREATE TABLE goal_measurements (
      id uuid PRIMARY KEY,
      goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      value numeric NOT NULL,
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 500),
      recorded_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL
    );

    CREATE INDEX goals_status_period_idx ON goals (status, end_date, updated_at DESC);
    CREATE INDEX goal_measurements_goal_idx ON goal_measurements (goal_id, recorded_at, id);
  `,
} as const;
