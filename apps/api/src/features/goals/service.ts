import { randomUUID } from 'node:crypto';
import type {
  Goal,
  GoalInput,
  GoalKeyResult,
  GoalMeasurementInput,
  GoalMetric,
  GoalUpdateInput,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import type { GoalRepository, GoalRow } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && normalized.length === 0) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_GOAL',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function date(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new AppError(400, 'INVALID_GOAL_DATE', `${name}不是有效日期。`);
  }
  return value;
}

function metric(value: GoalMetric | null | undefined): GoalMetric | undefined {
  if (value == null) return undefined;
  const numbers = [value.startValue, value.targetValue, value.currentValue];
  if (numbers.some((item) => !Number.isFinite(item))) {
    throw new AppError(400, 'INVALID_GOAL_METRIC', '目标数值必须是有限数字。');
  }
  if (value.startValue === value.targetValue) {
    throw new AppError(400, 'INVALID_GOAL_METRIC', '起始值和目标值不能相同。');
  }
  if (
    (value.direction === 'increase' && value.targetValue < value.startValue) ||
    (value.direction === 'decrease' && value.targetValue > value.startValue)
  ) {
    throw new AppError(400, 'INVALID_GOAL_METRIC', '变化方向与起始值、目标值不一致。');
  }
  return { ...value, unit: text(value.unit, '数值单位', 40) };
}

function keyResults(values: GoalKeyResult[] | undefined): GoalKeyResult[] {
  if ((values?.length ?? 0) > 20) {
    throw new AppError(400, 'INVALID_KEY_RESULTS', '一个目标最多包含 20 个关键结果。');
  }
  return (values ?? []).map((item) => {
    if (!Number.isFinite(item.progress) || item.progress < 0 || item.progress > 100) {
      throw new AppError(400, 'INVALID_KEY_RESULT_PROGRESS', '关键结果进度必须在 0–100 之间。');
    }
    return {
      id: text(item.id, '关键结果 ID', 100) || randomUUID(),
      title: text(item.title, '关键结果标题', 200, true),
      progress: Math.round(item.progress),
      completed: item.completed,
    };
  });
}

export function goalProgress(row: GoalRow): number {
  if (row.status === 'completed') return 100;
  if (
    row.startValue !== null &&
    row.targetValue !== null &&
    row.currentValue !== null &&
    row.metricDirection
  ) {
    const distance = Math.abs(row.targetValue - row.startValue);
    const change =
      row.metricDirection === 'increase'
        ? row.currentValue - row.startValue
        : row.startValue - row.currentValue;
    return Math.round(Math.max(0, Math.min(100, (change / distance) * 100)));
  }
  if (row.keyResults.length > 0) {
    return Math.round(
      row.keyResults.reduce((sum, item) => sum + (item.completed ? 100 : item.progress), 0) /
        row.keyResults.length,
    );
  }
  return 0;
}

