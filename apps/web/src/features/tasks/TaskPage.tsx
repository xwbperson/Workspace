import type { Task, TaskStatus } from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  Circle,
  Edit3,
  ListChecks,
  Play,
  Plus,
  Repeat2,
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
import { formatDateTime, formatRelativeTime } from '../../platform/time/format.js';
import { taskApi, taskKeys, invalidateTaskData } from './api.js';
import {
  priorityLabels,
  recurrenceLabels,
  TaskForm,
  type TaskFormValues,
} from './components/TaskForm.js';

type TaskFilter = Exclude<TaskStatus, never>;
interface TaskNode extends Task {
  children: TaskNode[];
}

const statusLabels: Record<TaskStatus, string> = {
  todo: '待办',
  'in-progress': '进行中',
  completed: '已完成',
  archived: '已归档',
};

function taskTree(tasks: Task[]): TaskNode[] {
  const nodes = new Map(tasks.map((task) => [task.id, { ...task, children: [] as TaskNode[] }]));
  const roots: TaskNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function TaskPage(): React.JSX.Element {
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { show } = useToast();
  const [filter, setFilter] = useState<TaskFilter>('todo');
  const [createOpen, setCreateOpen] = useState(searchParams.get('create') === '1');
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [defaultParentId, setDefaultParentId] = useState<string>();

  const list = useQuery({ queryKey: taskKeys.list(filter), queryFn: () => taskApi.list(filter) });
  const parents = useQuery({
    queryKey: taskKeys.list('open'),
    queryFn: () => taskApi.list('open'),
  });
  const detail = useQuery({
    queryKey: taskKeys.detail(taskId ?? ''),
    queryFn: () => taskApi.get(taskId!),
    enabled: Boolean(taskId),
  });
  const selected = detail.data ?? list.data?.items.find((item) => item.id === taskId);
  const tasks = useMemo(() => list.data?.items ?? [], [list.data]);
  const tree = useMemo(() => taskTree(tasks), [tasks]);

  const create = useMutation({
    mutationFn: (input: TaskFormValues) =>
      taskApi.create({
        ...input,
        status: input.status === 'completed' ? 'todo' : input.status,
      }),
    onSuccess: async (task) => {
      await invalidateTaskData();
      setCreateOpen(false);
      setDefaultParentId(undefined);
      setFilter(task.status);
      show('任务已创建');
      void navigate(`/features/tasks/${task.id}`, { replace: true });
    },
  });
  const update = useMutation({
    mutationFn: ({ task, input }: { task: Task; input: TaskFormValues }) =>
      taskApi.update(task.id, { ...input, version: task.version }),
    onSuccess: async (task) => {
      await invalidateTaskData();
      setEditOpen(false);
      setFilter(task.status);
      show('任务已更新');
      void navigate(`/features/tasks/${task.id}`);
    },
  });
  const changeStatus = useMutation({
    mutationFn: ({ task, status }: { task: Task; status: 'todo' | 'in-progress' }) =>
      taskApi.update(task.id, { status, version: task.version }),
    onSuccess: async (task) => {
      await invalidateTaskData();
      setFilter(task.status);
      show(task.status === 'in-progress' ? '任务已开始' : '任务已转为待办');
      void navigate(`/features/tasks/${task.id}`);
    },
  });
  const complete = useMutation({
    mutationFn: (task: Task) => taskApi.complete(task.id, task.version),
    onSuccess: async (result) => {
      await invalidateTaskData();
      show(result.nextTask ? '任务已完成，下一次重复任务已创建' : '任务已完成');
      setFilter('completed');
      void navigate(`/features/tasks/${result.completed.id}`);
    },
  });
  const archive = useMutation({
    mutationFn: (task: Task) => taskApi.archive(task.id, task.version),
    onSuccess: async () => {
      await invalidateTaskData();
      setArchiveOpen(false);
      show('任务已归档');
      void navigate('/features/tasks', { replace: true });
    },
  });
  const restore = useMutation({
    mutationFn: (task: Task) => taskApi.restore(task.id, task.version),
    onSuccess: async (task) => {
      await invalidateTaskData();
      setFilter(task.status);
      show('任务已恢复');
      void navigate(`/features/tasks/${task.id}`, { replace: true });
    },
  });
  const permanentDelete = useMutation({
    mutationFn: (task: Task) => taskApi.deletePermanently(task.id, task.version),
    onSuccess: async () => {
      await invalidateTaskData();
      setDeleteOpen(false);
      show('任务已永久删除');
      void navigate('/features/tasks', { replace: true });
    },
  });

  const error =
    create.error ??
    update.error ??
    changeStatus.error ??
    complete.error ??
    archive.error ??
    restore.error ??
    permanentDelete.error;
  const parentTasks = parents.data?.items ?? [];

  const openCreate = (parentId?: string): void => {
    setDefaultParentId(parentId);
    setCreateOpen(true);
  };

  return (
    <div className="feature-shell-page feature-shell-page--tasks">
      <PageTopbarActions>
        <button type="button" className="button button--primary" onClick={() => openCreate()}>
          <Plus size={18} /> <span>添加任务</span>
        </button>
      </PageTopbarActions>

      {error ? <SectionError title="操作没有完成" message={humanizeApiError(error)} /> : null}
      <div className="lifecycle-tabs" role="group" aria-label="任务状态">
        {(['todo', 'in-progress', 'completed', 'archived'] as const).map((status) => (
          <button
            type="button"
            key={status}
            className={filter === status ? 'active' : ''}
            aria-pressed={filter === status}
            onClick={() => {
              setFilter(status);
              void navigate('/features/tasks');
            }}
          >
            {statusLabels[status]}
          </button>
        ))}
        <span>{tasks.length} 项</span>
      </div>

      <div className={`entity-workspace ${selected ? 'entity-workspace--detail' : ''}`}>
        <section className="entity-list-panel task-tree-panel" aria-label="任务列表">
          {list.isError ? (
            <SectionError
              message={humanizeApiError(list.error)}
              onRetry={() => void list.refetch()}
            />
          ) : list.isLoading ? (
            <div className="skeleton-list" role="status" aria-label="正在加载任务">
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : tree.length ? (
            <div className="task-tree">
              {tree.map((node) => (
                <TaskTreeItem task={node} selectedId={taskId} depth={0} key={node.id} />
              ))}
            </div>
          ) : (
            <EmptyState
              title={`还没有${statusLabels[filter]}任务`}
              description={
                filter === 'archived'
                  ? '归档任务会保留在这里，之后可以恢复或永久删除。'
                  : '先建立一个可执行的下一步，再按需要继续拆分。'
              }
              action={
                filter !== 'archived' ? (
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => openCreate()}
                  >
                    创建任务
                  </button>
                ) : undefined
              }
            />
          )}
        </section>
        <section className="entity-detail-panel" aria-label="任务详情">
          {detail.isError ? (
            <SectionError
              message={humanizeApiError(detail.error)}
              onRetry={() => void detail.refetch()}
            />
          ) : selected ? (
            <TaskDetail
              task={selected}
              busy={changeStatus.isPending || complete.isPending || restore.isPending}
              onBack={() => void navigate('/features/tasks')}
              onEdit={() => setEditOpen(true)}
              onSubtask={() => openCreate(selected.id)}
              onStart={() => changeStatus.mutate({ task: selected, status: 'in-progress' })}
              onTodo={() => changeStatus.mutate({ task: selected, status: 'todo' })}
              onComplete={() => complete.mutate(selected)}
              onArchive={() => setArchiveOpen(true)}
              onRestore={() => restore.mutate(selected)}
              onDelete={() => setDeleteOpen(true)}
            />
          ) : (
            <div className="entity-detail-placeholder">
              <ListChecks size={46} />
              <h3>选择一项任务</h3>
              <p>说明、截止时间和重复规则会显示在这里。</p>
            </div>
          )}
        </section>
      </div>

      <Modal
        open={createOpen}
        title={defaultParentId ? '添加子任务' : '添加任务'}
        description={
          defaultParentId
            ? '子任务还可以继续拆分，没有层级数量限制。'
            : '先写清楚动作，再决定优先级和截止时间。'
        }
        onClose={() => {
          setCreateOpen(false);
          setDefaultParentId(undefined);
        }}
        className="modal--wide"
      >
        <TaskForm
          parentTasks={parentTasks}
          {...(defaultParentId ? { defaultParentId } : {})}
          submitting={create.isPending}
          onSubmit={async (input) => {
            await create.mutateAsync(input);
          }}
        />
      </Modal>
      <Modal
        open={editOpen}
        title="编辑任务"
        onClose={() => setEditOpen(false)}
        className="modal--wide"
      >
        {selected ? (
          <TaskForm
            task={selected}
            parentTasks={parentTasks}
            submitting={update.isPending}
            onSubmit={async (input) => {
              await update.mutateAsync({ task: selected, input });
            }}
          />
        ) : null}
      </Modal>
      <Modal
        open={archiveOpen}
        title="归档任务"
        description="归档后仍然可以恢复。"
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
        <p>子任务不会被自动删除，仍可分别处理。</p>
      </Modal>
      <Modal
        open={deleteOpen}
        title="永久删除任务"
        description="该任务下的全部子任务也会一并删除，无法恢复。"
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
        <p>只有已归档任务可以永久删除。</p>
      </Modal>
    </div>
  );
}

function TaskTreeItem({
  task,
  selectedId,
  depth,
}: {
  task: TaskNode;
  selectedId: string | undefined;
  depth: number;
}): React.JSX.Element {
  return (
    <div className="task-tree__branch">
      <Link
        className={`task-tree__item priority-${task.priority} ${task.id === selectedId ? 'active' : ''}`}
        style={{ '--task-indent': `${depth * 18}px` } as React.CSSProperties}
        to={`/features/tasks/${task.id}`}
      >
        <span className="task-tree__rail" />
        <span className="task-tree__state">
          {task.status === 'completed' ? (
            <Check size={16} />
          ) : task.status === 'in-progress' ? (
            <Play size={15} />
          ) : (
            <Circle size={15} />
          )}
        </span>
        <span className="task-tree__copy">
          <strong>{task.title}</strong>
          <small>
            {priorityLabels[task.priority]}优先级
            {task.dueAt ? ` · ${formatRelativeTime(task.dueAt)}` : ''}
          </small>
        </span>
        {task.children.length ? (
          <span className="task-tree__count">
            {task.children.length}
            <ChevronRight size={13} />
          </span>
        ) : null}
      </Link>
      {task.children.map((child) => (
        <TaskTreeItem task={child} selectedId={selectedId} depth={depth + 1} key={child.id} />
      ))}
    </div>
  );
}

function TaskDetail({
  task,
  busy,
  onBack,
  onEdit,
  onSubtask,
  onStart,
  onTodo,
  onComplete,
  onArchive,
  onRestore,
  onDelete,
}: {
  task: Task;
  busy: boolean;
  onBack(): void;
  onEdit(): void;
  onSubtask(): void;
  onStart(): void;
  onTodo(): void;
  onComplete(): void;
  onArchive(): void;
  onRestore(): void;
  onDelete(): void;
}): React.JSX.Element {
  return (
    <div className="entity-detail task-detail">
      <button type="button" className="button button--quiet mobile-back" onClick={onBack}>
        <ArrowLeft aria-hidden="true" size={17} /> 返回任务
      </button>
      <header className="entity-detail__header">
        <div>
          <span
            className={`source-pill ${task.status === 'completed' ? 'source-pill--completed' : task.status === 'archived' ? 'source-pill--archived' : ''}`}
          >
            {statusLabels[task.status]}
          </span>
          <p className="eyebrow">{priorityLabels[task.priority]}优先级</p>
          <h2>{task.title}</h2>
          <p>{task.description || '没有补充说明。'}</p>
        </div>
        <div className="entity-detail__actions">
          {task.status === 'archived' ? (
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
              <button type="button" className="button button--quiet" onClick={onSubtask}>
                <Plus size={16} /> 子任务
              </button>
              <button type="button" className="button button--quiet" onClick={onArchive}>
                <Archive size={16} /> 归档
              </button>
            </>
          )}
        </div>
      </header>
      <section className="task-command-panel">
        <div>
          {task.dueAt ? (
            <>
              <CalendarClock size={20} />
              <span>
                截止时间<strong>{formatDateTime(task.dueAt)}</strong>
              </span>
            </>
          ) : (
            <>
              <CalendarClock size={20} />
              <span>
                截止时间<strong>未设置</strong>
              </span>
            </>
          )}
        </div>
        <div>
          <Repeat2 size={20} />
          <span>
            重复规则<strong>{recurrenceLabels[task.recurrence]}</strong>
          </span>
        </div>
      </section>
      {task.status !== 'archived' ? (
        <section className="task-primary-actions">
          {task.status === 'todo' ? (
            <button
              type="button"
              className="button button--quiet"
              disabled={busy}
              onClick={onStart}
            >
              <Play size={17} /> 开始任务
            </button>
          ) : task.status === 'in-progress' ? (
            <button type="button" className="button button--quiet" disabled={busy} onClick={onTodo}>
              <RotateCcw size={17} /> 转回待办
            </button>
          ) : task.status === 'completed' ? (
            <button type="button" className="button button--quiet" disabled={busy} onClick={onTodo}>
              <RotateCcw size={17} /> 重新打开
            </button>
          ) : null}
          {task.status !== 'completed' ? (
            <button
              type="button"
              className="button button--primary"
              disabled={busy}
              onClick={onComplete}
            >
              <Check size={18} /> 完成任务
            </button>
          ) : null}
        </section>
      ) : null}
      {task.recurrence !== 'none' ? (
        <p className="task-repeat-note">
          <Repeat2 size={17} /> 完成后会按“{recurrenceLabels[task.recurrence]}
          ”创建下一项，当前记录仍保留为完成证据。
        </p>
      ) : null}
    </div>
  );
}
