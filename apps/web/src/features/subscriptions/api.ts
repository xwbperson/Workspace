import type {
  SubscriptionInput,
  SubscriptionStatus,
  SubscriptionUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';
export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  list: (status: SubscriptionStatus) => ['subscriptions', 'list', status] as const,
  detail: (id: string) => ['subscriptions', 'detail', id] as const,
};
export async function invalidateSubscriptionData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: subscriptionKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}
export const subscriptionApi = {
  list(status: SubscriptionStatus) {
    return workbenchClient.getSubscriptions({ status, limit: 500 });
  },
  get(id: string) {
    return workbenchClient.getSubscription(id);
  },
  create(input: SubscriptionInput) {
    return workbenchClient.createSubscription(input);
  },
  update(id: string, input: SubscriptionUpdateInput) {
    return workbenchClient.updateSubscription(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveSubscription(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreSubscription(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteSubscriptionPermanently(id, version);
  },
};
