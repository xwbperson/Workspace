import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryViewSwitch } from './InventoryViewSwitch.js';

describe('InventoryViewSwitch', () => {
  it('shows the selected view and switches to list view', () => {
    const onChange = vi.fn();
    render(<InventoryViewSwitch value="cards" onChange={onChange} />);

    expect(screen.getByRole('button', { name: '卡片视图' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '列表视图' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    fireEvent.click(screen.getByRole('button', { name: '列表视图' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });
});
