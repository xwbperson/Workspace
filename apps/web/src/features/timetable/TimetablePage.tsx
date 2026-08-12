import {
  ApiClientError,
  type TimetableCourse,
  type TimetableCourseInput,
  type TimetableOccurrence,
  type TimetableSemester,
} from '@workspace/client-sdk';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Edit3,
  MapPin,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Modal } from '../../components/ui/Modal.js';
import { PageTopbarActions } from '../../components/ui/PageTopbarActions.js';
import { EmptyState, PageLoader, SectionError } from '../../components/ui/States.js';
import { useToast } from '../../components/ui/ToastProvider.js';
import { humanizeApiError } from '../../platform/api/client.js';
import { timetableApi, timetableKeys, invalidateTimetableData } from './api.js';
import { AdjustmentForm } from './components/AdjustmentForm.js';
import { CourseForm } from './components/CourseForm.js';
import { SemesterForm } from './components/SemesterForm.js';
import {
  TimetableSettingsForm,
  type TimetableSettingsValue,
} from './components/TimetableSettingsForm.js';

const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const SHORT_WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDateDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function displayDate(value: string): string {
  return `${Number(value.slice(5, 7))}.${value.slice(8, 10)}`;
}

function currentTeachingWeek(semester: TimetableSemester, today = dateKey(new Date())): number {
  const first = new Date(`${semester.firstWeekMonday}T00:00:00Z`).getTime();
  const current = new Date(`${today}T00:00:00Z`).getTime();
  return Math.min(
    semester.totalWeeks,
    Math.max(1, Math.floor((current - first) / (7 * 86_400_000)) + 1),
  );
}

function weekState(semester: TimetableSemester, weekStart: string, weekEnd: string): string {
  const today = dateKey(new Date());
  if (today < semester.firstWeekMonday) return '学期未开始';
  if (today > addDateDays(semester.firstWeekMonday, semester.totalWeeks * 7 - 1)) {
    return '学期已结束';
  }
  if (today >= weekStart && today <= weekEnd) return '本周';
  return `第 ${currentTeachingWeek(semester)} 周进行中`;
}

function nowLinePosition(block: { startTime: string; endTime: string }): number | null {
  const now = new Date();
  const minute = now.getHours() * 60 + now.getMinutes();
  const [startHour = 0, startMinute = 0] = block.startTime.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = block.endTime.split(':').map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  if (minute < start || minute > end) return null;
  return ((minute - start) / (end - start)) * 100;
}

function isConflictConfirmation(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    typeof error.details === 'object' &&
    error.details !== null &&
    'code' in error.details &&
    error.details.code === 'TIMETABLE_CONFLICT_CONFIRMATION_REQUIRED'
  );
}

