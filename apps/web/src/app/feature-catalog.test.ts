import { describe, expect, it } from 'vitest';
import { featureCatalog } from './feature-catalog.js';

describe('static feature catalog', () => {
  it('publishes countdowns, books and courses as released features', () => {
    expect(featureCatalog).toHaveLength(3);
    expect(featureCatalog[0]).toMatchObject({
      featureId: 'countdowns',
      route: '/features/countdowns',
      lifecycle: 'released',
      discoverableInProduction: true,
      capabilities: {
        focusCandidates: true,
        upcoming: true,
        recent: true,
        overviewBlocks: true,
        search: true,
        quickCreate: true,
        notifications: true,
      },
    });
    expect(featureCatalog[1]).toMatchObject({
      featureId: 'books',
      route: '/features/books',
      lifecycle: 'released',
      capabilities: { recent: true, overviewBlocks: true, search: true, quickCreate: true },
    });
    expect(featureCatalog[2]).toMatchObject({
      featureId: 'courses',
      route: '/features/courses',
      lifecycle: 'released',
      capabilities: {
        focusCandidates: true,
        upcoming: true,
        recent: true,
        overviewBlocks: true,
        search: true,
        quickCreate: true,
      },
    });
  });

  it('keeps feature IDs and routes unique', () => {
    expect(new Set(featureCatalog.map((feature) => feature.featureId)).size).toBe(
      featureCatalog.length,
    );
    expect(new Set(featureCatalog.map((feature) => feature.route)).size).toBe(
      featureCatalog.length,
    );
  });
});
