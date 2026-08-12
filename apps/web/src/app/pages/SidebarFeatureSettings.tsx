import type { WorkbenchPreferences } from '@workspace/client-sdk';
import { ArrowDown, ArrowUp, Eye, EyeOff, Grid2X2, RotateCcw } from 'lucide-react';
import { FeatureIcon } from '../../components/ui/FeatureIcon.js';
import { getOrderedFeatureNavigation } from '../navigation.js';

export function SidebarFeatureSettings({
  preferences,
  saving,
  onSave,
}: {
  preferences: WorkbenchPreferences;
  saving: boolean;
  onSave(next: WorkbenchPreferences): Promise<void>;
}): React.JSX.Element {
  const features = getOrderedFeatureNavigation(preferences.sidebarFeatureOrder);

  const saveOrder = (featureId: string, offset: -1 | 1): void => {
    const order = features.map((feature) => feature.featureId);
    const currentIndex = order.indexOf(featureId);
    const nextIndex = currentIndex + offset;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) return;
    [order[currentIndex], order[nextIndex]] = [order[nextIndex]!, order[currentIndex]!];
    void onSave({ ...preferences, sidebarFeatureOrder: order });
  };

  return (
    <section className="settings-card settings-card--wide sidebar-feature-settings">
      <div className="settings-card__heading">
        <span>
          <Grid2X2 aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">侧边栏</p>
          <h2>功能顺序与显示</h2>
        </div>
        <button
          type="button"
          className="button button--quiet"
          disabled={saving || preferences.sidebarFeatureOrder.length === 0}
          onClick={() => void onSave({ ...preferences, sidebarFeatureOrder: [] })}
        >
          <RotateCcw aria-hidden="true" size={16} /> 恢复默认顺序
        </button>
      </div>
      <p className="settings-card__description">
        使用上移和下移调整侧边栏顺序。隐藏的功能仍保留位置，也可以从功能目录和搜索进入。
      </p>
      <div className="sidebar-feature-list">
        {features.map((feature, index) => {
          const visible = !preferences.hiddenFeatureIds.includes(feature.featureId);
          return (
            <div className="sidebar-feature-row" key={feature.featureId}>
              <span className="sidebar-feature-row__rank" aria-label={`第 ${index + 1} 位`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="sidebar-feature-row__icon">
                <FeatureIcon name={feature.icon} size={20} />
              </span>
              <span className="sidebar-feature-row__content">
                <strong>{feature.name}</strong>
                <small>{visible ? '显示在侧边栏' : '已隐藏，顺序仍会保留'}</small>
              </span>
              <span className="sidebar-feature-row__state" aria-hidden="true">
                {visible ? <Eye size={17} /> : <EyeOff size={17} />}
              </span>
              <label className="sidebar-feature-row__toggle">
                <input
                  type="checkbox"
                  checked={visible}
                  disabled={saving}
                  aria-label={`在侧边栏显示${feature.name}`}
                  onChange={() => {
                    const hiddenFeatureIds = visible
                      ? [...preferences.hiddenFeatureIds, feature.featureId]
                      : preferences.hiddenFeatureIds.filter((id) => id !== feature.featureId);
                    void onSave({ ...preferences, hiddenFeatureIds });
                  }}
                />
              </label>
              <span className="sidebar-feature-row__moves">
                <button
                  type="button"
                  className="icon-button"
                  disabled={saving || index === 0}
                  aria-label={`上移${feature.name}`}
                  title={`上移${feature.name}`}
                  onClick={() => saveOrder(feature.featureId, -1)}
                >
                  <ArrowUp aria-hidden="true" size={17} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  disabled={saving || index === features.length - 1}
                  aria-label={`下移${feature.name}`}
                  title={`下移${feature.name}`}
                  onClick={() => saveOrder(feature.featureId, 1)}
                >
                  <ArrowDown aria-hidden="true" size={17} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
