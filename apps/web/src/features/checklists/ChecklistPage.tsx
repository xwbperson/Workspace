import type {
  Checklist,
  ChecklistInput,
  ChecklistItem,
  ChecklistItemInput,
  ChecklistStatus,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArrowLeft,
  Check,
  CircleCheckBig,
  CircleDollarSign,
  Edit3,
  ListChecks,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { checklistApi, checklistKeys, invalidateChecklistData } from './api.js';
import { ChecklistForm } from './components/ChecklistForm.js';
import { ChecklistItemForm } from './components/ChecklistItemForm.js';

const statusLabels: Record<ChecklistStatus, string> = {
  active: '使用中',
  completed: '已完成',
  archived: '已归档',
};

function formatMoney(value: number): string {
  return `¥${value.toFixed(2)}`;
}

function itemMeta(item: ChecklistItem): string {
  const parts: string[] = [];
  if (item.quantity !== null) parts.push(`${item.quantity}${item.unit ? ` ${item.unit}` : ''}`);
  if (item.price !== null && item.price > 0) {
    parts.push(
      item.quantity !== null ? `${formatMoney(item.price)} / 单位` : formatMoney(item.price),
    );
  }
  return parts.join(' · ');
}

export function ChecklistPage(): React.JSX.Element {
  const { checklistId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [filter, setFilter] = useState<ChecklistStatus>('active');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ChecklistItem>();
  const [deletingItem, setDeletingItem] = useState<ChecklistItem>();

  const list = useQuery({
    queryKey: checklistKeys.list(filter),
    queryFn: () => checklistApi.list(filter),
  });
  const detail = useQuery({
    queryKey: checklistKeys.detail(checklistId ?? ''),
    queryFn: () => checklistApi.get(checklistId!),
    enabled: Boolean(checklistId),
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const selected = detail.data ?? items.find((item) => item.id === checklistId);
  const detailStatus = detail.data?.status;

  useEffect(() => {
    if (detailStatus) setFilter(detailStatus);
  }, [detailStatus]);

  const create = useMutation({
    mutationFn: (input: ChecklistInput) => checklistApi.create(input),
    onSuccess: async (checklist) => {
      await invalidateChecklistData();
      setCreateOpen(false);
      setFilter('active');
      show('清单已创建');
      void navigate(`/features/checklists/${checklist.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ checklist, input }: { checklist: Checklist; input: ChecklistInput }) =>
      checklistApi.update(checklist.id, { ...input, version: checklist.version }),
    onSuccess: async (checklist) => {
      await invalidateChecklistData();
      setEditOpen(false);
      show('清单已更新');
      void navigate(`/features/checklists/${checklist.id}`);
    },
  });
  const complete = useMutation({
    mutationFn: (checklist: Checklist) => checklistApi.complete(checklist.id, checklist.version),
    onSuccess: async (checklist) => {
      await invalidateChecklistData();
      setFilter('completed');
      show('清单已标记为完成');
      void navigate(`/features/checklists/${checklist.id}`);
    },
  });
  const reopen = useMutation({
    mutationFn: (checklist: Checklist) => checklistApi.reopen(checklist.id, checklist.version),
    onSuccess: async (checklist) => {
      await invalidateChecklistData();
      setFilter('active');
      show('清单已重新标记为使用中');
      void navigate(`/features/checklists/${checklist.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (checklist: Checklist) => checklistApi.archive(checklist.id, checklist.version),
    onSuccess: async () => {
      await invalidateChecklistData();
      setArchiveOpen(false);
      show('清单已归档');
      void navigate('/features/checklists');
    },
  });
  const restore = useMutation({
    mutationFn: (checklist: Checklist) => checklistApi.restore(checklist.id, checklist.version),
    onSuccess: async (checklist) => {
      await invalidateChecklistData();
      setFilter(checklist.status);
      show('清单已恢复');
      void navigate(`/features/checklists/${checklist.id}`);
    },
  });
  const remove = useMutation({
    mutationFn: (checklist: Checklist) =>
      checklistApi.deletePermanently(checklist.id, checklist.version),
    onSuccess: async () => {
      await invalidateChecklistData();
      setDeleteOpen(false);
      show('清单已永久删除');
      void navigate('/features/checklists');
    },
  });
  const addItem = useMutation({
    mutationFn: ({ checklist, input }: { checklist: Checklist; input: ChecklistItemInput }) =>
      checklistApi.createItem(checklist.id, input),
    onSuccess: async () => {
      await invalidateChecklistData();
      show('条目已添加');
    },
  });
  const updateItem = useMutation({
    mutationFn: ({
      checklist,
      item,
      input,
    }: {
      checklist: Checklist;
      item: ChecklistItem;
      input: ChecklistItemInput;
    }) => checklistApi.updateItem(checklist.id, item.id, { ...input, version: item.version }),
    onSuccess: async () => {
      await invalidateChecklistData();
      setEditingItem(undefined);
      show('条目已更新');
    },
  });
  const checkItem = useMutation({
    mutationFn: ({
      checklist,
      item,
      checked,
    }: {
      checklist: Checklist;
      item: ChecklistItem;
      checked: boolean;
    }) => checklistApi.checkItem(checklist.id, item.id, checked, item.version),
    onSuccess: async (_item, variables) => {
      await invalidateChecklistData();
      if (
        variables.checked &&
        variables.checklist.status === 'active' &&
        variables.checklist.progress.total > 0 &&
        variables.checklist.progress.checked + 1 >= variables.checklist.progress.total
      ) {
        show('所有条目均已勾选，清单已自动完成');
      }
    },
  });
  const deleteItem = useMutation({
    mutationFn: ({ checklist, item }: { checklist: Checklist; item: ChecklistItem }) =>
      checklistApi.deleteItem(checklist.id, item.id, item.version),
    onSuccess: async () => {
      await invalidateChecklistData();
      setDeletingItem(undefined);
      show('条目已删除');
    },
  });
  const reset = useMutation({
    mutationFn: (checklist: Checklist) => checklistApi.reset(checklist.id, checklist.version),
    onSuccess: async () => {
      await invalidateChecklistData();
      setResetOpen(false);
      show('所有勾选已重置');
    },
  });
  const clearChecked = useMutation({
    mutationFn: (checklist: Checklist) =>
      checklistApi.clearChecked(checklist.id, checklist.version),
    onSuccess: async () => {
      await invalidateChecklistData();
      setClearOpen(false);
      show('已勾条目已清除');
    },
  });

  const error =
    create.error ??
    update.error ??
    complete.error ??
    reopen.error ??
    archive.error ??
    restore.error ??
    remove.error ??
    addItem.error ??
    updateItem.error ??
    checkItem.error ??
    deleteItem.error ??
    reset.error ??
    clearChecked.error;

  return (
    <div className="feature-shell-page feature-shell-page--checklists">
      <PageTopbarActions>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} aria-hidden="true" />
          <span>新建清单</span>
        </button>
      </PageTopbarActions>
      {error ? <SectionError title="操作没有完成" message={humanizeApiError(error)} /> : null}
      <div className="lifecycle-tabs" role="group" aria-label="清单状态">
        {(['active', 'completed', 'archived'] as const).map((status) => (
          <button
            type="button"
            key={status}
            className={filter === status ? 'active' : ''}
            aria-pressed={filter === status}
            onClick={() => {
              setFilter(status);
              void navigate('/features/checklists');
            }}
          >
            {statusLabels[status]}
          </button>
        ))}
        <span>{items.length} 个清单</span>
      </div>
      <div className={`entity-workspace ${selected ? 'entity-workspace--detail' : ''}`}>
        <section className="entity-list-panel">
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : items.length ? (
            <div className="checklist-card-list">
              {items.map((checklist) => (
                <Link
                  key={checklist.id}
                  className={`checklist-card ${checklist.id === checklistId ? 'active' : ''}`}
                  to={`/features/checklists/${checklist.id}`}
                >
                  <span className="checklist-card__icon">
                    <ListChecks size={20} aria-hidden="true" />
                  </span>
                  <span className="checklist-card__copy">
                    <span>
                      <strong>{checklist.name}</strong>
                      <small>
                        {checklist.progress.checked}/{checklist.progress.total}
                      </small>
                    </span>
                    <span className="progress-track" aria-hidden="true">
                      <span style={{ width: `${checklist.progress.percentage}%` }} />
                    </span>
                    <small>
                      {checklist.note || '没有备注'}
                      {checklist.amounts.total > 0
                        ? ` · 合计 ${formatMoney(checklist.amounts.total)}`
                        : ''}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                filter === 'active'
                  ? '还没有使用中的清单'
                  : filter === 'completed'
                    ? '还没有已完成清单'
                    : '还没有已归档清单'
              }
              description={
                filter === 'active'
                  ? '创建购物、观影、旅行或任何需要逐项核对的清单。'
                  : filter === 'completed'
                    ? '全部条目勾选后，清单会自动进入这里；也可以手动标记完成。'
                    : '使用中和已完成的清单归档后都会保留在这里。'
              }
              action={
                filter === 'active' ? (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => setCreateOpen(true)}
                  >
                    创建第一个清单
                  </button>
                ) : undefined
              }
            />
          )}
        </section>
        <section className="entity-detail-panel">
          {selected ? (
            <ChecklistDetail
              checklist={selected}
              checkingItemId={checkItem.isPending ? checkItem.variables?.item.id : undefined}
              onBack={() => void navigate('/features/checklists')}
              onEdit={() => setEditOpen(true)}
              onComplete={() => complete.mutate(selected)}
              onReopen={() => reopen.mutate(selected)}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDelete={() => setDeleteOpen(true)}
              onAddItem={async (input) => {
                await addItem.mutateAsync({ checklist: selected, input });
              }}
              onCheckItem={(item, checked) =>
                checkItem.mutate({ checklist: selected, item, checked })
              }
              onEditItem={setEditingItem}
              onDeleteItem={setDeletingItem}
              onReset={() => setResetOpen(true)}
              onClearChecked={() => setClearOpen(true)}
              adding={addItem.isPending}
            />
          ) : (
            <div className="entity-detail-placeholder">
              <ListChecks size={48} aria-hidden="true" />
              <h3>选择一个清单</h3>
              <p>条目、勾选进度和金额汇总会显示在这里。</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={createOpen}
        title="新建清单"
        description="先确定用途，条目可以随后连续添加。"
        onClose={() => setCreateOpen(false)}
      >
        <ChecklistForm
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal open={editOpen} title="编辑清单" onClose={() => setEditOpen(false)}>
        {selected ? (
          <ChecklistForm
            key={`${selected.id}:${selected.version}`}
            checklist={selected}
            submitting={update.isPending}
            onSubmit={async (input) => {
              await update.mutateAsync({ checklist: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal open={Boolean(editingItem)} title="编辑条目" onClose={() => setEditingItem(undefined)}>
        {selected && editingItem ? (
          <ChecklistItemForm
            key={`${editingItem.id}:${editingItem.version}`}
            item={editingItem}
            submitting={updateItem.isPending}
            onSubmit={async (input) => {
              await updateItem.mutateAsync({ checklist: selected, item: editingItem, input });
            }}
          />
        ) : null}
      </Modal>
      <ConfirmModal
        open={archiveOpen}
        title="归档清单"
        description={`条目和勾选记录都会保留，恢复后仍是${
          selected?.status === 'completed' ? '已完成' : '使用中'
        }状态。`}
        confirmLabel="确认归档"
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => selected && archive.mutate(selected)}
      />
      <ConfirmModal
        open={deleteOpen}
        title="永久删除清单"
        description="清单及其所有条目都会被永久删除，无法恢复。"
        confirmLabel="永久删除"
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => selected && remove.mutate(selected)}
      />
      <ConfirmModal
        open={resetOpen}
        title="重置所有勾选"
        description="清单条目会保留，所有条目恢复为未勾选。"
        confirmLabel="确认重置"
        danger={false}
        onClose={() => setResetOpen(false)}
        onConfirm={() => selected && reset.mutate(selected)}
      />
      <ConfirmModal
        open={clearOpen}
        title="清除已勾条目"
        description={`将永久删除 ${selected?.progress.checked ?? 0} 个已勾条目，未勾条目不受影响。`}
        confirmLabel="确认清除"
        onClose={() => setClearOpen(false)}
        onConfirm={() => selected && clearChecked.mutate(selected)}
      />
      <ConfirmModal
        open={Boolean(deletingItem)}
        title="删除条目"
        description={deletingItem ? `“${deletingItem.name}”将被永久删除。` : ''}
        confirmLabel="删除条目"
        onClose={() => setDeletingItem(undefined)}
        onConfirm={() =>
          selected && deletingItem && deleteItem.mutate({ checklist: selected, item: deletingItem })
        }
      />
    </div>
  );
}

function ChecklistDetail({
  checklist,
  checkingItemId,
  adding,
  onBack,
  onEdit,
  onComplete,
  onReopen,
  onArchive,
  onRestore,
  onDelete,
  onAddItem,
  onCheckItem,
  onEditItem,
  onDeleteItem,
  onReset,
  onClearChecked,
}: {
  checklist: Checklist;
  checkingItemId: string | undefined;
  adding: boolean;
  onBack(): void;
  onEdit(): void;
  onComplete(): void;
  onReopen(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
  onAddItem(input: ChecklistItemInput): Promise<void>;
  onCheckItem(item: ChecklistItem, checked: boolean): void;
  onEditItem(item: ChecklistItem): void;
  onDeleteItem(item: ChecklistItem): void;
  onReset(): void;
  onClearChecked(): void;
}): React.JSX.Element {
  const editable = checklist.status !== 'archived';
  const statusClass =
    checklist.status === 'completed'
      ? 'source-pill--completed'
      : checklist.status === 'archived'
        ? 'source-pill--archived'
        : '';
  return (
    <article className="entity-detail checklist-detail">
      <button type="button" className="button button--quiet mobile-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} />
        返回清单
      </button>
      <header className="entity-detail__header">
        <div>
          <span className={`source-pill ${statusClass}`}>{statusLabels[checklist.status]}</span>
          <p className="eyebrow">通用勾选清单</p>
          <h2>{checklist.name}</h2>
          {checklist.note ? <p>{checklist.note}</p> : null}
        </div>
        <div className="entity-detail__actions">
          {editable ? (
            <>
              <button type="button" className="button button--quiet" onClick={onEdit}>
                <Edit3 size={16} aria-hidden="true" /> 编辑
              </button>
              {checklist.status === 'active' ? (
                <button type="button" className="button button--quiet" onClick={onComplete}>
                  <CircleCheckBig size={16} aria-hidden="true" /> 标记完成
                </button>
              ) : (
                <button type="button" className="button button--quiet" onClick={onReopen}>
                  <RotateCcw size={16} aria-hidden="true" /> 标记使用中
                </button>
              )}
              <button type="button" className="button button--quiet" onClick={onArchive}>
                <Archive size={16} aria-hidden="true" /> 归档
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button button--quiet" onClick={onRestore}>
                <RotateCcw size={16} aria-hidden="true" /> 恢复
              </button>
              <button type="button" className="button button--danger" onClick={onDelete}>
                <Trash2 size={16} aria-hidden="true" /> 永久删除
              </button>
            </>
          )}
        </div>
      </header>
      <div className="checklist-progress-panel">
        <div>
          <strong>{checklist.progress.percentage}%</strong>
          <span>
            已勾 {checklist.progress.checked} / {checklist.progress.total}
          </span>
        </div>
        <span className="progress-track" aria-label={`完成 ${checklist.progress.percentage}%`}>
          <span style={{ width: `${checklist.progress.percentage}%` }} />
        </span>
        {checklist.amounts.total > 0 ? (
          <div className="checklist-amount-summary">
            <CircleDollarSign size={18} aria-hidden="true" />
            <span>
              已勾 {formatMoney(checklist.amounts.checked)} · 全部{' '}
              {formatMoney(checklist.amounts.total)}
            </span>
          </div>
        ) : null}
      </div>
      {editable ? <ChecklistItemForm submitting={adding} onSubmit={onAddItem} /> : null}
      <section className="checklist-items-section">
        <header>
          <div>
            <p className="eyebrow">清单列表</p>
            <h3>{checklist.progress.total} 个条目</h3>
          </div>
          {editable && checklist.items.length ? (
            <div>
              <button
                type="button"
                className="button button--text"
                disabled={checklist.progress.checked === 0}
                onClick={onReset}
              >
                <RotateCcw size={15} aria-hidden="true" /> 重置勾选
              </button>
              <button
                type="button"
                className="button button--text button--text-danger"
                disabled={checklist.progress.checked === 0}
                onClick={onClearChecked}
              >
                <Trash2 size={15} aria-hidden="true" /> 清除已勾
              </button>
            </div>
          ) : null}
        </header>
        {checklist.items.length ? (
          <ul className="checklist-items">
            {checklist.items.map((item) => {
              const meta = itemMeta(item);
              return (
                <li key={item.id} className={item.checked ? 'checked' : ''}>
                  <label className="checklist-item-check">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      disabled={!editable || checkingItemId === item.id}
                      onChange={(event) => onCheckItem(item, event.target.checked)}
                      aria-label={`${item.checked ? '取消勾选' : '勾选'}${item.name}`}
                    />
                    <span aria-hidden="true">
                      <Check size={15} />
                    </span>
                  </label>
                  <div className="checklist-item-copy">
                    <strong>{item.name}</strong>
                    {item.note ? <p>{item.note}</p> : null}
                    {meta ? <small>{meta}</small> : null}
                  </div>
                  {item.price !== null && item.price > 0 ? (
                    <b>{formatMoney(item.price * (item.quantity ?? 1))}</b>
                  ) : null}
                  {editable ? (
                    <div className="checklist-item-actions">
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`编辑${item.name}`}
                        onClick={() => onEditItem(item)}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        className="icon-button icon-button--danger"
                        aria-label={`删除${item.name}`}
                        onClick={() => onDeleteItem(item)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="清单还是空的"
            description={
              editable ? '在上方输入第一项，之后可以连续按回车添加。' : '这个清单没有条目。'
            }
          />
        )}
      </section>
    </article>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onClose(): void;
  onConfirm(): void;
}): React.JSX.Element {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--quiet" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      <p>{description}</p>
    </Modal>
  );
}
