import type {
  ChecklistInput,
  ChecklistItemInput,
  ChecklistItemUpdateInput,
  ChecklistStatus,
  ChecklistUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const checklistKeys = {
  all: ['checklists'] as const,
  list: (status: ChecklistStatus) => ['checklists', 'list', status] as const,
  detail: (id: string) => ['checklists', 'detail', id] as const,
};

export async function invalidateChecklistData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: checklistKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}

export const checklistApi = {
  list(status: ChecklistStatus) {
    return workbenchClient.getChecklists({ status, limit: 500 });
  },
  get(id: string) {
    return workbenchClient.getChecklist(id);
  },
  create(input: ChecklistInput) {
    return workbenchClient.createChecklist(input);
  },
  update(id: string, input: ChecklistUpdateInput) {
    return workbenchClient.updateChecklist(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveChecklist(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreChecklist(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteChecklistPermanently(id, version);
  },
  createItem(checklistId: string, input: ChecklistItemInput) {
    return workbenchClient.createChecklistItem(checklistId, input);
  },
  updateItem(checklistId: string, itemId: string, input: ChecklistItemUpdateInput) {
    return workbenchClient.updateChecklistItem(checklistId, itemId, input);
  },
  checkItem(checklistId: string, itemId: string, checked: boolean, version: number) {
    return workbenchClient.checkChecklistItem(checklistId, itemId, checked, version);
  },
  deleteItem(checklistId: string, itemId: string, version: number) {
    return workbenchClient.deleteChecklistItem(checklistId, itemId, version);
  },
  reset(id: string, version: number) {
    return workbenchClient.resetChecklist(id, version);
  },
  clearChecked(id: string, version: number) {
    return workbenchClient.clearCheckedChecklistItems(id, version);
  },
};
