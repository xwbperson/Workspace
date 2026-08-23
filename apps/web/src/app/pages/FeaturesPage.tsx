import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { featureCatalog, featureCategories } from '../feature-catalog.js';
import { FeatureIcon } from '../../components/ui/FeatureIcon.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { humanizeApiError, workbenchClient } from '../../platform/api/client.js';

export function FeaturesPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams();
  const urlQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const states = useQuery({
    queryKey: ['workbench', 'features'],
    queryFn: () => workbenchClient.getFeatureStates(),
  });
  const stateById = new Map(states.data?.map((state) => [state.featureId, state]) ?? []);

  useEffect(() => setQuery(urlQuery), [urlQuery]);

  const updateQuery = (value: string): void => {
    setQuery(value);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value.trim()) next.set('q', value);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  };
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
            onChange={(event) => updateQuery(event.target.value)}
          />
          {query ? (
            <button type="button" onClick={() => updateQuery('')}>
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
        {states.isError ? (
          <SectionError
            title="功能状态暂时无法读取"
            message={`${humanizeApiError(states.error)} 功能入口仍可正常使用。`}
            onRetry={() => void states.refetch()}
          />
        ) : null}
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
              <button
                type="button"
                className="button button--quiet"
                onClick={() => updateQuery('')}
              >
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
  const content = (
    <>
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
      <span className="feature-tile__link" aria-disabled={disabled || undefined}>
        {disabled ? '暂时不可进入' : '打开功能'}
        {!disabled ? <ArrowRight aria-hidden="true" size={17} /> : null}
      </span>
    </>
  );

  return (
    <article className={`feature-tile ${disabled ? 'feature-tile--disabled' : ''}`}>
      {disabled ? (
        <div className="feature-tile__cover" aria-disabled="true">
          {content}
        </div>
      ) : (
        <Link className="feature-tile__cover" to={feature.route} aria-label={`打开${feature.name}`}>
          {content}
        </Link>
      )}
    </article>
  );
}
