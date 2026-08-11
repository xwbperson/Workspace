import type { InboxItemInput, InboxItemStatus, InboxItemUpdateInput } from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const inboxKeys = {
  all: ['inbox'] as const,
  list: (status: InboxItemStatus) => ['inbox', 'list', status] as const,
  detail: (id: string) => ['inbox', 'detail', id] as const,
};
export async function invalidateInboxData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: inboxKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}
export const inboxApi = {
  list(status: InboxItemStatus) {
    return workbenchClient.getInboxItems({ status, limit: 500 });
  },
  get(id: string) {
    return workbenchClient.getInboxItem(id);
  },
  create(input: InboxItemInput) {
    return workbenchClient.createInboxItem(input);
  },
  update(id: string, input: InboxItemUpdateInput) {
    return workbenchClient.updateInboxItem(id, input);
  },
  uploadFile(file: File) {
    return workbenchClient.uploadFile(file);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveInboxItem(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreInboxItem(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteInboxItemPermanently(id, version);
  },
};
