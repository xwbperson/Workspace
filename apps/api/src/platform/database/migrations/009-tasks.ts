export const tasksMigration = {
  id: '009-tasks',
  sql: `
    CREATE TABLE tasks (
      id uuid PRIMARY KEY,
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
      description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 20000),
      status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'completed', 'archived')),
      archived_from_status text,
      priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
      due_at timestamptz,
      recurrence text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none', 'daily', 'weekly', 'monthly', 'yearly')),
      parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
      recurrence_source_id uuid UNIQUE REFERENCES tasks(id) ON DELETE SET NULL,
      completed_at timestamptz,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CHECK (parent_id IS NULL OR parent_id <> id),
      CHECK (recurrence = 'none' OR due_at IS NOT NULL),
      CHECK (
        (status = 'archived' AND archived_from_status IN ('todo', 'in-progress', 'completed'))
        OR (status <> 'archived' AND archived_from_status IS NULL)
      )
    );

    CREATE INDEX tasks_status_due_idx ON tasks (status, due_at, priority, updated_at DESC);
    CREATE INDEX tasks_parent_idx ON tasks (parent_id, status, created_at);
  `,
} as const;