export function toGoal(row: GoalRow): Goal {
  const hasMetric =
    row.startValue !== null &&
    row.targetValue !== null &&
    row.currentValue !== null &&
    row.metricDirection !== null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    periodType: row.periodType,
    periodLabel: row.periodLabel,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    ...(hasMetric
      ? {
          metric: {
            startValue: row.startValue!,
            targetValue: row.targetValue!,
            currentValue: row.currentValue!,
            unit: row.metricUnit,
            direction: row.metricDirection!,
          },
        }
      : {}),
    keyResults: row.keyResults,
    progress: goalProgress(row),
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class GoalService {
  public constructor(
    private readonly repository: GoalRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: { status?: GoalRow['status']; limit?: number }) {
    const rows = await this.repository.list(
      input.status ?? 'active',
      Math.min(100, input.limit ?? 50),
    );
    return { items: rows.map(toGoal) };
  }

  public async get(id: string): Promise<Goal> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该目标。');
    return { ...toGoal(row), measurements: await this.repository.measurements(id) };
  }

  public async create(input: GoalInput): Promise<Goal> {
    const now = this.now();
    const normalizedMetric = metric(input.metric);
    const startDate = date(input.startDate, '开始日期');
    const endDate = date(input.endDate, '结束日期');
    if (endDate < startDate) {
      throw new AppError(400, 'INVALID_GOAL_RANGE', '结束日期不能早于开始日期。');
    }
    const row: GoalRow = {
      id: randomUUID(),
      title: text(input.title, '目标标题', 200, true),
      description: text(input.description, '目标说明', 10_000),
      periodType: input.periodType,
      periodLabel: text(input.periodLabel, '目标周期', 80, true),
      startDate,
      endDate,
      status: input.status ?? 'active',
      archivedFromStatus: null,
      startValue: normalizedMetric?.startValue ?? null,
      targetValue: normalizedMetric?.targetValue ?? null,
      currentValue: normalizedMetric?.currentValue ?? null,
      metricUnit: normalizedMetric?.unit ?? '',
      metricDirection: normalizedMetric?.direction ?? null,
      keyResults: keyResults(input.keyResults),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return toGoal(
      await this.repository.create(
        row,
        normalizedMetric
          ? { id: randomUUID(), value: normalizedMetric.currentValue, recordedAt: now }
          : undefined,
      ),
    );
  }

  public async update(id: string, input: GoalUpdateInput): Promise<Goal> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该目标。');
    const nextMetric = input.metric === undefined ? undefined : metric(input.metric);
    const startDate = input.startDate ? date(input.startDate, '开始日期') : existing.startDate;
    const endDate = input.endDate ? date(input.endDate, '结束日期') : existing.endDate;
    if (endDate < startDate) {
      throw new AppError(400, 'INVALID_GOAL_RANGE', '结束日期不能早于开始日期。');
    }
    const next: GoalRow = {
      ...existing,
      title: input.title === undefined ? existing.title : text(input.title, '目标标题', 200, true),
      description:
        input.description === undefined
          ? existing.description
          : text(input.description, '目标说明', 10_000),
      periodType: input.periodType ?? existing.periodType,
      periodLabel:
        input.periodLabel === undefined
          ? existing.periodLabel
          : text(input.periodLabel, '目标周期', 80, true),
      startDate,
      endDate,
      status: input.status ?? existing.status,
      startValue:
        input.metric === undefined ? existing.startValue : (nextMetric?.startValue ?? null),
      targetValue:
        input.metric === undefined ? existing.targetValue : (nextMetric?.targetValue ?? null),
      currentValue:
        input.metric === undefined ? existing.currentValue : (nextMetric?.currentValue ?? null),
      metricUnit: input.metric === undefined ? existing.metricUnit : (nextMetric?.unit ?? ''),
      metricDirection:
        input.metric === undefined ? existing.metricDirection : (nextMetric?.direction ?? null),
      keyResults:
        input.keyResults === undefined ? existing.keyResults : keyResults(input.keyResults),
      updatedAt: this.now(),
    };
    const updated = await this.repository.update(next, input.version);
    if (!updated) throw await this.conflict(id);
    return toGoal(updated);
  }

  public async addMeasurement(id: string, input: GoalMeasurementInput): Promise<Goal> {
    if (!Number.isFinite(input.value)) {
      throw new AppError(400, 'INVALID_GOAL_MEASUREMENT', '当前数值必须是有限数字。');
    }
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该目标。');
    if (!existing.metricDirection) {
      throw new ConflictError('只有数据型目标才能记录当前数值。', {
        currentVersion: existing.version,
      });
    }
    const now = this.now();
    const recordedAt = input.recordedAt ? new Date(input.recordedAt) : now;
    if (Number.isNaN(recordedAt.getTime())) {
      throw new AppError(400, 'INVALID_MEASUREMENT_TIME', '记录时间无效。');
    }
    const updated = await this.repository.addMeasurement({
      goalId: id,
      id: randomUUID(),
      value: input.value,
      note: text(input.note, '数值备注', 500),
      recordedAt,
      expectedVersion: input.version,
      now,
    });
    if (!updated) throw await this.conflict(id);
    return toGoal(updated);
  }

  public async archive(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该目标。');
    if (!(await this.repository.archive(id, version, this.now()))) throw await this.conflict(id);
  }

  public async restore(id: string, version: number): Promise<Goal> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该目标。');
    if (existing.status !== 'archived') {
      throw new ConflictError('该目标尚未归档，无需恢复。', { currentVersion: existing.version });
    }
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) throw await this.conflict(id);
    return toGoal(restored);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该目标。');
    if (existing.status !== 'archived') {
      throw new ConflictError('只能永久删除已归档的目标。', { currentVersion: existing.version });
    }
    if (!(await this.repository.deletePermanently(id, version))) throw await this.conflict(id);
  }

  private async conflict(id: string): Promise<ConflictError> {
    return new ConflictError('目标已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
