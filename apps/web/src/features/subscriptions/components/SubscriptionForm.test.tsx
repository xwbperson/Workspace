import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionForm } from './SubscriptionForm.js';

describe('SubscriptionForm', () => {
  it('submits a quarterly subscription from the visible form', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<SubscriptionForm submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('订阅名称'), { target: { value: '云服务器' } });
    fireEvent.change(screen.getByLabelText('分类'), { target: { value: 'server' } });
    fireEvent.change(screen.getByLabelText('金额'), { target: { value: '360' } });
    fireEvent.change(screen.getByLabelText('计费周期'), { target: { value: 'quarterly' } });
    fireEvent.change(screen.getByLabelText('续费日期'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: '添加订阅' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '云服务器',
        category: 'server',
        amount: 360,
        billingCycle: 'quarterly',
        renewalDate: '2026-10-01',
      }),
    );
  });
});
