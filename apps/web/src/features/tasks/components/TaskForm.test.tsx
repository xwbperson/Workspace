import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskForm } from './TaskForm.js';

describe('TaskForm', () => {
  it('requires a due date for a repeated subtask and submits its parent', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(
      <TaskForm
        parentTasks={[
          {
            id: 'parent-task',
            title: '父任务',
            description: '',
            status: 'todo',
            priority: 'medium',
            recurrence: 'none',
            parentId: null,
            recurrenceSourceId: null,
            version: 1,
            createdAt: '2026-08-11T00:00:00.000Z',
            updatedAt: '2026-08-11T00:00:00.000Z',
          },
        ]}
        defaultParentId="parent-task"
        submitting={false}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByLabelText('任务标题'), { target: { value: '每周整理' } });
    fireEvent.change(screen.getByLabelText('重复规则'), { target: { value: 'weekly' } });
    expect(screen.getByRole('button', { name: '创建任务' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('截止时间'), {
      target: { value: '2026-08-16T20:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建任务' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '每周整理',
        parentId: 'parent-task',
        recurrence: 'weekly',
      }),
    );
  });
});
