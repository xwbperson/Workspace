import type { Countdown, CountdownInput } from '@workspace/client-sdk';
import { CalendarClock, Check, Flag, StickyNote } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

interface CountdownFormValue {
  title: string;
  note: string;
  targetAt: string;
  priority: number;
}

function toLocalInput(value: string | Date): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function defaultTarget(): string {
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  next.setSeconds(0, 0);
  return toLocalInput(next);
}

export function CountdownForm({
  countdown,
  submitting,
  submitLabel,
  onSubmit,
}: {
  countdown?: Countdown;
  submitting: boolean;
  submitLabel: string;
  onSubmit(value: CountdownInput): Promise<void>;
}): React.JSX.Element {
  const form = useForm<CountdownFormValue>({
    defaultValues: {
      title: countdown?.title ?? '',
      note: countdown?.note ?? '',
      targetAt: countdown ? toLocalInput(countdown.targetAt) : defaultTarget(),
      priority: countdown?.priority ?? 50,
    },
  });

  useEffect(() => {
    if (!countdown) return;
    form.reset({
      title: countdown.title,
      note: countdown.note,
      targetAt: toLocalInput(countdown.targetAt),
      priority: countdown.priority,
    });
  }, [countdown, form]);

  return (
    <form
      className="countdown-form"
      onSubmit={(event) =>
        void form.handleSubmit(async (value) => {
          await onSubmit({
            title: value.title.trim(),
            note: value.note.trim(),
            targetAt: new Date(value.targetAt).toISOString(),
            priority: Number(value.priority),
          });
        })(event)
      }
    >
      <label className="field">
        <span>名称</span>
        <div className="input-shell">
          <Flag aria-hidden="true" size={18} />
          <input
            autoFocus
            placeholder="例如：论文初稿完成"
            maxLength={120}
            {...form.register('title', {
              required: '请输入倒计时名称',
              maxLength: { value: 120, message: '名称不能超过 120 个字符' },
            })}
          />
        </div>
        {form.formState.errors.title ? (
          <small className="field-error">{form.formState.errors.title.message}</small>
        ) : null}
      </label>
      <label className="field">
        <span>目标时间</span>
        <div className="input-shell">
          <CalendarClock aria-hidden="true" size={18} />
          <input
            type="datetime-local"
            {...form.register('targetAt', { required: '请选择目标时间' })}
          />
        </div>
        {form.formState.errors.targetAt ? (
          <small className="field-error">{form.formState.errors.targetAt.message}</small>
        ) : null}
      </label>
      <label className="field">
        <span>备注</span>
        <div className="input-shell input-shell--textarea">
          <StickyNote aria-hidden="true" size={18} />
          <textarea
            placeholder="补充这个时间节点的背景或下一步（可选）"
            maxLength={500}
            rows={4}
            {...form.register('note')}
          />
        </div>
      </label>
      <label className="field priority-field">
        <span>
          优先级 <output>{form.watch('priority')}</output>
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="10"
          {...form.register('priority', { valueAsNumber: true })}
        />
        <small>数值只用于相同时间下的排序，不代替时间远近。</small>
      </label>
      <button type="submit" className="button button--primary button--large" disabled={submitting}>
        <Check aria-hidden="true" size={18} /> {submitting ? '正在保存…' : submitLabel}
      </button>
    </form>
  );
}
