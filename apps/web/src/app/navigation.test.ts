import { describe, expect, it } from 'vitest';
import { featureCatalog } from './feature-catalog.js';
import { getVisibleFeatureNavigation } from './navigation.js';

describe('feature navigation', () => {
  it('shows every released feature by default and excludes only hidden feature ids', () => {
    expect(getVisibleFeatureNavigation([])).toEqual(featureCatalog);

    expect(
      getVisibleFeatureNavigation(['books', 'finance']).map((feature) => feature.featureId),
    ).toEqual(
      featureCatalog
        .filter((feature) => !['books', 'finance'].includes(feature.featureId))
        .map((feature) => feature.featureId),
    );
  });

  it('applies a partial custom order and appends newly available features', () => {
    const result = getVisibleFeatureNavigation([], ['finance', 'books', 'unknown', 'finance']);

    expect(result.slice(0, 2).map((feature) => feature.featureId)).toEqual(['finance', 'books']);
    expect(result).toHaveLength(featureCatalog.length);
    expect(new Set(result.map((feature) => feature.featureId)).size).toBe(featureCatalog.length);
  });

  it('keeps hidden features out without changing the custom order of visible features', () => {
    expect(
      getVisibleFeatureNavigation(['books'], ['finance', 'books', 'tasks']).map(
        (feature) => feature.featureId,
      ),
    ).toEqual([
      'finance',
      'tasks',
      ...featureCatalog
        .map((feature) => feature.featureId)
        .filter((id) => !['finance', 'books', 'tasks'].includes(id)),
    ]);
  });
});
