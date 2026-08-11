import type { CalendarEntry, CalendarEntryInput, CalendarEntryType } from '@workspace/client-sdk';
import { useState } from 'react';

function localDateTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function defaultTime(date: string, hour: string): string {
  return `${date}T${hour}`;
}
export const calendarTypeLabels: Record<CalendarEntryType, string> = {
  schedule: '行程',
  journal: '日记',
  summary: '总结',
};

export function CalendarEntryForm({
  entry,
  defaultDate,
  submitting,
  onSubmit,
}: {
  entry?: CalendarEntry;
  defaultDate: string;
  submitting: boolean;
  onSubmit(input: CalendarEntryInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    type: entry?.type ?? 'schedule',
    title: entry?.title ?? '',
    content: entry?.content ?? '',
    entryDate: entry?.entryDate ?? defaultDate,
    startsAt: localDateTime(entry?.startsAt) || defaultTime(defaultDate, '09:00'),
    endsAt: localDateTime(entry?.endsAt) || defaultTime(defaultDate, '10:00'),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));
  const timed = form.type === 'schedule';
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          type: form.type,
          title: form.title,
          content: form.content,
          entryDate: form.entryDate,
          startsAt: timed && form.startsAt ? new Date(form.startsAt).toISOString() : null,
          endsAt: timed && form.endsAt ? new Date(form.endsAt).toISOString() : null,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field">
          <span>记录类型</span>
          <select
            value={form.type}
            onChange={(event) => set('type', event.target.value as CalendarEntryType)}
          >
            {Object.entries(calendarTypeLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>日期</span>
          <input
            required
            type="date"
            value={form.entryDate}
            onChange={(event) => {
              const date = event.target.value;
              setForm((current) => ({
                ...current,
                entryDate: date,
                startsAt: timed ? defaultTime(date, '09:00') : current.startsAt,
                endsAt: timed ? defaultTime(date, '10:00') : current.endsAt,
              }));
            }}
          />
        </label>
        <label className="field entity-form__wide">
          <span>标题</span>
          <input
            required
            maxLength={240}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder={
              timed
                ? '例如：课题组例会'
                : form.type === 'journal'
                  ? '今天发生了什么'
                  : '今天的关键结论'
            }
          />
        </label>
        {timed ? (
          <>
            <label className="field">
              <span>开始时间</span>
              <input
                required
                type="datetime-local"
                value={form.startsAt}
                onChange={(event) => set('startsAt', event.target.value)}
              />
            </label>
            <label className="field">
              <span>结束时间</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(event) => set('endsAt', event.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="field entity-form__wide">
          <span>
            {form.type === 'journal'
              ? '日记正文'
              : form.type === 'summary'
                ? '总结内容'
                : '行程说明'}
          </span>
          <textarea
            maxLength={50000}
            value={form.content}
            onChange={(event) => set('content', event.target.value)}
            rows={8}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : entry ? '保存修改' : `添加${calendarTypeLabels[form.type]}`}
        </button>
      </div>
    </form>
  );
}
