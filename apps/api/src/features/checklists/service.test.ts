import { describe, expect, it, vi } from 'vitest';
import type { ChecklistItemRow, ChecklistRepository, ChecklistRow } from './repository.js';
import { ChecklistService } from './service.js';

const now = new Date('2030-01-01T00:00:00.000Z');

function checklist(id: string): ChecklistRow {
  return {
    id,
    name: `清单 ${id}`,
    note: '',
    status: 'active',
    archivedFromStatus: null,
    position: 0,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

function item(checklistId: string): ChecklistItemRow {
  return {
    id: `item-${checklistId}`,
    checklistId,
    name: '条目',
    note: '',
    quantity: null,
    unit: '',
    priceCents: null,
    checkedAt: null,
    position: 0,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
}

describe('ChecklistService batch hydration', () => {
  it('loads items for a list with one bulk repository call', async () => {
    const rows = [checklist('checklist-1'), checklist('checklist-2')];
    const itemsForChecklists = vi.fn().mockResolvedValue(
      new Map([
        ['checklist-1', [item('checklist-1')]],
        ['checklist-2', [item('checklist-2')]],
      ]),
    );
    const items = vi.fn();
    const repository = {
      list: vi.fn().mockResolvedValue(rows),
      itemsForChecklists,
      items,
    } as unknown as ChecklistRepository;
    const service = new ChecklistService(repository);

    const result = await service.list({ status: 'active' });

    expect(result.items).toHaveLength(2);
    expect(result.items[0]?.items).toHaveLength(1);
    expect(itemsForChecklists).toHaveBeenCalledOnce();
    expect(itemsForChecklists).toHaveBeenCalledWith(['checklist-1', 'checklist-2']);
    expect(items).not.toHaveBeenCalled();
  });
});
