export const fileStorageMigration = {
  id: '004-file-storage',
  sql: `
    CREATE TABLE stored_files (
      id uuid PRIMARY KEY,
      sha256 text NOT NULL CHECK (char_length(sha256) = 64),
      original_name text NOT NULL CHECK (char_length(original_name) BETWEEN 1 AND 240),
      mime_type text NOT NULL CHECK (char_length(mime_type) BETWEEN 1 AND 120),
      size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
      storage_key text NOT NULL CHECK (char_length(storage_key) BETWEEN 1 AND 200),
      created_at timestamptz NOT NULL
    );

    CREATE INDEX stored_files_sha256_idx ON stored_files (sha256);
  `,
} as const;
