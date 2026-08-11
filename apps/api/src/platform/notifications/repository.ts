import type { WorkbenchNotification } from '@workspace/client-sdk';
import type { Database } from '../database/types.js';

export interface NotificationInput {
  notificationId: string;
  source: WorkbenchNotification['source'];
  type: string;
  severity: WorkbenchNotification['severity'];
  title: string;
  summary?: string;
  occurredAt: Date;
  targetRoute?: string;
  requiresAction: boolean;
}

interface NotificationRow {
  notification_id: string;
  source: WorkbenchNotification['source'];
  type: string;
  severity: WorkbenchNotification['severity'];
  title: string;
  summary: string | null;
  occurred_at: Date;
  target_route: string | null;
  requires_action: boolean;
  read_at: Date | null;
}

function mapNotification(row: NotificationRow): WorkbenchNotification {
  return {
    notificationId: row.notification_id,
    source: row.source,
    type: row.type,
    severity: row.severity,
    title: row.title,
    occurredAt: row.occurred_at.toISOString(),
    requiresAction: row.requires_action,
    ...(row.summary ? { summary: row.summary } : {}),
    ...(row.target_route ? { targetRoute: row.target_route } : {}),
    ...(row.read_at ? { readAt: row.read_at.toISOString() } : {}),
  };
}

export class NotificationRepository {
  public constructor(
    private readonly database: Database,
    private readonly workspaceId: string,
  ) {}

  public async publish(input: NotificationInput): Promise<void> {
    await this.database.query(
      `INSERT INTO workbench_notifications (
         notification_id, workspace_id, source, type, severity, title, summary,
         occurred_at, target_route, requires_action
       ) VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (notification_id) DO NOTHING`,
      [
        input.notificationId,
        this.workspaceId,
        JSON.stringify(input.source),
        input.type,
        input.severity,
        input.title,
        input.summary ?? null,
        input.occurredAt,
        input.targetRoute ?? null,
        input.requiresAction,
      ],
    );
  }

  public async list(limit = 100): Promise<WorkbenchNotification[]> {
    const result = await this.database.query<NotificationRow>(
      `SELECT notification_id, source, type, severity, title, summary,
              occurred_at, target_route, requires_action, read_at
       FROM workbench_notifications
       WHERE workspace_id = $1
       ORDER BY occurred_at DESC, notification_id ASC
       LIMIT $2`,
      [this.workspaceId, limit],
    );
    return result.rows.map(mapNotification);
  }

  public async markRead(notificationId: string): Promise<void> {
    await this.database.query(
      `UPDATE workbench_notifications SET read_at = COALESCE(read_at, now())
       WHERE workspace_id = $1 AND notification_id = $2`,
      [this.workspaceId, notificationId],
    );
  }

  public async markAllRead(): Promise<void> {
    await this.database.query(
      `UPDATE workbench_notifications SET read_at = COALESCE(read_at, now())
       WHERE workspace_id = $1`,
      [this.workspaceId],
    );
  }
}
