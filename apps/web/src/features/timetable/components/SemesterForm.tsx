import type { TimetableSemester, TimetableSemesterInput } from '@workspace/client-sdk';
import { useState } from 'react';

export function SemesterForm({
  formId,
  semester,
  onSubmit,
}: {
  formId: string;
  semester?: TimetableSemester;
  onSubmit(input: TimetableSemesterInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: semester?.name ?? '2026—2027 学年秋季学期',
    shortName: semester?.shortName ?? '研一上',
    firstWeekMonday: semester?.firstWeekMonday ?? '2026-09-07',
    totalWeeks: semester?.totalWeeks ?? 20,
    showWeekend: semester?.showWeekend ?? true,
    makeCurrent: semester?.isCurrent ?? true,
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      id={formId}
      className="entity-form timetable-semester-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(form);
      }}
    >
      <div className="timetable-form-note" role="note">
        <strong>第一周日期可以随时修正</strong>
        <span>9 月 5 日是报到日；2026-09-07 只是报到后的首个周一，并非已确认的开课日。</span>
      </div>
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>学期名称</span>
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => set('name', event.target.value)}
          />
        </label>
        <label className="field">
          <span>简称</span>
          <input
            required
            maxLength={40}
            value={form.shortName}
            onChange={(event) => set('shortName', event.target.value)}
            placeholder="例如：研一上"
          />
        </label>
        <label className="field">
          <span>第一周周一</span>
          <input
            required
            type="date"
            value={form.firstWeekMonday}
            onChange={(event) => set('firstWeekMonday', event.target.value)}
          />
        </label>
        <label className="field">
          <span>教学周总数</span>
          <input
            required
            type="number"
            min={1}
            max={30}
            value={form.totalWeeks}
            onChange={(event) => set('totalWeeks', Number(event.target.value))}
          />
        </label>
        <div className="timetable-form-checks">
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.makeCurrent}
              onChange={(event) => set('makeCurrent', event.target.checked)}
            />
            <span>设为当前学期</span>
          </label>
          <label className="check-field">
            <input
              type="checkbox"
              checked={form.showWeekend}
              onChange={(event) => set('showWeekend', event.target.checked)}
            />
            <span>显示周六和周日</span>
          </label>
        </div>
      </div>
    </form>
  );
}
