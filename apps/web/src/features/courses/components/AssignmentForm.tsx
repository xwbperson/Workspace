import type {
  AssignmentStatus,
  CourseAssignment,
  CourseAssignmentInput,
} from '@workspace/client-sdk';
import { useState } from 'react';

export const assignmentStatusLabels: Record<AssignmentStatus, string> = {
  pending: '待完成',
  'in-progress': '进行中',
  completed: '已完成',
  abandoned: '已放弃',
};

function toLocalInput(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function AssignmentForm({
  assignment,
  submitting,
  onSubmit,
}: {
  assignment?: CourseAssignment;
  submitting: boolean;
  onSubmit(input: CourseAssignmentInput): Promise<void>;
}): React.JSX.Element {
  const [title, setTitle] = useState(assignment?.title ?? '');
  const [description, setDescription] = useState(assignment?.description ?? '');
  const [dueAt, setDueAt] = useState(toLocalInput(assignment?.dueAt));
  const [status, setStatus] = useState<AssignmentStatus>(assignment?.status ?? 'pending');
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          title: title.trim(),
          description,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          status,
        });
      }}
    >
      <label className="field">
        <span>作业名称 *</span>
        <input
          required
          autoFocus
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="entity-form__grid">
        <label className="field">
          <span>截止时间</span>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
          />
        </label>
        <label className="field">
          <span>状态</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as AssignmentStatus)}
          >
            {Object.entries(assignmentStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field entity-form__wide">
          <span>作业说明</span>
          <textarea
            rows={6}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : assignment ? '保存作业' : '添加作业'}
        </button>
      </div>
    </form>
  );
}
