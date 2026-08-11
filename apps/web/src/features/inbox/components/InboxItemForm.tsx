import type { InboxItem, InboxItemInput, InboxItemType, StoredFile } from '@workspace/client-sdk';
import { FileUp, Link2 } from 'lucide-react';
import { useState } from 'react';

export const inboxTypeLabels: Record<InboxItemType, string> = {
  idea: '想法',
  inspiration: '灵感',
  snippet: '片段',
  article: '文章',
  link: '网址',
  file: '文件',
};
export function InboxItemForm({
  item,
  submitting,
  onUpload,
  onSubmit,
}: {
  item?: InboxItem;
  submitting: boolean;
  onUpload(file: File): Promise<StoredFile>;
  onSubmit(input: InboxItemInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    type: item?.type ?? 'idea',
    title: item?.title ?? '',
    content: item?.content ?? '',
    url: item?.url ?? '',
    status: item?.status === 'processed' ? ('processed' as const) : ('inbox' as const),
    file: item?.file,
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          type: form.type,
          title: form.title,
          content: form.content,
          url: form.url,
          fileId: form.file?.id ?? null,
          status: form.status,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field">
          <span>内容类型</span>
          <select
            value={form.type}
            onChange={(event) => set('type', event.target.value as InboxItemType)}
          >
            {Object.entries(inboxTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>处理状态</span>
          <select
            value={form.status}
            onChange={(event) => set('status', event.target.value as 'inbox' | 'processed')}
          >
            <option value="inbox">待整理</option>
            <option value="processed">已处理</option>
          </select>
        </label>
        <label className="field entity-form__wide">
          <span>标题</span>
          <input
            required
            maxLength={240}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="一句话说明收下了什么"
          />
        </label>
        {form.type === 'link' || form.type === 'article' ? (
          <label className="field entity-form__wide">
            <span>网址</span>
            <span className="input-shell">
              <Link2 size={17} />
              <input
                required={form.type === 'link'}
                type="url"
                maxLength={4000}
                value={form.url}
                onChange={(event) => set('url', event.target.value)}
                placeholder="https://"
              />
            </span>
          </label>
        ) : null}
        <label className="field entity-form__wide">
          <span>内容</span>
          <textarea
            maxLength={50000}
            rows={8}
            value={form.content}
            onChange={(event) => set('content', event.target.value)}
            placeholder="想法、片段、摘要或后续处理说明"
          />
        </label>
        {form.type === 'file' ? (
          <label className="file-drop entity-form__wide">
            <FileUp size={24} />
            <strong>{form.file?.originalName ?? '选择一个文件作为多设备中转'}</strong>
            <span>
              {form.file ? `${(form.file.size / 1024).toFixed(1)} KB` : '单个文件最大 50 MB'}
            </span>
            <input
              type="file"
              required={!form.file}
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (!file) return;
                setUploading(true);
                setUploadError('');
                void onUpload(file)
                  .then((stored) => set('file', stored))
                  .catch((error: unknown) =>
                    setUploadError(error instanceof Error ? error.message : '文件上传失败'),
                  )
                  .finally(() => setUploading(false));
              }}
            />
            {uploading ? <small>正在上传…</small> : null}
            {uploadError ? <small className="danger-text">{uploadError}</small> : null}
          </label>
        ) : null}
      </div>
      <div className="entity-form__actions">
        <button
          type="submit"
          className="button button--primary"
          disabled={submitting || uploading || (form.type === 'file' && !form.file)}
        >
          {submitting ? '正在保存…' : item ? '保存修改' : '收入收集箱'}
        </button>
      </div>
    </form>
  );
}
