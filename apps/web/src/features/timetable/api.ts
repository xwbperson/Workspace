import type {
  TimetableAdjustmentInput,
  TimetableAdjustmentUpdateInput,
  TimetableCourseInput,
  TimetableCourseUpdateInput,
  TimetableEntityStatus,
  TimetableSemesterInput,
  TimetableSemesterUpdateInput,
  TimetableTimeBlocksUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const timetableKeys = {
  all: ['timetable'] as const,
  semesters: (status: TimetableEntityStatus) => ['timetable', 'semesters', status] as const,
  courses: (semesterId: string, status: TimetableEntityStatus) =>
    ['timetable', 'courses', semesterId, status] as const,
  course: (id: string) => ['timetable', 'course', id] as const,
  occurrences: (semesterId: string, week: number) =>
    ['timetable', 'occurrences', semesterId, week] as const,
};

export async function invalidateTimetableData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: timetableKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'search'] }),
  ]);
}

export const timetableApi = {
  semesters(status: TimetableEntityStatus = 'active') {
    return workbenchClient.getTimetableSemesters(status);
  },
  semester(id: string) {
    return workbenchClient.getTimetableSemester(id);
  },
  createSemester(input: TimetableSemesterInput) {
    return workbenchClient.createTimetableSemester(input);
  },
  updateSemester(id: string, input: TimetableSemesterUpdateInput) {
    return workbenchClient.updateTimetableSemester(id, input);
  },
  updateTimeBlocks(id: string, input: TimetableTimeBlocksUpdateInput) {
    return workbenchClient.updateTimetableTimeBlocks(id, input);
  },
  archiveSemester(id: string, version: number) {
    return workbenchClient.archiveTimetableSemester(id, version);
  },
  restoreSemester(id: string, version: number) {
    return workbenchClient.restoreTimetableSemester(id, version);
  },
  deleteSemester(id: string, version: number) {
    return workbenchClient.deleteTimetableSemesterPermanently(id, version);
  },
  courses(semesterId: string, status: TimetableEntityStatus = 'active') {
    return workbenchClient.getTimetableCourses(semesterId, status);
  },
  course(id: string) {
    return workbenchClient.getTimetableCourse(id);
  },
  createCourse(input: TimetableCourseInput) {
    return workbenchClient.createTimetableCourse(input);
  },
  updateCourse(id: string, input: TimetableCourseUpdateInput) {
    return workbenchClient.updateTimetableCourse(id, input);
  },
  archiveCourse(id: string, version: number) {
    return workbenchClient.archiveTimetableCourse(id, version);
  },
  restoreCourse(id: string, version: number) {
    return workbenchClient.restoreTimetableCourse(id, version);
  },
  deleteCourse(id: string, version: number) {
    return workbenchClient.deleteTimetableCoursePermanently(id, version);
  },
  occurrences(semesterId: string, week: number) {
    return workbenchClient.getTimetableOccurrences(week, semesterId);
  },
  createAdjustment(courseId: string, input: TimetableAdjustmentInput) {
    return workbenchClient.createTimetableAdjustment(courseId, input);
  },
  updateAdjustment(id: string, input: TimetableAdjustmentUpdateInput) {
    return workbenchClient.updateTimetableAdjustment(id, input);
  },
  deleteAdjustment(id: string, version: number) {
    return workbenchClient.deleteTimetableAdjustment(id, version);
  },
};
