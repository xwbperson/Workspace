import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GoalForm } from './GoalForm.js';

describe('GoalForm', () => {
  it('uses an aligned metric toggle and an accent action for key results', () => {
    render(<GoalForm submitting={false} onSubmit={vi.fn(async () => undefined)} />);

    expect(screen.getByLabelText('这是一个可记录数值的目标').closest('label')).toHaveClass(
      'goal-metric-toggle',
    );
    expect(screen.getByRole('button', { name: '添加关键结果' })).toHaveClass('button--accent');
  });

  it('submits a metric-backed quarterly goal from the user-facing form', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<GoalForm submitting={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('目标名称'), { target: { value: '减重目标' } });
    fireEvent.change(screen.getByLabelText('周期名称'), { target: { value: '2026 Q3' } });
    fireEvent.click(screen.getByLabelText('这是一个可记录数值的目标'));
    fireEvent.change(screen.getByLabelText('起始值'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('目标值'), { target: { value: '70' } });
    fireEvent.change(screen.getByLabelText('当前值'), { target: { value: '78' } });
    fireEvent.change(screen.getByLabelText('单位'), { target: { value: 'kg' } });
    fireEvent.change(screen.getByLabelText('变化方向'), { target: { value: 'decrease' } });
    fireEvent.click(screen.getByRole('button', { name: '创建目标' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '减重目标',
        periodType: 'quarterly',
        periodLabel: '2026 Q3',
        metric: {
          startValue: 80,
          targetValue: 70,
          currentValue: 78,
          unit: 'kg',
          direction: 'decrease',
        },
      }),
    );
  });
});
