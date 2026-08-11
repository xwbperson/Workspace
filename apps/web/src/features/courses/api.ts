import type {
  CourseAssignmentInput,
  CourseAssignmentUpdateInput,
  CourseClassRecordInput,
  CourseClassRecordUpdateInput,
  CourseInput,
  CourseUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const courseKeys = {
  all: ['courses'] as const,
  list: (archived: boolean) => ['courses', 'list', archived] as const,
  detail: (id: string) => ['courses', 'detail', id] as const,
};

export async function invalidateCourseData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: courseKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}

export const courseApi = {
  list(archived = false) {
    return workbenchClient.getCourses({ archived, limit: 100 });
  },
  get(id: string) {
    return workbenchClient.getCourse(id);
  },
  create(input: CourseInput) {
    return workbenchClient.createCourse(input);
  },
  update(id: string, input: CourseUpdateInput) {
    return workbenchClient.updateCourse(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveCourse(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreCourse(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteCoursePermanently(id, version);
  },
  createClassRecord(courseId: string, input: CourseClassRecordInput) {
    return workbenchClient.createCourseClassRecord(courseId, input);
  },
  updateClassRecord(courseId: string, recordId: string, input: CourseClassRecordUpdateInput) {
    return workbenchClient.updateCourseClassRecord(courseId, recordId, input);
  },
  deleteClassRecord(courseId: string, recordId: string, version: number) {
    return workbenchClient.deleteCourseClassRecord(courseId, recordId, version);
  },
  createAssignment(courseId: string, input: CourseAssignmentInput) {
    return workbenchClient.createCourseAssignment(courseId, input);
  },
  updateAssignment(courseId: string, assignmentId: string, input: CourseAssignmentUpdateInput) {
    return workbenchClient.updateCourseAssignment(courseId, assignmentId, input);
  },
  deleteAssignment(courseId: string, assignmentId: string, version: number) {
    return workbenchClient.deleteCourseAssignment(courseId, assignmentId, version);
  },
  createMaterialGroup(courseId: string, name: string) {
    return workbenchClient.createCourseMaterialGroup(courseId, { name });
  },
  deleteMaterialGroup(courseId: string, groupId: string, version: number) {
    return workbenchClient.deleteCourseMaterialGroup(courseId, groupId, version);
  },
  async uploadMaterial(courseId: string, file: File, groupId?: string) {
    const stored = await workbenchClient.uploadFile(file);
    return workbenchClient.createCourseMaterial(courseId, {
      fileId: stored.id,
      ...(groupId ? { groupId } : {}),
    });
  },
  deleteMaterial(courseId: string, materialId: string, version: number) {
    return workbenchClient.deleteCourseMaterial(courseId, materialId, version);
  },
  uploadFile(file: File) {
    return workbenchClient.uploadFile(file);
  },
};
