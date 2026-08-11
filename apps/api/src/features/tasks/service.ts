import { randomUUID } from 'node:crypto';
import type {
  Task,
  TaskCompletion,
  TaskInput,
  TaskRecurrence,
  TaskUpdateInput,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import { toTask, type TaskRepository, type TaskRow } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && normalized.length === 0) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_TASK',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function dueAt(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'INVALID_TASK_DUE_AT', '截止时间无效。');
  }
  return parsed;
}

function validateRecurrence(recurrence: TaskRecurrence, due: Date | null): void {
  if (recurrence !== 'none' && !due) {
    throw new AppError(400, 'TASK_RECURRENCE_REQUIRES_DUE_AT', '重复任务必须设置截止时间。');
  }
}

function nextDueAt(current: Date, recurrence: Exclude<TaskRecurrence, 'none'>): Date {
  const next = new Date(current);
  if (recurrence === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  if (recurrence === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  if (recurrence === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  if (recurrence === 'yearly') next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

export class TaskService {
  public constructor(
    private readonly repository: TaskRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: {
    status?: TaskRow['status'] | 'open';
    limit?: number;
  }): Promise<{ items: Task[] }> {
    return {
      items: (
        await this.repository.list(input.status ?? 'open', Math.min(500, input.limit ?? 200))
      ).map(toTask),
    };
  }

  public async get(id: string): Promise<Task> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该任务。');
    return toTask(row);
  }

  public async create(input: TaskInput): Promise<Task> {
    const now = this.now();
    const due = dueAt(input.dueAt);
    const recurrence = input.recurrence ?? 'none';
    validateRecurrence(recurrence, due);
    const parentId = input.parentId ?? null;
    await this.ensureParent(parentId);
    return toTask(
      await this.repository.create({
        id: randomUUID(),
        title: text(input.title, '任务标题', 240, true),
        description: text(input.description, '任务说明', 20_000),
        status: input.status ?? 'todo',
        archivedFromStatus: null,
        priority: input.priority ?? 'medium',
        dueAt: due,
        recurrence,
        parentId,
        recurrenceSourceId: null,
        completedAt: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async update(id: string, input: TaskUpdateInput): Promise<Task> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该任务。');
    if (input.status === 'completed' && existing.status !== 'completed') {
      throw new ConflictError('请使用“完成任务”操作，以便正确生成下一次重复任务。', {
        currentVersion: existing.version,
      });
    }
    const parentId = input.parentId === undefined ? existing.parentId : input.parentId;
    await this.ensureParent(parentId, id);
    const due = input.dueAt === undefined ? existing.dueAt : dueAt(input.dueAt);
    const recurrence = input.recurrence ?? existing.recurrence;
    validateRecurrence(recurrence, due);
    const updated = await this.repository.update(
      {
        ...existing,
        title:
          input.title === undefined ? existing.title : text(input.title, '任务标题', 240, true),
        description:
          input.description === undefined
            ? existing.description
            : text(input.description, '任务说明', 20_000),
        status: input.status ?? existing.status,
        priority: input.priority ?? existing.priority,
        dueAt: due,
        recurrence,
        parentId,
        completedAt: input.status && input.status !== 'completed' ? null : existing.completedAt,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.conflict(id);
    return toTask(updated);
  }

  public async complete(id: string, version: number): Promise<TaskCompletion> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该任务。');
    if (existing.status === 'completed') {
      throw new ConflictError('该任务已经完成。', { currentVersion: existing.version });
    }
    const now = this.now();
    const next =
      existing.recurrence !== 'none' && existing.dueAt
        ? {
            ...existing,
            id: randomUUID(),
            status: 'todo' as const,
            archivedFromStatus: null,
            dueAt: nextDueAt(existing.dueAt, existing.recurrence),
            recurrenceSourceId: existing.id,
            completedAt: null,
            version: 1,
            createdAt: now,
            updatedAt: now,
          }
        : undefined;
    const result = await this.repository.complete({ ...existing, updatedAt: now }, version, next);
    if (!result) throw await this.conflict(id);
    return {
      completed: toTask(result.completed),
      ...(result.next ? { nextTask: toTask(result.next) } : {}),
    };
  }

  public async archive(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该任务。');
    if (!(await this.repository.archive(id, version, this.now()))) throw await this.conflict(id);
  }

  public async restore(id: string, version: number): Promise<Task> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该任务。');
    if (existing.status !== 'archived') {
      throw new ConflictError('该任务尚未归档，无需恢复。', { currentVersion: existing.version });
    }
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) throw await this.conflict(id);
    return toTask(restored);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该任务。');
    if (existing.status !== 'archived') {
      throw new ConflictError('只能永久删除已归档的任务。', { currentVersion: existing.version });
    }
    if (!(await this.repository.deletePermanently(id, version))) throw await this.conflict(id);
  }

  private async ensureParent(parentId: string | null, taskId?: string): Promise<void> {
    if (!parentId) return;
    const visited = new Set<string>();
    let currentId: string | null = parentId;
    while (currentId) {
      if (currentId === taskId || visited.has(currentId)) {
        throw new ConflictError('任务层级不能形成循环。');
      }
      visited.add(currentId);
      const parent = await this.repository.get(currentId);
      if (!parent || parent.status === 'archived') {
        throw new AppError(400, 'INVALID_TASK_PARENT', '父任务不存在或已经归档。');
      }
      currentId = parent.parentId;
    }
  }

  private async conflict(id: string): Promise<ConflictError> {
    return new ConflictError('任务已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
