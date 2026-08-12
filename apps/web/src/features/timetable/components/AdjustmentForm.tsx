import type {
  TimetableAdjustmentInput,
  TimetableAdjustmentType,
  TimetableOccurrence,
  TimetableSemester,
} from '@workspace/client-sdk';
import { useState } from 'react';

function splitNames(value: string): string[] {
  return value
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AdjustmentForm({
  formId,
  occurrence,
  semester,
  onSubmit,
}: {
  formId: string;
  occurrence: TimetableOccurrence;
  semester: TimetableSemester;
  onSubmit(input: TimetableAdjustmentInput): Promise<void>;
}): React.JSX.Element {
  const existing = occurrence.adjustment;
  const [form, setForm] = useState({
    type: existing?.type ?? 'override',
    newDate: existing?.newDate ?? occurrence.date,
    newTimeBlockId: existing?.newTimeBlockId ?? occurrence.timeBlock.id,
    room: existing?.room ?? occurrence.room,
    instructors: (existing?.instructors ?? occurrence.instructors).join('、'),
    note: existing?.note ?? '',
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form
      id={formId}
      className="entity-form timetable-adjustment-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          meetingId: occurrence.meetingId,
          originalDate: occurrence.originalDate,
          type: form.type,
          newDate: form.type === 'reschedule' ? form.newDate : null,
          newTimeBlockId: form.type === 'reschedule' ? form.newTimeBlockId : null,
          room: form.type === 'cancel' ? null : form.room,
          instructors: form.type === 'cancel' ? null : splitNames(form.instructors),
          note: form.note,
        });
      }}
    >
      <div className="timetable-adjustment-context">
        <strong>{occurrence.courseName}</strong>
        <span>
          {occurrence.originalDate} · {occurrence.timeBlock.label} · {occurrence.room || '教室待定'}
        </span>
      </div>
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>调整方式</span>
          <select
            value={form.type}
            onChange={(event) => set('type', event.target.value as TimetableAdjustmentType)}
          >
            <option value="override">只换教室或教师</option>
            <option value="reschedule">调到其他日期和课段</option>
            <option value="cancel">本次停课</option>
          </select>
        </label>
        {form.type === 'reschedule' ? (
          <>
            <label className="field">
              <span>新日期</span>
              <input
                required
                type="date"
                value={form.newDate}
                onChange={(event) => set('newDate', event.target.value)}
              />
            </label>
            <label className="field">
              <span>新课段</span>
              <select
                value={form.newTimeBlockId}
                onChange={(event) => set('newTimeBlockId', event.target.value)}
              >
                {semester.timeBlocks.map((block) => (
                  <option value={block.id} key={block.id}>
                    {block.label} · {block.startTime}—{block.endTime}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : null}
        {form.type !== 'cancel' ? (
          <>
            <label className="field">
              <span>教室</span>
              <input
                maxLength={120}
                value={form.room}
                onChange={(event) => set('room', event.target.value)}
              />
            </label>
            <label className="field">
              <span>教师</span>
              <input
                maxLength={240}
                value={form.instructors}
                onChange={(event) => set('instructors', event.target.value)}
              />
            </label>
          </>
        ) : null}
        <label className="field entity-form__wide">
          <span>调整说明</span>
          <textarea
            rows={3}
            maxLength={1000}
            value={form.note}
            onChange={(event) => set('note', event.target.value)}
            placeholder="例如：学院临时调课"
          />
        </label>
      </div>
    </form>
  );
}
