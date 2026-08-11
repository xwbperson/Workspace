import type { SessionAuth } from '../platform/auth/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth: SessionAuth | null;
  }

  interface FastifyContextConfig {
    authenticated?: boolean;
    public?: boolean;
  }
}
