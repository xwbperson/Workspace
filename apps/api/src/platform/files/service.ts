import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import { access, link, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform, type Readable } from 'node:stream';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MEBIBYTES } from '@workspace/client-sdk';
import type { AppConfig } from '../../config.js';
import type { Database } from '../database/types.js';
import { AppError, NotFoundError } from '../errors.js';

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

interface StoredObjectRow {
  id: string;
  storage_key: string;
}

export interface FileCleanupResult {
  metadataRowsRemoved: number;
  objectFilesRemoved: number;
}

const ORPHAN_GRACE_PERIOD_MS = 24 * 60 * 60 * 1_000;
const ORPHAN_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1_000;

function cleanFilename(value: string): string {
  const cleaned = [...basename(value.replaceAll('\\', '/'))]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return code > 31 && code !== 127;
    })
    .join('')
    .trim()
    .slice(0, 240);
  return cleaned || '未命名文件';
}

function storageKeySegments(storageKey: string): string[] {
  const segments = storageKey.replaceAll('\\', '/').split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('附件存储键无效。');
  }
  return segments;
}

function canonicalStorageKey(storageKey: string): string {
  return storageKeySegments(storageKey).join('/');
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
  private readonly quarantineRoot: string;
  private readonly maintenanceLockPath: string;
  private objectMutationTail: Promise<void> = Promise.resolve();

  public constructor(
    private readonly database: Database,
    config: AppConfig,
    private readonly now: () => Date = () => new Date(),
    private readonly maxFileBytes = MAX_UPLOAD_FILE_BYTES,
  ) {
    this.objectsRoot = resolve(config.workbenchRoot, 'storage', 'objects');
    this.quarantineRoot = resolve(config.workbenchRoot, 'storage', 'quarantine');
    this.maintenanceLockPath = resolve(config.workbenchRoot, 'runtime', 'backup.lock');
  }

  public async store(input: {
    stream: Readable;
    filename: string;
    mimeType: string;
    isTruncated?: () => boolean;
  }): Promise<StoredFile> {
    await mkdir(this.quarantineRoot, { recursive: true });
    const temporaryPath = resolve(this.quarantineRoot, `${randomUUID()}.upload`);
    const hash = createHash('sha256');
    let size = 0;
    let temporaryFileExists = true;

    const meter = new Transform({
      transform: (chunk: Buffer, _encoding, callback) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > this.maxFileBytes) {
          callback(
            new AppError(
              413,
              'FILE_TOO_LARGE',
              `单个文件不能超过 ${MAX_UPLOAD_FILE_MEBIBYTES} MB。`,
            ),
          );
          return;
        }
        hash.update(buffer);
        callback(null, buffer);
      },
    });

    try {
      await pipeline(input.stream, meter, createWriteStream(temporaryPath, { flags: 'wx' }));
      if (input.isTruncated?.()) {
        throw new AppError(
          413,
          'FILE_TOO_LARGE',
          `单个文件不能超过 ${MAX_UPLOAD_FILE_MEBIBYTES} MB。`,
        );
      }
      if (size === 0) throw new AppError(400, 'EMPTY_FILE', '不能上传空文件。');

      const sha256 = hash.digest('hex');
      const storageKey = `${sha256.slice(0, 2)}/${sha256}`;
      const target = this.resolveObject(storageKey);
      return await this.withObjectMutationLock(async () => {
        await mkdir(resolve(target, '..'), { recursive: true });
        try {
          await link(temporaryPath, target);
          await rm(temporaryPath, { force: true });
          temporaryFileExists = false;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
          await access(target, constants.R_OK);
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
            cleanMimeType(input.mimeType),
            size,
            storageKey,
            this.now(),
          ],
        );
        return toStoredFile(result.rows[0]!);
      });
    } finally {
      if (temporaryFileExists) await rm(temporaryPath, { force: true });
    }
  }

  public async cleanupOrphans(
    gracePeriodMs = ORPHAN_GRACE_PERIOD_MS,
    limit = 500,
  ): Promise<FileCleanupResult> {
    if (!Number.isFinite(gracePeriodMs) || gracePeriodMs < 0) {
      throw new Error('附件清理宽限时间必须是非负数。');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
      throw new Error('附件清理批次必须是 1–10000 之间的整数。');
    }

    if (!(await this.acquireMaintenanceLock())) {
      return { metadataRowsRemoved: 0, objectFilesRemoved: 0 };
    }

    try {
      return await this.withObjectMutationLock(() =>
        this.cleanupOrphansUnlocked(gracePeriodMs, limit),
      );
    } finally {
      await rm(this.maintenanceLockPath, { force: true });
    }
  }

  private async withObjectMutationLock<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.objectMutationTail;
    let release!: () => void;
    this.objectMutationTail = new Promise<void>((resolvePromise) => {
      release = resolvePromise;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async cleanupOrphansUnlocked(
    gracePeriodMs: number,
    limit: number,
  ): Promise<FileCleanupResult> {
    const olderThan = new Date(this.now().getTime() - gracePeriodMs);
    const candidates = await this.database.query<StoredObjectRow>(
      `SELECT sf.id,sf.storage_key FROM stored_files sf
       LEFT JOIN books b ON b.cover_file_id=sf.id
       LEFT JOIN courses c ON c.syllabus_file_id=sf.id
       LEFT JOIN course_materials cm ON cm.file_id=sf.id
       LEFT JOIN inbox_items i ON i.file_id=sf.id
       WHERE sf.created_at < $1
         AND b.id IS NULL AND c.id IS NULL AND cm.id IS NULL AND i.id IS NULL
       GROUP BY sf.id,sf.storage_key,sf.created_at
       ORDER BY sf.created_at ASC,sf.id ASC LIMIT $2`,
      [olderThan, limit],
    );
    let metadataRowsRemoved = 0;
    const affectedStorageKeys = new Set<string>();
    for (const candidate of candidates.rows) {
      try {
        const removed = await this.database.query<StoredObjectRow>(
          `DELETE FROM stored_files WHERE id=$1 RETURNING id,storage_key`,
          [candidate.id],
        );
        if (removed.rows[0]) {
          metadataRowsRemoved += 1;
          affectedStorageKeys.add(canonicalStorageKey(removed.rows[0].storage_key));
        }
      } catch (error) {
        if ((error as { code?: string }).code !== '23503') throw error;
      }
    }

    const tracked = await this.database.query<{ storage_key: string }>(
      `SELECT DISTINCT storage_key FROM stored_files`,
    );
    const trackedKeys = new Set(tracked.rows.map((row) => canonicalStorageKey(row.storage_key)));

    let objectFilesRemoved = 0;
    for (const storageKey of affectedStorageKeys) {
      if (!trackedKeys.has(storageKey)) {
        await rm(this.resolveObject(storageKey), { force: true });
        objectFilesRemoved += 1;
      }
    }

    let rawObjectsRemoved = 0;
    for (const object of await this.listObjects()) {
      if (rawObjectsRemoved >= limit) break;
      if (trackedKeys.has(object.storageKey) || object.modifiedAt >= olderThan) continue;
      await rm(object.path, { force: true });
      objectFilesRemoved += 1;
      rawObjectsRemoved += 1;
    }
    return { metadataRowsRemoved, objectFilesRemoved };
  }

  private async acquireMaintenanceLock(): Promise<boolean> {
    await mkdir(dirname(this.maintenanceLockPath), { recursive: true });
    try {
      await writeFile(
        this.maintenanceLockPath,
        `${JSON.stringify({
          pid: process.pid,
          startedAt: this.now().toISOString(),
          purpose: 'file-cleanup',
        })}\n`,
        { encoding: 'utf8', flag: 'wx' },
      );
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  }

  public async get(id: string): Promise<StoredFile> {
    return toStoredFile(await this.getRow(id));
  }

  public async open(id: string): Promise<{
    file: StoredFile;
    sha256: string;
    createStream(range?: { start: number; end: number }): ReadStream;
  }> {
    const row = await this.getRow(id);
    const path = this.resolveObject(row.storage_key);
    try {
      await access(path, constants.R_OK);
    } catch {
      throw new NotFoundError('附件文件不存在或暂时无法读取。');
    }
    return {
      file: toStoredFile(row),
      sha256: row.sha256,
      createStream: (range) =>
        createReadStream(path, range ? { start: range.start, end: range.end } : undefined),
    };
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
    const segments = storageKeySegments(storageKey);
    const target = resolve(this.objectsRoot, ...segments);
    if (!target.startsWith(`${this.objectsRoot}${sep}`)) {
      throw new Error('附件存储路径超出工作区。');
    }
    return target;
  }

  private async listObjects(): Promise<
    Array<{ path: string; storageKey: string; modifiedAt: Date }>
  > {
    const objects: Array<{ path: string; storageKey: string; modifiedAt: Date }> = [];
    const visit = async (directory: string): Promise<void> => {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, entry.name);
        if (!path.startsWith(`${this.objectsRoot}${sep}`)) continue;
        if (entry.isDirectory()) await visit(path);
        else if (entry.isFile()) {
          objects.push({
            path,
            storageKey: relative(this.objectsRoot, path).split(sep).join('/'),
            modifiedAt: (await stat(path)).mtime,
          });
        }
      }
    };
    await visit(this.objectsRoot);
    return objects;
  }
}

export function startFileCleanup(
  files: FileStorageService,
  onError: (error: unknown) => void,
): () => void {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await files.cleanupOrphans();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  void run();
  const timer = setInterval(() => void run(), ORPHAN_CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

function cleanMimeType(value: string): string {
  const mimeType = value.split(';', 1)[0]?.trim().toLowerCase().slice(0, 120);
  return mimeType || 'application/octet-stream';
}
