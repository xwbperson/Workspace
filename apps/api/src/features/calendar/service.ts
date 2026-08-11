import { randomUUID } from 'node:crypto';
import type {
  CalendarEntry,
  CalendarEntryInput,
  CalendarEntryUpdateInput,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import { toCalendarEntry, type CalendarEntryRow, type CalendarRepository } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_CALENDAR_ENTRY',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function entryDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new AppError(400, 'INVALID_CALENDAR_DATE', '日历日期无效。');
  }
  return value;
}

function time(value: string | null | undefined, name: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(400, 'INVALID_CALENDAR_TIME', `${name}无效。`);
  }
  return parsed;
}

function validateTimes(
  type: CalendarEntryRow['type'],
  startsAt: Date | null,
  endsAt: Date | null,
): void {
  if (type === 'schedule' && !startsAt) {
    throw new AppError(400, 'SCHEDULE_START_REQUIRED', '行程安排必须设置开始时间。');
  }
  if (endsAt && (!startsAt || endsAt < startsAt)) {
    throw new AppError(400, 'INVALID_CALENDAR_RANGE', '结束时间不能早于开始时间。');
  }
}

export class CalendarService {
  public constructor(
    private readonly repository: CalendarRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: {
    from?: string;
    to?: string;
    status?: CalendarEntryRow['status'];
    limit?: number;
  }): Promise<{ items: CalendarEntry[] }> {
    const now = this.now();
    const from = entryDate(input.from ?? `${now.getUTCFullYear()}-01-01`);
    const to = entryDate(input.to ?? `${now.getUTCFullYear()}-12-31`);
    if (to < from) throw new AppError(400, 'INVALID_CALENDAR_RANGE', '结束日期不能早于开始日期。');
    return {
      items: (
        await this.repository.list({
          from,
          to,
          status: input.status ?? 'active',
          limit: Math.min(1000, input.limit ?? 500),
        })
      ).map(toCalendarEntry),
    };
  }

  public async get(id: string): Promise<CalendarEntry> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该日历记录。');
    return toCalendarEntry(row);
  }

  public async create(input: CalendarEntryInput): Promise<CalendarEntry> {
    const startsAt = time(input.startsAt, '开始时间');
    const endsAt = time(input.endsAt, '结束时间');
    validateTimes(input.type, startsAt, endsAt);
    const now = this.now();
    return toCalendarEntry(
      await this.repository.create({
        id: randomUUID(),
        type: input.type,
        title: text(input.title, '标题', 240, true),
        content: text(input.content, '内容', 50_000),
        entryDate: entryDate(input.entryDate),
        startsAt,
        endsAt,
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async update(id: string, input: CalendarEntryUpdateInput): Promise<CalendarEntry> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived')
      throw new NotFoundError('没有找到该日历记录。');
    const startsAt =
      input.startsAt === undefined ? existing.startsAt : time(input.startsAt, '开始时间');
    const endsAt = input.endsAt === undefined ? existing.endsAt : time(input.endsAt, '结束时间');
    const type = input.type ?? existing.type;
    validateTimes(type, startsAt, endsAt);
    const updated = await this.repository.update(
      {
        ...existing,
        type,
        title: input.title === undefined ? existing.title : text(input.title, '标题', 240, true),
        content:
          input.content === undefined ? existing.content : text(input.content, '内容', 50_000),
        entryDate: input.entryDate === undefined ? existing.entryDate : entryDate(input.entryDate),
        startsAt,
        endsAt,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.conflict(id);
    return toCalendarEntry(updated);
  }

  public async archive(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived')
      throw new NotFoundError('没有找到该日历记录。');
    if (!(await this.repository.archive(id, version, this.now()))) throw await this.conflict(id);
  }

  public async restore(id: string, version: number): Promise<CalendarEntry> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该日历记录。');
    if (existing.status !== 'archived') throw new ConflictError('该日历记录尚未归档。');
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) throw await this.conflict(id);
    return toCalendarEntry(restored);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该日历记录。');
    if (existing.status !== 'archived') throw new ConflictError('只能永久删除已归档的日历记录。');
    if (!(await this.repository.deletePermanently(id, version))) throw await this.conflict(id);
  }

  private async conflict(id: string): Promise<ConflictError> {
    return new ConflictError('日历记录已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
