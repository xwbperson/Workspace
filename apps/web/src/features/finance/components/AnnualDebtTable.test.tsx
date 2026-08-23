import type { FinanceDebtRecord } from '@workspace/client-sdk';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnnualDebtTable } from './AnnualDebtTable.js';

const records: FinanceDebtRecord[] = [
  {
    id: 'r1',
    platformId: 'p1',
    platformName: '信用卡',
    year: 2026,
    month: 8,
    amount: 2500,
    version: 2,
    updatedAt: '2026-08-12T00:00:00.000Z',
  },
  {
    id: 'r2',
    platformId: 'p2',
    platformName: '消费贷',
    year: 2026,
    month: 0,
    amount: 300,
    version: 1,
    updatedAt: '2026-08-12T00:00:00.000Z',
  },
];

describe('AnnualDebtTable', () => {
  it('shows every month, unbilled debt, platform totals and the year total', () => {
    render(
      <AnnualDebtTable
        year={2026}
        onYearChange={vi.fn()}
        platforms={[
          { id: 'p1', name: '信用卡' },
          { id: 'p2', name: '消费贷' },
        ]}
        records={records}
        saving={false}
        onSave={vi.fn(async () => undefined)}
      />,
    );

    const table = screen.getByRole('table', { name: '2026 年负债表' });
    expect(within(table).getAllByRole('row')).toHaveLength(15);
    expect(within(table).getByText('1月')).toBeInTheDocument();
    expect(within(table).getByText('12月')).toBeInTheDocument();
    expect(within(table).getByText('未入账')).toBeInTheDocument();
    expect(within(table).getByText('总计')).toBeInTheDocument();
    expect(within(table).getByText('¥2,800.00')).toBeInTheDocument();
  });

  it('saves an edited annual-table cell with its concurrency version', async () => {
    const onSave = vi.fn(async () => undefined);
    render(
      <AnnualDebtTable
        year={2026}
        onYearChange={vi.fn()}
        platforms={[{ id: 'p1', name: '信用卡' }]}
        records={records.filter((record) => record.platformId === 'p1')}
        saving={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑年度负债' }));
    const cell = screen.getByLabelText('8月 信用卡 负债');
    fireEvent.change(cell, { target: { value: '2300' } });
    fireEvent.blur(cell);

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        platformId: 'p1',
        year: 2026,
        month: 8,
        amount: 2300,
        version: 2,
      }),
    );
  });

  it('keeps a failed amount edit visible so the user can retry it', async () => {
    const onSave = vi.fn(async () => Promise.reject(new Error('保存失败')));
    render(
      <AnnualDebtTable
        year={2026}
        onYearChange={vi.fn()}
        platforms={[{ id: 'p1', name: '信用卡' }]}
        records={records.filter((record) => record.platformId === 'p1')}
        saving={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑年度负债' }));
    fireEvent.change(screen.getByLabelText('8月 信用卡 负债'), { target: { value: '2300' } });
    fireEvent.click(screen.getByRole('button', { name: '完成年度负债编辑' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('保存失败');
    expect(screen.getByLabelText('8月 信用卡 负债')).toHaveValue(2300);
    expect(screen.getByRole('button', { name: '完成年度负债编辑' })).toBeInTheDocument();
  });

  it('waits for dirty cells to save before leaving edit mode', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <AnnualDebtTable
        year={2026}
        onYearChange={vi.fn()}
        platforms={[{ id: 'p1', name: '信用卡' }]}
        records={records.filter((record) => record.platformId === 'p1')}
        saving={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '编辑年度负债' }));
    fireEvent.change(screen.getByLabelText('8月 信用卡 负债'), { target: { value: '2300' } });
    fireEvent.click(screen.getByRole('button', { name: '完成年度负债编辑' }));

    expect(screen.getByRole('button', { name: '完成年度负债编辑' })).toHaveTextContent('正在保存');
    expect(screen.getByLabelText('8月 信用卡 负债')).toHaveValue(2300);
    resolveSave?.();
    await waitFor(() => expect(screen.queryByLabelText('8月 信用卡 负债')).not.toBeInTheDocument());
  });

  it('changes the year from the annual table toolbar', () => {
    const onYearChange = vi.fn();
    render(
      <AnnualDebtTable
        year={2026}
        onYearChange={onYearChange}
        platforms={[{ id: 'p1', name: '信用卡' }]}
        records={[]}
        saving={false}
        onSave={vi.fn(async () => undefined)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '查看下一年负债' }));
    expect(onYearChange).toHaveBeenCalledWith(2027);
  });
});
