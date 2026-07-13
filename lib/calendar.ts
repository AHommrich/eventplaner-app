import { ScheduleStation } from './guest';
import { stationMoment, timedStations, TimedStation } from './schedule';

/**
 * Maps schedule stations to calendar-event shapes (absolute start/end Dates)
 * for the native "add to calendar" dialog (expo-calendar). We deliberately hand
 * off to the OS dialog rather than exporting an .ics via the share sheet: on
 * iOS the share sheet does not list calendar apps, whereas the native dialog
 * lets the guest pick any calendar (iCloud, Google, …) that third-party apps
 * like Family Wallet then read.
 */

// Open-ended stations (no `ends_at` and no following station) get this length.
const DEFAULT_DURATION_MS = 2 * 60 * 60 * 1000;

export type CalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  location: string | null;
};

function toEvent(s: TimedStation): CalendarEvent {
  return {
    title: s.title,
    start: s.start,
    end: s.end ?? new Date(s.start.getTime() + DEFAULT_DURATION_MS),
    location: s.address ?? s.location_name ?? null,
  };
}

/**
 * Calendar event for a single station (by id). Uses the shared timeline so a
 * station without its own end inherits the next station's start. Null when the
 * station has no start time (nothing to schedule).
 */
export function stationCalendarEvent(
  dateIso: string,
  stations: ScheduleStation[],
  stationId: number
): CalendarEvent | null {
  const station = timedStations(dateIso, stations).find((s) => s.id === stationId);
  return station ? toEvent(station) : null;
}

/** Calendar events for every timed station, in order. */
export function scheduleCalendarEvents(
  dateIso: string,
  stations: ScheduleStation[]
): CalendarEvent[] {
  return timedStations(dateIso, stations).map(toEvent);
}

/** True when a station can produce a calendar entry (i.e. it has a start time). */
export function stationHasTime(dateIso: string, station: ScheduleStation): boolean {
  return stationMoment(dateIso, station.starts_at) !== null;
}
