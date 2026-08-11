export const courseStatusMigration = {
  id: '007-course-status',
  sql: `
    ALTER TABLE courses
      ADD COLUMN status text NOT NULL DEFAULT 'in-progress'
      CHECK (status IN ('in-progress', 'completed'));

    DROP INDEX courses_updated_idx;
    CREATE INDEX courses_updated_idx ON courses (archived, status, updated_at DESC);
  `,
} as const;
