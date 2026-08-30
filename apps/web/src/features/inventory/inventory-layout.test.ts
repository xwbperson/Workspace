import type { InventoryGroup, InventoryItem } from '@workspace/client-sdk';
import { describe, expect, it } from 'vitest';
import { arrangeInventoryItems } from './inventory-layout.js';

const groups: InventoryGroup[] = [
  {
    id: 'group-storage',
    name: '收纳箱',
    position: 0,
    itemCount: 2,
    totalQuantity: 3,
    version: 1,
    createdAt: '2026-08-30T08:00:00.000Z',
    updatedAt: '2026-08-30T08:00:00.000Z',
  },
  {
    id: 'group-desk',
    name: '书桌',
    position: 1,
    itemCount: 1,
    totalQuantity: 1,
    version: 1,
    createdAt: '2026-08-30T08:00:00.000Z',
    updatedAt: '2026-08-30T08:00:00.000Z',
  },
];

function item(id: string, updatedAt: string, group: InventoryItem['group']): InventoryItem {
  return {
    id,
    group,
    name: id,
    purpose: '',
    note: '',
    quantity: 1,
    status: 'active',
    version: 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

const items = [
  item('storage-old', '2026-08-30T08:00:00.000Z', {
    id: 'group-storage',
    name: '收纳箱',
  }),
  item('ungrouped-newest', '2026-08-30T12:00:00.000Z', null),
  item('desk-new', '2026-08-30T11:00:00.000Z', { id: 'group-desk', name: '书桌' }),
  item('storage-new', '2026-08-30T10:00:00.000Z', {
    id: 'group-storage',
    name: '收纳箱',
  }),
];

describe('arrangeInventoryItems', () => {
  it('groups items using group order, keeps recent items first, and puts ungrouped last', () => {
    const sections = arrangeInventoryItems(items, groups, 'grouped');

    expect(sections.map((section) => section.label)).toEqual(['收纳箱', '书桌', '无分组']);
    expect(sections[0]?.items.map((entry) => entry.id)).toEqual(['storage-new', 'storage-old']);
    expect(sections[2]?.items.map((entry) => entry.id)).toEqual(['ungrouped-newest']);
  });

  it('merges all groups and sorts every item by most recent update', () => {
    const sections = arrangeInventoryItems(items, groups, 'all');

    expect(sections).toHaveLength(1);
    expect(sections[0]?.items.map((entry) => entry.id)).toEqual([
      'ungrouped-newest',
      'desk-new',
      'storage-new',
      'storage-old',
    ]);
  });
});
