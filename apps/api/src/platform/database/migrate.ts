import type { Database } from './types.js';
import { migrations } from './migrations/index.js';

export async function runMigrations(database: Database): Promise<string> {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const applied = await database.query<{ id: string }>('SELECT id FROM schema_migrations');
  const appliedIds = new Set(applied.rows.map((row) => row.id));

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue;
    const client = await database.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.sql);
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [migration.id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return migrations.at(-1)?.id ?? 'none';
}

export async function getMigrationVersion(database: Database): Promise<string> {
  const result = await database.query<{ id: string }>(
    'SELECT id FROM schema_migrations ORDER BY id DESC LIMIT 1',
  );
  return result.rows[0]?.id ?? 'none';
}
