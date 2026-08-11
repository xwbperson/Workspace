import pg from 'pg';
import type { AppConfig } from '../../config.js';
import type { Database } from './types.js';

export async function createDatabase(config: AppConfig): Promise<Database> {
  if (config.databaseInMemory) {
    const { newDb, DataType } = await import('pg-mem');
    const memory = newDb({ autoCreateForeignKeyIndices: true });
    memory.public.registerFunction({
      name: 'current_database',
      returns: DataType.text,
      implementation: () => 'workbench_test',
    });
    memory.public.registerFunction({
      name: 'char_length',
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => value.length,
    });
    const adapter = memory.adapters.createPg();
    // pg-mem intentionally exposes its adapter constructors as `any`.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    return new adapter.Pool();
  }

  return new pg.Pool({
    connectionString: config.databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: 'personal-workbench',
  });
}
