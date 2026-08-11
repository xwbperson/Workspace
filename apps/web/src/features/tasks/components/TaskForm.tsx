import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskRecurrence,
  TaskStatus,
} from '@workspace/client-sdk';
import { useState } from 'react';

function toLocalDateTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export const priorityLabels: Record<TaskPriority, string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '紧急',
};

export const recurrenceLabels: Record<TaskRecurrence, string> = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  yearly: '每年',
};

export interface TaskFormValues extends Omit<TaskInput, 'status'> {
  status: Exclude<TaskStatus, 'archived'>;
}

export function TaskForm({
  task,
  parentTasks,
  defaultParentId,
  submitting,
  onSubmit,
}: {
  task?: Task;
  parentTasks: Task[];
  defaultParentId?: string;
  submitting: boolean;
  onSubmit(input: TaskFormValues): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status:
      task?.status === 'completed'
        ? ('completed' as const)
        : task?.status === 'in-progress'
          ? ('in-progress' as const)
          : ('todo' as const),
    priority: task?.priority ?? 'medium',
    dueAt: toLocalDateTime(task?.dueAt),
    recurrence: task?.recurrence ?? 'none',
    parentId: task?.parentId ?? defaultParentId ?? '',
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          title: form.title,
          description: form.description,
          status: form.status,
          priority: form.priority,
          dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : null,
          recurrence: form.recurrence,
          parentId: form.parentId || null,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>任务标题</span>
          <input
            required
            maxLength={240}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="写清楚下一步动作"
          />
        </label>
        <label className="field entity-form__wide">
          <span>任务说明</span>
          <textarea
            maxLength={20000}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder="背景、条件或完成标准"
          />
        </label>
        <label className="field">
          <span>状态</span>
          <select
            value={form.status}
            onChange={(event) =>
              set('status', event.target.value as 'todo' | 'in-progress' | 'completed')
            }
          >
            <option value="todo">待办</option>
            <option value="in-progress">进行中</option>
            {task?.status === 'completed' ? <option value="completed">已完成</option> : null}
          </select>
        </label>
        <label className="field">
          <span>优先级</span>
          <select
            value={form.priority}
            onChange={(event) => set('priority', event.target.value as TaskPriority)}
          >
            {Object.entries(priorityLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>截止时间</span>
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(event) => set('dueAt', event.target.value)}
          />
        </label>
        <label className="field">
          <span>重复规则</span>
          <select
            value={form.recurrence}
            onChange={(event) => set('recurrence', event.target.value as TaskRecurrence)}
          >
            {Object.entries(recurrenceLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field entity-form__wide">
          <span>父任务</span>
          <select value={form.parentId} onChange={(event) => set('parentId', event.target.value)}>
            <option value="">无，作为顶层任务</option>
            {parentTasks
              .filter((item) => item.id !== task?.id)
              .map((item) => (
                <option value={item.id} key={item.id}>
                  {item.title}
                </option>
              ))}
          </select>
        </label>
      </div>
      {form.recurrence !== 'none' && !form.dueAt ? (
        <p className="form-callout">重复任务需要先设置截止时间。</p>
      ) : null}
      <div className="entity-form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={submitting || (form.recurrence !== 'none' && !form.dueAt)}
        >
          {submitting ? '正在保存…' : task ? '保存修改' : '创建任务'}
        </button>
      </div>
    </form>
  );
}
