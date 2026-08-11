import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Command, Search, Timer, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { featureCatalog } from '../feature-catalog.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { humanizeApiError, workbenchClient } from '../../platform/api/client.js';
import { formatRelativeTime } from '../../platform/time/format.js';

export function SearchPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (params.get('focus') === '1') inputRef.current?.focus();
  }, [params]);
  const normalized = query.trim().toLocaleLowerCase('zh-CN');
  const matchingFeatures = useMemo(
    () =>
      normalized
        ? featureCatalog.filter((feature) =>
            [feature.name, feature.description, ...feature.keywords]
              .join(' ')
              .toLocaleLowerCase('zh-CN')
              .includes(normalized),
          )
        : [],
    [normalized],
  );
  const results = useQuery({
    queryKey: ['workbench', 'search', normalized],
    queryFn: () => workbenchClient.search(query.trim()),
    enabled: normalized.length > 0,
  });
  const contentCount =
    results.data?.groups.reduce((count, group) => count + group.items.length, 0) ?? 0;

  return (
    <div className="search-page page-stack">
      <header className="page-intro">
        <div>
          <p className="eyebrow">功能与内容</p>
          <h2>从一个入口找到所有东西。</h2>
          <p>功能结果立即出现，功能内部内容随后加载。</p>
        </div>
      </header>
      <label className="global-search-field">
        <Search aria-hidden="true" />
        <span className="sr-only">搜索工作台</span>
        <input
          ref={inputRef}
          type="search"
          placeholder="输入功能名称、倒计时标题或备注"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <button
            type="button"
            className="icon-button"
            aria-label="清除搜索"
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
          >
            <X aria-hidden="true" />
          </button>
        ) : (
          <kbd>Ctrl K</kbd>
        )}
      </label>

      {!normalized ? (
        <div className="search-suggestions">
          <p className="eyebrow">可以尝试</p>
          <div>
            {['倒计时', '本月', '截止日期'].map((text) => (
              <button type="button" key={text} onClick={() => setQuery(text)}>
                {text}
              </button>
            ))}
          </div>
          <p>
            <Command aria-hidden="true" size={15} /> 搜索只读取各功能公开的短摘要。
          </p>
        </div>
      ) : (
        <div className="search-results">
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">功能</p>
                <h2>功能入口</h2>
              </div>
              <span>{matchingFeatures.length}</span>
            </div>
            {matchingFeatures.length ? (
              <div className="search-result-list">
                {matchingFeatures.map((feature) => (
                  <Link to={feature.route} key={feature.featureId}>
                    <Timer aria-hidden="true" />
                    <span>
                      <strong>{feature.name}</strong>
                      <small>{feature.description}</small>
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">没有匹配的功能。</p>
            )}
          </section>
          <section>
            <div className="section-heading">
              <div>
                <p className="eyebrow">内容</p>
                <h2>功能公开结果</h2>
              </div>
              <span>{contentCount}</span>
            </div>
            {results.isError ? (
              <SectionError
                message={humanizeApiError(results.error)}
                onRetry={() => void results.refetch()}
              />
            ) : null}
            {results.isFetching ? (
              <div className="search-result-list">
                <div className="skeleton" />
                <div className="skeleton" />
              </div>
            ) : null}
            {results.data?.groups.map((group) => (
              <div key={group.featureId} className="search-group">
                <h3>
                  {featureCatalog.find((feature) => feature.featureId === group.featureId)?.name ??
                    group.featureId}
                </h3>
                {group.error ? (
                  <SectionError message={group.error.message} />
                ) : group.items.length ? (
                  <div className="search-result-list">
                    {group.items.map((item) => (
                      <Link to={item.targetRoute} key={`${item.featureId}:${item.recordId}`}>
                        <Timer aria-hidden="true" />
                        <span>
                          <strong>{item.title}</strong>
                          <small>
                            {item.snippet || item.type}
                            {item.updatedAt ? ` · ${formatRelativeTime(item.updatedAt)}` : ''}
                          </small>
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="muted">这个功能中没有匹配内容。</p>
                )}
              </div>
            ))}
            {!results.isFetching && results.data && contentCount === 0 ? (
              <EmptyState
                title="没有找到内容"
                description={`没有内容匹配“${query.trim()}”。可以尝试更短的关键词。`}
              />
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}
