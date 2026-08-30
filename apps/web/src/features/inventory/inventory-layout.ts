import type { InventoryGroup, InventoryItem } from '@workspace/client-sdk';

export type InventoryOrderMode = 'grouped' | 'all';

export interface InventoryItemSection {
  key: string;
  label: string;
  items: InventoryItem[];
}

function byMostRecentlyUpdated(left: InventoryItem, right: InventoryItem): number {
  const updatedDifference = Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  return updatedDifference || left.id.localeCompare(right.id);
}

export function arrangeInventoryItems(
  items: InventoryItem[],
  groups: InventoryGroup[],
  mode: InventoryOrderMode,
): InventoryItemSection[] {
  const recentItems = [...items].sort(byMostRecentlyUpdated);
  if (mode === 'all') {
    return recentItems.length ? [{ key: 'all', label: '全部物品', items: recentItems }] : [];
  }

  const buckets = new Map<string, InventoryItemSection>();
  for (const item of recentItems) {
    const key = item.group?.id ?? 'ungrouped';
    const current = buckets.get(key) ?? {
      key,
      label: item.group?.name ?? '无分组',
      items: [],
    };
    current.items.push(item);
    buckets.set(key, current);
  }

  const sections: InventoryItemSection[] = [];
  for (const group of groups) {
    const section = buckets.get(group.id);
    if (!section) continue;
    sections.push({ ...section, label: group.name });
    buckets.delete(group.id);
  }

  const ungrouped = buckets.get('ungrouped');
  buckets.delete('ungrouped');
  sections.push(
    ...[...buckets.values()].sort((left, right) => left.label.localeCompare(right.label)),
  );
  if (ungrouped) sections.push(ungrouped);
  return sections;
}
