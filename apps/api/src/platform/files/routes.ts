import type { FastifyInstance } from 'fastify';
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
      upload = await request.file();
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
        throw new AppError(413, 'FILE_TOO_LARGE', '单个文件不能超过 50 MB。');
      }
      throw error;
    }
    if (!upload) throw new AppError(400, 'FILE_REQUIRED', '请选择要上传的文件。');
    const buffer = await upload.toBuffer();
    if (buffer.length === 0) throw new AppError(400, 'EMPTY_FILE', '不能上传空文件。');
    return reply.status(201).send(
      await files.store({
        buffer,
        filename: upload.filename,
        mimeType: upload.mimetype,
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
      const { file, stream } = await files.open(request.params.fileId);
      const encodedName = encodeURIComponent(file.originalName);
      return reply
        .header('Content-Type', file.mimeType)
        .header('Content-Length', String(file.size))
        .header('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`)
        .header('X-Content-Type-Options', 'nosniff')
        .send(stream);
    },
  );
}
