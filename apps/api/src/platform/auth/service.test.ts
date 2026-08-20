import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../../config.js';
import { createDatabase } from '../database/database.js';
import { runMigrations } from '../database/migrate.js';
import type { Database } from '../database/types.js';
import { createSecretToken } from './crypto.js';
import { AuthRepository } from './repository.js';
import { AuthService } from './service.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('long-lived owner session', () => {
  let database: Database;
  let now: Date;
  let service: AuthService;

  beforeEach(async () => {
    const config = loadConfig({
      nodeEnv: 'test',
      databaseInMemory: true,
      cookieSecure: false,
      logLevel: 'silent',
    });
    database = await createDatabase(config);
    await runMigrations(database);
    now = new Date('2030-01-01T00:00:00.000Z');
    service = new AuthService(new AuthRepository(database), config, () => new Date(now));
    await service.initializeOwner('correct horse battery staple');
  });

  afterEach(async () => database.end());

  it('uses 180-day idle and 365-day absolute limits for remembered devices', async () => {
    const login = await service.login(
      { username: 'owner', password: 'correct horse battery staple', remember: true },
      '127.0.0.1',
      createSecretToken(),
    );
    expect(login.maxAgeSeconds).toBe(180 * 24 * 60 * 60);
    expect(new Date(login.response.session.idleExpiresAt).getTime() - now.getTime()).toBe(
      180 * DAY_MS,
    );
    expect(new Date(login.response.session.absoluteExpiresAt).getTime() - now.getTime()).toBe(
      365 * DAY_MS,
    );
  });

  it('rotates the token after seven days and accepts the old token only for two minutes', async () => {
    const login = await service.login(
      { username: 'owner', password: 'correct horse battery staple', remember: true },
      '127.0.0.1',
      createSecretToken(),
    );
    now = new Date(now.getTime() + 7 * DAY_MS);
    const rotated = await service.authenticate(login.cookieValue);
    expect(rotated.replacementCookieValue).toBeDefined();
    await expect(service.authenticate(login.cookieValue)).resolves.toBeDefined();

    now = new Date(now.getTime() + 2 * 60 * 1000 + 1);
    await expect(service.authenticate(login.cookieValue)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(service.authenticate(rotated.replacementCookieValue)).resolves.toBeDefined();
  });

  it('only returns the winning cookie when parallel requests rotate one session', async () => {
    const login = await service.login(
      { username: 'owner', password: 'correct horse battery staple', remember: true },
      '127.0.0.1',
      createSecretToken(),
    );
    now = new Date(now.getTime() + 7 * DAY_MS);

    const results = await Promise.all([
      service.authenticate(login.cookieValue),
      service.authenticate(login.cookieValue),
      service.authenticate(login.cookieValue),
    ]);
    const replacementCookies = results.flatMap((result) =>
      result.replacementCookieValue ? [result.replacementCookieValue] : [],
    );
    expect(replacementCookies).toHaveLength(1);

    now = new Date(now.getTime() + 2 * 60 * 1000 + 1);
    await expect(service.authenticate(replacementCookies[0])).resolves.toBeDefined();
    await expect(service.authenticate(login.cookieValue)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('keeps temporary login browser-scoped with a 24-hour absolute server limit', async () => {
    const login = await service.login(
      { username: 'owner', password: 'correct horse battery staple', remember: false },
      '127.0.0.1',
      createSecretToken(),
    );
    expect(login.maxAgeSeconds).toBeUndefined();
    expect(new Date(login.response.session.idleExpiresAt).getTime() - now.getTime()).toBe(
      12 * 60 * 60 * 1000,
    );
    expect(new Date(login.response.session.absoluteExpiresAt).getTime() - now.getTime()).toBe(
      DAY_MS,
    );
  });

  it('rejects a short password through the CLI-facing service boundary', async () => {
    await expect(service.resetOwnerPassword('too-short')).rejects.toMatchObject({
      code: 'INVALID_PASSWORD_LENGTH',
    });
    await expect(
      service.login(
        { username: 'owner', password: 'correct horse battery staple', remember: false },
        '127.0.0.1',
        createSecretToken(),
      ),
    ).resolves.toBeDefined();
  });
});
