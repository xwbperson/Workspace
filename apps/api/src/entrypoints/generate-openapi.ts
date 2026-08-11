import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from '../app/build-app.js';
import { loadConfig } from '../config.js';
import { createDatabase } from '../platform/database/database.js';
import { runMigrations } from '../platform/database/migrate.js';

const root = await mkdtemp(resolve(tmpdir(), 'workbench-openapi-'));
const config = loadConfig({
  nodeEnv: 'test',
  databaseInMemory: true,
  workbenchRoot: root,
  logLevel: 'silent',
});
const database = await createDatabase(config);
await runMigrations(database);
const app = await buildApp({ config, database, startSchedulers: false });
await app.ready();

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const outputDirectory = resolve(repositoryRoot, 'contracts');
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, 'openapi.json'),
  `${JSON.stringify(app.swagger(), null, 2)}\n`,
  'utf8',
);
await app.close();
await rm(root, { recursive: true, force: true });
