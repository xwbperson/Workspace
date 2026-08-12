import { randomUUID } from 'node:crypto';
import type {
  TimetableAdjustment,
  TimetableAdjustmentInput,
  TimetableAdjustmentUpdateInput,
  TimetableColor,
  TimetableCourse,
  TimetableCourseInput,
  TimetableCourseUpdateInput,
  TimetableEntityStatus,
  TimetableMeeting,
  TimetableMeetingInput,
  TimetableOccurrence,
  TimetableOccurrenceListResponse,
  TimetableSemester,
  TimetableSemesterInput,
  TimetableSemesterUpdateInput,
  TimetableTimeBlocksUpdateInput,
} from '@workspace/client-sdk';
import { AppError, ConflictError, NotFoundError } from '../../platform/errors.js';
import {
  DEFAULT_TIMETABLE_BLOCKS,
  addDateDays,
  compressWeekNumbers,
  dateForTeachingWeek,
  isMonday,
  meetingsOverlap,
  normalizeWeekNumbers,
  shanghaiDateTime,
  validDateOnly,
  validTimeOnly,
} from './domain.js';
import type {
  TimetableAdjustmentRow,
  TimetableCourseRow,
  TimetableRepository,
  TimetableSemesterRow,
} from './repository.js';

const COLORS = new Set<TimetableColor>(['teal', 'blue', 'violet', 'amber', 'rose', 'slate']);

function text(value: string | undefined, name: string, max: number, required = false): string {
  const normalized = value?.trim() ?? '';
  if ((required && !normalized) || normalized.length > max) {
    throw new AppError(
      400,
      'INVALID_TIMETABLE_TEXT',
      `${name}${required ? `需要 1—${max}` : `不能超过 ${max}`} 个字符。`,
    );
  }
  return normalized;
}

function names(values: readonly string[] | undefined, name: string): string[] {
  const normalized = [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
  if (normalized.length > 12 || normalized.some((value) => value.length > 40)) {
    throw new AppError(
      400,
      'INVALID_TIMETABLE_NAMES',
      `${name}最多填写 12 项，每项不超过 40 个字符。`,
    );
  }
  return normalized;
}

function totalWeeks(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 30) {
    throw new AppError(400, 'INVALID_TIMETABLE_TOTAL_WEEKS', '教学周总数必须在 1—30 之间。');
  }
  return value;
}

function weekday(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw new AppError(400, 'INVALID_TIMETABLE_WEEKDAY', '星期必须在周一至周日之间。');
  }
  return value;
}

function courseColor(value: TimetableColor | undefined): TimetableColor {
  const normalized = value ?? 'teal';
  if (!COLORS.has(normalized)) {
    throw new AppError(400, 'INVALID_TIMETABLE_COLOR', '课程颜色无效。');
  }
  return normalized;
}

function rowFromSemester(semester: TimetableSemester): TimetableSemesterRow {
  return {
    id: semester.id,
    name: semester.name,
    shortName: semester.shortName,
    firstWeekMonday: semester.firstWeekMonday,
    totalWeeks: semester.totalWeeks,
    isCurrent: semester.isCurrent,
    showWeekend: semester.showWeekend,
    status: semester.status,
    version: semester.version,
    createdAt: new Date(semester.createdAt),
    updatedAt: new Date(semester.updatedAt),
  };
}

function rowFromCourse(course: TimetableCourse): TimetableCourseRow {
  return {
    id: course.id,
    semesterId: course.semesterId,
    name: course.name,
    shortName: course.shortName,
    instructors: course.instructors,
    color: course.color,
    notes: course.notes,
    status: course.status,
    version: course.version,
    createdAt: new Date(course.createdAt),
    updatedAt: new Date(course.updatedAt),
  };
}

