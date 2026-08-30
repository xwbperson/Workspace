import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QuantityStepper } from './QuantityStepper.js';

describe('QuantityStepper', () => {
  it('adjusts by one and disables decrement at zero without hiding the item', () => {
    const onAdjust = vi.fn();
    const { rerender } = render(
      <QuantityStepper itemName="备用电池" quantity={2} onAdjust={onAdjust} />,
    );

    fireEvent.click(screen.getByRole('button', { name: '减少备用电池数量' }));
    fireEvent.click(screen.getByRole('button', { name: '增加备用电池数量' }));
    expect(onAdjust).toHaveBeenNthCalledWith(1, -1);
    expect(onAdjust).toHaveBeenNthCalledWith(2, 1);

    rerender(<QuantityStepper itemName="备用电池" quantity={0} onAdjust={onAdjust} />);
    expect(screen.getByText('0')).toBeVisible();
    expect(screen.getByText('数量为 0')).toBeVisible();
    expect(screen.getByRole('button', { name: '减少备用电池数量' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '增加备用电池数量' })).toBeEnabled();
  });
});
