import type {
  InventoryGroup,
  InventoryItem,
  InventoryItemInput,
  InventoryItemStatus,
  InventoryStockFilter,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Archive, Edit3, FolderCog, Package, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { inventoryApi, inventoryKeys, invalidateInventoryData } from './api.js';
import { GroupManager } from './components/GroupManager.js';
import { InventoryForm } from './components/InventoryForm.js';
import { QuantityStepper } from './components/QuantityStepper.js';

type View = 'active' | 'zero' | 'archived';
type GroupFilter = string;

const viewLabels: Record<View, string> = {
  active: '使用中',
  zero: '数量为 0',
  archived: '已归档',
};

function viewQuery(view: View): { status: InventoryItemStatus; stock: InventoryStockFilter } {
  if (view === 'archived') return { status: 'archived', stock: 'all' };
  if (view === 'zero') return { status: 'active', stock: 'zero' };
  return { status: 'active', stock: 'all' };
}

export function InventoryPage(): React.JSX.Element {
  const [params] = useSearchParams();
  const { show } = useToast();
  const [view, setView] = useState<View>('active');
  const [groupFilter, setGroupFilter] = useState<GroupFilter>('all');
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(params.get('create') === '1');
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [archivingItem, setArchivingItem] = useState<InventoryItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [quantityOverrides, setQuantityOverrides] = useState<Record<string, number>>({});
  const pendingAdjustments = useRef<Record<string, number>>({});
  const filter = viewQuery(view);

  useEffect(() => {
    if (params.get('create') === '1') setCreateOpen(true);
  }, [params]);

  const groupsQuery = useQuery({
    queryKey: inventoryKeys.groups,
    queryFn: inventoryApi.groups,
  });
  const itemsQuery = useQuery({
    queryKey: inventoryKeys.items(
      filter.status,
      filter.stock,
      groupFilter === 'all' ? undefined : groupFilter,
      query.trim(),
    ),
    queryFn: () => {
      const selectedGroup = groupFilter === 'all' ? undefined : groupFilter;
      const searchQuery = query.trim() || undefined;
      return inventoryApi.items({
        ...filter,
        ...(selectedGroup === undefined ? {} : { groupId: selectedGroup }),
        ...(searchQuery === undefined ? {} : { query: searchQuery }),
      });
    },
  });

  const groups = groupsQuery.data?.items ?? [];
  const items = useMemo(
    () =>
      (itemsQuery.data?.items ?? []).map((item) => {
        const override = quantityOverrides[item.id];
        return override === undefined ? item : { ...item, quantity: override };
      }),
    [itemsQuery.data, quantityOverrides],
  );
  const summary = useMemo(
    () => ({
      kinds: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      zeroQuantity: items.filter((item) => item.quantity === 0).length,
    }),
    [items],
  );

  const createItem = useMutation({
    mutationFn: (input: InventoryItemInput) => inventoryApi.createItem(input),
    onSuccess: async () => {
      await invalidateInventoryData();
      setCreateOpen(false);
      setView('active');
      show('物品已添加');
    },
  });
  const updateItem = useMutation({
    mutationFn: ({ item, input }: { item: InventoryItem; input: InventoryItemInput }) =>
      inventoryApi.updateItem(item.id, { ...input, version: item.version }),
    onSuccess: async () => {
      await invalidateInventoryData();
      setEditingItem(null);
      show('物品已更新');
    },
  });
  const adjustQuantity = useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: -1 | 1 }) =>
      inventoryApi.adjustQuantity(id, delta),
    onSettled: async (_data, _error, variables) => {
      const remaining = Math.max(0, (pendingAdjustments.current[variables.id] ?? 1) - 1);
      pendingAdjustments.current[variables.id] = remaining;
      if (remaining === 0) {
        await invalidateInventoryData();
        setQuantityOverrides((current) => {
          const next = { ...current };
          delete next[variables.id];
          return next;
        });
      }
    },
  });
  const archiveItem = useMutation({
    mutationFn: (item: InventoryItem) => inventoryApi.archiveItem(item.id, item.version),
    onSuccess: async () => {
      await invalidateInventoryData();
      setArchivingItem(null);
      show('物品已归档');
    },
  });
  const restoreItem = useMutation({
    mutationFn: (item: InventoryItem) => inventoryApi.restoreItem(item.id, item.version),
    onSuccess: async () => {
      await invalidateInventoryData();
      show('物品已恢复');
    },
  });
  const deleteItem = useMutation({
    mutationFn: (item: InventoryItem) => inventoryApi.deleteItem(item.id, item.version),
    onSuccess: async () => {
      await invalidateInventoryData();
      setDeletingItem(null);
      show('物品已永久删除');
    },
  });
  const createGroup = useMutation({
    mutationFn: (name: string) => inventoryApi.createGroup({ name }),
    onSuccess: async () => {
      await invalidateInventoryData();
      show('分组已添加');
    },
  });
  const renameGroup = useMutation({
    mutationFn: ({ group, name }: { group: InventoryGroup; name: string }) =>
      inventoryApi.updateGroup(group.id, { name, version: group.version }),
    onSuccess: async () => {
      await invalidateInventoryData();
      show('分组已重命名');
    },
  });
  const deleteGroup = useMutation({
    mutationFn: (group: InventoryGroup) => inventoryApi.deleteGroup(group.id, group.version),
    onSuccess: async (_data, group) => {
      if (groupFilter === group.id) setGroupFilter('all');
      await invalidateInventoryData();
      show('分组已删除，其中物品已移至无分组');
    },
  });

  const actionError =
    createItem.error ??
    updateItem.error ??
    adjustQuantity.error ??
    archiveItem.error ??
    restoreItem.error ??
    deleteItem.error ??
    createGroup.error ??
    renameGroup.error ??
    deleteGroup.error;
  const groupBusy = createGroup.isPending || renameGroup.isPending || deleteGroup.isPending;

  const queueQuantityAdjustment = (item: InventoryItem, delta: -1 | 1): void => {
    const current = quantityOverrides[item.id] ?? item.quantity;
    const next = Math.max(0, Math.min(999_999, current + delta));
    if (next === current) return;
    setQuantityOverrides((values) => ({ ...values, [item.id]: next }));
    pendingAdjustments.current[item.id] = (pendingAdjustments.current[item.id] ?? 0) + 1;
    adjustQuantity.mutate({ id: item.id, delta });
  };

  return (
    <div className="feature-shell-page feature-shell-page--inventory">
      <PageTopbarActions>
        <button type="button" className="button button--quiet" onClick={() => setGroupsOpen(true)}>
          <FolderCog aria-hidden="true" size={18} />
          <span>管理分组</span>
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" size={18} />
          <span>添加物品</span>
        </button>
      </PageTopbarActions>

      {actionError ? (
        <SectionError title="操作没有完成" message={humanizeApiError(actionError)} />
      ) : null}
      {groupsQuery.isError ? (
        <SectionError
          title="分组暂时无法加载"
          message={humanizeApiError(groupsQuery.error)}
          onRetry={() => void groupsQuery.refetch()}
        />
      ) : null}

      <section className="inventory-toolbar" aria-label="筛选物品">
        <label className="inventory-search">
          <Search aria-hidden="true" size={19} />
          <span className="sr-only">搜索物品</span>
          <input
            type="search"
            value={query}
            placeholder="搜索名称、用途、备注或分组"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="lifecycle-tabs" role="group" aria-label="物品状态">
          {(['active', 'zero', 'archived'] as const).map((option) => (
            <button
              type="button"
              key={option}
              className={view === option ? 'active' : ''}
              aria-pressed={view === option}
              onClick={() => setView(option)}
            >
              {viewLabels[option]}
            </button>
          ))}
        </div>
      </section>

      <nav className="inventory-group-filters" aria-label="按物品分组筛选">
        <button
          type="button"
          className={groupFilter === 'all' ? 'active' : ''}
          aria-pressed={groupFilter === 'all'}
          onClick={() => setGroupFilter('all')}
        >
          全部
        </button>
        <button
          type="button"
          className={groupFilter === 'ungrouped' ? 'active' : ''}
          aria-pressed={groupFilter === 'ungrouped'}
          onClick={() => setGroupFilter('ungrouped')}
        >
          无分组
        </button>
        {groups.map((group) => (
          <button
            type="button"
            key={group.id}
            className={groupFilter === group.id ? 'active' : ''}
            aria-pressed={groupFilter === group.id}
            onClick={() => setGroupFilter(group.id)}
          >
            {group.name}
            <span>{group.itemCount}</span>
          </button>
        ))}
      </nav>

      <section className="inventory-summary" aria-label="物品汇总">
        <div>
          <span>物品种类</span>
          <strong>{summary.kinds}</strong>
        </div>
        <div>
          <span>数量合计</span>
          <strong>{summary.totalQuantity}</strong>
        </div>
        <div className={summary.zeroQuantity ? 'inventory-summary__warning' : ''}>
          <span>数量为 0</span>
          <strong>{summary.zeroQuantity}</strong>
        </div>
      </section>

      <section className="inventory-ledger" aria-label="物品列表">
        {itemsQuery.isError ? (
          <SectionError
            message={humanizeApiError(itemsQuery.error)}
            onRetry={() => void itemsQuery.refetch()}
          />
        ) : items.length ? (
          <div className="inventory-grid">
            {items.map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                onAdjust={(delta) => queueQuantityAdjustment(item, delta)}
                onEdit={() => setEditingItem(item)}
                onArchive={() => setArchivingItem(item)}
                onRestore={() => restoreItem.mutate(item)}
                onDelete={() => setDeletingItem(item)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              query.trim() || groupFilter !== 'all'
                ? '没有符合当前筛选的物品'
                : `还没有${viewLabels[view]}物品`
            }
            description={
              query.trim() || groupFilter !== 'all'
                ? '可以清除搜索词或切换到其他分组。'
                : '添加后可以直接在列表中调整数量，数量为 0 也会保留。'
            }
            action={
              view !== 'archived' && !query.trim() && groupFilter === 'all' ? (
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => setCreateOpen(true)}
                >
                  添加第一件物品
                </button>
              ) : undefined
            }
          />
        )}
      </section>

      <Modal
        open={createOpen}
        title="添加物品"
        description="数量可以从 0 开始，分组也可以暂时不选。"
        className="modal--wide"
        busy={createItem.isPending}
        error={createItem.error ? humanizeApiError(createItem.error) : null}
        onClose={() => setCreateOpen(false)}
      >
        <InventoryForm
          groups={groups}
          submitting={createItem.isPending}
          onSubmit={(input) => createItem.mutateAsync(input).then(() => undefined)}
        />
      </Modal>
      <Modal
        open={Boolean(editingItem)}
        title="编辑物品"
        className="modal--wide"
        busy={updateItem.isPending}
        error={updateItem.error ? humanizeApiError(updateItem.error) : null}
        onClose={() => setEditingItem(null)}
      >
        {editingItem ? (
          <InventoryForm
            key={`${editingItem.id}:${editingItem.version}`}
            item={editingItem}
            groups={groups}
            submitting={updateItem.isPending}
            onSubmit={(input) =>
              updateItem.mutateAsync({ item: editingItem, input }).then(() => undefined)
            }
          />
        ) : null}
      </Modal>
      <Modal
        open={groupsOpen}
        title="管理物品分组"
        description="删除分组只会把其中物品移至无分组。"
        className="modal--wide"
        busy={groupBusy}
        error={
          createGroup.error || renameGroup.error || deleteGroup.error
            ? humanizeApiError(createGroup.error ?? renameGroup.error ?? deleteGroup.error)
            : null
        }
        onClose={() => setGroupsOpen(false)}
      >
        <GroupManager
          groups={groups}
          busy={groupBusy}
          onCreate={(name) => createGroup.mutateAsync(name).then(() => undefined)}
          onRename={(group, name) => renameGroup.mutateAsync({ group, name }).then(() => undefined)}
          onDelete={(group) => deleteGroup.mutateAsync(group).then(() => undefined)}
        />
      </Modal>
      <ConfirmItemModal
        item={archivingItem}
        title="归档物品"
        description="归档后数量和分组仍会保留，可以随时恢复。"
        confirmLabel="确认归档"
        busy={archiveItem.isPending}
        error={archiveItem.error}
        onClose={() => setArchivingItem(null)}
        onConfirm={() => archivingItem && archiveItem.mutate(archivingItem)}
      />
      <ConfirmItemModal
        item={deletingItem}
        title="永久删除物品"
        description="此操作无法恢复，只能用于已归档物品。"
        confirmLabel="永久删除"
        busy={deleteItem.isPending}
        error={deleteItem.error}
        onClose={() => setDeletingItem(null)}
        onConfirm={() => deletingItem && deleteItem.mutate(deletingItem)}
      />
    </div>
  );
}

