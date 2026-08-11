import type { BookChapter, BookChapterInput } from '@workspace/client-sdk';
import { useState } from 'react';

export function ChapterForm({
  chapter,
  defaultStartPage,
  submitting,
  onSubmit,
}: {
  chapter?: BookChapter;
  defaultStartPage: number;
  submitting: boolean;
  onSubmit(input: BookChapterInput): Promise<void>;
}): React.JSX.Element {
  const start = chapter?.startPage ?? defaultStartPage;
  const [form, setForm] = useState({
    title: chapter?.title ?? '',
    startPage: String(start),
    endPage: String(chapter?.endPage ?? start + 19),
    currentPage: String(chapter?.currentPage ?? start - 1),
    notes: chapter?.notes ?? '',
  });

  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          title: form.title.trim(),
          startPage: Number(form.startPage),
          endPage: Number(form.endPage),
          currentPage: Number(form.currentPage),
          notes: form.notes,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>章节名称 *</span>
          <input
            required
            autoFocus
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label className="field">
          <span>起始页</span>
          <input
            required
            type="number"
            min="1"
            value={form.startPage}
            onChange={(event) =>
              setForm((current) => ({ ...current, startPage: event.target.value }))
            }
          />
        </label>
        <label className="field">
          <span>结束页</span>
          <input
            required
            type="number"
            min="1"
            value={form.endPage}
            onChange={(event) =>
              setForm((current) => ({ ...current, endPage: event.target.value }))
            }
          />
        </label>
        <label className="field entity-form__wide">
          <span>当前读到页（填起始页减 1 表示未开始）</span>
          <input
            required
            type="number"
            min="0"
            value={form.currentPage}
            onChange={(event) =>
              setForm((current) => ({ ...current, currentPage: event.target.value }))
            }
          />
        </label>
        <label className="field entity-form__wide">
          <span>章节笔记</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : chapter ? '保存章节' : '添加章节'}
        </button>
      </div>
    </form>
  );
}
