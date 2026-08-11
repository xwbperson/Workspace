import type { Book, BookInput, BookReadingStatus } from '@workspace/client-sdk';
import { useState } from 'react';

export const readingStatusLabels: Record<BookReadingStatus, string> = {
  'to-read': '待读',
  reading: '在读',
  read: '已读',
  abandoned: '放弃',
};

export function BookForm({
  book,
  submitting,
  onSubmit,
}: {
  book?: Book;
  submitting: boolean;
  onSubmit(input: BookInput): Promise<void>;
}): React.JSX.Element {
  const initialReadingStatus: BookReadingStatus = book?.readingStatus ?? 'to-read';
  const [form, setForm] = useState({
    title: book?.title ?? '',
    subtitle: book?.subtitle ?? '',
    originalTitle: book?.originalTitle ?? '',
    author: book?.author ?? '',
    translator: book?.translator ?? '',
    isbn: book?.isbn ?? '',
    publisher: book?.publisher ?? '',
    publishDate: book?.publishDate ?? '',
    edition: book?.edition ?? '',
    series: book?.series ?? '',
    language: book?.language ?? '',
    format: book?.format ?? '',
    pageCount: String(book?.pageCount ?? 0),
    description: book?.description ?? '',
    notes: book?.notes ?? '',
    readingStatus: initialReadingStatus,
    startedAt: book?.startedAt ?? '',
    finishedAt: book?.finishedAt ?? '',
  });

  const set = (name: keyof typeof form, value: string): void => {
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          ...form,
          title: form.title.trim(),
          pageCount: Number(form.pageCount) || 0,
          publishDate: form.publishDate || null,
          startedAt: form.startedAt || null,
          finishedAt: form.finishedAt || null,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>书名 *</span>
          <input
            required
            autoFocus
            maxLength={200}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
          />
        </label>
        <label className="field">
          <span>副标题</span>
          <input value={form.subtitle} onChange={(event) => set('subtitle', event.target.value)} />
        </label>
        <label className="field">
          <span>原书名</span>
          <input
            value={form.originalTitle}
            onChange={(event) => set('originalTitle', event.target.value)}
          />
        </label>
        <label className="field">
          <span>作者</span>
          <input value={form.author} onChange={(event) => set('author', event.target.value)} />
        </label>
        <label className="field">
          <span>译者</span>
          <input
            value={form.translator}
            onChange={(event) => set('translator', event.target.value)}
          />
        </label>
        <label className="field">
          <span>ISBN</span>
          <input value={form.isbn} onChange={(event) => set('isbn', event.target.value)} />
        </label>
        <label className="field">
          <span>出版社</span>
          <input
            value={form.publisher}
            onChange={(event) => set('publisher', event.target.value)}
          />
        </label>
        <label className="field">
          <span>出版日期</span>
          <input
            type="date"
            value={form.publishDate}
            onChange={(event) => set('publishDate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>版本 / 版次</span>
          <input
            placeholder="例如：原书第 3 版"
            value={form.edition}
            onChange={(event) => set('edition', event.target.value)}
          />
        </label>
        <label className="field">
          <span>丛书 / 系列</span>
          <input value={form.series} onChange={(event) => set('series', event.target.value)} />
        </label>
        <label className="field">
          <span>语言</span>
          <input value={form.language} onChange={(event) => set('language', event.target.value)} />
        </label>
        <label className="field">
          <span>载体</span>
          <select value={form.format} onChange={(event) => set('format', event.target.value)}>
            <option value="">未指定</option>
            <option value="纸质书">纸质书</option>
            <option value="电子书">电子书</option>
            <option value="有声书">有声书</option>
            <option value="其他">其他</option>
          </select>
        </label>
        <label className="field">
          <span>总页数（参考）</span>
          <input
            type="number"
            min="0"
            max="1000000"
            value={form.pageCount}
            onChange={(event) => set('pageCount', event.target.value)}
          />
        </label>
        <label className="field">
          <span>阅读状态</span>
          <select
            value={form.readingStatus}
            onChange={(event) => set('readingStatus', event.target.value)}
          >
            {Object.entries(readingStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>开始阅读</span>
          <input
            type="date"
            value={form.startedAt}
            onChange={(event) => set('startedAt', event.target.value)}
          />
        </label>
        <label className="field">
          <span>完成阅读</span>
          <input
            type="date"
            value={form.finishedAt}
            onChange={(event) => set('finishedAt', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>书籍简介</span>
          <textarea
            rows={4}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>阅读笔记</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? '正在保存…' : book ? '保存修改' : '添加书籍'}
        </button>
      </div>
    </form>
  );
}
