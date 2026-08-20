import type { Countdown, CountdownInput } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  Edit3,
  Plus,
  RotateCcw,
  Timer,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { formatDateTime, formatRelativeTime } from '../../platform/time/format.js';
import { countdownApi, countdownKeys, invalidateCountdownData } from './api.js';
import { CountdownDisplay } from './components/CountdownDisplay.js';
import { CountdownForm } from './components/CountdownForm.js';

type CountdownFilter = 'active' | 'completed' | 'archived';

export function CountdownPage(): React.JSX.Element {
  const { countdownId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [filter, setFilter] = useState<CountdownFilter>('active');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const list = useQuery({
    queryKey: countdownKeys.list(filter),
    queryFn: () => countdownApi.list(filter),
  });
  const detail = useQuery({
    queryKey: countdownKeys.detail(countdownId ?? ''),
    queryFn: () => countdownApi.get(countdownId!),
    enabled: Boolean(countdownId),
  });
  const selected = detail.data ?? list.data?.items.find((item) => item.id === countdownId);
  const ordered = useMemo(() => list.data?.items ?? [], [list.data]);
  const changeFilter = (nextFilter: CountdownFilter): void => {
    setFilter(nextFilter);
    void navigate('/features/countdowns');
  };

  const create = useMutation({
    mutationFn: (input: CountdownInput) => countdownApi.create(input),
    onSuccess: async (value) => {
      await invalidateCountdownData();
      setCreateOpen(false);
      show('倒计时已添加');
      void navigate(`/features/countdowns/${value.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ countdown, input }: { countdown: Countdown; input: CountdownInput }) =>
      countdownApi.update(countdown.id, { ...input, version: countdown.version }),
    onSuccess: async (value) => {
      await invalidateCountdownData();
      setEditOpen(false);
      show('倒计时已更新');
      void navigate(`/features/countdowns/${value.id}`);
    },
  });
  const toggleComplete = useMutation({
    mutationFn: (countdown: Countdown) =>
      countdownApi.update(countdown.id, {
        status: countdown.status === 'completed' ? 'active' : 'completed',
        version: countdown.version,
      }),
    onSuccess: async (value) => {
      await invalidateCountdownData();
      show(value.status === 'completed' ? '倒计时已完成' : '倒计时已恢复');
      if (value.status === 'completed' && filter === 'active') {
        void navigate('/features/countdowns');
      }
    },
  });
  const archive = useMutation({
    mutationFn: (countdown: Countdown) => countdownApi.archive(countdown.id, countdown.version),
    onSuccess: async () => {
      await invalidateCountdownData();
      setArchiveOpen(false);
      show('倒计时已归档');
      void navigate('/features/countdowns', { replace: true });
    },
  });
  const restore = useMutation({
    mutationFn: (countdown: Countdown) => countdownApi.restore(countdown.id, countdown.version),
    onSuccess: async (value) => {
      await invalidateCountdownData();
      show('倒计时已恢复');
      setFilter(value.status === 'completed' ? 'completed' : 'active');
      void navigate('/features/countdowns', { replace: true });
    },
  });
  const permanentDelete = useMutation({
    mutationFn: (countdown: Countdown) =>
      countdownApi.deletePermanently(countdown.id, countdown.version),
    onSuccess: async () => {
      await invalidateCountdownData();
      setDeleteOpen(false);
      show('倒计时已永久删除');
      void navigate('/features/countdowns', { replace: true });
    },
  });

  const mutationError =
    create.error ??
    update.error ??
    toggleComplete.error ??
    archive.error ??
    restore.error ??
    permanentDelete.error;

  return (
    <div className="countdown-page">
      <PageTopbarActions>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" size={18} /> <span>添加倒计时</span>
        </button>
      </PageTopbarActions>

      {mutationError ? (
        <SectionError title="操作没有完成" message={humanizeApiError(mutationError)} />
      ) : null}

      <div className={`countdown-workspace ${selected ? 'countdown-workspace--detail' : ''}`}>
        <section className="countdown-list-panel" aria-label="倒计时列表">
          <div className="countdown-list-toolbar">
            <div className="segmented-control" role="group" aria-label="倒计时状态">
              <button
                type="button"
                className={filter === 'active' ? 'active' : ''}
                aria-pressed={filter === 'active'}
                onClick={() => changeFilter('active')}
              >
                <Circle aria-hidden="true" />
                进行中
              </button>
              <button
                type="button"
                className={filter === 'completed' ? 'active' : ''}
                aria-pressed={filter === 'completed'}
                onClick={() => changeFilter('completed')}
              >
                <CheckCircle2 aria-hidden="true" />
                已完成
              </button>
              <button
                type="button"
                className={filter === 'archived' ? 'active' : ''}
                aria-pressed={filter === 'archived'}
                onClick={() => changeFilter('archived')}
              >
                <Archive aria-hidden="true" />
                已归档
              </button>
            </div>
            <span>{ordered.length} 项</span>
          </div>
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : list.isLoading ? (
            <div className="skeleton-list" role="status" aria-label="正在加载倒计时">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : ordered.length ? (
            <div className="countdown-list">
              {ordered.map((countdown) => (
                <Link
                  className={countdown.id === countdownId ? 'active' : ''}
                  to={`/features/countdowns/${countdown.id}`}
                  key={countdown.id}
                >
                  <span className="countdown-list__date">
                    <strong>{new Date(countdown.targetAt).getDate()}</strong>
                    <small>
                      {new Intl.DateTimeFormat('zh-CN', { month: 'short' }).format(
                        new Date(countdown.targetAt),
                      )}
                    </small>
                  </span>
                  <span className="countdown-list__copy">
                    <strong>{countdown.title}</strong>
                    <small>
                      {formatRelativeTime(countdown.targetAt)} · 优先级 {countdown.priority}
                    </small>
                  </span>
                  <CountdownDisplay targetAt={countdown.targetAt} compact />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                filter === 'active'
                  ? '还没有进行中的倒计时'
                  : filter === 'completed'
                    ? '还没有已完成的倒计时'
                    : '还没有已归档的倒计时'
              }
              description={
                filter === 'active'
                  ? '添加一个目标日期，它会同时出现在总览时间轨道中。'
                  : filter === 'completed'
                    ? '完成的倒计时会保留在这里，随时可以恢复。'
                    : '归档后的倒计时会保留在这里，可以恢复或永久删除。'
              }
              action={
                filter === 'active' ? (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => setCreateOpen(true)}
                  >
                    <Plus aria-hidden="true" size={17} /> 添加倒计时
                  </button>
                ) : null
              }
            />
          )}
        </section>

        <section className="countdown-detail-panel" aria-live="polite">
          {countdownId && detail.isLoading ? (
            <div className="skeleton skeleton--detail" />
          ) : detail.isError ? (
            <SectionError
              message={humanizeApiError(detail.error)}
              onRetry={() => void detail.refetch()}
            />
          ) : selected ? (
            <CountdownDetail
              countdown={selected}
              onBack={() => void navigate('/features/countdowns')}
              onEdit={() => setEditOpen(true)}
              onToggleComplete={() => toggleComplete.mutate(selected)}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDeletePermanently={() => setDeleteOpen(true)}
              restoring={restore.isPending}
            />
          ) : (
            <div className="countdown-detail-empty">
              <Timer aria-hidden="true" />
              <p className="eyebrow">时间轨道</p>
              <h3>选择一个倒计时</h3>
              <p>详细剩余时间、备注和操作会显示在这里。</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={createOpen}
        title="添加倒计时"
        description="选择一个明确时间，之后可以在所有端查看。"
        onClose={() => {
          setCreateOpen(false);
          if (params.get('create') === '1') {
            void navigate('/features/countdowns', { replace: true });
          }
        }}
      >
        <CountdownForm
          submitting={create.isPending}
          submitLabel="添加倒计时"
          onSubmit={async (value) => {
            await create.mutateAsync(value);
          }}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑倒计时"
        description="保存时会检查版本，避免覆盖其他位置的更新。"
        onClose={() => setEditOpen(false)}
      >
        {selected ? (
          <CountdownForm
            countdown={selected}
            submitting={update.isPending}
            submitLabel="保存修改"
            onSubmit={async (value) => {
              await update.mutateAsync({ countdown: selected, input: value });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档倒计时"
        description="归档后不再出现在总览和默认列表中。"
        onClose={() => setArchiveOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setArchiveOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={!selected || archive.isPending}
              onClick={() => selected && archive.mutate(selected)}
            >
              <Archive aria-hidden="true" size={17} />
              确认归档
            </button>
          </>
        }
      >
        <p>要归档“{selected?.title}”吗？它会移入已归档列表，之后仍可恢复。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除倒计时"
        description="此操作会从数据库中删除记录，不能撤销。"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setDeleteOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={!selected || permanentDelete.isPending}
              onClick={() => selected && permanentDelete.mutate(selected)}
            >
              <Trash2 aria-hidden="true" size={17} />
              确认永久删除
            </button>
          </>
        }
      >
        <p>确定永久删除“{selected?.title}”吗？删除后无法在工作台中恢复。</p>
      </Modal>
    </div>
  );
}

function CountdownDetail({
  countdown,
  onBack,
  onEdit,
  onToggleComplete,
  onArchive,
  onRestore,
  onDeletePermanently,
  restoring,
}: {
  countdown: Countdown;
  onBack(): void;
  onEdit(): void;
  onToggleComplete(): void;
  onArchive(): void;
  onRestore(): void;
  onDeletePermanently(): void;
  restoring: boolean;
}): React.JSX.Element {
  return (
    <div className="countdown-detail">
      <div className="countdown-detail__mobile-back">
        <button type="button" className="button button--text" onClick={onBack}>
          <ArrowLeft aria-hidden="true" />
          返回列表
        </button>
      </div>
      <div className="countdown-detail__header">
        <div>
          <span
            className={`source-pill ${
              countdown.status === 'completed'
                ? 'source-pill--complete'
                : countdown.status === 'archived'
                  ? 'source-pill--archived'
                  : ''
            }`}
          >
            {countdown.status === 'completed'
              ? '已完成'
              : countdown.status === 'archived'
                ? '已归档'
                : '进行中'}
          </span>
          <h3>{countdown.title}</h3>
        </div>
        <div>
          {countdown.status === 'archived' ? (
            <>
              <button
                type="button"
                className="icon-button"
                aria-label="恢复倒计时"
                onClick={onRestore}
              >
                <RotateCcw aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                aria-label="永久删除倒计时"
                onClick={onDeletePermanently}
              >
                <Trash2 aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="icon-button"
                aria-label="编辑倒计时"
                onClick={onEdit}
              >
                <Edit3 aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button icon-button--danger"
                aria-label="归档倒计时"
                onClick={onArchive}
              >
                <Archive aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="countdown-detail__clock">
        <CountdownDisplay targetAt={countdown.targetAt} />
      </div>
      <dl className="countdown-meta">
        <div>
          <dt>
            <CalendarDays aria-hidden="true" />
            目标时间
          </dt>
          <dd>{formatDateTime(countdown.targetAt)}</dd>
        </div>
        <div>
          <dt>
            <Clock3 aria-hidden="true" />
            相对时间
          </dt>
          <dd>{formatRelativeTime(countdown.targetAt)}</dd>
        </div>
        <div>
          <dt>优先级</dt>
          <dd>{countdown.priority} / 100</dd>
        </div>
        <div>
          <dt>版本</dt>
          <dd>v{countdown.version}</dd>
        </div>
      </dl>
      <div className="countdown-note">
        <p className="eyebrow">备注</p>
        <p>{countdown.note || '没有备注。可以编辑倒计时补充背景或下一步。'}</p>
      </div>
      <div className="countdown-detail__actions">
        {countdown.status === 'archived' ? (
          <>
            <button
              type="button"
              className="button button--primary"
              onClick={onRestore}
              disabled={restoring}
            >
              <RotateCcw aria-hidden="true" />
              恢复倒计时
            </button>
            <button type="button" className="button button--danger" onClick={onDeletePermanently}>
              <Trash2 aria-hidden="true" />
              永久删除
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button button--primary" onClick={onToggleComplete}>
              {countdown.status === 'completed' ? (
                <RotateCcw aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {countdown.status === 'completed' ? '恢复进行中' : '标记为完成'}
            </button>
            <button type="button" className="button button--quiet" onClick={onEdit}>
              <Edit3 aria-hidden="true" />
              编辑
            </button>
          </>
        )}
      </div>
    </div>
  );
}
