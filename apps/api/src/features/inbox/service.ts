import { randomUUID } from 'node:crypto';
import type { InboxItem, InboxItemInput, InboxItemUpdateInput } from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import type { FileStorageService } from '../../platform/files/service.js';
import { toInboxItem, type InboxItemRow, type InboxRepository } from './repository.js';

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max)
    throw new AppError(
      400,
      'INVALID_INBOX_ITEM',
      `${name}${required ? `需要 1–${max}` : `不能超过 ${max}`} 个字符。`,
    );
  return normalized;
}

function url(value: string | undefined, required: boolean): string {
  const normalized = text(value, '网址', 4000, required);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
    return parsed.toString();
  } catch {
    throw new AppError(400, 'INVALID_INBOX_URL', '网址必须是有效的 HTTP 或 HTTPS 地址。');
  }
}

export class InboxService {
  public constructor(
    private readonly repository: InboxRepository,
    private readonly files: FileStorageService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async list(input: {
    status?: InboxItemRow['status'];
    limit?: number;
  }): Promise<{ items: InboxItem[] }> {
    return {
      items: (
        await this.repository.list(input.status ?? 'inbox', Math.min(500, input.limit ?? 200))
      ).map(toInboxItem),
    };
  }

  public async get(id: string): Promise<InboxItem> {
    const row = await this.repository.get(id);
    if (!row) throw new NotFoundError('没有找到该收集箱内容。');
    return toInboxItem(row);
  }

  public async create(input: InboxItemInput): Promise<InboxItem> {
    const fileId = input.fileId ?? null;
    if (input.type === 'file' && !fileId)
      throw new AppError(400, 'INBOX_FILE_REQUIRED', '文件类型必须选择一个附件。');
    if (fileId) await this.files.get(fileId);
    const now = this.now();
    return toInboxItem(
      await this.repository.create({
        id: randomUUID(),
        type: input.type,
        title: text(input.title, '标题', 240, true),
        content: text(input.content, '内容', 50_000),
        url: url(input.url, input.type === 'link'),
        fileId,
        fileOriginalName: null,
        fileMimeType: null,
        fileSize: null,
        fileCreatedAt: null,
        status: input.status ?? 'inbox',
        archivedFromStatus: null,
        version: 1,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  public async update(id: string, input: InboxItemUpdateInput): Promise<InboxItem> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived')
      throw new NotFoundError('没有找到该收集箱内容。');
    const type = input.type ?? existing.type;
    const fileId = input.fileId === undefined ? existing.fileId : input.fileId;
    if (type === 'file' && !fileId)
      throw new AppError(400, 'INBOX_FILE_REQUIRED', '文件类型必须选择一个附件。');
    if (fileId && fileId !== existing.fileId) await this.files.get(fileId);
    const nextUrl = input.url === undefined ? existing.url : input.url;
    const updated = await this.repository.update(
      {
        ...existing,
        type,
        title: input.title === undefined ? existing.title : text(input.title, '标题', 240, true),
        content:
          input.content === undefined ? existing.content : text(input.content, '内容', 50_000),
        url: url(nextUrl, type === 'link'),
        fileId,
        status: input.status ?? existing.status,
        updatedAt: this.now(),
      },
      input.version,
    );
    if (!updated) throw await this.conflict(id);
    return toInboxItem(updated);
  }

  public async archive(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing || existing.status === 'archived')
      throw new NotFoundError('没有找到该收集箱内容。');
    if (!(await this.repository.archive(id, version, this.now()))) throw await this.conflict(id);
  }
  public async restore(id: string, version: number): Promise<InboxItem> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该收集箱内容。');
    if (existing.status !== 'archived') throw new ConflictError('该内容尚未归档。');
    const restored = await this.repository.restore(id, version, this.now());
    if (!restored) throw await this.conflict(id);
    return toInboxItem(restored);
  }
  public async deletePermanently(id: string, version: number): Promise<void> {
    const existing = await this.repository.get(id);
    if (!existing) throw new NotFoundError('没有找到该收集箱内容。');
    if (existing.status !== 'archived') throw new ConflictError('只能永久删除已归档的收集箱内容。');
    if (!(await this.repository.deletePermanently(id, version))) throw await this.conflict(id);
  }
  private async conflict(id: string): Promise<ConflictError> {
    return new ConflictError('收集箱内容已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.get(id))?.version,
    });
  }
}
