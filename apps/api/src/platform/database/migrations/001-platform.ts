export const platformMigration = {
  id: '001-platform',
  sql: `
    CREATE TABLE owner_account (
      id uuid PRIMARY KEY,
      username text NOT NULL UNIQUE CHECK (username = 'owner'),
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE auth_sessions (
      session_id uuid PRIMARY KEY,
      session_family_id uuid NOT NULL,
      current_token_hash text NOT NULL UNIQUE,
      previous_token_hash text,
      previous_token_grace_until timestamptz,
      csrf_token_hash text NOT NULL,
      client_label text NOT NULL CHECK (char_length(client_label) BETWEEN 1 AND 80),
      remembered boolean NOT NULL,
      created_at timestamptz NOT NULL,
      last_seen_at timestamptz NOT NULL,
      idle_expires_at timestamptz NOT NULL,
      absolute_expires_at timestamptz NOT NULL,
      last_rotated_at timestamptz NOT NULL,
      revoked_at timestamptz,
      CONSTRAINT auth_session_expiry_order CHECK (idle_expires_at <= absolute_expires_at)
    );
    CREATE INDEX auth_sessions_family_idx ON auth_sessions (session_family_id);
    CREATE INDEX auth_sessions_expiry_idx ON auth_sessions (absolute_expires_at) WHERE revoked_at IS NULL;

    CREATE TABLE auth_login_attempts (
      source_hash text PRIMARY KEY,
      failure_count integer NOT NULL DEFAULT 0 CHECK (failure_count >= 0),
      last_failed_at timestamptz NOT NULL
    );

    CREATE TABLE workbench_preferences (
      workspace_id uuid PRIMARY KEY,
      value jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE workbench_notifications (
      notification_id text PRIMARY KEY,
      workspace_id uuid NOT NULL,
      source jsonb NOT NULL,
      type text NOT NULL,
      severity text NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
      title text NOT NULL,
      summary text,
      occurred_at timestamptz NOT NULL,
      target_route text,
      requires_action boolean NOT NULL DEFAULT false,
      read_at timestamptz
    );
    CREATE INDEX workbench_notifications_time_idx
      ON workbench_notifications (occurred_at DESC);

    CREATE TABLE backup_runs (
      backup_id uuid PRIMARY KEY,
      status text NOT NULL CHECK (status IN ('running', 'complete', 'failed', 'verified', 'restored')),
      path text NOT NULL,
      started_at timestamptz NOT NULL,
      completed_at timestamptz,
      verified_at timestamptz,
      error_code text
    );
  `,
} as const;
