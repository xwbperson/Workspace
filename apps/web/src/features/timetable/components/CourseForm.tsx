import type {
  TimetableColor,
  TimetableCourse,
  TimetableCourseInput,
  TimetableSemester,
} from '@workspace/client-sdk';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface MeetingDraft {
  id?: string;
  weekday: number;
  timeBlockId: string;
  room: string;
  instructorOverride: string;
  weekNumbers: number[];
}

const WEEKDAY_OPTIONS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const COLOR_OPTIONS: Array<{ value: TimetableColor; label: string }> = [
  { value: 'teal', label: '青绿' },
  { value: 'blue', label: '蓝色' },
  { value: 'violet', label: '紫色' },
  { value: 'amber', label: '琥珀' },
  { value: 'rose', label: '玫红' },
  { value: 'slate', label: '灰蓝' },
];

function splitNames(value: string): string[] {
  return value
    .split(/[，,、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function allWeeks(totalWeeks: number): number[] {
  return Array.from({ length: totalWeeks }, (_, index) => index + 1);
}

function newMeeting(semester: TimetableSemester, weekday = 1, timeBlockId?: string): MeetingDraft {
  return {
    weekday,
    timeBlockId: timeBlockId ?? semester.timeBlocks[0]?.id ?? '',
    room: '',
    instructorOverride: '',
    weekNumbers: allWeeks(semester.totalWeeks),
  };
}

export function CourseForm({
  formId,
  semester,
  course,
  preset,
  conflictMessage,
  onSubmit,
}: {
  formId: string;
  semester: TimetableSemester;
  course?: TimetableCourse;
  preset?: { weekday: number; timeBlockId: string };
  conflictMessage?: string;
  onSubmit(input: TimetableCourseInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: course?.name ?? '',
    shortName: course?.shortName ?? '',
    instructors: course?.instructors.join('、') ?? '',
    color: course?.color ?? 'teal',
    notes: course?.notes ?? '',
  });
  const [meetings, setMeetings] = useState<MeetingDraft[]>(
    course?.meetings.map((meeting) => ({
      id: meeting.id,
      weekday: meeting.weekday,
      timeBlockId: meeting.timeBlockId,
      room: meeting.room,
      instructorOverride: meeting.instructorOverride.join('、'),
      weekNumbers: meeting.weekNumbers,
    })) ?? [newMeeting(semester, preset?.weekday, preset?.timeBlockId)],
  );
  const [validationError, setValidationError] = useState('');
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));
  const setMeeting = <K extends keyof MeetingDraft>(
    index: number,
    key: K,
    value: MeetingDraft[K],
  ): void =>
    setMeetings((current) =>
      current.map((meeting, meetingIndex) =>
        meetingIndex === index ? { ...meeting, [key]: value } : meeting,
      ),
    );
  const replaceWeeks = (index: number, values: number[]): void =>
    setMeeting(
      index,
      'weekNumbers',
      [...new Set(values)].toSorted((left, right) => left - right),
    );

  return (
    <form
      id={formId}
      className="entity-form timetable-course-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (meetings.some((meeting) => meeting.weekNumbers.length === 0)) {
          setValidationError('每条上课安排至少选择一个教学周。');
          return;
        }
        setValidationError('');
        void onSubmit({
          semesterId: semester.id,
          name: form.name,
          shortName: form.shortName,
          instructors: splitNames(form.instructors),
          color: form.color,
          notes: form.notes,
          meetings: meetings.map((meeting) => ({
            ...(meeting.id ? { id: meeting.id } : {}),
            weekday: meeting.weekday,
            timeBlockId: meeting.timeBlockId,
            room: meeting.room,
            instructorOverride: splitNames(meeting.instructorOverride),
            weekNumbers: meeting.weekNumbers,
          })),
        });
      }}
    >
      {conflictMessage ? (
        <div className="section-state section-state--error timetable-conflict-note" role="alert">
          <div>
            <strong>发现上课时间冲突</strong>
            <p>{conflictMessage} 再次保存即可确认保留重叠课程。</p>
          </div>
        </div>
      ) : null}
      {validationError ? (
        <div className="section-state section-state--error" role="alert">
          <div>
            <strong>还不能保存</strong>
            <p>{validationError}</p>
          </div>
        </div>
      ) : null}
      <section className="timetable-form-section">
        <header>
          <div>
            <p className="eyebrow">课程信息</p>
            <h3>这门课叫什么</h3>
          </div>
        </header>
        <div className="entity-form__grid">
          <label className="field entity-form__wide">
            <span>课程名称</span>
            <input
              autoFocus
              required
              maxLength={80}
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="例如：网络空间安全数学原理"
            />
          </label>
          <label className="field">
            <span>课程简称</span>
            <input
              maxLength={30}
              value={form.shortName}
              onChange={(event) => set('shortName', event.target.value)}
              placeholder="窄卡片优先显示"
            />
          </label>
          <label className="field">
            <span>默认教师</span>
            <input
              maxLength={240}
              value={form.instructors}
              onChange={(event) => set('instructors', event.target.value)}
              placeholder="多位教师用顿号分隔"
            />
          </label>
          <label className="field">
            <span>卡片颜色</span>
            <select
              value={form.color}
              onChange={(event) => set('color', event.target.value as TimetableColor)}
            >
              {COLOR_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field entity-form__wide">
            <span>备注</span>
            <textarea
              rows={3}
              maxLength={5000}
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
              placeholder="选填：课程群、特殊要求等"
            />
          </label>
        </div>
      </section>
      <section className="timetable-form-section">
        <header>
          <div>
            <p className="eyebrow">上课安排</p>
            <h3>什么时候、在哪里上课</h3>
          </div>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setMeetings((current) => [...current, newMeeting(semester)])}
          >
            <Plus aria-hidden="true" size={17} /> 添加安排
          </button>
        </header>
        <div className="timetable-meeting-list">
          {meetings.map((meeting, index) => (
            <article className="timetable-meeting-editor" key={meeting.id ?? `new-${index}`}>
              <header>
                <strong>安排 {index + 1}</strong>
                {meetings.length > 1 ? (
                  <button
                    type="button"
                    className="icon-button danger-action"
                    aria-label={`删除安排 ${index + 1}`}
                    onClick={() =>
                      setMeetings((current) =>
                        current.filter((_, meetingIndex) => meetingIndex !== index),
                      )
                    }
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                ) : null}
              </header>
              <div className="entity-form__grid">
                <label className="field">
                  <span>星期</span>
                  <select
                    value={meeting.weekday}
                    onChange={(event) => setMeeting(index, 'weekday', Number(event.target.value))}
                  >
                    {WEEKDAY_OPTIONS.map((label, optionIndex) => (
                      <option value={optionIndex + 1} key={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>课段</span>
                  <select
                    value={meeting.timeBlockId}
                    onChange={(event) => setMeeting(index, 'timeBlockId', event.target.value)}
                  >
                    {semester.timeBlocks.map((block) => (
                      <option value={block.id} key={block.id}>
                        {block.label} · {block.startTime}—{block.endTime}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>教室</span>
                  <input
                    maxLength={120}
                    value={meeting.room}
                    onChange={(event) => setMeeting(index, 'room', event.target.value)}
                    placeholder="暂不确定可留空"
                  />
                </label>
                <label className="field">
                  <span>本安排教师</span>
                  <input
                    maxLength={240}
                    value={meeting.instructorOverride}
                    onChange={(event) =>
                      setMeeting(index, 'instructorOverride', event.target.value)
                    }
                    placeholder="与默认教师不同才填写"
                  />
                </label>
              </div>
              <div className="week-selector">
                <div className="week-selector__heading">
                  <div>
                    <strong>上课周次</strong>
                    <span>已选 {meeting.weekNumbers.length} 周</span>
                  </div>
                  <div className="week-selector__shortcuts">
                    <button
                      type="button"
                      onClick={() => replaceWeeks(index, allWeeks(semester.totalWeeks))}
                    >
                      全选
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        replaceWeeks(
                          index,
                          allWeeks(semester.totalWeeks).filter((week) => week % 2 === 1),
                        )
                      }
                    >
                      单周
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        replaceWeeks(
                          index,
                          allWeeks(semester.totalWeeks).filter((week) => week % 2 === 0),
                        )
                      }
                    >
                      双周
                    </button>
                    <button type="button" onClick={() => replaceWeeks(index, [])}>
                      清空
                    </button>
                  </div>
                </div>
                <div className="week-selector__grid">
                  {allWeeks(semester.totalWeeks).map((week) => {
                    const selected = meeting.weekNumbers.includes(week);
                    return (
                      <button
                        type="button"
                        aria-pressed={selected}
                        className={selected ? 'selected' : ''}
                        key={week}
                        onClick={() =>
                          replaceWeeks(
                            index,
                            selected
                              ? meeting.weekNumbers.filter((value) => value !== week)
                              : [...meeting.weekNumbers, week],
                          )
                        }
                      >
                        {week}
                      </button>
                    );
                  })}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </form>
  );
}
