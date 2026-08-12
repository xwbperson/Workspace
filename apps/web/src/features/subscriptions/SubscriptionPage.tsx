import type { Subscription, SubscriptionInput, SubscriptionStatus } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CreditCard,
  Edit3,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { subscriptionApi, subscriptionKeys, invalidateSubscriptionData } from './api.js';
import {
  billingCycleLabels,
  SubscriptionForm,
  subscriptionCategoryLabels,
} from './components/SubscriptionForm.js';
const statusLabels: Record<SubscriptionStatus, string> = {
  active: '生效中',
  expired: '已到期',
  archived: '已归档',
};
export function SubscriptionPage(): React.JSX.Element {
  const { subscriptionId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [filter, setFilter] = useState<SubscriptionStatus>('active');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const list = useQuery({
    queryKey: subscriptionKeys.list(filter),
    queryFn: () => subscriptionApi.list(filter),
  });
  const detail = useQuery({
    queryKey: subscriptionKeys.detail(subscriptionId ?? ''),
    queryFn: () => subscriptionApi.get(subscriptionId!),
    enabled: Boolean(subscriptionId),
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const selected = detail.data ?? items.find((item) => item.id === subscriptionId);
  const create = useMutation({
    mutationFn: (input: SubscriptionInput) => subscriptionApi.create(input),
    onSuccess: async (item) => {
      await invalidateSubscriptionData();
      setCreateOpen(false);
      setFilter(item.status);
      show('订阅已添加');
      void navigate(`/features/subscriptions/${item.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ item, input }: { item: Subscription; input: SubscriptionInput }) =>
      subscriptionApi.update(item.id, { ...input, version: item.version }),
    onSuccess: async (item) => {
      await invalidateSubscriptionData();
      setEditOpen(false);
      setFilter(item.status);
      show('订阅已更新');
      void navigate(`/features/subscriptions/${item.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (item: Subscription) => subscriptionApi.archive(item.id, item.version),
    onSuccess: async () => {
      await invalidateSubscriptionData();
      setArchiveOpen(false);
      show('订阅已归档');
      void navigate('/features/subscriptions');
    },
  });
  const restore = useMutation({
    mutationFn: (item: Subscription) => subscriptionApi.restore(item.id, item.version),
    onSuccess: async (item) => {
      await invalidateSubscriptionData();
      setFilter(item.status);
      show('订阅已恢复');
      void navigate(`/features/subscriptions/${item.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: (item: Subscription) => subscriptionApi.deletePermanently(item.id, item.version),
    onSuccess: async () => {
      await invalidateSubscriptionData();
      setDeleteOpen(false);
      show('订阅已永久删除');
      void navigate('/features/subscriptions');
    },
  });
  const error = create.error ?? update.error ?? archive.error ?? restore.error ?? remove.error;
  return (
    <div className="feature-shell-page feature-shell-page--subscriptions">
      <PageTopbarActions>
        <button className="button button--primary" onClick={() => setCreateOpen(true)}>
          <Plus size={18} />
          <span>添加订阅</span>
        </button>
      </PageTopbarActions>
      {error ? <SectionError title="操作没有完成" message={humanizeApiError(error)} /> : null}
      <div className="lifecycle-tabs" aria-label="订阅状态">
        {(['active', 'expired', 'archived'] as const).map((status) => (
          <button
            key={status}
            className={filter === status ? 'active' : ''}
            onClick={() => {
              setFilter(status);
              void navigate('/features/subscriptions');
            }}
          >
            {statusLabels[status]}
          </button>
        ))}
        <span>{items.length}项</span>
      </div>
      <div className={`entity-workspace ${selected ? 'entity-workspace--detail' : ''}`}>
        <section className="entity-list-panel">
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : items.length ? (
            <div className="subscription-list">
              {items.map((item) => (
                <Link
                  key={item.id}
                  className={`subscription-card ${item.id === subscriptionId ? 'active' : ''}`}
                  to={`/features/subscriptions/${item.id}`}
                >
                  <span>
                    <CreditCard size={20} />
                  </span>
                  <div>
                    <small>
                      {subscriptionCategoryLabels[item.category]} ·{' '}
                      {billingCycleLabels[item.billingCycle]}
                    </small>
                    <strong>{item.name}</strong>
                    <p>
                      {item.currency} {item.amount.toFixed(2)} · 月均{' '}
                      {item.monthlyEquivalent.toFixed(2)}
                    </p>
                  </div>
                  <time>{item.renewalDate}</time>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={`还没有${statusLabels[filter]}订阅`}
              description="添加后可以随时修改、归档和恢复。"
              action={
                filter !== 'archived' ? (
                  <button className="button button--quiet" onClick={() => setCreateOpen(true)}>
                    添加第一项
                  </button>
                ) : undefined
              }
            />
          )}
        </section>
        <section className="entity-detail-panel">
          {selected ? (
            <SubscriptionDetail
              item={selected}
              onBack={() => void navigate('/features/subscriptions')}
              onEdit={() => setEditOpen(true)}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : (
            <div className="entity-detail-placeholder">
              <CreditCard size={46} />
              <h3>选择一项订阅</h3>
              <p>费用、周期和续费信息会显示在这里。</p>
            </div>
          )}
        </section>
      </div>
      <Modal
        open={createOpen}
        title="添加订阅"
        onClose={() => setCreateOpen(false)}
        className="modal--wide"
      >
        <SubscriptionForm
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑订阅"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <SubscriptionForm
            key={`${selected.id}:${selected.version}`}
            subscription={selected}
            submitting={update.isPending}
            onSubmit={async (input) => {
              await update.mutateAsync({ item: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档订阅"
        onClose={() => setArchiveOpen(false)}
        footer={
          <>
            <button className="button button--quiet" onClick={() => setArchiveOpen(false)}>
              取消
            </button>
            <button
              className="button button--danger"
              onClick={() => selected && archive.mutate(selected)}
            >
              确认归档
            </button>
          </>
        }
      >
        <p>费用历史会保留，之后可以恢复。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除订阅"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <button className="button button--quiet" onClick={() => setDeleteOpen(false)}>
              取消
            </button>
            <button
              className="button button--danger"
              onClick={() => selected && remove.mutate(selected)}
            >
              永久删除
            </button>
          </>
        }
      >
        <p>只能删除已归档订阅，且无法恢复。</p>
      </Modal>
    </div>
  );
}
function SubscriptionDetail({
  item,
  onBack,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: Subscription;
  onBack(): void;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
}): React.JSX.Element {
  return (
    <article className="entity-detail subscription-detail">
      <button type="button" className="button button--quiet mobile-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        返回订阅
      </button>
      <header className="entity-detail__header">
        <div>
          <span
            className={`source-pill ${item.status === 'archived' ? 'source-pill--archived' : item.status === 'expired' ? 'source-pill--completed' : ''}`}
          >
            {statusLabels[item.status]}
          </span>
          <p className="eyebrow">{subscriptionCategoryLabels[item.category]}</p>
          <h2>{item.name}</h2>
        </div>
        <div className="entity-detail__actions">
          {item.status === 'archived' ? (
            <>
              <button className="button button--quiet" onClick={onRestore}>
                <RotateCcw size={16} />
                恢复
              </button>
              <button className="button button--danger" onClick={onDelete}>
                <Trash2 size={16} />
                永久删除
              </button>
            </>
          ) : (
            <>
              <button className="button button--quiet" onClick={onEdit}>
                <Edit3 size={16} />
                编辑
              </button>
              <button className="button button--quiet" onClick={onArchive}>
                <Archive size={16} />
                归档
              </button>
            </>
          )}
        </div>
      </header>
      <div className="metric-card-row">
        <div>
          <small>本周期费用</small>
          <strong>
            {item.currency} {item.amount.toFixed(2)}
          </strong>
        </div>
        <div>
          <small>折算月均</small>
          <strong>
            {item.currency} {item.monthlyEquivalent.toFixed(2)}
          </strong>
        </div>
      </div>
      <dl className="metadata-grid">
        <div>
          <dt>计费周期</dt>
          <dd>{billingCycleLabels[item.billingCycle]}</dd>
        </div>
        <div>
          <dt>续费日期</dt>
          <dd>{item.renewalDate}</dd>
        </div>
        <div>
          <dt>续费方式</dt>
          <dd>{item.autoRenew ? '自动续费' : '手动续费'}</dd>
        </div>
        <div>
          <dt>状态</dt>
          <dd>{statusLabels[item.status]}</dd>
        </div>
      </dl>
      {item.note ? (
        <section className="detail-note">
          <CalendarClock />
          <p>{item.note}</p>
        </section>
      ) : null}
    </article>
  );
}
