import { featureCatalog } from './feature-catalog.js';

export const primaryNavigation = [
  { id: 'overview', label: '总览', route: '/' },
  { id: 'features', label: '功能', route: '/features' },
  { id: 'search', label: '搜索', route: '/search' },
] as const;

export function getOrderedFeatureNavigation(sidebarFeatureOrder: readonly string[] = []) {
  const available = featureCatalog.filter(
    (feature) => feature.lifecycle === 'released' && feature.discoverableInProduction,
  );
  const byId = new Map(available.map((feature) => [feature.featureId, feature] as const));
  const ordered = sidebarFeatureOrder.flatMap((id) => {
    const feature = byId.get(id);
    if (!feature) return [];
    byId.delete(id);
    return [feature];
  });
  return [...ordered, ...available.filter((feature) => byId.has(feature.featureId))];
}

export function getVisibleFeatureNavigation(
  hiddenFeatureIds: readonly string[],
  sidebarFeatureOrder: readonly string[] = [],
) {
  const hidden = new Set(hiddenFeatureIds);
  return getOrderedFeatureNavigation(sidebarFeatureOrder).filter(
    (feature) => !hidden.has(feature.featureId),
  );
}
