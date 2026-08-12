import type { WorkbenchPreferences } from '@workspace/client-sdk';
import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../database/types.js';
import { PreferencesRepository } from './repository.js';

const defaults: WorkbenchPreferences = {
  hiddenFeatureIds: [],
  sidebarFeatureOrder: [],
  overviewBlockIds: ['countdowns:nearest'],
  theme: 'dark',
  dateDisplay: 'relative',
  notificationsEnabled: true,
  refreshIntervalMinutes: 5,
};

describe('PreferencesRepository', () => {
  it('upgrades legacy pinned preferences without hiding any feature', async () => {
    const database = {
      query: vi.fn(async () => ({
        rows: [
          {
            value: {
              pinnedFeatureIds: ['countdowns'],
              overviewBlockIds: ['countdowns:nearest'],
              theme: 'dark',
              dateDisplay: 'absolute',
              notificationsEnabled: false,
              refreshIntervalMinutes: 15,
            },
          },
        ],
      })),
    } as unknown as Database;
    const repository = new PreferencesRepository(database, 'workspace');

    const result = await repository.get(defaults);

    expect(result.hiddenFeatureIds).toEqual([]);
    expect(result.sidebarFeatureOrder).toEqual([]);
    expect(result.theme).toBe('dark');
    expect(result).not.toHaveProperty('pinnedFeatureIds');
  });

  it('uses the dark default when a legacy system theme is stored', async () => {
    const database = {
      query: vi.fn(async () => ({
        rows: [
          {
            value: {
              theme: 'system',
            },
          },
        ],
      })),
    } as unknown as Database;
    const repository = new PreferencesRepository(database, 'workspace');

    const result = await repository.get(defaults);

    expect(result.theme).toBe('dark');
  });

  it('keeps the glass theme when it is stored', async () => {
    const database = {
      query: vi.fn(async () => ({
        rows: [
          {
            value: {
              theme: 'glass',
            },
          },
        ],
      })),
    } as unknown as Database;
    const repository = new PreferencesRepository(database, 'workspace');

    const result = await repository.get(defaults);

    expect(result.theme).toBe('glass');
  });
});
