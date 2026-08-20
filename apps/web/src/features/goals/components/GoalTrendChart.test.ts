import type { GoalMeasurement } from '@workspace/client-sdk';
import { describe, expect, it } from 'vitest';
import { downsampleMeasurements } from './GoalTrendChart.js';

function measurements(count: number): GoalMeasurement[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `measurement-${index}`,
    value: index,
    note: '',
    recordedAt: new Date(2026, 0, 1, 0, index).toISOString(),
  }));
}

describe('downsampleMeasurements', () => {
  it('preserves small data sets without allocating a replacement array', () => {
    const source = measurements(3);
    expect(downsampleMeasurements(source, 5)).toBe(source);
  });

  it('caps rendered points while preserving both ends of the history', () => {
    const source = measurements(10_000);
    const result = downsampleMeasurements(source, 500);

    expect(result).toHaveLength(500);
    expect(result[0]).toBe(source[0]);
    expect(result.at(-1)).toBe(source.at(-1));
  });
});
