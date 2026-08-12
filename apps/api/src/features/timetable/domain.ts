import { AppError } from '../../platform/errors.js';

export interface TimetableBlockTemplate {
  label: string;
  sourceLabel: string;
  startTime: string;
  endTime: string;
}

export const DEFAULT_TIMETABLE_BLOCKS: readonly TimetableBlockTemplate[] = [
  { label: '课 1', sourceLabel: '第 1—2 节', startTime: '08:30', endTime: '10:05' },
  { label: '课 2', sourceLabel: '第 3—4 节', startTime: '10:25', endTime: '12:00' },
  { label: '课 3', sourceLabel: '第 5—6 节', startTime: '14:00', endTime: '15:35' },
  { label: '课 4', sourceLabel: '第 7—8 节', startTime: '15:55', endTime: '17:30' },
  { label: '课 5', sourceLabel: '第 9—11 节', startTime: '19:00', endTime: '21:25' },
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validDateOnly(value: string, name = '日期'): string {
  if (!DATE_PATTERN.test(value)) {
    throw new AppError(400, 'INVALID_TIMETABLE_DATE', `${name}无效。`);
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AppError(400, 'INVALID_TIMETABLE_DATE', `${name}无效。`);
  }
  return value;
}

export function validTimeOnly(value: string, name = '时间'): string {
  if (!TIME_PATTERN.test(value)) {
    throw new AppError(400, 'INVALID_TIMETABLE_TIME', `${name}无效。`);
  }
  return value;
}

export function isMonday(value: string): boolean {
  return new Date(`${validDateOnly(value)}T00:00:00Z`).getUTCDay() === 1;
}

export function addDateDays(value: string, days: number): string {
  const date = new Date(`${validDateOnly(value)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dateForTeachingWeek(
  firstWeekMonday: string,
  weekNumber: number,
  weekday: number,
): string {
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 60) {
    throw new AppError(400, 'INVALID_TIMETABLE_WEEK', '教学周必须是有效的正整数。');
  }
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
    throw new AppError(400, 'INVALID_TIMETABLE_WEEKDAY', '星期必须在周一至周日之间。');
  }
  return addDateDays(firstWeekMonday, (weekNumber - 1) * 7 + weekday - 1);
}

export function shanghaiDateTime(date: string, time: string): string {
  validDateOnly(date);
  validTimeOnly(time);
  return new Date(`${date}T${time}:00+08:00`).toISOString();
}

export function normalizeWeekNumbers(values: readonly number[], totalWeeks?: number): number[] {
  const result = [...new Set(values)].toSorted((left, right) => left - right);
  const maximum = totalWeeks ?? 60;
  if (
    result.length === 0 ||
    result.some((value) => !Number.isInteger(value) || value < 1 || value > maximum)
  ) {
    throw new AppError(
      400,
      'INVALID_TIMETABLE_WEEKS',
      `上课周次必须在 1—${maximum} 周之间，并且至少选择一周。`,
    );
  }
  return result;
}

export function compressWeekNumbers(values: readonly number[]): string {
  if (values.length === 0) return '未选择周次';
  const weeks = [...new Set(values)].toSorted((left, right) => left - right);
  const ranges: string[] = [];
  let start = weeks[0]!;
  let end = start;
  for (const week of weeks.slice(1)) {
    if (week === end + 1) {
      end = week;
      continue;
    }
    ranges.push(start === end ? `${start}` : `${start}—${end}`);
    start = week;
    end = week;
  }
  ranges.push(start === end ? `${start}` : `${start}—${end}`);
  return `${ranges.join('、')} 周`;
}

export function meetingsOverlap(
  left: { weekday: number; timeBlockId: string; weekNumbers: readonly number[] },
  right: { weekday: number; timeBlockId: string; weekNumbers: readonly number[] },
): boolean {
  if (left.weekday !== right.weekday || left.timeBlockId !== right.timeBlockId) return false;
  const leftWeeks = new Set(left.weekNumbers);
  return right.weekNumbers.some((week) => leftWeeks.has(week));
}
