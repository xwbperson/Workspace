import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Pin, PinOff, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { featureCatalog, featureCategories, type FeatureCategory } from '../feature-catalog.js';
import { FeatureIcon } from '../../components/ui/FeatureIcon.js';
import { EmptyState } from '../../components/ui/States.js';
import { workbenchClient } from '../../platform/api/client.js';
import { usePreferences } from '../../platform/preferences/usePreferences.js';
import { useToast } from '../../components/ui/ToastProvider.js';

type Filter = 'all' | 'pinned' | FeatureCategory;

export function FeaturesPage(): React.JSX.Element {
  const { preferences, save } = usePreferences();
  const { show } = useToast();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const states = useQuery({
    queryKey: ['workbench', 'features'],
    queryFn: () => workbenchClient.getFeatureStates(),
  });
  const stateById = new Map(states.data?.map((state) => [state.featureId, state]) ?? []);
  const pinned = new Set(preferences.pinnedFeatureIds);
  const visibleFeatures = featureCatalog.filter(
    (feature) => feature.lifecycle === 'released' && feature.discoverableInProduction,
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    return visibleFeatures.filter((feature) => {
      if (filter === 'pinned' && !pinned.has(feature.featureId)) return false;
      if (filter !== 'all' && filter !== 'pinned' && feature.category !== filter) return false;
      if (!normalized) return true;
      return [feature.name, feature.description, ...feature.keywords]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(normalized);
    });
  }, [filter, pinned, query, visibleFeatures]);
  const usedCategories = [...new Set(visibleFeatures.map((feature) => feature.category))];

  const togglePin = async (featureId: string): Promise<void> => {
    const next = pinned.has(featureId)
      ? preferences.pinnedFeatureIds.filter((id) => id !== featureId)
      : [...preferences.pinnedFeatureIds, featureId];
    await save({ ...preferences, pinnedFeatureIds: next });
    show(pinned.has(featureId) ? '已从常用功能移除' : '已固定到常用功能');
  };

  return (
    <div className="features-page page-stack">
      <header className="page-intro">
        <div>
          <p className="eyebrow">{visibleFeatures.length} 个可见功能</p>
          <h2>所有能力，都有固定位置。</h2>
          <p>功能彼此独立接入，但在这里保持一致的查找和进入方式。</p>
        </div>
      </header>
      <div className="feature-toolbar">
        <label className="search-field">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">搜索功能</span>
          <input
            type="search"
            placeholder="搜索功能名称或用途"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')}>
              清除
            </button>
          ) : null}
        </label>
        <div className="filter-chips" aria-label="功能分类">
          <button
            type="button"
            className={filter === 'all' ? 'active' : ''}
            onClick={() => setFilter('all')}
          >
            全部
          </button>
          <button
            type="button"
            className={filter === 'pinned' ? 'active' : ''}
            onClick={() => setFilter('pinned')}
          >
            常用
          </button>
          {usedCategories.map((category) => (
            <button
              type="button"
              className={filter === category ? 'active' : ''}
              key={category}
              onClick={() => setFilter(category)}
            >
              {featureCategories[category]}
            </button>
          ))}
        </div>
      </div>

      {pinned.size > 0 && filter === 'all' && !query ? (
        <section>
          <div className="section-heading">
            <div>
              <p className="eyebrow">常用功能</p>
              <h2>随手可达</h2>
            </div>
          </div>
          <div className="feature-grid feature-grid--pinned">
            {visibleFeatures
              .filter((feature) => pinned.has(feature.featureId))
              .map((feature) => {
                const runtime = stateById.get(feature.featureId);
                return (
                  <FeatureTile
                    key={`pinned:${feature.featureId}`}
                    feature={feature}
                    {...(runtime ? { runtime } : {})}
                    pinned
                    onTogglePin={() => void togglePin(feature.featureId)}
                  />
                );
              })}
          </div>
        </section>
      ) : null}

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">全部功能</p>
            <h2>{filter === 'all' ? '工作台功能目录' : '筛选结果'}</h2>
          </div>
          <span className="result-count">
            <SlidersHorizontal aria-hidden="true" size={15} /> {filtered.length} 项
          </span>
        </div>
        {filtered.length ? (
          <div className="feature-grid">
            {filtered.map((feature) => {
              const runtime = stateById.get(feature.featureId);
              return (
                <FeatureTile
                  key={feature.featureId}
                  feature={feature}
                  {...(runtime ? { runtime } : {})}
                  pinned={pinned.has(feature.featureId)}
                  onTogglePin={() => void togglePin(feature.featureId)}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="没有找到功能"
            description={
              query ? `没有功能匹配“${query}”，可以清除搜索后重试。` : '当前筛选下没有功能。'
            }
            action={
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                清除筛选
              </button>
            }
          />
        )}
      </section>
    </div>
  );
}

function FeatureTile({
  feature,
  runtime,
  pinned,
  onTogglePin,
}: {
  feature: (typeof featureCatalog)[number];
  runtime?: Awaited<ReturnType<typeof workbenchClient.getFeatureStates>>[number];
  pinned: boolean;
  onTogglePin(): void;
}): React.JSX.Element {
  const disabled = runtime?.entryMode === 'disabled';
  return (
    <article className={`feature-tile ${disabled ? 'feature-tile--disabled' : ''}`}>
      <div className="feature-tile__top">
        <span className="feature-icon">
          <FeatureIcon name={feature.icon} size={25} />
        </span>
        <button
          type="button"
          className="icon-button icon-button--small"
          aria-label={pinned ? `取消固定${feature.name}` : `固定${feature.name}`}
          onClick={onTogglePin}
        >
          {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
        </button>
      </div>
      <div>
        <span className="feature-category">{featureCategories[feature.category]}</span>
        <h3>{feature.name}</h3>
        <p>{feature.description}</p>
      </div>
      {runtime && runtime.availability !== 'available' ? (
        <span className="feature-state">{runtime.message ?? '暂时不可用'}</span>
      ) : null}
      {disabled ? (
        <span className="feature-tile__link" aria-disabled="true">
          暂时不可进入
        </span>
      ) : (
        <Link className="feature-tile__link" to={feature.route} aria-label={`打开${feature.name}`}>
          打开功能 <ArrowRight aria-hidden="true" size={17} />
        </Link>
      )}
    </article>
  );
}