function CourseCard({
  occurrence,
  onSelect,
}: {
  occurrence: TimetableOccurrence;
  onSelect(occurrence: TimetableOccurrence): void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      className={`timetable-course-card color-${occurrence.color} ${occurrence.cancelled ? 'is-cancelled' : ''}`}
      onClick={() => onSelect(occurrence)}
    >
      <span className="timetable-course-card__title">
        {occurrence.courseShortName || occurrence.courseName}
      </span>
      <span className="timetable-course-card__meta">
        <MapPin aria-hidden="true" size={13} /> {occurrence.room || '教室待定'}
      </span>
      <span className="timetable-course-card__meta">
        <UserRound aria-hidden="true" size={13} /> {occurrence.instructors.join('、') || '教师待定'}
      </span>
      <span className="timetable-course-card__weeks">{occurrence.weekLabel}</span>
      <span className="timetable-course-card__badges">
        {occurrence.conflict ? (
          <span className="timetable-badge timetable-badge--warning">
            <TriangleAlert aria-hidden="true" size={12} /> 冲突
          </span>
        ) : null}
        {occurrence.adjustment ? (
          <span className="timetable-badge">
            {occurrence.cancelled
              ? '已停课'
              : occurrence.adjustment.type === 'reschedule'
                ? '已调课'
                : '有变更'}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function TimetablePage(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const { show } = useToast();
  const courseParam = searchParams.get('course');
  const requestedWeek = Number(searchParams.get('week') ?? 0);
  const [selectedSemesterId, setSelectedSemesterId] = useState('');
  const [week, setWeek] = useState(requestedWeek > 0 ? requestedWeek : 1);
  const [mobileWeekday, setMobileWeekday] = useState(1);
  const [archivedView, setArchivedView] = useState(false);
  const [semesterOpen, setSemesterOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [courseOpen, setCourseOpen] = useState(false);
  const [courseEditOpen, setCourseEditOpen] = useState(false);
  const [courseDetailOpen, setCourseDetailOpen] = useState(Boolean(courseParam));
  const [occurrenceOpen, setOccurrenceOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);
  const [deleteCourseOpen, setDeleteCourseOpen] = useState(false);
  const [deleteSemester, setDeleteSemester] = useState<TimetableSemester | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState(courseParam ?? '');
  const [selectedOccurrence, setSelectedOccurrence] = useState<TimetableOccurrence | null>(null);
  const [preset, setPreset] = useState<{ weekday: number; timeBlockId: string } | null>(null);
  const [conflictMessage, setConflictMessage] = useState('');
  const createParamHandled = useRef(false);

  const activeSemesters = useQuery({
    queryKey: timetableKeys.semesters('active'),
    queryFn: () => timetableApi.semesters('active'),
  });
  const archivedSemesters = useQuery({
    queryKey: timetableKeys.semesters('archived'),
    queryFn: () => timetableApi.semesters('archived'),
  });
  const courseLookup = useQuery({
    queryKey: timetableKeys.course(selectedCourseId),
    queryFn: () => timetableApi.course(selectedCourseId),
    enabled: Boolean(selectedCourseId),
  });
  const semesters = useMemo(() => activeSemesters.data?.items ?? [], [activeSemesters.data]);
  const currentSemester = useMemo(
    () =>
      semesters.find((semester) => semester.id === selectedSemesterId) ??
      semesters.find((semester) => semester.isCurrent) ??
      semesters[0],
    [selectedSemesterId, semesters],
  );

  useEffect(() => {
    if (courseLookup.data?.semesterId && courseLookup.data.semesterId !== selectedSemesterId) {
      setSelectedSemesterId(courseLookup.data.semesterId);
    }
  }, [courseLookup.data, selectedSemesterId]);

  useEffect(() => {
    if (!currentSemester) return;
    if (currentSemester.id !== selectedSemesterId) setSelectedSemesterId(currentSemester.id);
    const nextWeek =
      requestedWeek >= 1 && requestedWeek <= currentSemester.totalWeeks
        ? requestedWeek
        : currentTeachingWeek(currentSemester);
    setWeek((current) =>
      current < 1 || current > currentSemester.totalWeeks || !selectedSemesterId
        ? nextWeek
        : current,
    );
    const weekStart = addDateDays(currentSemester.firstWeekMonday, (nextWeek - 1) * 7);
    const today = dateKey(new Date());
    if (today >= weekStart && today <= addDateDays(weekStart, 6)) {
      const day = new Date(`${today}T00:00:00Z`).getUTCDay();
      setMobileWeekday(day === 0 ? 7 : day);
    }
  }, [currentSemester, requestedWeek, selectedSemesterId]);

  const occurrences = useQuery({
    queryKey: timetableKeys.occurrences(currentSemester?.id ?? '', week),
    queryFn: () => timetableApi.occurrences(currentSemester!.id, week),
    enabled: Boolean(currentSemester) && !archivedView,
  });
  const courses = useQuery({
    queryKey: timetableKeys.courses(
      currentSemester?.id ?? '',
      archivedView ? 'archived' : 'active',
    ),
    queryFn: () => timetableApi.courses(currentSemester!.id, archivedView ? 'archived' : 'active'),
    enabled: Boolean(currentSemester),
  });
  const selectedCourse =
    courseLookup.data ?? courses.data?.items.find((course) => course.id === selectedCourseId);

  useEffect(() => {
    if (createParamHandled.current || searchParams.get('create') !== '1') return;
    if (activeSemesters.isLoading) return;
    createParamHandled.current = true;
    if (currentSemester) setCourseOpen(true);
    else setSemesterOpen(true);
  }, [activeSemesters.isLoading, currentSemester, searchParams]);

  const createSemester = useMutation({
    mutationFn: timetableApi.createSemester,
    onSuccess: async (semester) => {
      await invalidateTimetableData();
      setSelectedSemesterId(semester.id);
      setSemesterOpen(false);
      setWeek(1);
      show('学期课表已创建');
    },
  });
  const saveSettings = useMutation({
    mutationFn: async (value: TimetableSettingsValue) => {
      const updated = await timetableApi.updateSemester(currentSemester!.id, {
        ...value.semester,
        version: currentSemester!.version,
      });
      return timetableApi.updateTimeBlocks(updated.id, {
        semesterVersion: updated.version,
        blocks: value.blocks,
      });
    },
    onSuccess: async () => {
      await invalidateTimetableData();
      setSettingsOpen(false);
      show('课程表设置已保存');
    },
  });
  const createCourse = useMutation({
    mutationFn: timetableApi.createCourse,
    onSuccess: async (course) => {
      await invalidateTimetableData();
      setCourseOpen(false);
      setPreset(null);
      setConflictMessage('');
      setSelectedCourseId(course.id);
      show('课表课程已添加');
    },
  });
  const updateCourse = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TimetableCourseInput }) =>
      timetableApi.updateCourse(id, { ...input, version: selectedCourse!.version }),
    onSuccess: async () => {
      await invalidateTimetableData();
      setCourseEditOpen(false);
      setConflictMessage('');
      show('课表课程已更新');
    },
  });
  const archiveCourse = useMutation({
    mutationFn: (course: TimetableCourse) => timetableApi.archiveCourse(course.id, course.version),
    onSuccess: async () => {
      await invalidateTimetableData();
      setCourseDetailOpen(false);
      setSelectedCourseId('');
      show('课表课程已归档');
    },
  });
  const restoreCourse = useMutation({
    mutationFn: (course: TimetableCourse) => timetableApi.restoreCourse(course.id, course.version),
    onSuccess: async () => {
      await invalidateTimetableData();
      setCourseDetailOpen(false);
      setSelectedCourseId('');
      show('课表课程已恢复');
    },
  });
  const permanentDeleteCourse = useMutation({
    mutationFn: (course: TimetableCourse) => timetableApi.deleteCourse(course.id, course.version),
    onSuccess: async () => {
      await invalidateTimetableData();
      setDeleteCourseOpen(false);
      setCourseDetailOpen(false);
      setSelectedCourseId('');
      show('课表课程已永久删除');
    },
  });
  const archiveSemester = useMutation({
    mutationFn: (semester: TimetableSemester) =>
      timetableApi.archiveSemester(semester.id, semester.version),
    onSuccess: async () => {
      await invalidateTimetableData();
      setSettingsOpen(false);
      setSelectedSemesterId('');
      show('学期课表已归档');
    },
  });
  const restoreSemester = useMutation({
    mutationFn: (semester: TimetableSemester) =>
      timetableApi.restoreSemester(semester.id, semester.version),
    onSuccess: async (semester) => {
      await invalidateTimetableData();
      setSelectedSemesterId(semester.id);
      show('学期课表已恢复');
    },
  });
  const permanentDeleteSemester = useMutation({
    mutationFn: (semester: TimetableSemester) =>
      timetableApi.deleteSemester(semester.id, semester.version),
    onSuccess: async () => {
      await invalidateTimetableData();
      setDeleteSemester(null);
      show('学期课表已永久删除');
    },
  });
  const saveAdjustment = useMutation({
    mutationFn: async (input: Parameters<typeof timetableApi.createAdjustment>[1]) => {
      if (!selectedOccurrence) throw new Error('没有选择课程实例。');
      return selectedOccurrence.adjustment
        ? timetableApi.updateAdjustment(selectedOccurrence.adjustment.id, {
            ...input,
            version: selectedOccurrence.adjustment.version,
          })
        : timetableApi.createAdjustment(selectedOccurrence.courseId, input);
    },
    onSuccess: async () => {
      await invalidateTimetableData();
      setAdjustmentOpen(false);
      setOccurrenceOpen(false);
      setSelectedOccurrence(null);
      show('临时调整已保存');
    },
  });
  const removeAdjustment = useMutation({
    mutationFn: (occurrence: TimetableOccurrence) =>
      timetableApi.deleteAdjustment(occurrence.adjustment!.id, occurrence.adjustment!.version),
    onSuccess: async () => {
      await invalidateTimetableData();
      setOccurrenceOpen(false);
      setSelectedOccurrence(null);
      show('已恢复原上课安排');
    },
  });

  const operationError =
    createSemester.error ??
    saveSettings.error ??
    (!isConflictConfirmation(createCourse.error) ? createCourse.error : null) ??
    (!isConflictConfirmation(updateCourse.error) ? updateCourse.error : null) ??
    archiveCourse.error ??
    restoreCourse.error ??
    permanentDeleteCourse.error ??
    archiveSemester.error ??
    restoreSemester.error ??
    permanentDeleteSemester.error ??
    saveAdjustment.error ??
    removeAdjustment.error;

  const submitCourse = async (input: TimetableCourseInput, editing = false): Promise<void> => {
    const payload = { ...input, allowConflicts: Boolean(conflictMessage) };
    try {
      if (editing && selectedCourse) {
        await updateCourse.mutateAsync({ id: selectedCourse.id, input: payload });
      } else {
        await createCourse.mutateAsync(payload);
      }
    } catch (error) {
      if (isConflictConfirmation(error)) setConflictMessage(humanizeApiError(error));
    }
  };

  if (activeSemesters.isLoading) return <PageLoader label="正在加载课程表" />;
  if (activeSemesters.isError) {
    return (
      <SectionError
        message={humanizeApiError(activeSemesters.error)}
        onRetry={() => void activeSemesters.refetch()}
      />
    );
  }

  if (!currentSemester) {
    return (
      <div className="feature-shell-page feature-shell-page--timetable">
        <EmptyState
          title="先设置第一个学期"
          description="确认第一周周一和五个默认课段后，就可以逐门添加课程。"
          action={
            <button
              type="button"
              className="button button--primary"
              onClick={() => setSemesterOpen(true)}
            >
              <CalendarClock aria-hidden="true" size={18} /> 初始化课程表
            </button>
          }
        />
        <Modal
          open={semesterOpen}
          title="设置第一个学期"
          description="默认作息来自西电研究生院通知，保存后仍可修改。"
          onClose={() => setSemesterOpen(false)}
          className="modal--wide"
          footer={
            <>
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setSemesterOpen(false)}
              >
                取消
              </button>
              <button
                type="submit"
                form="timetable-semester-create"
                className="button button--primary"
                disabled={createSemester.isPending}
              >
                {createSemester.isPending ? '正在保存…' : '创建学期'}
              </button>
            </>
          }
        >
          <SemesterForm
            formId="timetable-semester-create"
            onSubmit={async (input) => {
              await createSemester.mutateAsync(input);
            }}
          />
        </Modal>
      </div>
    );
  }

  const weekStart =
    occurrences.data?.weekStart ?? addDateDays(currentSemester.firstWeekMonday, (week - 1) * 7);
  const weekEnd = occurrences.data?.weekEnd ?? addDateDays(weekStart, 6);
  const visibleWeekdays = currentSemester.showWeekend ? 7 : 5;
  const occurrenceItems = occurrences.data?.items ?? [];
  const today = dateKey(new Date());

  return (
    <div className="feature-shell-page feature-shell-page--timetable">
      <PageTopbarActions>
        <button
          type="button"
          className="button button--primary"
          onClick={() => {
            setPreset(null);
            setConflictMessage('');
            setCourseOpen(true);
          }}
        >
          <Plus aria-hidden="true" size={18} /> <span>添加课程</span>
        </button>
      </PageTopbarActions>
      {operationError ? (
        <SectionError title="操作没有完成" message={humanizeApiError(operationError)} />
      ) : null}
      <section className="timetable-toolbar" aria-label="课表浏览工具">
        <div className="timetable-toolbar__semester">
          <span className="eyebrow">当前学期</span>
          <select
            aria-label="选择学期"
            value={currentSemester.id}
            onChange={(event) => {
              setSelectedSemesterId(event.target.value);
              const semester = semesters.find((item) => item.id === event.target.value);
              setWeek(semester ? currentTeachingWeek(semester) : 1);
            }}
          >
            {semesters.map((semester) => (
              <option value={semester.id} key={semester.id}>
                {semester.shortName} · {semester.name}
              </option>
            ))}
          </select>
        </div>
        <div className="timetable-week-switcher">
          <button
            type="button"
            className="icon-button"
            aria-label="上一周"
            disabled={week <= 1}
            onClick={() => setWeek((value) => Math.max(1, value - 1))}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <div>
            <strong>第 {week} 周</strong>
            <span>
              {displayDate(weekStart)}—{displayDate(weekEnd)} ·{' '}
              {weekState(currentSemester, weekStart, weekEnd)}
            </span>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="下一周"
            disabled={week >= currentSemester.totalWeeks}
            onClick={() => setWeek((value) => Math.min(currentSemester.totalWeeks, value + 1))}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setWeek(currentTeachingWeek(currentSemester))}
          >
            本周
          </button>
        </div>
        <div className="timetable-toolbar__actions">
          <button
            type="button"
            className={`button button--quiet ${archivedView ? 'active' : ''}`}
            onClick={() => setArchivedView((value) => !value)}
          >
            <Archive aria-hidden="true" size={17} /> {archivedView ? '返回课表' : '已归档'}
          </button>
          <button
            type="button"
            className="button button--quiet"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 aria-hidden="true" size={17} /> 设置
          </button>
        </div>
      </section>

      {archivedView ? (
        <section className="timetable-archive-panel">
          <header>
            <div>
              <p className="eyebrow">当前学期</p>
              <h2>已归档课程</h2>
            </div>
            <span>{courses.data?.items.length ?? 0} 门</span>
          </header>
          {courses.isError ? (
            <SectionError
              message={humanizeApiError(courses.error)}
              onRetry={() => void courses.refetch()}
            />
          ) : courses.data?.items.length ? (
            <div className="timetable-archive-list">
              {courses.data.items.map((course) => (
                <button
                  type="button"
                  key={course.id}
                  onClick={() => {
                    setSelectedCourseId(course.id);
                    setCourseDetailOpen(true);
                  }}
                >
                  <span className={`timetable-color-dot color-${course.color}`} />
                  <span>
                    <strong>{course.name}</strong>
                    <small>{course.instructors.join('、') || '教师待定'}</small>
                  </span>
                  <ArchiveRestore aria-hidden="true" size={18} />
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              title="没有已归档课程"
              description="归档课程后，可以在这里恢复或永久删除。"
            />
          )}
        </section>
      ) : occurrences.isError ? (
        <SectionError
          message={humanizeApiError(occurrences.error)}
          onRetry={() => void occurrences.refetch()}
        />
      ) : (
        <>
          <section
            className={`timetable-grid ${currentSemester.showWeekend ? 'has-weekend' : ''}`}
            aria-label={`第 ${week} 周课程表`}
          >
            <div className="timetable-grid__corner">
              <span>教学周</span>
              <strong>
                {week}/{currentSemester.totalWeeks}
              </strong>
            </div>
            {Array.from({ length: visibleWeekdays }, (_, index) => {
              const day = index + 1;
              const date = addDateDays(weekStart, index);
              return (
                <div
                  className={`timetable-day-heading ${date === today ? 'is-today' : ''}`}
                  key={day}
                >
                  <span>{WEEKDAYS[index]}</span>
                  <strong>{displayDate(date)}</strong>
                </div>
              );
            })}
            {currentSemester.timeBlocks.flatMap((block) => [
              <div className="timetable-time-label" key={`label-${block.id}`}>
                <strong>{block.label}</strong>
                <span>{block.sourceLabel}</span>
                <time>
                  {block.startTime}
                  <br />
                  {block.endTime}
                </time>
              </div>,
              ...Array.from({ length: visibleWeekdays }, (_, index) => {
                const day = index + 1;
                const date = addDateDays(weekStart, index);
                const cellItems = occurrenceItems.filter(
                  (item) => item.weekday === day && item.timeBlock.id === block.id,
                );
                const nowPosition = date === today ? nowLinePosition(block) : null;
                return (
                  <div
                    className={`timetable-cell ${date === today ? 'is-today' : ''}`}
                    key={`${block.id}-${day}`}
                  >
                    {nowPosition !== null ? (
                      <span
                        className="timetable-now-line"
                        style={{ top: `${nowPosition}%` }}
                        aria-label="当前时间"
                      />
                    ) : null}
                    {cellItems.map((occurrence) => (
                      <CourseCard
                        occurrence={occurrence}
                        key={occurrence.occurrenceId}
                        onSelect={(item) => {
                          setSelectedOccurrence(item);
                          setOccurrenceOpen(true);
                        }}
                      />
                    ))}
                    {cellItems.length === 0 ? (
                      <button
                        type="button"
                        className="timetable-empty-cell"
                        aria-label={`${WEEKDAYS[index]}${block.label}添加课程`}
                        onClick={() => {
                          setPreset({ weekday: day, timeBlockId: block.id });
                          setConflictMessage('');
                          setCourseOpen(true);
                        }}
                      >
                        <Plus aria-hidden="true" size={15} /> 添加
                      </button>
                    ) : null}
                  </div>
                );
              }),
            ])}
          </section>

          <section className="timetable-mobile" aria-label={`第 ${week} 周按天课程表`}>
            <div className="timetable-mobile__days" role="tablist" aria-label="选择星期">
              {Array.from({ length: visibleWeekdays }, (_, index) => {
                const day = index + 1;
                const date = addDateDays(weekStart, index);
                return (
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mobileWeekday === day}
                    className={`${mobileWeekday === day ? 'active' : ''} ${date === today ? 'is-today' : ''}`}
                    key={day}
                    onClick={() => setMobileWeekday(day)}
                  >
                    <span>{SHORT_WEEKDAYS[index]}</span>
                    <strong>{Number(date.slice(8, 10))}</strong>
                  </button>
                );
              })}
            </div>
            <div className="timetable-mobile__list">
              {currentSemester.timeBlocks.map((block) => {
                const cellItems = occurrenceItems.filter(
                  (item) => item.weekday === mobileWeekday && item.timeBlock.id === block.id,
                );
                return (
                  <article className="timetable-mobile-slot" key={block.id}>
                    <header>
                      <div>
                        <strong>{block.label}</strong>
                        <span>{block.sourceLabel}</span>
                      </div>
                      <time>
                        {block.startTime}—{block.endTime}
                      </time>
                    </header>
                    {cellItems.length ? (
                      cellItems.map((occurrence) => (
                        <CourseCard
                          occurrence={occurrence}
                          key={occurrence.occurrenceId}
                          onSelect={(item) => {
                            setSelectedOccurrence(item);
                            setOccurrenceOpen(true);
                          }}
                        />
                      ))
                    ) : (
                      <button
                        type="button"
                        className="timetable-mobile-slot__empty"
                        onClick={() => {
                          setPreset({ weekday: mobileWeekday, timeBlockId: block.id });
                          setCourseOpen(true);
                        }}
                      >
                        <Plus aria-hidden="true" size={15} /> 这个课段没有课程
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      <Modal
        open={semesterOpen}
        title="新建学期课表"
        description="可以复制默认作息，课程不会从其他学期自动带入。"
        onClose={() => setSemesterOpen(false)}
        className="modal--wide"
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setSemesterOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              form="timetable-semester-create"
              className="button button--primary"
              disabled={createSemester.isPending}
            >
              {createSemester.isPending ? '正在保存…' : '创建学期'}
            </button>
          </>
        }
      >
        <SemesterForm
          formId="timetable-semester-create"
          onSubmit={async (input) => {
            await createSemester.mutateAsync(input);
          }}
        />
      </Modal>

      <Modal
        open={settingsOpen}
        title="课程表设置"
        description={`${currentSemester.shortName} · 日期和作息修改后整张课表同步更新`}
        onClose={() => setSettingsOpen(false)}
        className="modal--timetable-settings"
        footer={
          <>
            <button
              type="button"
              className="button button--danger-quiet"
              onClick={() => archiveSemester.mutate(currentSemester)}
              disabled={archiveSemester.isPending}
            >
              <Archive aria-hidden="true" size={16} /> 归档学期
            </button>
            <span className="modal-footer-spacer" />
            <button
              type="button"
              className="button button--quiet"
              onClick={() => {
                setSettingsOpen(false);
                setSemesterOpen(true);
              }}
            >
              新建学期
            </button>
            <button
              type="submit"
              form="timetable-settings"
              className="button button--primary"
              disabled={saveSettings.isPending}
            >
              {saveSettings.isPending ? '正在保存…' : '保存设置'}
            </button>
          </>
        }
      >
        <TimetableSettingsForm
          formId="timetable-settings"
          semester={currentSemester}
          onSubmit={async (value) => {
            await saveSettings.mutateAsync(value);
          }}
        />
        <section className="timetable-semester-manager">
          <header>
            <div>
              <p className="eyebrow">历史学期</p>
              <h3>已归档学期</h3>
            </div>
          </header>
          {archivedSemesters.data?.items.length ? (
            <div>
              {archivedSemesters.data.items.map((semester) => (
                <article key={semester.id}>
                  <span>
                    <strong>{semester.shortName}</strong>
                    <small>{semester.name}</small>
                  </span>
                  <button
                    type="button"
                    className="button button--quiet"
                    onClick={() => restoreSemester.mutate(semester)}
                  >
                    恢复
                  </button>
                  <button
                    type="button"
                    className="icon-button danger-action"
                    aria-label={`永久删除${semester.name}`}
                    onClick={() => {
                      setSettingsOpen(false);
                      setDeleteSemester(semester);
                    }}
                  >
                    <Trash2 aria-hidden="true" size={17} />
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p>还没有已归档学期。</p>
          )}
        </section>
      </Modal>

      <Modal
        open={courseOpen}
        title="添加课表课程"
        description={`${currentSemester.shortName} · 可在一门课中添加多条上课安排`}
        onClose={() => {
          setCourseOpen(false);
          setConflictMessage('');
          setPreset(null);
        }}
        className="modal--timetable-course"
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setCourseOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              form="timetable-course-create"
              className="button button--primary"
              disabled={createCourse.isPending}
            >
              {createCourse.isPending ? '正在保存…' : conflictMessage ? '仍然保存' : '添加课程'}
            </button>
          </>
        }
      >
        <CourseForm
          formId="timetable-course-create"
          semester={currentSemester}
          {...(preset ? { preset } : {})}
          {...(conflictMessage ? { conflictMessage } : {})}
          onSubmit={async (input) => submitCourse(input)}
        />
      </Modal>

      <Modal
        open={courseEditOpen}
        title="编辑课表课程"
        description="修改后会重新计算受影响的教学周。"
        onClose={() => {
          setCourseEditOpen(false);
          setConflictMessage('');
        }}
        className="modal--timetable-course"
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setCourseEditOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              form="timetable-course-edit"
              className="button button--primary"
              disabled={updateCourse.isPending}
            >
              {updateCourse.isPending ? '正在保存…' : conflictMessage ? '仍然保存' : '保存修改'}
            </button>
          </>
        }
      >
        {selectedCourse ? (
          <CourseForm
            formId="timetable-course-edit"
            semester={currentSemester}
            course={selectedCourse}
            {...(conflictMessage ? { conflictMessage } : {})}
            onSubmit={async (input) => submitCourse(input, true)}
          />
        ) : null}
      </Modal>

      <Modal
        open={courseDetailOpen}
        title={selectedCourse?.name ?? '课表课程'}
        description={selectedCourse?.shortName || '课程详情'}
        onClose={() => setCourseDetailOpen(false)}
        className="modal--wide"
        footer={
          selectedCourse ? (
            selectedCourse.status === 'archived' ? (
              <>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => restoreCourse.mutate(selectedCourse)}
                >
                  <ArchiveRestore aria-hidden="true" size={17} /> 恢复课程
                </button>
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    setCourseDetailOpen(false);
                    setDeleteCourseOpen(true);
                  }}
                >
                  <Trash2 aria-hidden="true" size={17} /> 永久删除
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => archiveCourse.mutate(selectedCourse)}
                >
                  <Archive aria-hidden="true" size={17} /> 归档
                </button>
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => {
                    setCourseDetailOpen(false);
                    setCourseEditOpen(true);
                  }}
                >
                  <Edit3 aria-hidden="true" size={17} /> 编辑课程
                </button>
              </>
            )
          ) : null
        }
      >
        {selectedCourse ? (
          <div className="timetable-course-detail">
            <div className="timetable-course-detail__summary">
              <span className={`timetable-color-dot color-${selectedCourse.color}`} />
              <p>
                <UserRound aria-hidden="true" size={16} />{' '}
                {selectedCourse.instructors.join('、') || '教师待定'}
              </p>
              <p>{selectedCourse.notes || '没有补充备注。'}</p>
            </div>
            <div className="timetable-course-detail__meetings">
              {selectedCourse.meetings.map((meeting) => {
                const block = currentSemester.timeBlocks.find(
                  (candidate) => candidate.id === meeting.timeBlockId,
                );
                return (
                  <article key={meeting.id}>
                    <strong>
                      {WEEKDAYS[meeting.weekday - 1]} · {block?.label ?? '未知课段'}
                    </strong>
                    <span>
                      {block?.startTime}—{block?.endTime} · {meeting.room || '教室待定'}
                    </span>
                    <small>{meeting.weekNumbers.join('、')} 周</small>
                  </article>
                );
              })}
            </div>
          </div>
        ) : courseLookup.isLoading ? (
          <PageLoader label="正在加载课程" />
        ) : null}
      </Modal>

      <Modal
        open={occurrenceOpen}
        title={selectedOccurrence?.courseName ?? '本次课程'}
        {...(selectedOccurrence
          ? { description: `${selectedOccurrence.date} · ${selectedOccurrence.timeBlock.label}` }
          : {})}
        onClose={() => setOccurrenceOpen(false)}
        className="modal--wide"
        footer={
          selectedOccurrence ? (
            <>
              {selectedOccurrence.adjustment ? (
                <button
                  type="button"
                  className="button button--quiet"
                  onClick={() => removeAdjustment.mutate(selectedOccurrence)}
                >
                  <RotateCcw aria-hidden="true" size={17} /> 恢复原安排
                </button>
              ) : null}
              <span className="modal-footer-spacer" />
              <button
                type="button"
                className="button button--quiet"
                onClick={() => {
                  setSelectedCourseId(selectedOccurrence.courseId);
                  setOccurrenceOpen(false);
                  setCourseDetailOpen(true);
                }}
              >
                查看课程
              </button>
              <button
                type="button"
                className="button button--primary"
                onClick={() => {
                  setOccurrenceOpen(false);
                  setAdjustmentOpen(true);
                }}
              >
                临时调整
              </button>
            </>
          ) : null
        }
      >
        {selectedOccurrence ? (
          <div className="timetable-occurrence-detail">
            <div>
              <span>时间</span>
              <strong>
                {selectedOccurrence.timeBlock.startTime}—{selectedOccurrence.timeBlock.endTime}
              </strong>
            </div>
            <div>
              <span>教室</span>
              <strong>{selectedOccurrence.room || '教室待定'}</strong>
            </div>
            <div>
              <span>教师</span>
              <strong>{selectedOccurrence.instructors.join('、') || '教师待定'}</strong>
            </div>
            <div>
              <span>周次</span>
              <strong>{selectedOccurrence.weekLabel}</strong>
            </div>
            {selectedOccurrence.adjustment ? (
              <p className="timetable-adjustment-note">
                {selectedOccurrence.cancelled ? '本次已停课。' : '本次课程有临时调整。'}{' '}
                {selectedOccurrence.adjustment.note}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={adjustmentOpen}
        title="临时调整本次课程"
        description="只影响这一次，不改变其他教学周。"
        onClose={() => setAdjustmentOpen(false)}
        className="modal--wide"
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setAdjustmentOpen(false)}
            >
              取消
            </button>
            <button
              type="submit"
              form="timetable-adjustment"
              className="button button--primary"
              disabled={saveAdjustment.isPending}
            >
              {saveAdjustment.isPending ? '正在保存…' : '保存调整'}
            </button>
          </>
        }
      >
        {selectedOccurrence ? (
          <AdjustmentForm
            formId="timetable-adjustment"
            occurrence={selectedOccurrence}
            semester={currentSemester}
            onSubmit={async (input) => {
              await saveAdjustment.mutateAsync(input);
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={deleteCourseOpen}
        title="永久删除课表课程"
        description="课程、上课安排和临时调整都会一起删除。"
        onClose={() => setDeleteCourseOpen(false)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setDeleteCourseOpen(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={!selectedCourse || permanentDeleteCourse.isPending}
              onClick={() => selectedCourse && permanentDeleteCourse.mutate(selectedCourse)}
            >
              永久删除
            </button>
          </>
        }
      >
        <p>这个操作无法撤销，只对已归档课程开放。</p>
      </Modal>

      <Modal
        open={Boolean(deleteSemester)}
        title="永久删除学期课表"
        description="该学期中的所有课程和调整都会一起删除。"
        onClose={() => setDeleteSemester(null)}
        footer={
          <>
            <button
              type="button"
              className="button button--quiet"
              onClick={() => setDeleteSemester(null)}
            >
              取消
            </button>
            <button
              type="button"
              className="button button--danger"
              disabled={!deleteSemester || permanentDeleteSemester.isPending}
              onClick={() => deleteSemester && permanentDeleteSemester.mutate(deleteSemester)}
            >
              永久删除
            </button>
          </>
        }
      >
        <p>这个操作无法撤销。</p>
      </Modal>
    </div>
  );
}