function InventoryCard({
  item,
  onAdjust,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: InventoryItem;
  onAdjust(delta: -1 | 1): void;
  onEdit(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
}): React.JSX.Element {
  return (
    <article className={`inventory-card ${item.quantity === 0 ? 'inventory-card--zero' : ''}`}>
      <header>
        <span className="inventory-card__icon">
          <Package aria-hidden="true" size={22} />
        </span>
        <div>
          <span className="inventory-card__group">{item.group?.name ?? '无分组'}</span>
          <h2>{item.name}</h2>
        </div>
        <div className="inventory-card__actions">
          {item.status === 'archived' ? (
            <>
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-label={`恢复${item.name}`}
                onClick={onRestore}
              >
                <RotateCcw aria-hidden="true" size={17} />
              </button>
              <button
                type="button"
                className="icon-button icon-button--small icon-button--danger"
                aria-label={`永久删除${item.name}`}
                onClick={onDelete}
              >
                <Trash2 aria-hidden="true" size={17} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-label={`编辑${item.name}`}
                onClick={onEdit}
              >
                <Edit3 aria-hidden="true" size={17} />
              </button>
              <button
                type="button"
                className="icon-button icon-button--small"
                aria-label={`归档${item.name}`}
                onClick={onArchive}
              >
                <Archive aria-hidden="true" size={17} />
              </button>
            </>
          )}
        </div>
      </header>
      <div className="inventory-card__copy">
        {item.purpose ? <p>{item.purpose}</p> : <p className="inventory-card__empty">未填写用途</p>}
        {item.note ? <small>{item.note}</small> : null}
      </div>
      {item.status === 'archived' ? (
        <div className="inventory-card__archived-quantity">
          <span>归档时数量</span>
          <strong>{item.quantity}</strong>
        </div>
      ) : (
        <QuantityStepper itemName={item.name} quantity={item.quantity} onAdjust={onAdjust} />
      )}
    </article>
  );
}

function ConfirmItemModal({
  item,
  title,
  description,
  confirmLabel,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  item: InventoryItem | null;
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  error: unknown;
  onClose(): void;
  onConfirm(): void;
}): React.JSX.Element {
  return (
    <Modal
      open={Boolean(item)}
      title={title}
      busy={busy}
      error={error ? humanizeApiError(error) : null}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--quiet" disabled={busy} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="button button--danger"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? '正在处理…' : confirmLabel}
          </button>
        </>
      }
    >
      <p>
        {item ? `“${item.name}”：` : ''}
        {description}
      </p>
    </Modal>
  );
}
