import type { TaskInput, TaskStatus, TaskUpdateInput } from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const taskKeys = {
  all: ['tasks'] as const,
  list: (status: TaskStatus | 'open') => ['tasks', 'list', status] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
};

export async function invalidateTaskData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: taskKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}

export const taskApi = {
  list(status: TaskStatus | 'open') {
    return workbenchClient.getTasks({ status, limit: 500 });
  },
  get(id: string) {
    return workbenchClient.getTask(id);
  },
  create(input: TaskInput) {
    return workbenchClient.createTask(input);
  },
  update(id: string, input: TaskUpdateInput) {
    return workbenchClient.updateTask(id, input);
  },
  complete(id: string, version: number) {
    return workbenchClient.completeTask(id, version);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveTask(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreTask(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteTaskPermanently(id, version);
  },
};
