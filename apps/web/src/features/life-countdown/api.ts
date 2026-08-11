import type { LifeEventInput, LifeEventUpdateInput, LifeProfileInput } from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';
export const lifeKeys = {
  all: ['life-countdown'] as const,
  dashboard: (status: 'active' | 'archived') => ['life-countdown', status] as const,
};
export async function invalidateLifeData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: lifeKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}
export const lifeApi = {
  dashboard(status: 'active' | 'archived') {
    return workbenchClient.getLifeCountdown(status);
  },
  updateProfile(input: LifeProfileInput) {
    return workbenchClient.updateLifeProfile(input);
  },
  createEvent(input: LifeEventInput) {
    return workbenchClient.createLifeEvent(input);
  },
  updateEvent(id: string, input: LifeEventUpdateInput) {
    return workbenchClient.updateLifeEvent(id, input);
  },
  archiveEvent(id: string, version: number) {
    return workbenchClient.archiveLifeEvent(id, version);
  },
  restoreEvent(id: string, version: number) {
    return workbenchClient.restoreLifeEvent(id, version);
  },
  deleteEvent(id: string, version: number) {
    return workbenchClient.deleteLifeEventPermanently(id, version);
  },
};
