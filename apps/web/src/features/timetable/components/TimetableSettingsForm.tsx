import type {
  TimetableSemester,
  TimetableSemesterInput,
  TimetableTimeBlockInput,
} from '@workspace/client-sdk';
import { useState } from 'react';

export interface TimetableSettingsValue {
  semester: TimetableSemesterInput;
  blocks: TimetableTimeBlockInput[];
}

export function TimetableSettingsForm({
  formId,
  semester,
  onSubmit,
}: {
  formId: string;
  semester: TimetableSemester;
  onSubmit(value: TimetableSettingsValue): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    name: semester.name,
    shortName: semester.shortName,
    firstWeekMonday: semester.firstWeekMonday,
    totalWeeks: semester.totalWeeks,
    showWeekend: semester.showWeekend,
    makeCurrent: semester.isCurrent,
  });
  const [blocks, setBlocks] = useState(
    semester.timeBlocks.map((block) => ({
      id: block.id,
      label: block.label,
      sourceLabel: block.sourceLabel,
      startTime: block.startTime,
      endTime: block.endTime,
      position: block.position,
      version: block.version,
    })),
  );
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void =>
    setForm((current) => ({ ...current, [key]: value }));
  const setBlock = <K extends keyof TimetableTimeBlockInput>(
    index: number,
    key: K,
    value: TimetableTimeBlockInput[K],
  ): void =>
    setBlocks((current) =>
      current.map((block, blockIndex) =>
        blockIndex === index ? { ...block, [key]: value } : block,
      ),
    );

  return (
    <form
      id={formId}
      className="entity-form timetable-settings-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({ semester: form, blocks });
      }}
    >
      <section className="timetable-settings-section">
        <div>
          <p className="eyebrow">教学周</p>
          <h3>学期与日期</h3>
          <p>修改第一周后，全部课程日期会按新的周一重新计算。</p>
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
              <span>当前学期</span>
            </label>
            <label className="check-field">
              <input
                type="checkbox"
                checked={form.showWeekend}
                onChange={(event) => set('showWeekend', event.target.checked)}
              />
              <span>显示周末</span>
            </label>
          </div>
        </div>
      </section>
      <section className="timetable-settings-section">
        <div>
          <p className="eyebrow">作息模板</p>
          <h3>五个课段</h3>
          <p>课 5 默认对应学校作息中的第 9—11 节；这里修改后整张课表同步更新。</p>
        </div>
        <div className="timetable-block-editor">
          {blocks.map((block, index) => (
            <div className="timetable-block-editor__row" key={block.id}>
              <span className="timetable-block-editor__index">{index + 1}</span>
              <label className="field">
                <span>课段名称</span>
                <input
                  required
                  maxLength={20}
                  value={block.label}
                  onChange={(event) => setBlock(index, 'label', event.target.value)}
                />
              </label>
              <label className="field">
                <span>原节次</span>
                <input
                  maxLength={40}
                  value={block.sourceLabel}
                  onChange={(event) => setBlock(index, 'sourceLabel', event.target.value)}
                />
              </label>
              <label className="field">
                <span>开始</span>
                <input
                  required
                  type="time"
                  value={block.startTime}
                  onChange={(event) => setBlock(index, 'startTime', event.target.value)}
                />
              </label>
              <label className="field">
                <span>结束</span>
                <input
                  required
                  type="time"
                  value={block.endTime}
                  onChange={(event) => setBlock(index, 'endTime', event.target.value)}
                />
              </label>
            </div>
          ))}
        </div>
      </section>
    </form>
  );
}
