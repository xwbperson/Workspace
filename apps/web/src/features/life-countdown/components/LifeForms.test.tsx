import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LifeEventForm, LifeProfileForm } from './LifeForms.js';

describe('Life countdown forms', () => {
  it('submits profile parameters and a personal event', async () => {
    const profileSubmit = vi.fn(async () => undefined);
    const { unmount } = render(
      <LifeProfileForm
        profile={{
          birthDate: null,
          expectedAge: 80,
          expectedEndDate: null,
          version: 1,
          updatedAt: '2026-08-11T00:00:00.000Z',
        }}
        submitting={false}
        onSubmit={profileSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('出生日期'), { target: { value: '1998-05-20' } });
    fireEvent.change(screen.getByLabelText('预期寿命'), { target: { value: '85' } });
    fireEvent.click(screen.getByRole('button', { name: '保存人生参数' }));
    await waitFor(() =>
      expect(profileSubmit).toHaveBeenCalledWith({
        birthDate: '1998-05-20',
        expectedAge: 85,
        version: 1,
      }),
    );
    unmount();

    const eventSubmit = vi.fn(async () => undefined);
    render(<LifeEventForm submitting={false} onSubmit={eventSubmit} />);
    fireEvent.change(screen.getByLabelText('事件名称'), { target: { value: '毕业' } });
    fireEvent.change(screen.getByLabelText('目标时间'), { target: { value: '2027-06-30T12:00' } });
    fireEvent.click(screen.getByRole('button', { name: '添加事件' }));
    await waitFor(() =>
      expect(eventSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: '毕业' })),
    );
  });
});