function rowFromAdjustment(adjustment: TimetableAdjustment): TimetableAdjustmentRow {
  return {
    id: adjustment.id,
    courseId: adjustment.courseId,
    meetingId: adjustment.meetingId,
    originalDate: adjustment.originalDate,
    type: adjustment.type,
    ...(adjustment.newDate ? { newDate: adjustment.newDate } : {}),
    ...(adjustment.newTimeBlockId ? { newTimeBlockId: adjustment.newTimeBlockId } : {}),
    ...(adjustment.room !== undefined ? { room: adjustment.room } : {}),
    ...(adjustment.instructors !== undefined ? { instructors: adjustment.instructors } : {}),
    note: adjustment.note,
    version: adjustment.version,
    createdAt: new Date(adjustment.createdAt),
    updatedAt: new Date(adjustment.updatedAt),
  };
}

export class TimetableService {
  public constructor(
    private readonly repository: TimetableRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async listSemesters(
    status: TimetableEntityStatus = 'active',
  ): Promise<{ items: TimetableSemester[] }> {
    return { items: await this.repository.listSemesters(status) };
  }

  public async getSemester(id: string): Promise<TimetableSemester> {
    const semester = await this.repository.getSemester(id);
    if (!semester) throw new NotFoundError('没有找到该学期课表。');
    return semester;
  }

  public async createSemester(input: TimetableSemesterInput): Promise<TimetableSemester> {
    const firstWeekMonday = validDateOnly(input.firstWeekMonday, '第一周周一');
    if (!isMonday(firstWeekMonday)) {
      throw new AppError(400, 'TIMETABLE_FIRST_WEEK_NOT_MONDAY', '第一周基准日必须是周一。');
    }
    const now = this.now();
    const current = await this.repository.getCurrentSemester();
    const id = randomUUID();
    const row: TimetableSemesterRow = {
      id,
      name: text(input.name, '学期名称', 120, true),
      shortName: text(input.shortName, '学期简称', 40, true),
      firstWeekMonday,
      totalWeeks: totalWeeks(input.totalWeeks),
      isCurrent: input.makeCurrent ?? !current,
      showWeekend: input.showWeekend ?? true,
      status: 'active',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    return this.repository.createSemester({
      row,
      blocks: DEFAULT_TIMETABLE_BLOCKS.map((block, index) => ({
        id: randomUUID(),
        semesterId: id,
        ...block,
        position: index + 1,
        version: 1,
      })),
    });
  }

  public async updateSemester(
    id: string,
    input: TimetableSemesterUpdateInput,
  ): Promise<TimetableSemester> {
    const existing = await this.getSemester(id);
    if (existing.status === 'archived') throw new NotFoundError('没有找到该使用中的学期课表。');
    const firstWeekMonday =
      input.firstWeekMonday === undefined
        ? existing.firstWeekMonday
        : validDateOnly(input.firstWeekMonday, '第一周周一');
    if (!isMonday(firstWeekMonday)) {
      throw new AppError(400, 'TIMETABLE_FIRST_WEEK_NOT_MONDAY', '第一周基准日必须是周一。');
    }
    const nextTotalWeeks =
      input.totalWeeks === undefined ? existing.totalWeeks : totalWeeks(input.totalWeeks);
    const courses = await this.repository.listCourses(id, 'active');
    const outOfRange = courses.flatMap((course) =>
      course.meetings.flatMap((meeting) =>
        meeting.weekNumbers.filter((week) => week > nextTotalWeeks),
      ),
    );
    if (outOfRange.length > 0) {
      throw new ConflictError('缩短学期会移除已有课程周次，请先调整课程。', {
        highestSelectedWeek: Math.max(...outOfRange),
      });
    }
    const row = rowFromSemester(existing);
    row.name = input.name === undefined ? existing.name : text(input.name, '学期名称', 120, true);
    row.shortName =
      input.shortName === undefined
        ? existing.shortName
        : text(input.shortName, '学期简称', 40, true);
    row.firstWeekMonday = firstWeekMonday;
    row.totalWeeks = nextTotalWeeks;
    row.showWeekend = input.showWeekend ?? existing.showWeekend;
    row.isCurrent = input.makeCurrent ?? existing.isCurrent;
    row.updatedAt = this.now();
    const updated = await this.repository.updateSemester(row, input.version);
    if (!updated) throw await this.semesterConflict(id);
    return updated;
  }

  public async updateTimeBlocks(
    semesterId: string,
    input: TimetableTimeBlocksUpdateInput,
  ): Promise<TimetableSemester> {
    const semester = await this.getSemester(semesterId);
    if (semester.status === 'archived') throw new NotFoundError('没有找到该使用中的学期课表。');
    if (input.blocks.length !== 5) {
      throw new AppError(400, 'TIMETABLE_REQUIRES_FIVE_BLOCKS', '课程表必须保留五个课段。');
    }
    const existingIds = new Set(semester.timeBlocks.map((block) => block.id));
    const ids = new Set(input.blocks.map((block) => block.id));
    const positions = new Set(input.blocks.map((block) => block.position));
    if (
      ids.size !== 5 ||
      positions.size !== 5 ||
      input.blocks.some(
        (block) => !existingIds.has(block.id) || block.position < 1 || block.position > 5,
      )
    ) {
      throw new AppError(400, 'INVALID_TIMETABLE_BLOCK_SET', '课段集合与当前学期不一致。');
    }
    const blocks = input.blocks
      .map((block) => ({
        id: block.id,
        semesterId,
        label: text(block.label, '课段名称', 20, true),
        sourceLabel: text(block.sourceLabel, '原节次说明', 40),
        startTime: validTimeOnly(block.startTime, '开始时间'),
        endTime: validTimeOnly(block.endTime, '结束时间'),
        position: block.position,
        version: block.version,
      }))
      .toSorted((left, right) => left.position - right.position);
    if (new Set(blocks.map((block) => block.label)).size !== 5) {
      throw new AppError(400, 'DUPLICATE_TIMETABLE_BLOCK_LABEL', '五个课段名称不能重复。');
    }
    for (const block of blocks) {
      if (block.endTime <= block.startTime) {
        throw new AppError(
          400,
          'INVALID_TIMETABLE_BLOCK_RANGE',
          `${block.label}的结束时间必须晚于开始时间。`,
        );
      }
    }
    for (let index = 1; index < blocks.length; index += 1) {
      if (blocks[index]!.startTime < blocks[index - 1]!.endTime) {
        throw new AppError(400, 'OVERLAPPING_TIMETABLE_BLOCKS', '课段时间不能相互重叠。');
      }
    }
    const updated = await this.repository.updateTimeBlocks(
      semesterId,
      blocks,
      input.semesterVersion,
      this.now(),
    );
    if (!updated) throw await this.semesterConflict(semesterId);
    return updated;
  }

  public async archiveSemester(id: string, version: number): Promise<void> {
    const semester = await this.getSemester(id);
    if (semester.status === 'archived') throw new NotFoundError('没有找到该使用中的学期课表。');
    if (!(await this.repository.archiveSemester(id, version, this.now()))) {
      throw await this.semesterConflict(id);
    }
  }

  public async restoreSemester(id: string, version: number): Promise<TimetableSemester> {
    const semester = await this.getSemester(id);
    if (semester.status !== 'archived') throw new ConflictError('该学期课表尚未归档。');
    const restored = await this.repository.restoreSemester(id, version, this.now());
    if (!restored) throw await this.semesterConflict(id);
    return restored;
  }

  public async deleteSemesterPermanently(id: string, version: number): Promise<void> {
    const semester = await this.getSemester(id);
    if (semester.status !== 'archived') throw new ConflictError('只能永久删除已归档的学期课表。');
    if (!(await this.repository.deleteSemester(id, version))) throw await this.semesterConflict(id);
  }

  public async listCourses(input: {
    semesterId: string;
    status?: TimetableEntityStatus;
  }): Promise<{ items: TimetableCourse[] }> {
    await this.getSemester(input.semesterId);
    return {
      items: await this.repository.listCourses(input.semesterId, input.status ?? 'active'),
    };
  }

  public async getCourse(id: string): Promise<TimetableCourse> {
    const course = await this.repository.getCourse(id);
    if (!course) throw new NotFoundError('没有找到该课表课程。');
    return course;
  }

  private normalizeMeetings(
    courseId: string,
    inputs: readonly TimetableMeetingInput[],
    semester: TimetableSemester,
    existing?: TimetableCourse,
  ): TimetableMeeting[] {
    if (inputs.length < 1 || inputs.length > 20) {
      throw new AppError(400, 'INVALID_TIMETABLE_MEETING_COUNT', '每门课程需要 1—20 条上课安排。');
    }
    const blockIds = new Set(semester.timeBlocks.map((block) => block.id));
    const existingIds = new Set(existing?.meetings.map((meeting) => meeting.id) ?? []);
    const seenIds = new Set<string>();
    return inputs.map((input, index) => {
      if (!blockIds.has(input.timeBlockId)) {
        throw new AppError(400, 'INVALID_TIMETABLE_BLOCK', '上课安排使用了其他学期的课段。');
      }
      const id = input.id && existingIds.has(input.id) ? input.id : randomUUID();
      if (seenIds.has(id)) {
        throw new AppError(400, 'DUPLICATE_TIMETABLE_MEETING', '上课安排不能重复提交。');
      }
      seenIds.add(id);
      return {
        id,
        courseId,
        timeBlockId: input.timeBlockId,
        weekday: weekday(input.weekday),
        room: text(input.room, '教室', 120),
        instructorOverride: names(input.instructorOverride, '安排教师'),
        weekNumbers: normalizeWeekNumbers(input.weekNumbers, semester.totalWeeks),
        position: index + 1,
        version: existing?.meetings.find((meeting) => meeting.id === id)?.version ?? 1,
      };
    });
  }

  private async assertNoUnconfirmedConflicts(input: {
    semesterId: string;
    courseId: string;
    meetings: TimetableMeeting[];
    allowConflicts: boolean;
  }): Promise<void> {
    const existing = await this.repository.listCourses(input.semesterId, 'active');
    const candidates = [
      ...existing
        .filter((course) => course.id !== input.courseId)
        .flatMap((course) =>
          course.meetings.map((meeting) => ({
            courseId: course.id,
            courseName: course.name,
            meeting,
            isIncoming: false,
          })),
        ),
      ...input.meetings.map((meeting) => ({
        courseId: input.courseId,
        courseName: '当前课程',
        meeting,
        isIncoming: true,
      })),
    ];
    const conflicts: Array<{
      leftCourseId: string;
      rightCourseId: string;
      weekday: number;
      timeBlockId: string;
      weeks: number[];
    }> = [];
    for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
        const left = candidates[leftIndex]!;
        const right = candidates[rightIndex]!;
        if (!left.isIncoming && !right.isIncoming) continue;
        if (!meetingsOverlap(left.meeting, right.meeting)) continue;
        const rightWeeks = new Set(right.meeting.weekNumbers);
        conflicts.push({
          leftCourseId: left.courseId,
          rightCourseId: right.courseId,
          weekday: left.meeting.weekday,
          timeBlockId: left.meeting.timeBlockId,
          weeks: left.meeting.weekNumbers.filter((week) => rightWeeks.has(week)),
        });
      }
    }
    if (conflicts.length > 0 && !input.allowConflicts) {
      throw new ConflictError('上课时间与已有安排冲突，确认后可以继续保存。', {
        code: 'TIMETABLE_CONFLICT_CONFIRMATION_REQUIRED',
        conflicts,
      });
    }
  }

