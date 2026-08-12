import type {
  OverviewBlockData,
  RecentItem,
  SearchResultItem,
  UpcomingItem,
} from '@workspace/client-sdk';
import type { WorkbenchContributionProvider } from '../../app/workbench-contracts.js';
import type { TimetableRepository } from './repository.js';
import type { TimetableService } from './service.js';

function shanghaiDateKey(value: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function createTimetableContributions(
  repository: TimetableRepository,
  service: TimetableService,
  now: () => Date = () => new Date(),
): WorkbenchContributionProvider {
  return {
    featureId: 'timetable',
    async getUpcoming(range): Promise<UpcomingItem[]> {
      const current = now();
      const occurrences = await service.occurrenceRange(
        shanghaiDateKey(new Date(range.from)),
        shanghaiDateKey(new Date(range.to)),
      );
      return occurrences.slice(0, 30).map((occurrence) => {
        const occursAt = service.occurrenceStart(occurrence);
        const distance = new Date(occursAt).getTime() - current.getTime();
        return {
          featureId: 'timetable',
          recordId: occurrence.courseId,
          occurrenceId: occurrence.occurrenceId,
          type: '课程',
          title: occurrence.courseName,
          occursAt,
          state: distance >= 0 && distance <= 86_400_000 ? 'near' : 'normal',
          targetRoute: `/features/timetable?course=${occurrence.courseId}&week=${occurrence.weekNumber}`,
        };
      });
    },
    async getRecent(limit): Promise<RecentItem[]> {
      return (await repository.recentCourses(limit)).map((course) => ({
        featureId: 'timetable',
        recordId: course.id,
        type: '课表课程',
        title: course.name,
        updatedAt: course.updatedAt,
        targetRoute: `/features/timetable?course=${course.id}`,
      }));
    },
    overviewBlocks: [
      {
        definition: {
          featureId: 'timetable',
          blockId: 'timetable:today',
          title: '今日课程',
          kind: 'upcoming',
          priority: 96,
          defaultVisible: true,
          targetRoute: '/features/timetable',
        },
        async getData(): Promise<OverviewBlockData> {
          const current = now();
          const date = shanghaiDateKey(current);
          const occurrences = await service.occurrenceRange(date, date);
          return {
            kind: 'upcoming',
            items: occurrences.map((occurrence) => ({
              id: occurrence.occurrenceId,
              title: occurrence.courseName,
              subtitle: `${occurrence.timeBlock.startTime} · ${occurrence.room || '教室待定'}`,
              occurredAt: service.occurrenceStart(occurrence),
              targetRoute: `/features/timetable?course=${occurrence.courseId}&week=${occurrence.weekNumber}`,
            })),
            updatedAt: current.toISOString(),
          };
        },
      },
    ],
    search: {
      featureId: 'timetable',
      async search(input): Promise<{ items: SearchResultItem[] }> {
        return {
          items: (await repository.searchCourses(input.query, input.limit)).map((course) => ({
            featureId: 'timetable',
            recordId: course.id,
            type: '课表课程',
            title: course.name,
            snippet: [course.instructors.join('、'), course.meetings[0]?.room]
              .filter(Boolean)
              .join(' · '),
            updatedAt: course.updatedAt,
            targetRoute: `/features/timetable?course=${course.id}`,
          })),
        };
      },
    },
    quickCreateActions: [
      {
        featureId: 'timetable',
        actionId: 'create',
        label: '添加课表课程',
        mode: 'open-route',
        targetRoute: '/features/timetable?create=1',
      },
    ],
  };
}
