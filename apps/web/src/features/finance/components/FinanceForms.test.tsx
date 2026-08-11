import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  FinanceAccountForm,
  FinanceDebtPlatformForm,
  FinanceDebtRecordForm,
} from './FinanceForms.js';

describe('Finance forms', () => {
  it('submits an account, platform, and monthly debt record', async () => {
    const accountSubmit = vi.fn(async () => undefined);
    const { unmount } = render(<FinanceAccountForm submitting={false} onSubmit={accountSubmit} />);
    fireEvent.change(screen.getByLabelText('账户名称'), { target: { value: '工资卡' } });
    fireEvent.change(screen.getByLabelText('账户余额'), { target: { value: '10000' } });
    fireEvent.click(screen.getByRole('button', { name: '添加账户' }));
    await waitFor(() =>
      expect(accountSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: '工资卡', balance: 10000 }),
      ),
    );
    unmount();

    const platformSubmit = vi.fn(async () => undefined);
    const platformRender = render(
      <FinanceDebtPlatformForm submitting={false} onSubmit={platformSubmit} />,
    );
    fireEvent.change(screen.getByLabelText('平台名称'), { target: { value: '信用卡' } });
    fireEvent.change(screen.getByLabelText('固定额度'), { target: { value: '20000' } });
    fireEvent.click(screen.getByRole('button', { name: '添加平台' }));
    await waitFor(() =>
      expect(platformSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ name: '信用卡', fixedLimit: 20000 }),
      ),
    );
    platformRender.unmount();

    const recordSubmit = vi.fn(async () => undefined);
    render(
      <FinanceDebtRecordForm
        platforms={[{ id: 'p1', name: '信用卡' }]}
        year={2026}
        month={8}
        submitting={false}
        onSubmit={recordSubmit}
      />,
    );
    fireEvent.change(screen.getByLabelText('本月负债'), { target: { value: '2500' } });
    fireEvent.click(screen.getByRole('button', { name: '保存月度负债' }));
    await waitFor(() =>
      expect(recordSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ platformId: 'p1', year: 2026, month: 8, amount: 2500 }),
      ),
    );
  });
});
