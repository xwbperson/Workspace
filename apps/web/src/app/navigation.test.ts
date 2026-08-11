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
});
