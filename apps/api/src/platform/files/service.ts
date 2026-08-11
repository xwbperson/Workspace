import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve, sep } from 'node:path';
import type { AppConfig } from '../../config.js';
import type { Database } from '../database/types.js';
import { NotFoundError } from '../errors.js';

export interface StoredFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  contentUrl: string;
}

interface StoredFileRow {
  id: string;
  sha256: string;
  original_name: string;
  mime_type: string;
  size_bytes: string | number;
  storage_key: string;
  created_at: Date;
}

function cleanFilename(value: string): string {
  const cleaned = [...basename(value)]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, 240);
  return cleaned || '未命名文件';
}

function toStoredFile(row: StoredFileRow): StoredFile {
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: Number(row.size_bytes),
    createdAt: row.created_at.toISOString(),
    contentUrl: `/api/v1/files/${row.id}/content`,
  };
}

export class FileStorageService {
  private readonly objectsRoot: string;

  public constructor(
    private readonly database: Database,
    config: AppConfig,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.objectsRoot = resolve(config.workbenchRoot, 'storage', 'objects');
  }

  public async store(input: {
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }): Promise<StoredFile> {
    const sha256 = createHash('sha256').update(input.buffer).digest('hex');
    const storageKey = join(sha256.slice(0, 2), sha256);
    const target = this.resolveObject(storageKey);
    await mkdir(resolve(target, '..'), { recursive: true });
    try {
      await writeFile(target, input.buffer, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    const result = await this.database.query<StoredFileRow>(
      `INSERT INTO stored_files
         (id, sha256, original_name, mime_type, size_bytes, storage_key, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, sha256, original_name, mime_type, size_bytes, storage_key, created_at`,
      [
        randomUUID(),
        sha256,
        cleanFilename(input.filename),
        input.mimeType || 'application/octet-stream',
        input.buffer.length,
        storageKey,
        this.now(),
      ],
    );
    return toStoredFile(result.rows[0]!);
  }

  public async get(id: string): Promise<StoredFile> {
    return toStoredFile(await this.getRow(id));
  }

  public async open(id: string): Promise<{
    file: StoredFile;
    stream: ReturnType<typeof createReadStream>;
  }> {
    const row = await this.getRow(id);
    const path = this.resolveObject(row.storage_key);
    try {
      await access(path, constants.R_OK);
    } catch {
      throw new NotFoundError('附件文件不存在或暂时无法读取。');
    }
    return { file: toStoredFile(row), stream: createReadStream(path) };
  }

  private async getRow(id: string): Promise<StoredFileRow> {
    const result = await this.database.query<StoredFileRow>(
      `SELECT id, sha256, original_name, mime_type, size_bytes, storage_key, created_at
       FROM stored_files WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundError('没有找到该附件。');
    return row;
  }

  private resolveObject(storageKey: string): string {
    const target = resolve(this.objectsRoot, storageKey);
    if (!target.startsWith(`${this.objectsRoot}${sep}`)) {
      throw new Error('附件存储路径超出工作区。');
    }
    return target;
  }
}
