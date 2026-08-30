import type { InventoryGroup, InventoryItem, InventoryItemInput } from '@workspace/client-sdk';
import { useState } from 'react';

export function InventoryForm({
  groups,
  item,
  submitting,
  onSubmit,
}: {
  groups: InventoryGroup[];
  item?: InventoryItem;
  submitting: boolean;
  onSubmit(input: InventoryItemInput): Promise<void>;
}): React.JSX.Element {
  const [name, setName] = useState(item?.name ?? '');
  const [purpose, setPurpose] = useState(item?.purpose ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [quantity, setQuantity] = useState(String(item?.quantity ?? 1));
  const [groupId, setGroupId] = useState(item?.group?.id ?? '');

  return (
    <form
      className="entity-form inventory-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || submitting) return;
        void onSubmit({
          name: name.trim(),
          purpose: purpose.trim(),
          note: note.trim(),
          quantity: Number(quantity),
          groupId: groupId || null,
        }).catch(() => undefined);
      }}
    >
      <div className="entity-form__grid">
        <label className="field entity-form__wide">
          <span>物品名称</span>
          <input
            required
            autoFocus
            maxLength={120}
            value={name}
            placeholder="例如：备用数据线"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="field">
          <span>分组</span>
          <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
            <option value="">无分组</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>数量</span>
          <input
            required
            type="number"
            min="0"
            max="999999"
            step="1"
            inputMode="numeric"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>物品用途</span>
          <input
            maxLength={500}
            value={purpose}
            placeholder="它主要用来做什么（可选）"
            onChange={(event) => setPurpose(event.target.value)}
          />
        </label>
        <label className="field entity-form__wide">
          <span>备注</span>
          <textarea
            rows={4}
            maxLength={2000}
            value={note}
            placeholder="位置、规格或其他说明（可选）"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>
      <div className="entity-form__actions">
        <button className="button button--primary" type="submit" disabled={submitting}>
          {submitting ? '正在保存…' : item ? '保存修改' : '添加物品'}
        </button>
      </div>
    </form>
  );
}
