export const countdownLifecycleMigration = {
  id: '003-countdown-lifecycle',
  sql: `
    ALTER TABLE countdowns ADD COLUMN archived_from_status text;

    UPDATE countdowns
    SET archived_from_status = 'active'
    WHERE status = 'archived';

    ALTER TABLE countdowns
      ADD CONSTRAINT countdowns_archive_state_check CHECK (
        (status = 'archived' AND archived_from_status IN ('active', 'completed'))
        OR (status <> 'archived' AND archived_from_status IS NULL)
      );
  `,
} as const;
