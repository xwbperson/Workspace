import { LayoutGrid, Rows3 } from 'lucide-react';

export type InventoryViewMode = 'cards' | 'list';

const viewOptions: Array<{
  mode: InventoryViewMode;
  label: string;
  icon: typeof LayoutGrid;
}> = [
  { mode: 'cards', label: '卡片', icon: LayoutGrid },
  { mode: 'list', label: '列表', icon: Rows3 },
];

export function InventoryViewSwitch({
  value,
  onChange,
}: {
  value: InventoryViewMode;
  onChange(value: InventoryViewMode): void;
}): React.JSX.Element {
  return (
    <div className="inventory-view-switch" role="group" aria-label="物品展示方式">
      {viewOptions.map((option) => {
        const Icon = option.icon;
        return (
          <button
            key={option.mode}
            type="button"
            className={value === option.mode ? 'active' : ''}
            aria-label={`${option.label}视图`}
            aria-pressed={value === option.mode}
            title={`${option.label}视图`}
            onClick={() => onChange(option.mode)}
          >
            <Icon aria-hidden="true" size={17} />
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
