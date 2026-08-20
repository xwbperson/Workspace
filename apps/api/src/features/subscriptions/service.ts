import { randomUUID } from 'node:crypto';
import type {
  Subscription,
  SubscriptionInput,
  SubscriptionUpdateInput,
} from '@workspace/client-sdk';
import { isValidDateOnly } from '../../platform/date.js';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import { toSubscription, type SubscriptionRepository, type SubscriptionRow } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_SUBSCRIPTION',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function amount(value: number): number {
  if (!Number.isFinite(value) || value < 0)
    throw new AppError(400, 'INVALID_SUBSCRIPTION_AMOUNT', '订阅金额不能小于 0。');
  return Math.round(value * 100) / 100;
}

function dateOnly(value: string): string {
  if (!isValidDateOnly(value)) {
    throw new AppError(400, 'INVALID_SUBSCRIPTION_DATE', '续费日期无效。');
  }
  return value;
}

function currency(value = 'CNY'): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized))
    throw new AppError(400, 'INVALID_CURRENCY', '货币代码必须是 3 个字母。');
  return normalized;
}

export class SubscriptionService {
  public constructor(
    private readonly repository: SubscriptionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: {
    status?: SubscriptionRow['status'];
    limit?: number;
  }): Promise<{ items: Subscription[] }> {
    return {
      items: (
        await this.repository.list(input.status ?? 'active', Math.min(500, input.limit ?? 200))
      ).map(toSubscription),
    };
  }

  public async get(id: string): Promise<Subscription> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该订阅。');
    return toSubscription(row);
  }

  public async create(input: SubscriptionInput): Promise<Subscription> {
    const now = this.now();
    return toSubscription(
      await this.repository.create({
        id: randomUUID(),
        name: text(input.name, '名称', 240, true),
        category: input.category,
        amount: amount(input.amount),
        currency: currency(input.currency),
        billingCycle: input.billingCycle,
        renewalDate: dateOnly(input.renewalDate),
        autoRenew: input.autoRenew ?? false,
        note: text(input.note, '备注', 5000),
        status: input.status ?? 'active',
        archivedFromStatus: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async update(id: string, input: SubscriptionUpdateInput): Promise<Subscription> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该订阅。');
    const updated = await this.repository.update(
      {
        ...existing,
        name: input.name === undefined ? existing.name : text(input.name, '名称', 240, true),
        category: input.category ?? existing.category,
        amount: input.amount === undefined ? existing.amount : amount(input.amount),
        currency: input.currency === undefined ? existing.currency : currency(input.currency),
        billingCycle: input.billingCycle ?? existing.billingCycle,
        renewalDate:
          input.renewalDate === undefined ? existing.renewalDate : dateOnly(input.renewalDate),
        autoRenew: input.autoRenew ?? existing.autoRenew,
        note: input.note === undefined ? existing.note : text(input.note, '备注', 5000),
        status: input.status ?? existing.status,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.conflict(id);
    return toSubscription(updated);
  }

  public async archive(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该订阅。');
    if (!(await this.repository.archive(id, version, this.now()))) throw await this.conflict(id);
  }

  public async restore(id: string, version: number): Promise<Subscription> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该订阅。');
    if (existing.status !== 'archived') throw new ConflictError('该订阅尚未归档。');
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) throw await this.conflict(id);
    return toSubscription(restored);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该订阅。');
    if (existing.status !== 'archived') throw new ConflictError('只能永久删除已归档的订阅。');
    if (!(await this.repository.deletePermanently(id, version))) throw await this.conflict(id);
  }

  private async conflict(id: string): Promise<ConflictError> {
    return new ConflictError('订阅已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
