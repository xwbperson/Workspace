import { randomUUID } from 'node:crypto';
import type {
  Checklist,
  ChecklistInput,
  ChecklistItem,
  ChecklistItemInput,
  ChecklistItemUpdateInput,
  ChecklistStatus,
  ChecklistUpdateInput,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import {
  toChecklist,
  toChecklistItem,
  type ChecklistRepository,
  type ChecklistRow,
} from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && normalized.length === 0) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_CHECKLIST',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function quantity(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    value > 999_999 ||
    Math.round(value * 1000) !== value * 1000
  ) {
    throw new AppError(400, 'INVALID_CHECKLIST_ITEM_QUANTITY', '数量需要是最多三位小数的正数。');
  }
  return value;
}

function priceCents(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 10_000_000) {
    throw new AppError(400, 'INVALID_CHECKLIST_ITEM_PRICE', '单价需要是有效的非负金额。');
  }
  return Math.round(value * 100);
}

export class ChecklistService {
  public constructor(
    private readonly repository: ChecklistRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: {
    status?: ChecklistStatus;
    limit?: number;
  }): Promise<{ items: Checklist[] }> {
    const rows = await this.repository.list(
      input.status ?? 'active',
      Math.min(500, input.limit ?? 200),
    );
    return { items: await this.hydrateMany(rows) };
  }

  public async recent(limit: number): Promise<Checklist[]> {
    return this.hydrateMany(await this.repository.recent(limit));
  }

  public async search(query: string, limit: number): Promise<Checklist[]> {
    return this.hydrateMany(await this.repository.search(query, limit));
  }

