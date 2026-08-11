export const inboxMigration = {
  id: '011-inbox',
  sql: `
    CREATE TABLE inbox_items (
      id uuid PRIMARY KEY,
      type text NOT NULL CHECK (type IN ('idea', 'inspiration', 'snippet', 'article', 'link', 'file')),
      title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
      content text NOT NULL DEFAULT '' CHECK (char_length(content) <= 50000),
      url text NOT NULL DEFAULT '' CHECK (char_length(url) <= 4000),
      file_id uuid REFERENCES stored_files(id) ON DELETE SET NULL,
      status text NOT NULL DEFAULT 'inbox' CHECK (status IN ('inbox', 'processed', 'archived')),
      archived_from_status text,
      version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
      created_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL,
      CHECK (
        (status = 'archived' AND archived_from_status IN ('inbox', 'processed'))
        OR (status <> 'archived' AND archived_from_status IS NULL)
      )
    );

    CREATE INDEX inbox_items_status_updated_idx ON inbox_items (status, updated_at DESC);
    CREATE INDEX inbox_items_file_idx ON inbox_items (file_id);
  `,
} as const;
