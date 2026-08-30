export const inventoryMigration = {
  id: '023-inventory',
  sql: `
    CREATE TABLE inventory_groups (
      id uuid PRIMARY KEY,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
      position integer NOT NULL DEFAULT 0 CHECK (position >= 0),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE UNIQUE INDEX inventory_groups_name_unique_idx
      ON inventory_groups (LOWER(name));
    CREATE INDEX inventory_groups_position_idx
      ON inventory_groups (position, created_at, id);

    CREATE TABLE inventory_items (
      id uuid PRIMARY KEY,
      group_id uuid REFERENCES inventory_groups(id) ON DELETE SET NULL,
      name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
      purpose text NOT NULL DEFAULT '' CHECK (char_length(purpose) <= 500),
      note text NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
      quantity integer NOT NULL DEFAULT 0 CHECK (quantity BETWEEN 0 AND 999999),
      status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL
    );

    CREATE INDEX inventory_items_status_updated_idx
      ON inventory_items (status, updated_at DESC, id);
    CREATE INDEX inventory_items_group_status_idx
      ON inventory_items (group_id, status, name, id);
  `,
} as const;
