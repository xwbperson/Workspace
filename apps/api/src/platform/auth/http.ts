import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AppConfig } from '../../config.js';
import { AppError, UnauthorizedError } from '../errors.js';
import { createSecretToken } from './crypto.js';
import { csrfCookieOptions, getCookieNames, sessionCookieOptions } from './session-cookie.js';
import type { AuthService } from './service.js';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function requestOrigin(request: FastifyRequest): string | null {
  const origin = request.headers.origin;
  if (origin) return origin;
  const referer = request.headers.referer;
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

function verifySameOrigin(request: FastifyRequest, config: AppConfig): void {
  if (!MUTATION_METHODS.has(request.method)) return;
  if (requestOrigin(request) !== config.appOrigin) {
    throw new AppError(403, 'ORIGIN_MISMATCH', '请求来源校验失败。');
  }
}

function setReplacementCookie(
  reply: FastifyReply,
  config: AppConfig,
  value: string,
  maxAgeSeconds?: number,
): void {
  reply.setCookie(
    getCookieNames(config).session,
    value,
    sessionCookieOptions(config, maxAgeSeconds),
  );
}

export function registerAuthenticationHooks(
  app: FastifyInstance,
  config: AppConfig,
  authService: AuthService,
): void {
  app.decorateRequest('auth', null);
  app.addHook('onRoute', (route) => {
    if (!route.url.startsWith('/api/v1')) return;
    if (route.config?.public === true) return;
    if (route.config?.authenticated !== true) {
      throw new Error(`API 路由 ${route.method.toString()} ${route.url} 未声明 authenticated。`);
    }
  });

  app.addHook('preHandler', async (request, reply) => {
    verifySameOrigin(request, config);
    if (request.routeOptions.config.public === true) return;
    const names = getCookieNames(config);
    const session = await authService.authenticate(request.cookies[names.session]);
    request.auth = session.auth;
    if (session.replacementCookieValue) {
      setReplacementCookie(
        reply,
        config,
        session.replacementCookieValue,
        session.replacementCookieMaxAgeSeconds,
      );
    }

    if (MUTATION_METHODS.has(request.method)) {
      const headerToken = request.headers['x-csrf-token'];
      const cookieToken = request.cookies[names.csrf];
      if (
        typeof headerToken !== 'string' ||
        !cookieToken ||
        headerToken !== cookieToken ||
        !authService.csrfMatches(session.auth, headerToken)
      ) {
        throw new AppError(403, 'CSRF_INVALID', 'CSRF 校验失败，请刷新页面后重试。');
      }
    }
  });
}

export async function registerAuthRoutes(
  app: FastifyInstance,
  config: AppConfig,
  authService: AuthService,
): Promise<void> {
  const names = getCookieNames(config);

  app.get('/api/v1/auth/csrf', { config: { public: true } }, async (request, reply) => {
    const csrfToken = createSecretToken();
    const sessionCookie = request.cookies[names.session];
    if (sessionCookie) {
      try {
        const session = await authService.refreshCsrf(sessionCookie, csrfToken);
        if (session.replacementCookieValue) {
          setReplacementCookie(
            reply,
            config,
            session.replacementCookieValue,
            session.replacementCookieMaxAgeSeconds,
          );
        }
      } catch (error) {
        if (!(error instanceof UnauthorizedError)) throw error;
      }
    }
    reply.setCookie(names.csrf, csrfToken, csrfCookieOptions(config));
    return { csrfToken };
  });

  app.post<{
    Body: { username: 'owner'; password: string; remember: boolean; clientLabel?: string };
  }>(
    '/api/v1/auth/login',
    {
      config: { public: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['username', 'password', 'remember'],
          properties: {
            username: { type: 'string', const: 'owner' },
            password: { type: 'string', minLength: 1, maxLength: 128 },
            remember: { type: 'boolean' },
            clientLabel: { type: 'string', minLength: 1, maxLength: 80 },
          },
        },
      },
    },
    async (request, reply) => {
      const headerToken = request.headers['x-csrf-token'];
      const cookieToken = request.cookies[names.csrf];
      if (typeof headerToken !== 'string' || !cookieToken || headerToken !== cookieToken) {
        throw new AppError(403, 'CSRF_INVALID', 'CSRF 校验失败，请刷新页面后重试。');
      }
      const result = await authService.login(
        request.body,
        request.ip,
        headerToken,
        request.headers['user-agent'],
      );
      setReplacementCookie(reply, config, result.cookieValue, result.maxAgeSeconds);
      return result.response;
    },
  );

  app.get('/api/v1/auth/session', { config: { authenticated: true } }, async (request) => {
    const session = (await authService.listSessions(request.auth!.sessionId)).find(
      (candidate) => candidate.current,
    );
    if (!session) throw new UnauthorizedError();
    return {
      authenticated: true as const,
      owner: { id: request.auth!.userId, username: 'owner' as const },
      session,
    };
  });

  app.post('/api/v1/auth/logout', { config: { authenticated: true } }, async (request, reply) => {
    await authService.logoutFamily(request.auth!.sessionFamilyId);
    reply.clearCookie(names.session, sessionCookieOptions(config));
    reply.clearCookie(names.csrf, csrfCookieOptions(config));
    return reply.status(204).send();
  });

  app.get('/api/v1/auth/sessions', { config: { authenticated: true } }, async (request) =>
    authService.listSessions(request.auth!.sessionId),
  );

  app.patch<{ Params: { sessionId: string }; Body: { clientLabel: string } }>(
    '/api/v1/auth/sessions/:sessionId',
    {
      config: { authenticated: true },
      schema: {
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string', format: 'uuid' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['clientLabel'],
          properties: { clientLabel: { type: 'string', minLength: 1, maxLength: 80 } },
        },
      },
    },
    async (request) =>
      authService.renameSession(
        request.params.sessionId,
        request.auth!.sessionId,
        request.body.clientLabel,
      ),
  );

  app.delete<{ Params: { sessionId: string } }>(
    '/api/v1/auth/sessions/:sessionId',
    {
      config: { authenticated: true },
      schema: {
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request, reply) => {
      await authService.revokeSession(request.params.sessionId);
      if (request.params.sessionId === request.auth!.sessionId) {
        reply.clearCookie(names.session, sessionCookieOptions(config));
        reply.clearCookie(names.csrf, csrfCookieOptions(config));
      }
      return reply.status(204).send();
    },
  );

  app.post(
    '/api/v1/auth/sessions/logout-others',
    { config: { authenticated: true } },
    async (request, reply) => {
      await authService.logoutOtherSessions(request.auth!.sessionFamilyId);
      return reply.status(204).send();
    },
  );

  app.put<{ Body: { currentPassword: string; newPassword: string } }>(
    '/api/v1/auth/password',
    {
      config: { authenticated: true },
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 1, maxLength: 128 },
            newPassword: { type: 'string', minLength: 12, maxLength: 128 },
          },
        },
      },
    },
    async (request, reply) => {
      await authService.changePassword(request.body.currentPassword, request.body.newPassword);
      reply.clearCookie(names.session, sessionCookieOptions(config));
      reply.clearCookie(names.csrf, csrfCookieOptions(config));
      return reply.status(204).send();
    },
  );
}
