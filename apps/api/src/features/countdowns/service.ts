import { randomUUID } from 'node:crypto';
import type {
  Countdown,
  CountdownInput,
  CountdownUpdateInput,
  PaginatedCountdowns,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import { toCountdown, type CountdownRepository, type CountdownRow } from './repository.js';

interface CursorPayload {
  targetAt: string;
  id: string;
}

function encodeCursor(row: CountdownRow): string {
  return Buffer.from(JSON.stringify({ targetAt: row.targetAt.toISOString(), id: row.id })).toString(
    'base64url',
  );
}

function decodeCursor(cursor: string | undefined): CursorPayload | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as CursorPayload;
    if (!value.id || Number.isNaN(Date.parse(value.targetAt))) throw new Error('invalid');
    return value;
  } catch {
    throw new AppError(400, 'INVALID_CURSOR', '分页游标无效。');
  }
}

function normalizeTitle(title: string): string {
  const normalized = title.trim();
  if (normalized.length < 1 || normalized.length > 120) {
    throw new AppError(400, 'INVALID_TITLE', '标题需要 1–120 个字符。');
  }
  return normalized;
}

function normalizeNote(note: string | undefined): string {
  const normalized = note?.trim() ?? '';
  if (normalized.length > 500) {
    throw new AppError(400, 'INVALID_NOTE', '备注不能超过 500 个字符。');
  }
  return normalized;
}

function parseDate(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'INVALID_TARGET_TIME', '目标时间必须是带时区的有效时间。');
  }
  return date;
}

function normalizePriority(priority: number | undefined): number {
  const value = priority ?? 0;
  if (!Number.isInteger(value) || value < 0 || value > 100) {
    throw new AppError(400, 'INVALID_PRIORITY', '优先级必须是 0–100 的整数。');
  }
  return value;
}

export class CountdownService {
  public constructor(
    private readonly repository: CountdownRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: {
    status?: CountdownRow['status'];
    cursor?: string;
    limit?: number;
  }): Promise<PaginatedCountdowns> {
    const limit = Math.min(50, Math.max(1, input.limit ?? 20));
    const cursor = decodeCursor(input.cursor);
    const rows = await this.repository.list({
      status: input.status ?? 'active',
      limit: limit + 1,
      ...(cursor ? { afterTargetAt: new Date(cursor.targetAt), afterId: cursor.id } : {}),
    });
    const hasMore = rows.length > limit;
    const visible = rows.slice(0, limit);
    const nextRow = visible.at(-1);
    return {
      items: visible.map(toCountdown),
      ...(hasMore && nextRow ? { nextCursor: encodeCursor(nextRow) } : {}),
    };
  }

  public async get(id: string): Promise<Countdown> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该倒计时。');
    return toCountdown(row);
  }

  public async create(input: CountdownInput): Promise<Countdown> {
    const now = this.now();
    const row: CountdownRow = {
      id: randomUUID(),
      title: normalizeTitle(input.title),
      note: normalizeNote(input.note),
      targetAt: parseDate(input.targetAt),
      status: 'active',
      archivedFromStatus: null,
      priority: normalizePriority(input.priority),
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return toCountdown(await this.repository.create(row));
  }

  public async update(id: string, input: CountdownUpdateInput): Promise<Countdown> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该倒计时。');
    const next: CountdownRow = {
      ...existing,
      title: input.title === undefined ? existing.title : normalizeTitle(input.title),
      note: input.note === undefined ? existing.note : normalizeNote(input.note),
      targetAt: input.targetAt === undefined ? existing.targetAt : parseDate(input.targetAt),
      status: input.status ?? existing.status,
      priority:
        input.priority === undefined ? existing.priority : normalizePriority(input.priority),
      updatedAt: this.now(),
    };
    const updated = await this.repository.update(next, input.version);
    if (!updated) {
      const current = await this.repository.get(id);
      throw new ConflictError('倒计时已在其他位置修改，请刷新后重试。', {
        currentVersion: current?.version,
      });
    }
    return toCountdown(updated);
  }

  public async archive(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该倒计时。');
    if (!(await this.repository.archive(id, version, this.now()))) {
      throw new ConflictError('倒计时已在其他位置修改，请刷新后重试。', {
        currentVersion: (await this.repository.get(id))?.version,
      });
    }
  }

  public async restore(id: string, version: number): Promise<Countdown> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该倒计时。');
    if (existing.status !== 'archived') {
      throw new ConflictError('该倒计时尚未归档，无需恢复。', { currentVersion: existing.version });
    }
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) {
      throw new ConflictError('倒计时已在其他位置修改，请刷新后重试。', {
        currentVersion: (await this.repository.get(id))?.version,
      });
    }
    return toCountdown(restored);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该倒计时。');
    if (existing.status !== 'archived') {
      throw new ConflictError('只能永久删除已归档的倒计时。', { currentVersion: existing.version });
    }
    if (!(await this.repository.deletePermanently(id, version))) {
      throw new ConflictError('倒计时已在其他位置修改，请刷新后重试。', {
        currentVersion: (await this.repository.get(id))?.version,
      });
    }
  }
}
