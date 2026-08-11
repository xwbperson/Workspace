import type {
  FocusCandidate,
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { CourseRepository } from './repository.js';

export function createCourseContributions(
  repository: CourseRepository,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'courses',
    async getFocusCandidates(): Promise<FocusCandidate[]> {
      const assignments = await repository.upcomingAssignments(
        new Date(now().getTime() - 30 * 86_400_000),
        new Date(now().getTime() + 90 * 86_400_000),
        10,
      );
      return assignments.map((assignment) => ({
        featureId: 'courses',
        recordId: assignment.id,
        title: assignment.title,
        state: assignment.status === 'in-progress' ? 'in-progress' : 'planned',
        ...(assignment.dueAt ? { dueAt: assignment.dueAt.toISOString() } : {}),
        targetRoute: `/features/courses/${assignment.courseId}`,
      }));
    },
    async getUpcoming(range): Promise<UpcomingItem[]> {
      return (
        await repository.upcomingAssignments(new Date(range.from), new Date(range.to), 20)
      ).map((assignment) => ({
        featureId: 'courses',
        recordId: assignment.id,
        type: '课程作业',
        title: assignment.title,
        occursAt: assignment.dueAt!.toISOString(),
        state: assignment.dueAt!.getTime() < now().getTime() ? 'overdue' : 'normal',
        targetRoute: `/features/courses/${assignment.courseId}`,
      }));
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.list(false, limit)).map((row) => ({
        featureId: 'courses',
        recordId: row.id,
        type: '课程',
        title: row.name,
        updatedAt: row.updatedAt.toISOString(),
        targetRoute: `/features/courses/${row.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'courses',
          blockId: 'courses:assignments',
          title: '近期作业',
          kind: 'upcoming',
          priority: 75,
          defaultVisible: true,
          targetRoute: '/features/courses',
        },
        async getData(): Promise<OverviewBlockData> {
          const assignments = await repository.upcomingAssignments(
            new Date(now().getTime() - 30 * 86_400_000),
            new Date(now().getTime() + 90 * 86_400_000),
            5,
          );
          return {
            kind: 'upcoming',
            items: assignments.map((assignment) => ({
              id: assignment.id,
              title: assignment.title,
              ...(assignment.dueAt ? { occurredAt: assignment.dueAt.toISOString() } : {}),
              targetRoute: `/features/courses/${assignment.courseId}`,
            })),
            updatedAt: now().toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'courses',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.search(input.query, input.limit)).map((row) => ({
            featureId: 'courses',
            recordId: row.id,
            type: '课程',
            title: row.name,
            ...(row.instructor || row.courseCode
              ? { snippet: [row.courseCode, row.instructor].filter(Boolean).join(' · ') }
              : {}),
            updatedAt: row.updatedAt.toISOString(),
            targetRoute: `/features/courses/${row.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'courses',
        actionId: 'create',
        label: '添加课程',
        mode: 'open-route',
        targetRoute: '/features/courses?create=1',
      },
    ],
  };
}