  public async createCourse(input: TimetableCourseInput): Promise<TimetableCourse> {
    const semester = await this.getSemester(input.semesterId);
    if (semester.status === 'archived') throw new ConflictError('不能向已归档学期添加课程。');
    const now = this.now();
    const id = randomUUID();
    const meetings = this.normalizeMeetings(id, input.meetings, semester);
    await this.assertNoUnconfirmedConflicts({
      semesterId: semester.id,
      courseId: id,
      meetings,
      allowConflicts: input.allowConflicts ?? false,
    });
    return this.repository.createCourse({
      row: {
        id,
        semesterId: semester.id,
        name: text(input.name, '课程名称', 80, true),
        shortName: text(input.shortName, '课程简称', 30),
        instructors: names(input.instructors, '教师'),
        color: courseColor(input.color),
        notes: text(input.notes, '备注', 5000),
        status: 'active',
        version: 1,
        createdAt: now,
        updatedAt: now,
      },
      meetings,
    });
  }

  public async updateCourse(
    id: string,
    input: TimetableCourseUpdateInput,
  ): Promise<TimetableCourse> {
    const existing = await this.getCourse(id);
    if (existing.status === 'archived') throw new NotFoundError('没有找到该使用中的课表课程。');
    if (input.semesterId !== undefined && input.semesterId !== existing.semesterId) {
      throw new AppError(
        400,
        'TIMETABLE_COURSE_SEMESTER_IMMUTABLE',
        '不能把课程移动到另一个学期。',
      );
    }
    const semester = await this.getSemester(existing.semesterId);
    const meetings =
      input.meetings === undefined
        ? existing.meetings
        : this.normalizeMeetings(id, input.meetings, semester, existing);
    await this.assertNoUnconfirmedConflicts({
      semesterId: semester.id,
      courseId: id,
      meetings,
      allowConflicts: input.allowConflicts ?? false,
    });
    const row = rowFromCourse(existing);
    row.name = input.name === undefined ? existing.name : text(input.name, '课程名称', 80, true);
    row.shortName =
      input.shortName === undefined ? existing.shortName : text(input.shortName, '课程简称', 30);
    row.instructors =
      input.instructors === undefined ? existing.instructors : names(input.instructors, '教师');
    row.color = input.color === undefined ? existing.color : courseColor(input.color);
    row.notes = input.notes === undefined ? existing.notes : text(input.notes, '备注', 5000);
    row.updatedAt = this.now();
    const updated = await this.repository.updateCourse(row, meetings, input.version);
    if (!updated) throw await this.courseConflict(id);
    return updated;
  }

