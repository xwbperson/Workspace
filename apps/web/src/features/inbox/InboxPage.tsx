import type {
  InboxItem,
  InboxItemInput,
  InboxItemStatus,
  InboxItemType,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Check,
  FileText,
  Info,
  Inbox,
  Lightbulb,
  Link2,
  MessageSquareQuote,
  Newspaper,
  Plus,
  RotateCcw,
  Sparkles,
  Shapes,
  Trash2,
  Edit3,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { inboxApi, inboxKeys, invalidateInboxData } from './api.js';
import { InboxItemForm, inboxTypeLabels } from './components/InboxItemForm.js';

const statusLabels: Record<InboxItemStatus, string> = {
  inbox: '待整理',
  processed: '已处理',
  archived: '已归档',
};
function TypeIcon({ type, size = 19 }: { type: InboxItemType; size?: number }): React.JSX.Element {
  if (type === 'idea') return <Lightbulb size={size} />;
  if (type === 'inspiration') return <Sparkles size={size} />;
  if (type === 'snippet') return <MessageSquareQuote size={size} />;
  if (type === 'article') return <Newspaper size={size} />;
  if (type === 'link') return <Link2 size={size} />;
  if (type === 'information') return <Info size={size} />;
  if (type === 'other') return <Shapes size={size} />;
  return <FileText size={size} />;
}

export function InboxPage(): React.JSX.Element {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [filter, setFilter] = useState<InboxItemStatus>('inbox');
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const list = useQuery({ queryKey: inboxKeys.list(filter), queryFn: () => inboxApi.list(filter) });
  const detail = useQuery({
    queryKey: inboxKeys.detail(itemId ?? ''),
    queryFn: () => inboxApi.get(itemId!),
    enabled: Boolean(itemId),
  });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const selected = detail.data ?? items.find((item) => item.id === itemId);
  const create = useMutation({
    mutationFn: (input: InboxItemInput) => inboxApi.create(input),
    onSuccess: async (item) => {
      await invalidateInboxData();
      setCreateOpen(false);
      setFilter(item.status);
      show('内容已收入收集箱');
      void navigate(`/features/inbox/${item.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ item, input }: { item: InboxItem; input: InboxItemInput }) =>
      inboxApi.update(item.id, { ...input, version: item.version }),
    onSuccess: async (item) => {
      await invalidateInboxData();
      setEditOpen(false);
      setFilter(item.status);
      show('收集内容已更新');
      void navigate(`/features/inbox/${item.id}`);
    },
  });
  const changeStatus = useMutation({
    mutationFn: ({ item, status }: { item: InboxItem; status: 'inbox' | 'processed' }) =>
      inboxApi.update(item.id, { status, version: item.version }),
    onSuccess: async (item) => {
      await invalidateInboxData();
      setFilter(item.status);
      show(item.status === 'processed' ? '已标记为处理完成' : '已放回待整理');
      void navigate(`/features/inbox/${item.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (item: InboxItem) => inboxApi.archive(item.id, item.version),
    onSuccess: async () => {
      await invalidateInboxData();
      setArchiveOpen(false);
      show('内容已归档');
      void navigate('/features/inbox', { replace: true });
    },
  });
  const restore = useMutation({
    mutationFn: (item: InboxItem) => inboxApi.restore(item.id, item.version),
    onSuccess: async (item) => {
      await invalidateInboxData();
      setFilter(item.status);
      show('内容已恢复');
      void navigate(`/features/inbox/${item.id}`, { replace: true });
    },
  });
  const permanentDelete = useMutation({
    mutationFn: (item: InboxItem) => inboxApi.deletePermanently(item.id, item.version),
    onSuccess: async () => {
      await invalidateInboxData();
      setDeleteOpen(false);
      show('内容已永久删除');
      void navigate('/features/inbox', { replace: true });
    },
  });
  const error =
    create.error ??
    update.error ??
    changeStatus.error ??
    archive.error ??
    restore.error ??
    permanentDelete.error;

  return (
    <div className="feature-shell-page feature-shell-page--inbox">
      <PageTopbarActions>
        <button
          type="button"
          className="button button--primary"
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={18} /> <span>收集内容</span>
        </button>
      </PageTopbarActions>
      {error ? <SectionError title="操作没有完成" message={humanizeApiError(error)} /> : null}
      <div className="lifecycle-tabs" role="group" aria-label="收集箱状态">
        {(['inbox', 'processed', 'archived'] as const).map((status) => (
          <button
            type="button"
            key={status}
            className={filter === status ? 'active' : ''}
            aria-pressed={filter === status}
            onClick={() => {
              setFilter(status);
              void navigate('/features/inbox');
            }}
          >
            {statusLabels[status]}
          </button>
        ))}
        <span>{items.length} 项</span>
      </div>
      <div className={`entity-workspace ${selected ? 'entity-workspace--detail' : ''}`}>
        <section className="entity-list-panel inbox-list-panel">
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : list.isLoading ? (
            <div className="skeleton-list" role="status" aria-label="正在加载收集箱">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : items.length ? (
            <div className="inbox-card-list">
              {items.map((item) => (
                <Link
                  className={`inbox-card type-${item.type} ${item.id === itemId ? 'active' : ''}`}
                  to={`/features/inbox/${item.id}`}
                  key={item.id}
                >
                  <span className="inbox-card__icon">
                    <TypeIcon type={item.type} />
                  </span>
                  <span className="inbox-card__copy">
                    <small>{inboxTypeLabels[item.type]}</small>
                    <strong>{item.title}</strong>
                    <p>{item.content || item.url || item.file?.originalName || '没有补充内容'}</p>
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={filter === 'inbox' ? '收集箱已经清空' : `还没有${statusLabels[filter]}内容`}
              description={
                filter === 'inbox'
                  ? '新的想法或临时文件可以随时放进来。'
                  : '处理和归档后的内容会保留在这里。'
              }
              action={
                filter !== 'archived' ? (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => setCreateOpen(true)}
                  >
                    收集第一条
                  </button>
                ) : undefined
              }
            />
          )}
        </section>
        <section className="entity-detail-panel">
          {detail.isError ? (
            <SectionError
              message={humanizeApiError(detail.error)}
              onRetry={() => void detail.refetch()}
            />
          ) : selected ? (
            <InboxDetail
              item={selected}
              busy={changeStatus.isPending || restore.isPending}
              onBack={() => void navigate('/features/inbox')}
              onEdit={() => setEditOpen(true)}
              onProcessed={() => changeStatus.mutate({ item: selected, status: 'processed' })}
              onInbox={() => changeStatus.mutate({ item: selected, status: 'inbox' })}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : (
            <div className="entity-detail-placeholder">
              <Inbox size={46} />
              <h3>选择一条收集内容</h3>
              <p>正文、网址或中转文件会显示在这里。</p>
            </div>
          )}
        </section>
      </div>
      <Modal
        open={createOpen}
        title="收集内容"
        description="只需先写清标题，其他信息之后仍可补充。"
        onClose={() => setCreateOpen(false)}
        className="modal--wide"
      >
        <InboxItemForm
          submitting={create.isPending}
          onUpload={inboxApi.uploadFile}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑收集内容"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <InboxItemForm
            item={selected}
            submitting={update.isPending}
            onUpload={inboxApi.uploadFile}
            onSubmit={async (input) => {
              await update.mutateAsync({ item: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档收集内容"
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
              确认归档
            </button>
          </>
        }
      >
        <p>附件仍会保存在工作区和备份中。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除收集内容"
        description="记录会被删除；已上传的底层文件仍可能被其他功能引用。"
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
              永久删除
            </button>
          </>
        }
      >
        <p>这个操作无法撤销。</p>
      </Modal>
    </div>
  );
}

function InboxDetail({
  item,
  busy,
  onBack,
  onEdit,
  onProcessed,
  onInbox,
  onArchive,
  onRestore,
  onDelete,
}: {
  item: InboxItem;
  busy: boolean;
  onBack(): void;
  onEdit(): void;
  onProcessed(): void;
  onInbox(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
}): React.JSX.Element {
  return (
    <div className="entity-detail inbox-detail">
      <button type="button" className="button button--quiet mobile-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} /> 返回收集箱
      </button>
      <header className="entity-detail__header">
        <div>
          <span
            className={`source-pill ${item.status === 'processed' ? 'source-pill--completed' : item.status === 'archived' ? 'source-pill--archived' : ''}`}
          >
            {statusLabels[item.status]}
          </span>
          <p className="eyebrow">{inboxTypeLabels[item.type]}</p>
          <h2>{item.title}</h2>
        </div>
        <div className="entity-detail__actions">
          {item.status === 'archived' ? (
            <>
              <button
                type="button"
                className="button button--quiet"
                disabled={busy}
                onClick={onRestore}
              >
                <ArchiveRestore size={16} /> 恢复
              </button>
              <button type="button" className="button button--danger" onClick={onDelete}>
                <Trash2 size={16} /> 永久删除
              </button>
            </>
          ) : (
            <>
              <button type="button" className="button button--quiet" onClick={onEdit}>
                <Edit3 size={16} /> 编辑
              </button>
              <button type="button" className="button button--quiet" onClick={onArchive}>
                <Archive size={16} /> 归档
              </button>
            </>
          )}
        </div>
      </header>
      {item.content ? (
        <section className="inbox-content">
          <pre>{item.content}</pre>
        </section>
      ) : null}
      {item.url ? (
        <a className="inbox-attachment" href={item.url} target="_blank" rel="noreferrer">
          <Link2 />
          <span>
            <small>打开网址</small>
            <strong>{item.url}</strong>
          </span>
        </a>
      ) : null}
      {item.file ? (
        <a
          className="inbox-attachment"
          href={item.file.contentUrl}
          target="_blank"
          rel="noreferrer"
        >
          <FileText />
          <span>
            <small>
              {(item.file.size / 1024).toFixed(1)} KB · {item.file.mimeType}
            </small>
            <strong>{item.file.originalName}</strong>
          </span>
        </a>
      ) : null}
      {item.status !== 'archived' ? (
        <div className="task-primary-actions">
          {item.status === 'inbox' ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={onProcessed}
            >
              <Check size={17} /> 标记已处理
            </button>
          ) : (
            <button
              type="button"
              className="button button--quiet"
              disabled={busy}
              onClick={onInbox}
            >
              <RotateCcw size={17} /> 放回待整理
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
