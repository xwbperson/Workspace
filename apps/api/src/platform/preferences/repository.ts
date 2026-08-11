import type { WorkbenchPreferences } from '@workspace/client-sdk';
import type { Database } from '../database/types.js';

interface PreferenceRow {
  value: WorkbenchPreferences;
}

export class PreferencesRepository {
  public constructor(
    private readonly database: Database,
    private readonly workspaceId: string,
  ) {}

  public async get(defaults: WorkbenchPreferences): Promise<WorkbenchPreferences> {
    const result = await this.database.query<PreferenceRow>(
      'SELECT value FROM workbench_preferences WHERE workspace_id = $1',
      [this.workspaceId],
    );
    return result.rows[0]?.value ?? defaults;
  }

  public async save(value: WorkbenchPreferences): Promise<WorkbenchPreferences> {
    const result = await this.database.query<PreferenceRow>(
      `INSERT INTO workbench_preferences (workspace_id, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (workspace_id) DO UPDATE SET value = $2::jsonb, updated_at = now()
       RETURNING value`,
      [this.workspaceId, JSON.stringify(value)],
    );
    return result.rows[0]!.value;
  }
}
