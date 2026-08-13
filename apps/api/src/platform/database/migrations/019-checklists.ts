export const checklistsMigration = {
  id: '019-checklists',
  sql: `
    CREATE TABLE checklists (
      id uuid PRIMARY KEY,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 20000),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE TABLE checklist_items (
      id uuid PRIMARY KEY,
      checklist_id uuid NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 240),
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
      quantity numeric(12, 3) CHECK (quantity > 0),
      unit text NOT NULL DEFAULT '' CHECK (char_length(unit) <= 20),
      price_cents integer CHECK (price_cents >= 0),
      checked_at timestamptz,
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE INDEX checklists_status_position_idx
      ON checklists (status, position, updated_at DESC, id);
    CREATE INDEX checklist_items_order_idx
      ON checklist_items (checklist_id, checked_at, position, id);
  `,
} as const;
