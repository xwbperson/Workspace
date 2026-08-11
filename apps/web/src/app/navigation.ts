import { featureCatalog } from './feature-catalog.js';

export const primaryNavigation = [
  { id: 'overview', label: '总览', route: '/' },
  { id: 'features', label: '功能', route: '/features' },
  { id: 'search', label: '搜索', route: '/search' },
] as const;

export function getVisibleFeatureNavigation(hiddenFeatureIds: readonly string[]) {
  const hidden = new Set(hiddenFeatureIds);
  return featureCatalog.filter(
    (feature) =>
      feature.lifecycle === 'released' &&
      feature.discoverableInProduction &&
      !hidden.has(feature.featureId),
  );
}
