import type { ChecklistItem, ChecklistItemInput } from '@workspace/client-sdk';
import { Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function ChecklistItemForm({
  item,
  submitting,
  onSubmit,
}: {
  item?: ChecklistItem;
  submitting: boolean;
  onSubmit(input: ChecklistItemInput): Promise<void>;
}): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(item?.name ?? '');
  const [note, setNote] = useState(item?.note ?? '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(item?.unit ?? '');
  const [price, setPrice] = useState(item?.price?.toString() ?? '');

  useEffect(() => {
    setName(item?.name ?? '');
    setNote(item?.note ?? '');
    setQuantity(item?.quantity?.toString() ?? '');
    setUnit(item?.unit ?? '');
    setPrice(item?.price?.toString() ?? '');
  }, [item]);

  async function submit(): Promise<void> {
    const normalizedName = name.trim();
    if (!normalizedName || submitting) return;
    const input: ChecklistItemInput = {
      name: normalizedName,
      note: note.trim(),
      quantity: quantity.trim() ? Number(quantity) : null,
      unit: unit.trim(),
      price: price.trim() ? Number(price) : null,
    };
    await onSubmit(input);
    if (!item) {
      setName('');
      setNote('');
      setQuantity('');
      setUnit('');
      setPrice('');
      inputRef.current?.focus();
    }
  }

  return (
    <form
      className={`checklist-item-form ${item ? 'checklist-item-form--edit' : ''}`}
      onSubmit={(event) => {
        event.preventDefault();
        void submit().catch(() => undefined);
      }}
    >
      <div className="checklist-item-form__primary">
        <label
          className="sr-only"
          htmlFor={item ? `checklist-item-${item.id}` : 'checklist-item-new'}
        >
          条目名称
        </label>
        <input
          ref={inputRef}
          id={item ? `checklist-item-${item.id}` : 'checklist-item-new'}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="输入条目后按回车继续添加"
          maxLength={240}
          autoFocus={!item}
          required
        />
        <button type="submit" className="button button--primary" disabled={submitting}>
          {!item ? <Plus size={17} aria-hidden="true" /> : null}
          {item ? '保存条目' : '添加条目'}
        </button>
      </div>
      <div className="checklist-item-form__details">
        <label>
          <span>数量</span>
          <input
            type="number"
            min="0.001"
            max="999999"
            step="0.001"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="可选"
          />
        </label>
        <label>
          <span>单位</span>
          <input
            value={unit}
            maxLength={20}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="个、盒、kg"
          />
        </label>
        <label>
          <span>单价</span>
          <input
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="可选"
          />
        </label>
        <label className="checklist-item-form__note">
          <span>条目备注</span>
          <input
            value={note}
            maxLength={2000}
            onChange={(event) => setNote(event.target.value)}
            placeholder="规格、来源或观看顺序等"
          />
        </label>
      </div>
    </form>
  );
}
