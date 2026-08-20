import { describe, expect, it } from 'vitest';
import { isValidDateOnly } from './date.js';

describe('date-only validation', () => {
  it('accepts real calendar dates including leap days', () => {
    expect(isValidDateOnly('2024-02-29')).toBe(true);
    expect(isValidDateOnly('2026-08-20')).toBe(true);
  });

  it('rejects normalized and malformed dates', () => {
    expect(isValidDateOnly('2026-02-29')).toBe(false);
    expect(isValidDateOnly('2026-02-30')).toBe(false);
    expect(isValidDateOnly('2026-13-01')).toBe(false);
    expect(isValidDateOnly('2026-8-20')).toBe(false);
  });
});
