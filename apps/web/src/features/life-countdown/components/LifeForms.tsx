import type {
  LifeEvent,
  LifeEventInput,
  LifeProfile,
  LifeProfileInput,
} from '@workspace/client-sdk';
import { useState } from 'react';

function localDateTime(value: string | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
export function LifeProfileForm({
  profile,
  submitting,
  onSubmit,
}: {
  profile: LifeProfile;
  submitting: boolean;
  onSubmit(input: LifeProfileInput): Promise<void>;
}): React.JSX.Element {
  const [birthDate, setBirthDate] = useState(profile.birthDate ?? '');
  const [expectedAge, setExpectedAge] = useState(String(profile.expectedAge));
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ birthDate, expectedAge: Number(expectedAge), version: profile.version });
      }}
    >
      <div className="entity-form__grid">
        <label className="field">
          <span>出生日期</span>
          <input
            autoFocus
            required
            type="date"
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
        </label>
        <label className="field">
          <span>预期寿命</span>
          <input
            required
            type="number"
            min="1"
            max="150"
            value={expectedAge}
            onChange={(event) => setExpectedAge(event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : '保存人生参数'}
        </button>
      </div>
    </form>
  );
}
export function LifeEventForm({
  lifeEvent,
  submitting,
  onSubmit,
}: {
  lifeEvent?: LifeEvent;
  submitting: boolean;
  onSubmit(input: LifeEventInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    title: lifeEvent?.title ?? '',
    targetAt: localDateTime(lifeEvent?.targetAt),
    note: lifeEvent?.note ?? '',
  });
  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          title: form.title.trim(),
          targetAt: new Date(form.targetAt).toISOString(),
          note: form.note,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>事件名称</span>
          <input
            autoFocus
            required
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
        </label>
        <label className="field entity-form__wide">
          <span>目标时间</span>
          <input
            required
            type="datetime-local"
            value={form.targetAt}
            onChange={(event) => setForm({ ...form, targetAt: event.target.value })}
          />
        </label>
        <label className="field entity-form__wide">
          <span>备注</span>
          <textarea
            rows={4}
            value={form.note}
            onChange={(event) => setForm({ ...form, note: event.target.value })}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : lifeEvent ? '保存事件' : '添加事件'}
        </button>
      </div>
    </form>
  );
}
