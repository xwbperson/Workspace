import type { WorkbenchPreferences } from '@workspace/client-sdk';
import { describe, expect, it, vi } from 'vitest';
import type { PreferencesRepository } from '../platform/preferences/repository.js';
import type { WorkbenchContributionProvider } from './workbench-contracts.js';
import { WorkbenchService } from './workbench-service.js';

function createService(): { service: WorkbenchService; save: ReturnType<typeof vi.fn> } {
  const save = vi.fn(async (value: WorkbenchPreferences) => value);
  const preferences = {
    get: vi.fn(async (defaults: WorkbenchPreferences) => defaults),
    save,
  } as unknown as PreferencesRepository;
  const providers = [{ featureId: 'countdowns' }, { featureId: 'books' }].map(
    (provider) => provider as WorkbenchContributionProvider,
  );
  return { service: new WorkbenchService(providers, preferences), save };
}

describe('WorkbenchService preferences', () => {
  it('shows every feature in navigation by default', () => {
    const { service } = createService();

    expect(service.defaultPreferences()).toMatchObject({ hiddenFeatureIds: [] });
    expect(service.defaultPreferences()).not.toHaveProperty('pinnedFeatureIds');
  });

  it('stores only unique hidden ids that belong to registered features', async () => {
    const { service, save } = createService();
    const input = {
      ...service.defaultPreferences(),
      hiddenFeatureIds: ['books', 'unknown', 'books'],
    };

    await service.savePreferences(input);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ hiddenFeatureIds: ['books'] }));
  });
});
