import { randomUUID } from 'node:crypto';
import type {
  InventoryGroup,
  InventoryGroupInput,
  InventoryGroupUpdateInput,
  InventoryItem,
  InventoryItemInput,
  InventoryItemListResponse,
  InventoryItemStatus,
  InventoryItemUpdateInput,
  InventoryStockFilter,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import { type InventoryRepository, toInventoryGroup, toInventoryItem } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_INVENTORY_TEXT',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function quantity(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 999_999) {
    throw new AppError(400, 'INVALID_INVENTORY_QUANTITY', '数量必须是 0–999999 的整数。');
  }
  return value;
}

export class InventoryService {
  public constructor(
    private readonly repository: InventoryRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listGroups(): Promise<{ items: InventoryGroup[] }> {
    return { items: (await this.repository.listGroups()).map(toInventoryGroup) };
  }

  public async createGroup(input: InventoryGroupInput): Promise<InventoryGroup> {
    const name = text(input.name, '分组名称', 80, true);
    await this.assertUniqueGroupName(name);
    return toInventoryGroup(
      await this.repository.createGroup({ id: randomUUID(), name, createdAt: this.now() }),
    );
  }

  public async updateGroup(id: string, input: InventoryGroupUpdateInput): Promise<InventoryGroup> {
    const existing = await this.repository.getGroup(id);
    if (!existing) throw new NotFoundError('没有找到该物品分组。');
    const name = text(input.name, '分组名称', 80, true);
    await this.assertUniqueGroupName(name, id);
    const updated = await this.repository.updateGroup(id, name, input.version, this.now());
    if (!updated) throw await this.groupConflict(id);
    return toInventoryGroup((await this.repository.getGroup(id)) ?? updated);
  }

  public async deleteGroup(id: string, version: number): Promise<void> {
    if (!(await this.repository.getGroup(id))) throw new NotFoundError('没有找到该物品分组。');
    if (!(await this.repository.deleteGroup(id, version))) throw await this.groupConflict(id);
  }

  public async listItems(input: {
    status?: InventoryItemStatus;
    stock?: InventoryStockFilter;
    groupId?: string;
    query?: string;
    limit?: number;
  }): Promise<InventoryItemListResponse> {
    const groupId = input.groupId;
    const query = input.query?.trim() || undefined;
    const rows = await this.repository.listItems({
      status: input.status ?? 'active',
      stock: input.stock ?? 'all',
      limit: Math.min(500, input.limit ?? 500),
      ...(groupId === undefined ? {} : { groupId }),
      ...(query === undefined ? {} : { query }),
    });
    return {
      items: rows.map(toInventoryItem),
      summary: {
        kinds: rows.length,
        totalQuantity: rows.reduce((sum, row) => sum + row.quantity, 0),
        zeroQuantity: rows.filter((row) => row.quantity === 0).length,
      },
    };
  }

  public async getItem(id: string): Promise<InventoryItem> {
    const row = await this.repository.getItem(id);
    if (!row) throw new NotFoundError('没有找到该物品。');
    return toInventoryItem(row);
  }

  public async createItem(input: InventoryItemInput): Promise<InventoryItem> {
    const groupId = await this.validGroupId(input.groupId);
    return toInventoryItem(
      await this.repository.createItem({
        id: randomUUID(),
        groupId,
        name: text(input.name, '物品名称', 120, true),
        purpose: text(input.purpose, '物品用途', 500),
        note: text(input.note, '备注', 2000),
        quantity: quantity(input.quantity),
        createdAt: this.now(),
      }),
    );
  }

  public async updateItem(id: string, input: InventoryItemUpdateInput): Promise<InventoryItem> {
    const existing = await this.repository.getItem(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该物品。');
    const groupId =
      input.groupId === undefined ? existing.groupId : await this.validGroupId(input.groupId);
    const updated = await this.repository.updateItem(
      {
        id,
        groupId,
        name: input.name === undefined ? existing.name : text(input.name, '物品名称', 120, true),
        purpose:
          input.purpose === undefined ? existing.purpose : text(input.purpose, '物品用途', 500),
        note: input.note === undefined ? existing.note : text(input.note, '备注', 2000),
        quantity: input.quantity === undefined ? existing.quantity : quantity(input.quantity),
      },
      input.version,
      this.now(),
    );
    if (!updated) throw await this.itemConflict(id);
    return toInventoryItem(updated);
  }

  public async adjustQuantity(id: string, delta: -1 | 1): Promise<InventoryItem> {
    const existing = await this.repository.getItem(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该物品。');
    const updated = await this.repository.adjustQuantity(id, delta, this.now());
    if (!updated) throw new NotFoundError('没有找到该物品。');
    return toInventoryItem(updated);
  }

  public async archiveItem(id: string, version: number): Promise<void> {
    const existing = await this.repository.getItem(id);
    if (!existing || existing.status === 'archived') throw new NotFoundError('没有找到该物品。');
    if (!(await this.repository.archiveItem(id, version, this.now()))) {
      throw await this.itemConflict(id);
    }
  }

  public async restoreItem(id: string, version: number): Promise<InventoryItem> {
    const existing = await this.repository.getItem(id);
    if (!existing) throw new NotFoundError('没有找到该物品。');
    if (existing.status !== 'archived') throw new ConflictError('该物品尚未归档。');
    const restored = await this.repository.restoreItem(id, version, this.now());
    if (!restored) throw await this.itemConflict(id);
    return toInventoryItem(restored);
  }

  public async deleteItemPermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.getItem(id);
    if (!existing) throw new NotFoundError('没有找到该物品。');
    if (existing.status !== 'archived') throw new ConflictError('只能永久删除已归档的物品。');
    if (!(await this.repository.deleteItemPermanently(id, version))) {
      throw await this.itemConflict(id);
    }
  }

  private async validGroupId(groupId: string | null | undefined): Promise<string | null> {
    if (!groupId) return null;
    if (!(await this.repository.getGroup(groupId))) {
      throw new AppError(400, 'INVALID_INVENTORY_GROUP', '选择的物品分组不存在。');
    }
    return groupId;
  }

  private async assertUniqueGroupName(name: string, currentId?: string): Promise<void> {
    const existing = await this.repository.findGroupByName(name);
    if (existing && existing.id !== currentId) {
      throw new AppError(409, 'INVENTORY_GROUP_EXISTS', '已经存在同名分组。');
    }
  }

  private async groupConflict(id: string): Promise<ConflictError> {
    return new ConflictError('分组已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getGroup(id))?.version,
    });
  }

  private async itemConflict(id: string): Promise<ConflictError> {
    return new ConflictError('物品已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getItem(id))?.version,
    });
  }
}
