import type { CountdownInput, CountdownUpdateInput } from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const countdownKeys = {
  all: ['countdowns'] as const,
  list: (status: string) => ['countdowns', 'list', status] as const,
  detail: (id: string) => ['countdowns', 'detail', id] as const,
};

export async function invalidateCountdownData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: countdownKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'notifications'] }),
  ]);
}

export const countdownApi = {
  list(status: 'active' | 'completed') {
    return workbenchClient.getCountdowns({ status, limit: 50 });
  },
  get(id: string) {
    return workbenchClient.getCountdown(id);
  },
  create(input: CountdownInput) {
    return workbenchClient.createCountdown(input);
  },
  update(id: string, input: CountdownUpdateInput) {
    return workbenchClient.updateCountdown(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveCountdown(id, version);
  },
};
