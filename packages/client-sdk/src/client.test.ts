import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkbenchClient } from './client.js';
import { MAX_UPLOAD_FILE_BYTES } from './constants.js';

function requestUrl(input: string | URL | Request): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

describe('file upload client limits', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rejects oversized files before making a network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const file = {
      name: 'large.bin',
      size: MAX_UPLOAD_FILE_BYTES + 1,
      type: 'application/octet-stream',
    } as File;

    await expect(new WorkbenchClient('/api/v1').uploadFile(file)).rejects.toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects empty files before making a network request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const file = { name: 'empty.txt', size: 0, type: 'text/plain' } as File;

    await expect(new WorkbenchClient('/api/v1').uploadFile(file)).rejects.toMatchObject({
      status: 400,
      code: 'EMPTY_FILE',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shares one CSRF bootstrap across parallel mutations', async () => {
    const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.endsWith('/auth/csrf')) {
        return new Response(JSON.stringify({ csrfToken: 'shared-token' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      expect(new Headers(init?.headers).get('X-CSRF-Token')).toBe('shared-token');
      return new Response(null, { status: 204 });
    });
    vi.stubGlobal('fetch', fetch);
    const client = new WorkbenchClient('/api/v1');

    await Promise.all([
      client.markAllNotificationsRead(),
      client.markAllNotificationsRead(),
      client.markAllNotificationsRead(),
    ]);

    expect(
      fetch.mock.calls.filter(([input]) => requestUrl(input).endsWith('/auth/csrf')),
    ).toHaveLength(1);
  });

  it('refreshes a stale CSRF token and safely retries a rejected mutation once', async () => {
    const responses = [
      new Response(JSON.stringify({ csrfToken: 'old-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ error: { code: 'CSRF_INVALID', message: 'stale token' } }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(JSON.stringify({ csrfToken: 'new-token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
      new Response(null, { status: 204 }),
    ];
    const fetch = vi.fn(async () => responses.shift()!);
    vi.stubGlobal('fetch', fetch);

    await expect(
      new WorkbenchClient('/api/v1').markAllNotificationsRead(),
    ).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
});
