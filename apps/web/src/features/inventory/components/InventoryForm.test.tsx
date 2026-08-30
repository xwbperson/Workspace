import { fireEvent, render, screen } from '@testing-library/react';
import type { InventoryGroup } from '@workspace/client-sdk';
import { describe, expect, it, vi } from 'vitest';
import { InventoryForm } from './InventoryForm.js';

const group: InventoryGroup = {
  id: '00000000-0000-4000-8000-000000000501',
  name: '收纳箱',
  position: 0,
  itemCount: 0,
  totalQuantity: 0,
  version: 1,
  createdAt: '2026-08-30T00:00:00.000Z',
  updatedAt: '2026-08-30T00:00:00.000Z',
};

describe('InventoryForm', () => {
  it('submits an optional group and allows an initial quantity of zero', () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<InventoryForm groups={[group]} submitting={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('物品名称'), { target: { value: '备用数据线' } });
    fireEvent.change(screen.getByLabelText('分组'), { target: { value: group.id } });
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('物品用途'), { target: { value: '连接硬盘' } });
    fireEvent.change(screen.getByLabelText('备注'), { target: { value: '透明袋内' } });
    fireEvent.click(screen.getByRole('button', { name: '添加物品' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: '备用数据线',
      groupId: group.id,
      quantity: 0,
      purpose: '连接硬盘',
      note: '透明袋内',
    });
  });

  it('starts clean each time the create form is mounted', () => {
    const onSubmit = vi.fn(async () => undefined);
    const first = render(<InventoryForm groups={[]} submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('物品名称'), { target: { value: '上次内容' } });
    first.unmount();

    render(<InventoryForm groups={[]} submitting={false} onSubmit={onSubmit} />);
    expect(screen.getByLabelText('物品名称')).toHaveValue('');
    expect(screen.getByLabelText('数量')).toHaveValue(1);
    expect(screen.getByLabelText('分组')).toHaveValue('');
  });
});