  public async archiveCourse(id: string, version: number): Promise<void> {
    const course = await this.getCourse(id);
    if (course.status === 'archived') throw new NotFoundError('没有找到该使用中的课表课程。');
    if (!(await this.repository.archiveCourse(id, version, this.now()))) {
      throw await this.courseConflict(id);
    }
  }

  public async restoreCourse(id: string, version: number): Promise<TimetableCourse> {
    const course = await this.getCourse(id);
    if (course.status !== 'archived') throw new ConflictError('该课表课程尚未归档。');
    const semester = await this.getSemester(course.semesterId);
    if (semester.status === 'archived') throw new ConflictError('请先恢复该课程所属的学期。');
    const restored = await this.repository.restoreCourse(id, version, this.now());
    if (!restored) throw await this.courseConflict(id);
    return restored;
  }

  public async deleteCoursePermanently(id: string, version: number): Promise<void> {
    const course = await this.getCourse(id);
    if (course.status !== 'archived') throw new ConflictError('只能永久删除已归档的课表课程。');
    if (!(await this.repository.deleteCourse(id, version))) throw await this.courseConflict(id);
  }

  private allOccurrences(
    semester: TimetableSemester,
    courses: readonly TimetableCourse[],
    adjustments: readonly TimetableAdjustment[],
  ): TimetableOccurrence[] {
    const blockMap = new Map(semester.timeBlocks.map((block) => [block.id, block]));
    const adjustmentMap = new Map(
      adjustments.map((adjustment) => [
        `${adjustment.meetingId}:${adjustment.originalDate}`,
        adjustment,
      ]),
    );
    const items: TimetableOccurrence[] = [];
    for (const course of courses) {
      for (const meeting of course.meetings) {
        const originalBlock = blockMap.get(meeting.timeBlockId);
        if (!originalBlock) continue;
        for (const weekNumber of meeting.weekNumbers) {
          const originalDate = dateForTeachingWeek(
            semester.firstWeekMonday,
            weekNumber,
            meeting.weekday,
          );
          const adjustment = adjustmentMap.get(`${meeting.id}:${originalDate}`);
          const effectiveBlock =
            adjustment?.newTimeBlockId === undefined
              ? originalBlock
              : (blockMap.get(adjustment.newTimeBlockId) ?? originalBlock);
          const effectiveDate = adjustment?.newDate ?? originalDate;
          items.push({
            occurrenceId: `${meeting.id}:${originalDate}`,
            courseId: course.id,
            meetingId: meeting.id,
            semesterId: semester.id,
            date: effectiveDate,
            originalDate,
            weekNumber,
            weekday: new Date(`${effectiveDate}T00:00:00Z`).getUTCDay() || 7,
            courseName: course.name,
            courseShortName: course.shortName,
            instructors:
              adjustment?.instructors ??
              (meeting.instructorOverride.length > 0
                ? meeting.instructorOverride
                : course.instructors),
            room: adjustment?.room ?? meeting.room,
            color: course.color,
            notes: course.notes,
            weekLabel: compressWeekNumbers(meeting.weekNumbers),
            timeBlock: effectiveBlock,
            conflict: false,
            cancelled: adjustment?.type === 'cancel',
            ...(adjustment ? { adjustment } : {}),
          });
        }
      }
    }
    const groups = new Map<string, TimetableOccurrence[]>();
    for (const item of items) {
      if (item.cancelled) continue;
      const key = `${item.date}:${item.timeBlock.id}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      for (const item of group) item.conflict = true;
    }
    return items;
  }

  public async occurrences(input: {
    semesterId?: string;
    week: number;
  }): Promise<TimetableOccurrenceListResponse> {
    const semester = input.semesterId
      ? await this.getSemester(input.semesterId)
      : await this.repository.getCurrentSemester();
    if (!semester) throw new NotFoundError('还没有当前学期，请先设置学期课表。');
    const weekNumber = normalizeWeekNumbers([input.week], semester.totalWeeks)[0]!;
    const weekStart = dateForTeachingWeek(semester.firstWeekMonday, weekNumber, 1);
    const weekEnd = addDateDays(weekStart, 6);
    const [courses, adjustments] = await Promise.all([
      this.repository.listCourses(semester.id, 'active'),
      this.repository.listAdjustments(semester.id),
    ]);
    const items = this.allOccurrences(semester, courses, adjustments)
      .filter((item) => item.date >= weekStart && item.date <= weekEnd)
      .toSorted(
        (left, right) =>
          left.date.localeCompare(right.date) ||
          left.timeBlock.position - right.timeBlock.position ||
          left.courseName.localeCompare(right.courseName, 'zh-CN'),
      );
    return { semester, weekNumber, weekStart, weekEnd, items };
  }

  public async occurrenceRange(from: string, to: string): Promise<TimetableOccurrence[]> {
    validDateOnly(from, '开始日期');
    validDateOnly(to, '结束日期');
    const semester = await this.repository.getCurrentSemester();
    if (!semester || to < semester.firstWeekMonday) return [];
    const [courses, adjustments] = await Promise.all([
      this.repository.listCourses(semester.id, 'active'),
      this.repository.listAdjustments(semester.id),
    ]);
    return this.allOccurrences(semester, courses, adjustments)
      .filter((item) => !item.cancelled && item.date >= from && item.date <= to)
      .toSorted(
        (left, right) =>
          left.date.localeCompare(right.date) || left.timeBlock.position - right.timeBlock.position,
      );
  }

  private async validateAdjustment(
    courseId: string,
    input: TimetableAdjustmentInput,
  ): Promise<{
    course: TimetableCourse;
    semester: TimetableSemester;
    meeting: TimetableMeeting;
    values: Omit<TimetableAdjustmentRow, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
  }> {
    const course = await this.getCourse(courseId);
    if (course.status === 'archived') throw new ConflictError('不能调整已归档课程。');
    const semester = await this.getSemester(course.semesterId);
    const meeting = course.meetings.find((candidate) => candidate.id === input.meetingId);
    if (!meeting) throw new NotFoundError('没有找到该上课安排。');
    const originalDate = validDateOnly(input.originalDate, '原上课日期');
    const validOriginal = meeting.weekNumbers.some(
      (week) =>
        dateForTeachingWeek(semester.firstWeekMonday, week, meeting.weekday) === originalDate,
    );
    if (!validOriginal)
      throw new AppError(400, 'INVALID_TIMETABLE_OCCURRENCE', '原上课日期不属于该安排。');
    const type = input.type;
    const newDate = input.newDate ? validDateOnly(input.newDate, '调课日期') : undefined;
    const newTimeBlockId = input.newTimeBlockId ?? undefined;
    if (type === 'reschedule') {
      if (!newDate || !newTimeBlockId) {
        throw new AppError(
          400,
          'TIMETABLE_RESCHEDULE_TARGET_REQUIRED',
          '调课必须选择新日期和新课段。',
        );
      }
      if (!semester.timeBlocks.some((block) => block.id === newTimeBlockId)) {
        throw new AppError(400, 'INVALID_TIMETABLE_BLOCK', '调课使用了其他学期的课段。');
      }
    }
    return {
      course,
      semester,
      meeting,
      values: {
        courseId,
        meetingId: meeting.id,
        originalDate,
        type,
        ...(newDate ? { newDate } : {}),
        ...(newTimeBlockId ? { newTimeBlockId } : {}),
        ...(input.room !== undefined && input.room !== null
          ? { room: text(input.room, '教室', 120) }
          : {}),
        ...(input.instructors !== undefined && input.instructors !== null
          ? { instructors: names(input.instructors, '教师') }
          : {}),
        note: text(input.note, '调整说明', 1000),
      },
    };
  }

  public async createAdjustment(
    courseId: string,
    input: TimetableAdjustmentInput,
  ): Promise<TimetableAdjustment> {
    const { values } = await this.validateAdjustment(courseId, input);
    const duplicate = (
      await this.repository.listAdjustments((await this.getCourse(courseId)).semesterId)
    ).find(
      (item) => item.meetingId === values.meetingId && item.originalDate === values.originalDate,
    );
    if (duplicate) throw new ConflictError('这一次课程已经有临时调整，请直接编辑现有调整。');
    const now = this.now();
    return this.repository.createAdjustment({
      id: randomUUID(),
      ...values,
      version: 1,
      createdAt: now,
      updatedAt: now,
    });
  }

  public async updateAdjustment(
    id: string,
    input: TimetableAdjustmentUpdateInput,
  ): Promise<TimetableAdjustment> {
    const existing = await this.repository.getAdjustment(id);
    if (!existing) throw new NotFoundError('没有找到该临时调整。');
    const merged: TimetableAdjustmentInput = {
      meetingId: input.meetingId ?? existing.meetingId,
      originalDate: input.originalDate ?? existing.originalDate,
      type: input.type ?? existing.type,
      newDate: input.newDate === undefined ? (existing.newDate ?? null) : input.newDate,
      newTimeBlockId:
        input.newTimeBlockId === undefined
          ? (existing.newTimeBlockId ?? null)
          : input.newTimeBlockId,
      room: input.room === undefined ? (existing.room ?? null) : input.room,
      instructors:
        input.instructors === undefined ? (existing.instructors ?? null) : input.instructors,
      note: input.note ?? existing.note,
    };
    const { values } = await this.validateAdjustment(existing.courseId, merged);
    const row = rowFromAdjustment(existing);
    Object.assign(row, values, { updatedAt: this.now() });
    delete row.newDate;
    delete row.newTimeBlockId;
    delete row.room;
    delete row.instructors;
    Object.assign(row, values);
    const updated = await this.repository.updateAdjustment(row, input.version);
    if (!updated) throw new ConflictError('临时调整已在其他位置修改，请刷新后重试。');
    return updated;
  }

  public async deleteAdjustment(id: string, version: number): Promise<void> {
    if (!(await this.repository.getAdjustment(id))) throw new NotFoundError('没有找到该临时调整。');
    if (!(await this.repository.deleteAdjustment(id, version))) {
      throw new ConflictError('临时调整已在其他位置修改，请刷新后重试。');
    }
  }

  public occurrenceStart(occurrence: TimetableOccurrence): string {
    return shanghaiDateTime(occurrence.date, occurrence.timeBlock.startTime);
  }

  private async semesterConflict(id: string): Promise<ConflictError> {
    return new ConflictError('学期课表已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getSemester(id))?.version,
    });
  }

  private async courseConflict(id: string): Promise<ConflictError> {
    return new ConflictError('课表课程已在其他位置修改，请刷新后重试。', {
      currentVersion: (await this.repository.getCourse(id))?.version,
    });
  }
}
