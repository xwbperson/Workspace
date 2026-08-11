import { featureCatalog } from './feature-catalog.js';

export const dashboardWidgets = featureCatalog.flatMap((feature) =>
  feature.capabilities.overviewBlocks
    ? [{ featureId: feature.featureId, blockIdPrefix: `${feature.featureId}:` }]
    : [],
);
