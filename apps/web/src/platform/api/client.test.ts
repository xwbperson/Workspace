import { describe, expect, it } from 'vitest';
import { humanizeApiError } from './client.js';

describe('humanizeApiError', () => {
  it('turns browser network failures into an actionable Chinese message', () => {
    expect(humanizeApiError(new TypeError('Failed to fetch'))).toBe(
      '无法连接服务器，请检查网络后重试。',
    );
  });
});
