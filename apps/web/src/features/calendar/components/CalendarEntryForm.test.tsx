import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarEntryForm } from './CalendarEntryForm.js';

describe('CalendarEntryForm', () => {
  it('submits a journal entry without schedule times', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<CalendarEntryForm defaultDate="2026-08-18" submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('记录类型'), { target: { value: 'journal' } });
    fireEvent.change(screen.getByLabelText('标题'), { target: { value: '今日记录' } });
    fireEvent.change(screen.getByLabelText('日记正文'), { target: { value: '完成数据清洗。' } });
    fireEvent.click(screen.getByRole('button', { name: '添加日记' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'journal',
        entryDate: '2026-08-18',
        startsAt: null,
        endsAt: null,
      }),
    );
  });
});
