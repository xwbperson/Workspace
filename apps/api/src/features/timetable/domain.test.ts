import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIMETABLE_BLOCKS,
  compressWeekNumbers,
  dateForTeachingWeek,
  meetingsOverlap,
} from './domain.js';

describe('timetable teaching calendar', () => {
  it('maps the editable first Monday to arbitrary teaching weeks', () => {
    expect(dateForTeachingWeek('2026-09-07', 1, 1)).toBe('2026-09-07');
    expect(dateForTeachingWeek('2026-09-07', 1, 7)).toBe('2026-09-13');
    expect(dateForTeachingWeek('2026-09-07', 8, 3)).toBe('2026-10-28');
  });

  it('uses the five official time ranges as an editable default template', () => {
    expect(DEFAULT_TIMETABLE_BLOCKS).toEqual([
      { label: '课 1', sourceLabel: '第 1—2 节', startTime: '08:30', endTime: '10:05' },
      { label: '课 2', sourceLabel: '第 3—4 节', startTime: '10:25', endTime: '12:00' },
      { label: '课 3', sourceLabel: '第 5—6 节', startTime: '14:00', endTime: '15:35' },
      { label: '课 4', sourceLabel: '第 7—8 节', startTime: '15:55', endTime: '17:30' },
      { label: '课 5', sourceLabel: '第 9—11 节', startTime: '19:00', endTime: '21:25' },
    ]);
  });

  it('compresses selected weeks and only flags actual overlapping weeks', () => {
    expect(compressWeekNumbers([10, 1, 2, 3, 4, 6, 8, 9])).toBe('1—4、6、8—10 周');
    expect(
      meetingsOverlap(
        { weekday: 2, timeBlockId: 'block-1', weekNumbers: [1, 3, 5] },
        { weekday: 2, timeBlockId: 'block-1', weekNumbers: [2, 4, 6] },
      ),
    ).toBe(false);
    expect(
      meetingsOverlap(
        { weekday: 2, timeBlockId: 'block-1', weekNumbers: [1, 3, 5] },
        { weekday: 2, timeBlockId: 'block-1', weekNumbers: [3, 4] },
      ),
    ).toBe(true);
  });
});
