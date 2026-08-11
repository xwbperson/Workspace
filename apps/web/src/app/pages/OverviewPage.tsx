import type { OverviewBlock, UpcomingItem } from '@workspace/client-sdk';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import {
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Timer,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { Modal } from '../../components/ui/Modal.js';
import { humanizeApiError, workbenchClient } from '../../platform/api/client.js';
import { usePreferences } from '../../platform/preferences/usePreferences.js';
import { formatRelativeTime, formatShortDateTime } from '../../platform/time/format.js';

function UpcomingRow({ item }: { item: UpcomingItem }): React.JSX.Element {
  return (
    <Link className="timeline-item" to={item.targetRoute}>
      <span
        className={`timeline-item__marker timeline-item__marker--${item.state}`}
        aria-hidden="true"
      />
      <time dateTime={item.occursAt}>
        <strong>{formatRelativeTime(item.occursAt)}</strong>
        <small>{formatShortDateTime(item.occursAt)}</small>
      </time>
      <span className="timeline-item__content">
        <strong>{item.title}</strong>
        <small>
          {item.type} ·{' '}
          {item.state === 'near' ? '临近' : item.state === 'overdue' ? '已到时间' : '按计划'}
        </small>
      </span>
      <ArrowRight aria-hidden="true" size={17} />
    </Link>
  );
}

function OverviewBlockView({ block }: { block: OverviewBlock }): React.JSX.Element {
  return (
    <section className="overview-block">
      <div className="section-heading">
        <div>
          <p className="eyebrow">来自倒计时</p>
          <h2>{block.title}</h2>
        </div>
        <Link to={block.targetRoute}>
          查看全部 <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
      {block.data.kind === 'upcoming' || block.data.kind === 'recent-list' ? (
        block.data.items.length > 0 ? (
          <div className="compact-list">
            {block.data.items.slice(0, 4).map((item) => (
              <Link key={item.id} to={item.targetRoute}>
                <Timer aria-hidden="true" size={18} />
                <span>
                  <strong>{item.title}</strong>
                  {item.occurredAt ? <small>{formatRelativeTime(item.occurredAt)}</small> : null}
                </span>
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="还没有倒计时" description="添加一个重要日期后，它会出现在这里。" />
        )
      ) : null}
      {block.data.kind === 'metric' ? (
        <div className="metric-value">
          <strong>{block.data.value}</strong>
          <span>{block.data.label}</span>
        </div>
      ) : null}
      {block.data.kind === 'progress' ? (
        <div className="progress-summary">
          <progress value={block.data.current} max={block.data.total} />
          <span>{block.data.label}</span>
        </div>
      ) : null}
      {block.data.kind === 'status' ? (
        <p className={`status-copy status-copy--${block.data.level}`}>{block.data.text}</p>
      ) : null}
    </section>
  );
}

export function OverviewPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { preferences, save, saving } = usePreferences();
  const [editing, setEditing] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<string[]>(preferences.overviewBlockIds);
  const definitions = useQuery({
    queryKey: ['workbench', 'overview-definitions'],
    queryFn: () => workbenchClient.getOverviewDefinitions(),
  });
  const overview = useQuery({
    queryKey: ['workbench', 'overview', preferences.overviewBlockIds],
    queryFn: () => workbenchClient.getOverview(preferences.overviewBlockIds),
    refetchInterval:
      preferences.refreshIntervalMinutes > 0 ? preferences.refreshIntervalMinutes * 60_000 : false,
  });
  const today = useMemo(() => format(new Date(), 'M月d日 EEEE', { locale: zhCN }), []);

  const openEditor = (): void => {
    setDraftBlocks(preferences.overviewBlockIds);
    setEditing(true);
  };
  const saveBlocks = async (): Promise<void> => {
    await save({ ...preferences, overviewBlockIds: draftBlocks });
    setEditing(false);
  };

  return (
    <div className="overview-page page-stack">
      <header className="page-intro overview-intro">
        <div>
          <p className="eyebrow">{today}</p>
          <h2>先看时间，再决定下一步。</h2>
          <p>工作台只把当前最值得注意的内容放在这里。</p>
        </div>
        <div className="page-intro__actions">
          <span className="updated-at">
            <Clock3 aria-hidden="true" size={15} />
            {overview.data
              ? `更新于 ${format(new Date(overview.data.updatedAt), 'HH:mm')}`
              : '等待数据'}
          </span>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => void overview.refetch()}
            disabled={overview.isFetching}
          >
            <RefreshCw className={overview.isFetching ? 'spin' : ''} aria-hidden="true" size={17} />{' '}
            刷新
          </button>
          <button type="button" className="button button--quiet" onClick={openEditor}>
            <PencilLine aria-hidden="true" size={17} /> 编辑总览
          </button>
        </div>
      </header>

      {overview.isError ? (
        <SectionError
          title="总览数据没有连接成功"
          message={humanizeApiError(overview.error)}
          onRetry={() => void overview.refetch()}
        />
      ) : null}

      <div className="overview-core-grid">
        <section className="focus-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">当前关注</p>
              <h2>离现在最近的一件事</h2>
            </div>
          </div>
          {overview.isLoading ? (
            <div className="skeleton skeleton--focus" />
          ) : overview.data?.focus.primary ? (
            <div className="focus-item">
              <div className="focus-item__time">
                <span>目标时间</span>
                <strong>
                  {formatRelativeTime(overview.data.focus.primary.dueAt ?? new Date())}
                </strong>
                {overview.data.focus.primary.dueAt ? (
                  <small>{formatShortDateTime(overview.data.focus.primary.dueAt)}</small>
                ) : null}
              </div>
              <div className="focus-item__copy">
                <span className="source-pill">倒计时</span>
                <h3>{overview.data.focus.primary.title}</h3>
                <Link
                  className="button button--primary"
                  to={overview.data.focus.primary.targetRoute}
                >
                  打开倒计时 <ArrowRight aria-hidden="true" size={17} />
                </Link>
              </div>
            </div>
          ) : (
            <EmptyState
              title="当前没有需要关注的日期"
              description="添加第一个倒计时，工作台就能开始组织你的时间线。"
              action={
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => void navigate('/features/countdowns?create=1')}
                >
                  <Plus aria-hidden="true" size={17} /> 添加倒计时
                </button>
              }
            />
          )}
        </section>

        <aside className="quick-create-panel">
          <p className="eyebrow">快速开始</p>
          <h2>记下一个日期</h2>
          <p>把重要节点放进工作台，之后所有端都会看见。</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void navigate('/features/countdowns?create=1')}
          >
            <Plus aria-hidden="true" size={18} /> 添加倒计时
          </button>
          <span className="shortcut-hint">
            也可以按 <kbd>Ctrl N</kbd>
          </span>
        </aside>
      </div>

      <section className="timeline-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">即将到来</p>
            <h2>时间轨道</h2>
          </div>
          <Link to="/features/countdowns">
            查看全部 <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </div>
        <div className="time-rail" aria-hidden="true">
          <CalendarClock />
          <span />
        </div>
        {overview.isLoading ? (
          <div className="timeline-skeleton">
            <div className="skeleton" />
            <div className="skeleton" />
          </div>
        ) : overview.data?.upcoming.length ? (
          <div className="timeline-list">
            {overview.data.upcoming.slice(0, 6).map((item) => (
              <UpcomingRow key={`${item.featureId}:${item.recordId}`} item={item} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="未来 90 天还没有时间节点"
            description="新建倒计时后，这里会按时间顺序排列。"
          />
        )}
      </section>

      {overview.data?.errors.length ? (
        <section className="overview-alerts" aria-labelledby="overview-alert-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">局部异常</p>
              <h2 id="overview-alert-title">部分来源暂时不可用</h2>
            </div>
          </div>
          {overview.data.errors.map((error, index) => (
            <SectionError
              key={`${error.featureId}:${index}`}
              message={error.message}
              onRetry={() => void overview.refetch()}
            />
          ))}
        </section>
      ) : null}

      <div className="overview-secondary-grid">
        <div className="overview-blocks">
          {overview.data?.blocks.map((block) => (
            <OverviewBlockView key={block.blockId} block={block} />
          ))}
        </div>
        <section className="recent-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">最近内容</p>
              <h2>刚刚处理过</h2>
            </div>
          </div>
          {overview.data?.recent.length ? (
            <div className="compact-list">
              {overview.data.recent.slice(0, 5).map((item) => (
                <Link key={`${item.featureId}:${item.recordId}`} to={item.targetRoute}>
                  <Clock3 aria-hidden="true" size={18} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{formatRelativeTime(item.updatedAt)}</small>
                  </span>
                  <ArrowRight aria-hidden="true" size={16} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="没有最近内容" description="打开或修改功能内容后会显示在这里。" />
          )}
        </section>
      </div>

      <Modal
        open={editing}
        title="编辑总览"
        description="选择总览需要显示的功能摘要，并调整语义顺序。"
        onClose={() => setEditing(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() =>
                setDraftBlocks(
                  definitions.data
                    ?.filter((item) => item.defaultVisible)
                    .map((item) => item.blockId) ?? [],
                )
              }
            >
              <RotateCcw aria-hidden="true" size={16} /> 恢复默认
            </button>
            <button
              type="button"
              className="button button--primary"
              disabled={saving}
              onClick={() => void saveBlocks()}
            >
              <Check aria-hidden="true" size={16} /> {saving ? '正在保存' : '保存布局'}
            </button>
          </>
        }
      >
        <div className="overview-editor-list">
          {definitions.data?.map((definition) => {
            const selectedIndex = draftBlocks.indexOf(definition.blockId);
            const selected = selectedIndex >= 0;
            return (
              <div className="overview-editor-item" key={definition.blockId}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) =>
                      setDraftBlocks((current) =>
                        event.target.checked
                          ? [...current, definition.blockId]
                          : current.filter((id) => id !== definition.blockId),
                      )
                    }
                  />
                  <span>
                    <strong>{definition.title}</strong>
                    <small>{definition.featureId}</small>
                  </span>
                </label>
                <div>
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    aria-label={`上移 ${definition.title}`}
                    disabled={!selected || selectedIndex === 0}
                    onClick={() =>
                      setDraftBlocks((current) => {
                        const next = [...current];
                        const at = next.indexOf(definition.blockId);
                        if (at > 0) [next[at - 1], next[at]] = [next[at]!, next[at - 1]!];
                        return next;
                      })
                    }
                  >
                    <ChevronUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button--small"
                    aria-label={`下移 ${definition.title}`}
                    disabled={!selected || selectedIndex === draftBlocks.length - 1}
                    onClick={() =>
                      setDraftBlocks((current) => {
                        const next = [...current];
                        const at = next.indexOf(definition.blockId);
                        if (at >= 0 && at < next.length - 1)
                          [next[at], next[at + 1]] = [next[at + 1]!, next[at]!];
                        return next;
                      })
                    }
                  >
                    <ChevronDown aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}
