import { randomUUID } from 'node:crypto';
import type {
  LifeCountdownDashboard,
  LifeEvent,
  LifeEventInput,
  LifeEventUpdateInput,
  LifeProfile,
  LifeProfileInput,
} from '@workspace/client-sdk';
import { isValidDateOnly } from '../../platform/date.js';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import { toLifeEvent, toLifeProfile, type LifeCountdownRepository } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max)
    throw new AppError(
      400,
      'INVALID_LIFE_COUNTDOWN',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  return normalized;
}
function birthDate(value: string, now: Date): string {
  if (!isValidDateOnly(value) || Date.parse(`${value}T00:00:00Z`) > now.getTime())
    throw new AppError(400, 'INVALID_BIRTH_DATE', '出生日期无效或晚于今天。');
  return value;
}
function targetAt(value: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()))
    throw new AppError(400, 'INVALID_LIFE_EVENT_TIME', '目标时间无效。');
  return parsed;
}

export class LifeCountdownService {
  public constructor(
    private readonly repository: LifeCountdownRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}
  public async dashboard(
    status: 'active' | 'archived' = 'active',
  ): Promise<LifeCountdownDashboard> {
    const [profile, events] = await Promise.all([
      this.repository.getProfile(),
      this.repository.listEvents(status, 500),
    ]);
    return { profile: toLifeProfile(profile), events: events.map(toLifeEvent) };
  }
  public async updateProfile(input: LifeProfileInput): Promise<LifeProfile> {
    if (!Number.isInteger(input.expectedAge) || input.expectedAge < 1 || input.expectedAge > 150)
      throw new AppError(400, 'INVALID_EXPECTED_AGE', '预期寿命必须在 1–150 岁之间。');
    const existing = await this.repository.getProfile();
    const updated = await this.repository.updateProfile(
      {
        ...existing,
        birthDate: birthDate(input.birthDate, this.now()),
        expectedAge: input.expectedAge,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated)
      throw new ConflictError('人生参数已在其他位置修改，请刷新后重试。', {
        currentVersion: (await this.repository.getProfile()).version,
      });
    return toLifeProfile(updated);
  }
  public async createEvent(input: LifeEventInput): Promise<LifeEvent> {
    const now = this.now();
    return toLifeEvent(
      await this.repository.createEvent({
        id: randomUUID(),
        title: text(input.title, '事件标题', 240, true),
        targetAt: targetAt(input.targetAt),
        note: text(input.note, '备注', 5000),
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  public async updateEvent(id: string, input: LifeEventUpdateInput): Promise<LifeEvent> {
    const existing = await this.repository.getEvent(id);
    if (!existing || existing.status === 'archived')
      throw new NotFoundError('没有找到该人生事件。');
    const updated = await this.repository.updateEvent(
      {
        ...existing,
        title:
          input.title === undefined ? existing.title : text(input.title, '事件标题', 240, true),
        targetAt: input.targetAt === undefined ? existing.targetAt : targetAt(input.targetAt),
        note: input.note === undefined ? existing.note : text(input.note, '备注', 5000),
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.eventConflict(id);
    return toLifeEvent(updated);
  }
  public async archiveEvent(id: string, version: number): Promise<void> {
    const existing = await this.repository.getEvent(id);
    if (!existing || existing.status === 'archived')
      throw new NotFoundError('没有找到该人生事件。');
    if (!(await this.repository.setEventArchived(id, version, true, this.now())))
      throw await this.eventConflict(id);
  }
  public async restoreEvent(id: string, version: number): Promise<LifeEvent> {
    const existing = await this.repository.getEvent(id);
    if (!existing) throw new NotFoundError('没有找到该人生事件。');
    if (existing.status !== 'archived') throw new ConflictError('该人生事件尚未归档。');
    const restored = await this.repository.setEventArchived(id, version, false, this.now());
    if (!restored) throw await this.eventConflict(id);
    return toLifeEvent(restored);
  }
  public async deleteEvent(id: string, version: number): Promise<void> {
    const existing = await this.repository.getEvent(id);
    if (!existing) throw new NotFoundError('没有找到该人生事件。');
    if (existing.status !== 'archived') throw new ConflictError('只能永久删除已归档的人生事件。');
    if (!(await this.repository.deleteEvent(id, version))) throw await this.eventConflict(id);
  }
  private async eventConflict(id: string): Promise<ConflictError> {
    return new ConflictError('人生事件已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getEvent(id))?.version,
    });
  }
}
