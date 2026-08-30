import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InventoryOrderSwitch } from './InventoryOrderSwitch.js';

describe('InventoryOrderSwitch', () => {
  it('defaults visibly to grouped mode and can select all items', () => {
    const onChange = vi.fn();
    render(<InventoryOrderSwitch value="grouped" onChange={onChange} />);

    expect(screen.getByRole('button', { name: '分组' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    expect(onChange).toHaveBeenCalledWith('all');
  });
});
