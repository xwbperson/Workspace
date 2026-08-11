import { loadConfig } from '../config.js';
import { buildApp } from '../app/build-app.js';
import { createDatabase } from '../platform/database/database.js';
import { runMigrations } from '../platform/database/migrate.js';
import { AuthRepository } from '../platform/auth/repository.js';
import { AuthService } from '../platform/auth/service.js';
import { initializeWorkspace, validateWorkspace } from '../platform/workspace/workspace.js';

const config = loadConfig();

if (config.nodeEnv === 'test' && config.databaseInMemory) {
  await initializeWorkspace(config);
} else {
  await validateWorkspace(config);
}

const database = await createDatabase(config);
await runMigrations(database);

if (config.nodeEnv === 'test' && process.env.WORKBENCH_TEST_PASSWORD) {
  const auth = new AuthService(new AuthRepository(database), config);
  if (!(await auth.isOwnerInitialized())) {
    await auth.initializeOwner(process.env.WORKBENCH_TEST_PASSWORD);
  }
}

const app = await buildApp({ config, database });

const shutdown = async (): Promise<void> => {
  await app.close();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.fatal({ err: error }, 'API startup failed');
  await app.close();
  process.exit(1);
}
