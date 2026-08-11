import { randomUUID } from 'node:crypto';
import type {
  FinanceAccount,
  FinanceAccountInput,
  FinanceAccountUpdateInput,
  FinanceDebtPlatform,
  FinanceDebtPlatformInput,
  FinanceDebtPlatformUpdateInput,
  FinanceDebtRecord,
  FinanceDebtRecordInput,
  FinanceSummary,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import {
  toFinanceAccount,
  toFinanceDebtPlatform,
  toFinanceDebtRecord,
  type FinanceRepository,
} from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max)
    throw new AppError(
      400,
      'INVALID_FINANCE_RECORD',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  return normalized;
}
function money(value: number, name: string, nonnegative = false): number {
  if (!Number.isFinite(value) || (nonnegative && value < 0))
    throw new AppError(400, 'INVALID_FINANCE_AMOUNT', `${name}无效。`);
  return Math.round(value * 100) / 100;
}
function day(value: number | null | undefined, name: string): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 1 || value > 31)
    throw new AppError(400, 'INVALID_FINANCE_DAY', `${name}必须在 1–31 之间。`);
  return value;
}
function period(year: number, month: number): void {
  if (
    !Number.isInteger(year) ||
    year < 1900 ||
    year > 2200 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  )
    throw new AppError(400, 'INVALID_FINANCE_PERIOD', '年月无效。');
}

