export const fileReferenceProtectionMigration = {
  id: '021-file-reference-protection',
  sql: `
    ALTER TABLE books
      DROP CONSTRAINT IF EXISTS books_cover_file_id_fkey,
      ADD CONSTRAINT books_cover_file_id_fkey
        FOREIGN KEY (cover_file_id) REFERENCES stored_files(id) ON DELETE RESTRICT;

    ALTER TABLE courses
      DROP CONSTRAINT IF EXISTS courses_syllabus_file_id_fkey,
      ADD CONSTRAINT courses_syllabus_file_id_fkey
        FOREIGN KEY (syllabus_file_id) REFERENCES stored_files(id) ON DELETE RESTRICT;

    ALTER TABLE inbox_items
      DROP CONSTRAINT IF EXISTS inbox_items_file_id_fkey,
      ADD CONSTRAINT inbox_items_file_id_fkey
        FOREIGN KEY (file_id) REFERENCES stored_files(id) ON DELETE RESTRICT;

    CREATE INDEX stored_files_created_at_idx ON stored_files (created_at);
  `,
} as const;
