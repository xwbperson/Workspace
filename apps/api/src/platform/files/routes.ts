import type { FastifyInstance } from 'fastify';
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MEBIBYTES } from '@workspace/client-sdk';
import { AppError } from '../errors.js';
import type { FileStorageService } from './service.js';

const fileParamsSchema = {
  type: 'object',
  required: ['fileId'],
  properties: { fileId: { type: 'string', format: 'uuid' } },
} as const;

export async function registerFileRoutes(
  app: FastifyInstance,
  files: FileStorageService,
): Promise<void> {
  app.post('/api/v1/files', { config: { authenticated: true } }, async (request, reply) => {
    let upload;
    try {
      upload = await request.file({
        limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
        throwFileSizeLimit: false,
      });
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new AppError(
          413,
          'FILE_TOO_LARGE',
          `单个文件不能超过 ${MAX_UPLOAD_FILE_MEBIBYTES} MB。`,
        );
      }
      throw error;
    }
    if (!upload) throw new AppError(400, 'FILE_REQUIRED', '请选择要上传的文件。');
    return reply.status(201).send(
      await files.store({
        stream: upload.file,
        filename: upload.filename,
        mimeType: upload.mimetype,
        isTruncated: () => upload.file.truncated,
      }),
    );
  });

  app.get<{ Params: { fileId: string } }>(
    '/api/v1/files/:fileId/content',
    {
      config: { authenticated: true },
      schema: { params: fileParamsSchema },
    },
    async (request, reply) => {
      const opened = await files.open(request.params.fileId);
      const { file } = opened;
      const encodedName = encodeRfc5987Value(file.originalName);
      const etag = `"${opened.sha256}"`;
      const lastModified = new Date(file.createdAt).toUTCString();
      const range = parseRange(request.headers.range, file.size);
      if (range === 'invalid') {
        return reply
          .status(416)
          .header('Content-Range', `bytes */${file.size}`)
          .header('Accept-Ranges', 'bytes')
          .send();
      }
      if (matchesEtag(request.headers['if-none-match'], etag) && !range) {
        return reply.status(304).header('ETag', etag).send();
      }

      const disposition = canOpenInline(file.mimeType) ? 'inline' : 'attachment';
      const response = reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedName}`)
        .header('X-Content-Type-Options', 'nosniff')
        .header('Accept-Ranges', 'bytes')
        .header('Cache-Control', 'private, no-cache')
        .header('ETag', etag)
        .header('Last-Modified', lastModified);

      if (range) {
        return response
          .status(206)
          .header('Content-Length', String(range.end - range.start + 1))
          .header('Content-Range', `bytes ${range.start}-${range.end}/${file.size}`)
          .send(opened.createStream(range));
      }
      return response.header('Content-Length', String(file.size)).send(opened.createStream());
    },
  );
}

function canOpenInline(mimeType: string): boolean {
  return new Set([
    'application/pdf',
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
  ]).has(mimeType.toLowerCase());
}

function encodeRfc5987Value(value: string): string {
  return encodeURIComponent(value).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function matchesEtag(value: string | undefined, etag: string): boolean {
  if (!value) return false;
  return value
    .split(',')
    .map((candidate) => candidate.trim())
    .some((candidate) => candidate === '*' || candidate === etag);
}

function parseRange(
  value: string | undefined,
  size: number,
): { start: number; end: number } | 'invalid' | undefined {
  if (!value) return undefined;
  if (size <= 0) return 'invalid';
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match || (!match[1] && !match[2])) return 'invalid';

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return 'invalid';
    return { start: Math.max(size - suffixLength, 0), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= size
  ) {
    return 'invalid';
  }
  return { start, end: Math.min(requestedEnd, size - 1) };
}
