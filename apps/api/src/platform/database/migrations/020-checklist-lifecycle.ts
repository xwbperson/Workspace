export const checklistLifecycleMigration = {
  id: '020-checklist-lifecycle',
  sql: `
    ALTER TABLE checklists ADD COLUMN completed boolean NOT NULL DEFAULT false;
    ALTER TABLE checklists ADD COLUMN archived_from_status text;

    UPDATE checklists
    SET archived_from_status='active'
    WHERE status='archived';

    ALTER TABLE checklists
      ADD CONSTRAINT checklists_archive_state_check CHECK (
        (status = 'archived'
          AND archived_from_status IN ('active', 'completed')
          AND completed = (archived_from_status = 'completed'))
        OR (status = 'active' AND archived_from_status IS NULL)
      );
  `,
} as const;
