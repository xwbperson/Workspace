import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChecklistItemForm } from './ChecklistItemForm.js';

describe('ChecklistItemForm', () => {
  it('adds an item with Enter, clears the form and keeps focus for continuous entry', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<ChecklistItemForm submitting={false} onSubmit={onSubmit} />);
    const name = screen.getByLabelText('条目名称');
    fireEvent.change(name, { target: { value: '牛奶' } });
    fireEvent.submit(name.closest('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: '牛奶' }));
    expect(name).toHaveValue('');
    expect(name).toHaveFocus();
  });

  it('submits optional note, quantity, unit and price details', async () => {
    const onSubmit = vi.fn(async () => undefined);
    render(<ChecklistItemForm submitting={false} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText('条目名称'), { target: { value: '苹果' } });
    fireEvent.click(screen.getByRole('button', { name: '补充数量、价格或备注' }));
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '2.5' } });
    fireEvent.change(screen.getByLabelText('单位'), { target: { value: 'kg' } });
    fireEvent.change(screen.getByLabelText('单价'), { target: { value: '8.8' } });
    fireEvent.change(screen.getByLabelText('条目备注'), { target: { value: '选脆甜的' } });
    fireEvent.click(screen.getByRole('button', { name: '添加条目' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        name: '苹果',
        note: '选脆甜的',
        quantity: 2.5,
        unit: 'kg',
        price: 8.8,
      }),
    );
  });
});
