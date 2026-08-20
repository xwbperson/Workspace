export const backupRestoreTimestampsMigration = {
  id: '022-backup-restore-timestamps',
  sql: `
    ALTER TABLE backup_runs ADD COLUMN restored_at timestamptz;
    UPDATE backup_runs SET restored_at=completed_at
      WHERE status='restored' AND restored_at IS NULL;
    CREATE INDEX backup_runs_restored_at_idx ON backup_runs (restored_at DESC);
  `,
} as const;