  public async get(id: string): Promise<Checklist> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该清单。');
    return this.hydrate(row);
  }

  public async create(input: ChecklistInput): Promise<Checklist> {
    const now = this.now();
    const row = await this.repository.create({
      id: randomUUID(),
      name: text(input.name, '清单名称', 120, true),
      note: text(input.note, '清单备注', 20_000),
      status: 'active',
      archivedFromStatus: null,
      position: 0,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
    return toChecklist(row, []);
  }

  public async update(id: string, input: ChecklistUpdateInput): Promise<Checklist> {
    const existing = await this.editableChecklist(id);
    const updated = await this.repository.update(
      {
        ...existing,
        name: input.name === undefined ? existing.name : text(input.name, '清单名称', 120, true),
        note: input.note === undefined ? existing.note : text(input.note, '清单备注', 20_000),
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.checklistConflict(id);
    return this.hydrate(updated);
  }

  public async archive(id: string, version: number): Promise<void> {
    await this.editableChecklist(id);
    if (!(await this.repository.archive(id, version, this.now()))) {
      throw await this.checklistConflict(id);
    }
  }

  public async complete(id: string, version: number): Promise<Checklist> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status !== 'active') {
      throw new ConflictError('只有使用中的清单可以标记为已完成。', {
        currentVersion: existing?.version,
      });
    }
    const completed = await this.repository.complete(id, version, this.now());
    if (!completed) throw await this.checklistConflict(id);
    return this.hydrate(completed);
  }

  public async reopen(id: string, version: number): Promise<Checklist> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status !== 'completed') {
      throw new ConflictError('只有已完成的清单可以重新标记为使用中。', {
        currentVersion: existing?.version,
      });
    }
    const reopened = await this.repository.reopen(id, version, this.now());
    if (!reopened) throw await this.checklistConflict(id);
    return this.hydrate(reopened);
  }

  public async restore(id: string, version: number): Promise<Checklist> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该清单。');
    if (existing.status !== 'archived') {
      throw new ConflictError('该清单尚未归档，无需恢复。', {
        currentVersion: existing.version,
      });
    }
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) throw await this.checklistConflict(id);
    return this.hydrate(restored);
  }

  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该清单。');
    if (existing.status !== 'archived') {
      throw new ConflictError('只能永久删除已归档的清单。', {
        currentVersion: existing.version,
      });
    }
    if (!(await this.repository.deletePermanently(id, version))) {
      throw await this.checklistConflict(id);
    }
  }

  public async addItem(checklistId: string, input: ChecklistItemInput): Promise<ChecklistItem> {
    await this.editableChecklist(checklistId);
    const now = this.now();
    return toChecklistItem(
      await this.repository.createItem({
        id: randomUUID(),
        checklistId,
        name: text(input.name, '条目名称', 240, true),
        note: text(input.note, '条目备注', 2_000),
        quantity: quantity(input.quantity),
        unit: text(input.unit, '单位', 20),
        priceCents: priceCents(input.price),
        checkedAt: null,
        position: 0,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async checkItem(
    checklistId: string,
    itemId: string,
    checked: boolean,
    version: number,
  ): Promise<ChecklistItem> {
    await this.editableChecklist(checklistId);
    const existing = await this.repository.getItem(checklistId, itemId);
    if (!existing) throw new NotFoundError('没有找到该清单条目。');
    const now = this.now();
    const updated = await this.repository.checkItem(
      checklistId,
      itemId,
      checked ? now : null,
      version,
      now,
    );
    if (!updated) {
      throw new ConflictError('清单条目已在其他位置修改，请刷新后重试。', {
        currentVersion: (await this.repository.getItem(checklistId, itemId))?.version,
      });
    }
    return toChecklistItem(updated);
  }

  public async updateItem(
    checklistId: string,
    itemId: string,
    input: ChecklistItemUpdateInput,
  ): Promise<ChecklistItem> {
    await this.editableChecklist(checklistId);
    const existing = await this.repository.getItem(checklistId, itemId);
    if (!existing) throw new NotFoundError('没有找到该清单条目。');
    const updated = await this.repository.updateItem(
      {
        ...existing,
        name: input.name === undefined ? existing.name : text(input.name, '条目名称', 240, true),
        note: input.note === undefined ? existing.note : text(input.note, '条目备注', 2_000),
        quantity: input.quantity === undefined ? existing.quantity : quantity(input.quantity),
        unit: input.unit === undefined ? existing.unit : text(input.unit, '单位', 20),
        priceCents: input.price === undefined ? existing.priceCents : priceCents(input.price),
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.itemConflict(checklistId, itemId);
    return toChecklistItem(updated);
  }

  public async reset(id: string, version: number): Promise<Checklist> {
    await this.editableChecklist(id);
    const updated = await this.repository.reset(id, version, this.now());
    if (!updated) throw await this.checklistConflict(id);
    return this.hydrate(updated);
  }

  public async deleteItem(checklistId: string, itemId: string, version: number): Promise<void> {
    await this.editableChecklist(checklistId);
    const existing = await this.repository.getItem(checklistId, itemId);
    if (!existing) throw new NotFoundError('没有找到该清单条目。');
    if (!(await this.repository.deleteItem(checklistId, itemId, version, this.now()))) {
      throw await this.itemConflict(checklistId, itemId);
    }
  }

  public async clearChecked(id: string, version: number): Promise<Checklist> {
    await this.editableChecklist(id);
    const updated = await this.repository.clearChecked(id, version, this.now());
    if (!updated) throw await this.checklistConflict(id);
    return this.hydrate(updated);
  }

  private async editableChecklist(id: string): Promise<ChecklistRow> {
    const row = await this.repository.get(id);
    if (!row || row.status === 'archived') throw new NotFoundError('没有找到可编辑的清单。');
    return row;
  }

  private async hydrate(row: ChecklistRow): Promise<Checklist> {
    return toChecklist(row, await this.repository.items(row.id));
  }

  private async hydrateMany(rows: readonly ChecklistRow[]): Promise<Checklist[]> {
    const itemsByChecklist = await this.repository.itemsForChecklists(rows.map((row) => row.id));
    return rows.map((row) => toChecklist(row, itemsByChecklist.get(row.id) ?? []));
  }

  private async checklistConflict(id: string): Promise<ConflictError> {
    return new ConflictError('清单已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }

  private async itemConflict(checklistId: string, itemId: string): Promise<ConflictError> {
    return new ConflictError('清单条目已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getItem(checklistId, itemId))?.version,
    });
  }
}
