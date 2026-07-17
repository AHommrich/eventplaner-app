import api from './api';
import type { ScheduleStation } from './guest';

export type ManagementSchedule = {
  date: string | null;
  schedule: string | null;
  schedule_stations: ScheduleStation[];
};

/** Fetches the complete read-only schedule for the event-bound organizer session. */
export async function fetchManagementSchedule(): Promise<ManagementSchedule> {
  const response = await api.get<ManagementSchedule>('/api/management/schedule');
  return response.data;
}
