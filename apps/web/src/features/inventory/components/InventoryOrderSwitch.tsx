import { Layers3, ListOrdered } from 'lucide-react';
import type { InventoryOrderMode } from '../inventory-layout.js';

const orderOptions: Array<{
  mode: InventoryOrderMode;
  label: string;
  description: string;
  icon: typeof Layers3;
}> = [
  { mode: 'grouped', label: '分组', description: '按分组集中展示', icon: Layers3 },
  { mode: 'all', label: '全部', description: '按最近更新统一排列', icon: ListOrdered },
];

export function InventoryOrderSwitch({
  value,
  onChange,
}: {
  value: InventoryOrderMode;
  onChange(value: InventoryOrderMode): void;
}): React.JSX.Element {
  return (
    <div className="inventory-order-switch" role="group" aria-label="物品排列方式">
      {orderOptions.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.mode}
            type="button"
            className={value === option.mode ? 'active' : ''}
            aria-pressed={value === option.mode}
            title={option.description}
            onClick={() => onChange(option.mode)}
          >
            <Icon aria-hidden="true" size={16} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