export class FinanceService {
  public constructor(
    private readonly repository: FinanceRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listAccounts(archived = false): Promise<{ items: FinanceAccount[] }> {
    return { items: (await this.repository.listAccounts(archived)).map(toFinanceAccount) };
  }
  public async createAccount(input: FinanceAccountInput): Promise<FinanceAccount> {
    const now = this.now();
    return toFinanceAccount(
      await this.repository.createAccount({
        id: randomUUID(),
        type: input.type,
        name: text(input.name, '账户名称', 200, true),
        balance: money(input.balance, '余额'),
        note: text(input.note, '备注', 5000),
        archived: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  public async updateAccount(
    id: string,
    input: FinanceAccountUpdateInput,
  ): Promise<FinanceAccount> {
    const existing = await this.repository.getAccount(id);
    if (!existing || existing.archived) throw new NotFoundError('没有找到该资金账户。');
    const updated = await this.repository.updateAccount(
      {
        ...existing,
        type: input.type ?? existing.type,
        name: input.name === undefined ? existing.name : text(input.name, '账户名称', 200, true),
        balance: input.balance === undefined ? existing.balance : money(input.balance, '余额'),
        note: input.note === undefined ? existing.note : text(input.note, '备注', 5000),
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.accountConflict(id);
    return toFinanceAccount(updated);
  }
  public async archiveAccount(id: string, version: number): Promise<void> {
    const existing = await this.repository.getAccount(id);
    if (!existing || existing.archived) throw new NotFoundError('没有找到该资金账户。');
    if (!(await this.repository.setAccountArchived(id, version, true, this.now())))
      throw await this.accountConflict(id);
  }
  public async restoreAccount(id: string, version: number): Promise<FinanceAccount> {
    const existing = await this.repository.getAccount(id);
    if (!existing) throw new NotFoundError('没有找到该资金账户。');
    if (!existing.archived) throw new ConflictError('该资金账户尚未归档。');
    const restored = await this.repository.setAccountArchived(id, version, false, this.now());
    if (!restored) throw await this.accountConflict(id);
    return toFinanceAccount(restored);
  }
  public async deleteAccount(id: string, version: number): Promise<void> {
    const existing = await this.repository.getAccount(id);
    if (!existing) throw new NotFoundError('没有找到该资金账户。');
    if (!existing.archived) throw new ConflictError('只能永久删除已归档的资金账户。');
    if (!(await this.repository.deleteAccount(id, version))) throw await this.accountConflict(id);
  }

  public async listPlatforms(archived = false): Promise<{ items: FinanceDebtPlatform[] }> {
    return { items: (await this.repository.listPlatforms(archived)).map(toFinanceDebtPlatform) };
  }
  public async createPlatform(input: FinanceDebtPlatformInput): Promise<FinanceDebtPlatform> {
    const now = this.now();
    return toFinanceDebtPlatform(
      await this.repository.createPlatform({
        id: randomUUID(),
        name: text(input.name, '平台名称', 200, true),
        billingDay: day(input.billingDay, '账单日'),
        repaymentDay: day(input.repaymentDay, '还款日'),
        fixedLimit: money(input.fixedLimit ?? 0, '固定额度', true),
        temporaryLimit: money(input.temporaryLimit ?? 0, '临时额度', true),
        remainingLimit: money(input.remainingLimit ?? 0, '剩余额度', true),
        note: text(input.note, '备注', 5000),
        archived: false,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }
  public async updatePlatform(
    id: string,
    input: FinanceDebtPlatformUpdateInput,
  ): Promise<FinanceDebtPlatform> {
    const existing = await this.repository.getPlatform(id);
    if (!existing || existing.archived) throw new NotFoundError('没有找到该负债平台。');
    const updated = await this.repository.updatePlatform(
      {
        ...existing,
        name: input.name === undefined ? existing.name : text(input.name, '平台名称', 200, true),
        billingDay:
          input.billingDay === undefined ? existing.billingDay : day(input.billingDay, '账单日'),
        repaymentDay:
          input.repaymentDay === undefined
            ? existing.repaymentDay
            : day(input.repaymentDay, '还款日'),
        fixedLimit:
          input.fixedLimit === undefined
            ? existing.fixedLimit
            : money(input.fixedLimit, '固定额度', true),
        temporaryLimit:
          input.temporaryLimit === undefined
            ? existing.temporaryLimit
            : money(input.temporaryLimit, '临时额度', true),
        remainingLimit:
          input.remainingLimit === undefined
            ? existing.remainingLimit
            : money(input.remainingLimit, '剩余额度', true),
        note: input.note === undefined ? existing.note : text(input.note, '备注', 5000),
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.platformConflict(id);
    return toFinanceDebtPlatform(updated);
  }
  public async archivePlatform(id: string, version: number): Promise<void> {
    const existing = await this.repository.getPlatform(id);
    if (!existing || existing.archived) throw new NotFoundError('没有找到该负债平台。');
    if (!(await this.repository.setPlatformArchived(id, version, true, this.now())))
      throw await this.platformConflict(id);
  }
  public async restorePlatform(id: string, version: number): Promise<FinanceDebtPlatform> {
    const existing = await this.repository.getPlatform(id);
    if (!existing) throw new NotFoundError('没有找到该负债平台。');
    if (!existing.archived) throw new ConflictError('该负债平台尚未归档。');
    const restored = await this.repository.setPlatformArchived(id, version, false, this.now());
    if (!restored) throw await this.platformConflict(id);
    return toFinanceDebtPlatform(restored);
  }
  public async deletePlatform(id: string, version: number): Promise<void> {
    const existing = await this.repository.getPlatform(id);
    if (!existing) throw new NotFoundError('没有找到该负债平台。');
    if (!existing.archived) throw new ConflictError('只能永久删除已归档的负债平台。');
    if (!(await this.repository.deletePlatform(id, version))) throw await this.platformConflict(id);
  }

  public async upsertRecord(
    input: FinanceDebtRecordInput & { version?: number },
  ): Promise<FinanceDebtRecord> {
    period(input.year, input.month);
    const platform = await this.repository.getPlatform(input.platformId);
    if (!platform || platform.archived) throw new NotFoundError('没有找到该负债平台。');
    const existing = await this.repository.getRecord(input.platformId, input.year, input.month);
    const now = this.now();
    if (!existing)
      return toFinanceDebtRecord(
        await this.repository.createRecord({
          id: randomUUID(),
          platformId: platform.id,
          platformName: platform.name,
          year: input.year,
          month: input.month,
          amount: money(input.amount, '负债金额', true),
          version: 1,
          createdAt: now,
          updatedAt: now,
        }),
      );
    if (input.version !== existing.version)
      throw new ConflictError('月度负债记录已在其他位置修改，请刷新后重试。', {
        currentVersion: existing.version,
      });
    const updated = await this.repository.updateRecord(
      { ...existing, amount: money(input.amount, '负债金额', true), updatedAt: now },
      input.version,
    );
    if (!updated) throw new ConflictError('月度负债记录已在其他位置修改，请刷新后重试。');
    return toFinanceDebtRecord(updated);
  }
  public async deleteRecord(id: string, version: number): Promise<void> {
    if (!(await this.repository.deleteRecord(id, version)))
      throw new ConflictError('月度负债记录不存在或已被修改。');
  }

  public async summary(year: number, month: number): Promise<FinanceSummary> {
    period(year, month);
    const [accountRows, platformRows, recordRows] = await Promise.all([
      this.repository.listAccounts(false),
      this.repository.listPlatforms(false),
      this.repository.listRecords(year),
    ]);
    const currentMonthDebt = recordRows
      .filter(
        (row) =>
          row.month === month && !platformRows.every((platform) => platform.id !== row.platformId),
      )
      .reduce((sum, row) => sum + row.amount, 0);
    const totalAssets = accountRows.reduce((sum, row) => sum + row.balance, 0);
    return {
      year,
      month,
      totalAssets,
      currentMonthDebt,
      yearDebt: recordRows.reduce((sum, row) => sum + row.amount, 0),
      netPosition: totalAssets - currentMonthDebt,
      totalCreditLimit: platformRows.reduce(
        (sum, row) => sum + row.fixedLimit + row.temporaryLimit,
        0,
      ),
      remainingCredit: platformRows.reduce((sum, row) => sum + row.remainingLimit, 0),
      accounts: accountRows.map(toFinanceAccount),
      platforms: platformRows.map(toFinanceDebtPlatform),
      records: recordRows.map(toFinanceDebtRecord),
    };
  }

  private async accountConflict(id: string): Promise<ConflictError> {
    return new ConflictError('资金账户已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getAccount(id))?.version,
    });
  }
  private async platformConflict(id: string): Promise<ConflictError> {
    return new ConflictError('负债平台已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getPlatform(id))?.version,
    });
  }
}
