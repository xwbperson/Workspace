import { describe, expect, it } from 'vitest';
import { nextRecurringDueAt } from './service.js';

describe('task recurrence dates', () => {
  it('clamps month-end recurrences instead of skipping a month', () => {
    expect(nextRecurringDueAt(new Date('2026-01-31T08:30:00.000Z'), 'monthly').toISOString()).toBe(
      '2026-02-28T08:30:00.000Z',
    );
  });

  it('clamps leap-day yearly recurrences to the last day of February', () => {
    expect(nextRecurringDueAt(new Date('2024-02-29T08:30:00.000Z'), 'yearly').toISOString()).toBe(
      '2025-02-28T08:30:00.000Z',
    );
  });
});
