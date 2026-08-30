import { Minus, Plus } from 'lucide-react';

export function QuantityStepper({
  itemName,
  quantity,
  disabled = false,
  onAdjust,
}: {
  itemName: string;
  quantity: number;
  disabled?: boolean;
  onAdjust(delta: -1 | 1): void;
}): React.JSX.Element {
  return (
    <div className={`inventory-stepper ${quantity === 0 ? 'inventory-stepper--zero' : ''}`}>
      <button
        type="button"
        className="inventory-stepper__button"
        aria-label={`减少${itemName}数量`}
        disabled={disabled || quantity === 0}
        onClick={() => onAdjust(-1)}
      >
        <Minus aria-hidden="true" size={19} />
      </button>
      <div className="inventory-stepper__value" aria-live="polite" aria-atomic="true">
        <strong>{quantity}</strong>
        <span>{quantity === 0 ? '数量为 0' : '当前数量'}</span>
      </div>
      <button
        type="button"
        className="inventory-stepper__button"
        aria-label={`增加${itemName}数量`}
        disabled={disabled || quantity >= 999_999}
        onClick={() => onAdjust(1)}
      >
        <Plus aria-hidden="true" size={19} />
      </button>
    </div>
  );
}
