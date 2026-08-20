import type {
  Goal,
  GoalInput,
  GoalKeyResult,
  GoalMetricDirection,
  GoalPeriodType,
} from '@workspace/client-sdk';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function newKeyResult(): GoalKeyResult {
  return { id: crypto.randomUUID(), title: '', progress: 0, completed: false };
}

export function GoalForm({
  goal,
  submitting,
  onSubmit,
}: {
  goal?: Goal;
  submitting: boolean;
  onSubmit(input: GoalInput): Promise<void>;
}): React.JSX.Element {
  const [form, setForm] = useState({
    title: goal?.title ?? '',
    description: goal?.description ?? '',
    periodType: goal?.periodType ?? 'quarterly',
    periodLabel: goal?.periodLabel ?? '',
    startDate: goal?.startDate ?? localDateKey(),
    endDate: goal?.endDate ?? localDateKey(),
    status: goal?.status === 'completed' ? ('completed' as const) : ('active' as const),
    metricEnabled: Boolean(goal?.metric),
    startValue: String(goal?.metric?.startValue ?? ''),
    targetValue: String(goal?.metric?.targetValue ?? ''),
    currentValue: String(goal?.metric?.currentValue ?? ''),
    unit: goal?.metric?.unit ?? '',
    direction: goal?.metric?.direction ?? 'increase',
    keyResults: goal?.keyResults ?? [],
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const setKeyResult = (index: number, value: GoalKeyResult): void => {
    set(
      'keyResults',
      form.keyResults.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  return (
    <form
      className="entity-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit({
          title: form.title,
          description: form.description,
          periodType: form.periodType,
          periodLabel: form.periodLabel,
          startDate: form.startDate,
          endDate: form.endDate,
          status: form.status,
          metric: form.metricEnabled
            ? {
                startValue: Number(form.startValue),
                targetValue: Number(form.targetValue),
                currentValue: Number(form.currentValue),
                unit: form.unit,
                direction: form.direction,
              }
            : null,
          keyResults: form.keyResults,
        });
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>目标名称</span>
          <input
            required
            maxLength={200}
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder="例如：体重降到 70 公斤"
          />
        </label>
        <label className="field">
          <span>周期类型</span>
          <select
            value={form.periodType}
            onChange={(event) => set('periodType', event.target.value as GoalPeriodType)}
          >
            <option value="annual">年度目标</option>
            <option value="quarterly">季度目标</option>
            <option value="monthly">月度目标</option>
          </select>
        </label>
        <label className="field">
          <span>周期名称</span>
          <input
            required
            maxLength={80}
            value={form.periodLabel}
            onChange={(event) => set('periodLabel', event.target.value)}
            placeholder="例如：2026 Q3"
          />
        </label>
        <label className="field">
          <span>开始日期</span>
          <input
            required
            type="date"
            value={form.startDate}
            onChange={(event) => set('startDate', event.target.value)}
          />
        </label>
        <label className="field">
          <span>结束日期</span>
          <input
            required
            type="date"
            value={form.endDate}
            onChange={(event) => set('endDate', event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>目标说明</span>
          <textarea
            maxLength={10000}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </label>
        <label className="field">
          <span>完成状态</span>
          <select
            value={form.status}
            onChange={(event) => set('status', event.target.value as 'active' | 'completed')}
          >
            <option value="active">进行中</option>
            <option value="completed">已完成</option>
          </select>
        </label>
        <label className="goal-metric-toggle entity-form__wide">
          <input
            type="checkbox"
            aria-label="这是一个可记录数值的目标"
            checked={form.metricEnabled}
            onChange={(event) => set('metricEnabled', event.target.checked)}
          />
          <span>
            <strong>记录数值进度</strong>
            <small>适合体重、页数、金额等可持续测量的目标</small>
          </span>
        </label>
      </div>

      {form.metricEnabled ? (
        <fieldset className="form-subsection">
          <legend>数值轨迹</legend>
          <div className="entity-form__grid entity-form__grid--metrics">
            <label className="field">
              <span>起始值</span>
              <input
                required
                type="number"
                step="any"
                value={form.startValue}
                onChange={(event) => set('startValue', event.target.value)}
              />
            </label>
            <label className="field">
              <span>目标值</span>
              <input
                required
                type="number"
                step="any"
                value={form.targetValue}
                onChange={(event) => set('targetValue', event.target.value)}
              />
            </label>
            <label className="field">
              <span>当前值</span>
              <input
                required
                type="number"
                step="any"
                value={form.currentValue}
                onChange={(event) => set('currentValue', event.target.value)}
              />
            </label>
            <label className="field">
              <span>单位</span>
              <input
                maxLength={40}
                value={form.unit}
                onChange={(event) => set('unit', event.target.value)}
                placeholder="kg、页、元"
              />
            </label>
            <label className="field">
              <span>变化方向</span>
              <select
                value={form.direction}
                onChange={(event) => set('direction', event.target.value as GoalMetricDirection)}
              >
                <option value="increase">增加到目标值</option>
                <option value="decrease">降低到目标值</option>
              </select>
            </label>
          </div>
        </fieldset>
      ) : null}

      <fieldset className="form-subsection">
        <div className="form-subsection__heading">
          <legend>关键结果</legend>
          <button
            type="button"
            className="button button--accent"
            onClick={() => set('keyResults', [...form.keyResults, newKeyResult()])}
          >
            <Plus size={16} /> 添加关键结果
          </button>
        </div>
        {form.keyResults.length ? (
          <div className="key-result-editor">
            {form.keyResults.map((item, index) => (
              <div className="key-result-editor__row" key={item.id}>
                <input
                  aria-label={`关键结果 ${index + 1}`}
                  required
                  maxLength={200}
                  value={item.title}
                  onChange={(event) => setKeyResult(index, { ...item, title: event.target.value })}
                  placeholder="可验证的结果"
                />
                <input
                  aria-label={`关键结果 ${index + 1} 进度`}
                  type="number"
                  min="0"
                  max="100"
                  value={item.progress}
                  onChange={(event) =>
                    setKeyResult(index, {
                      ...item,
                      progress: Number(event.target.value),
                      completed: Number(event.target.value) >= 100,
                    })
                  }
                />
                <span>%</span>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`删除关键结果 ${index + 1}`}
                  onClick={() =>
                    set(
                      'keyResults',
                      form.keyResults.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="form-hint">可以只使用总进度，也可以添加最多 20 个关键结果。</p>
        )}
      </fieldset>

      <div className="entity-form__actions">
        <button type="submit" className="button button--primary" disabled={submitting}>
          {submitting ? '正在保存…' : goal ? '保存修改' : '创建目标'}
        </button>
      </div>
    </form>
  );
}
