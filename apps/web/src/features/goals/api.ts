import type {
  GoalInput,
  GoalMeasurementInput,
  GoalStatus,
  GoalUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const goalKeys = {
  all: ['goals'] as const,
  list: (status: GoalStatus) => ['goals', 'list', status] as const,
  detail: (id: string) => ['goals', 'detail', id] as const,
};

export async function invalidateGoalData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: goalKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}

export const goalApi = {
  list(status: GoalStatus) {
    return workbenchClient.getGoals({ status, limit: 100 });
  },
  get(id: string) {
    return workbenchClient.getGoal(id);
  },
  create(input: GoalInput) {
    return workbenchClient.createGoal(input);
  },
  update(id: string, input: GoalUpdateInput) {
    return workbenchClient.updateGoal(id, input);
  },
  addMeasurement(id: string, input: GoalMeasurementInput) {
    return workbenchClient.addGoalMeasurement(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveGoal(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreGoal(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteGoalPermanently(id, version);
  },
};
