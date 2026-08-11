import { featureCatalog } from './feature-catalog.js';

export const primaryNavigation = [
  { id: 'overview', label: '总览', route: '/' },
  { id: 'features', label: '功能', route: '/features' },
  { id: 'search', label: '搜索', route: '/search' },
] as const;

export function getPinnedNavigation(pinnedFeatureIds: readonly string[]) {
  const pinned = new Set(pinnedFeatureIds);
  return featureCatalog.filter((feature) => pinned.has(feature.featureId));
}
