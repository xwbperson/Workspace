import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { featureCatalog, featureCategories } from '../feature-catalog.js';
import { FeatureIcon } from '../../components/ui/FeatureIcon.js';
import { EmptyState } from '../../components/ui/States.js';
import { workbenchClient } from '../../platform/api/client.js';

export function FeaturesPage(): React.JSX.Element {
  const [query, setQuery] = useState('');
  const states = useQuery({
    queryKey: ['workbench', 'features'],
    queryFn: () => workbenchClient.getFeatureStates(),
  });
  const stateById = new Map(states.data?.map((state) => [state.featureId, state]) ?? []);
  const visibleFeatures = featureCatalog.filter(
    (feature) => feature.lifecycle === 'released' && feature.discoverableInProduction,
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('zh-CN');
    return visibleFeatures.filter((feature) => {
      if (!normalized) return true;
      return [feature.name, feature.description, ...feature.keywords]
        .join(' ')
        .toLocaleLowerCase('zh-CN')
        .includes(normalized);
    });
  }, [query, visibleFeatures]);

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
      </div>

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">全部功能</p>
            <h2>工作台功能目录</h2>
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
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="没有找到功能"
            description={
              query ? `没有功能匹配“${query}”，可以清除搜索后重试。` : '当前没有可用功能。'
            }
            action={
              <button type="button" className="button button--quiet" onClick={() => setQuery('')}>
                清除搜索
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
}: {
  feature: (typeof featureCatalog)[number];
  runtime?: Awaited<ReturnType<typeof workbenchClient.getFeatureStates>>[number];
}): React.JSX.Element {
  const disabled = runtime?.entryMode === 'disabled';
  return (
    <article className={`feature-tile ${disabled ? 'feature-tile--disabled' : ''}`}>
      <div className="feature-tile__top">
        <span className="feature-icon">
          <FeatureIcon name={feature.icon} size={25} />
        </span>
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
