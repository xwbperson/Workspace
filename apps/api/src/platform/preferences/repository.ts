import type { WorkbenchPreferences } from '@workspace/client-sdk';
import type { Database } from '../database/types.js';

interface PreferenceRow {
  value: Partial<WorkbenchPreferences> & { pinnedFeatureIds?: string[] };
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
    const stored = result.rows[0]?.value;
    if (!stored) return defaults;
    const current = { ...stored };
    delete current.pinnedFeatureIds;
    const theme =
      current.theme === 'light' || current.theme === 'dark' ? current.theme : defaults.theme;
    return {
      ...defaults,
      ...current,
      theme,
      hiddenFeatureIds: Array.isArray(current.hiddenFeatureIds)
        ? current.hiddenFeatureIds
        : defaults.hiddenFeatureIds,
    };
  }

  public async save(value: WorkbenchPreferences): Promise<WorkbenchPreferences> {
    const result = await this.database.query<PreferenceRow>(
      `INSERT INTO workbench_preferences (workspace_id, value, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (workspace_id) DO UPDATE SET value = $2::jsonb, updated_at = now()
       RETURNING value`,
      [this.workspaceId, JSON.stringify(value)],
    );
    return result.rows[0]!.value as WorkbenchPreferences;
  }
}
