import type {
  CalendarEntryInput,
  CalendarEntryStatus,
  CalendarEntryUpdateInput,
} from '@workspace/client-sdk';
import { queryClient, workbenchClient } from '../../platform/api/client.js';

export const calendarKeys = {
  all: ['calendar'] as const,
  range: (from: string, to: string, status: CalendarEntryStatus) =>
    ['calendar', 'range', from, to, status] as const,
  detail: (id: string) => ['calendar', 'detail', id] as const,
};
export async function invalidateCalendarData(): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: calendarKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['workbench', 'overview'] }),
  ]);
}
export const calendarApi = {
  list(from: string, to: string, status: CalendarEntryStatus) {
    return workbenchClient.getCalendarEntries({ from, to, status, limit: 1000 });
  },
  get(id: string) {
    return workbenchClient.getCalendarEntry(id);
  },
  create(input: CalendarEntryInput) {
    return workbenchClient.createCalendarEntry(input);
  },
  update(id: string, input: CalendarEntryUpdateInput) {
    return workbenchClient.updateCalendarEntry(id, input);
  },
  archive(id: string, version: number) {
    return workbenchClient.archiveCalendarEntry(id, version);
  },
  restore(id: string, version: number) {
    return workbenchClient.restoreCalendarEntry(id, version);
  },
  deletePermanently(id: string, version: number) {
    return workbenchClient.deleteCalendarEntryPermanently(id, version);
  },
};
