import type { CourseClassRecord, CourseClassRecordInput } from '@workspace/client-sdk';
import { useState } from 'react';

function toLocalInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function ClassRecordForm({
  record,
  submitting,
  onSubmit,
}: {
  record?: CourseClassRecord;
  submitting: boolean;
  onSubmit(input: CourseClassRecordInput): Promise<void>;
}): React.JSX.Element {
  const [occurredAt, setOccurredAt] = useState(
    record ? toLocalInput(record.occurredAt) : toLocalInput(new Date().toISOString()),
  );
  const [content, setContent] = useState(record?.content ?? '');
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ occurredAt: new Date(occurredAt).toISOString(), content: content.trim() });
      }}
    >
      <label className="field">
        <span>上课时间</span>
        <input
          required
          type="datetime-local"
          value={occurredAt}
          onChange={(event) => setOccurredAt(event.target.value)}
        />
      </label>
      <label className="field">
        <span>上课内容</span>
        <textarea
          required
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      </label>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : record ? '保存记录' : '添加记录'}
        </button>
      </div>
    </form>
  );
}
