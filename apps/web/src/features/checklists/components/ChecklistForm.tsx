import type { Checklist, ChecklistInput } from '@workspace/client-sdk';
import { useState } from 'react';

export function ChecklistForm({
  checklist,
  submitting,
  onSubmit,
}: {
  checklist?: Checklist;
  submitting: boolean;
  onSubmit(input: ChecklistInput): Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState(checklist?.name ?? '');
  const [note, setNote] = useState(checklist?.note ?? '');

  return (
    <form
      className="form-stack"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || submitting) return;
        void onSubmit({ name: name.trim(), note: note.trim() }).catch(() => undefined);
      }}
    >
      <label>
        <span>清单名称</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          placeholder="例如：周末采购、旅行行李、经典片单"
          autoFocus
          required
        />
      </label>
      <label>
        <span>清单备注</span>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={20_000}
          rows={5}
          placeholder="记录用途、范围或使用习惯（可选）"
        />
      </label>
      <div className="form-actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : checklist ? '保存清单' : '创建清单'}
        </button>
      </div>
    </form>
  );
}
