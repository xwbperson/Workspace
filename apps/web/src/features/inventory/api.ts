import type {
  InventoryGroupInput,
  InventoryGroupUpdateInput,
  InventoryItemInput,
  InventoryItemStatus,
  InventoryItemUpdateInput,
  InventoryStockFilter,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const inventoryKeys = {
  all: ['inventory'] as const,
  groups: ['inventory', 'groups'] as const,
  items: (
    status: InventoryItemStatus,
    stock: InventoryStockFilter,
    groupId: string | undefined,
    query: string,
  ) => ['inventory', 'items', status, stock, groupId ?? 'all', query] as const,
};

export async function invalidateInventoryData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}

export const inventoryApi = {
  groups() {
    return workbenchClient.getInventoryGroups();
  },
  createGroup(input: InventoryGroupInput) {
    return workbenchClient.createInventoryGroup(input);
  },
  updateGroup(id: string, input: InventoryGroupUpdateInput) {
    return workbenchClient.updateInventoryGroup(id, input);
  },
  deleteGroup(id: string, version: number) {
    return workbenchClient.deleteInventoryGroup(id, version);
  },
  items(options: {
    status: InventoryItemStatus;
    stock: InventoryStockFilter;
    groupId?: string;
    query?: string;
  }) {
    return workbenchClient.getInventoryItems({ ...options, limit: 500 });
  },
  createItem(input: InventoryItemInput) {
    return workbenchClient.createInventoryItem(input);
  },
  updateItem(id: string, input: InventoryItemUpdateInput) {
    return workbenchClient.updateInventoryItem(id, input);
  },
  adjustQuantity(id: string, delta: -1 | 1) {
    return workbenchClient.adjustInventoryItemQuantity(id, delta);
  },
  archiveItem(id: string, version: number) {
    return workbenchClient.archiveInventoryItem(id, version);
  },
  restoreItem(id: string, version: number) {
    return workbenchClient.restoreInventoryItem(id, version);
  },
  deleteItem(id: string, version: number) {
    return workbenchClient.deleteInventoryItemPermanently(id, version);
  },
};
