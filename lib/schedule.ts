import { ScheduleStation } from './guest';

/**
 * Schedule timeline helpers. Stations carry wall-clock "HH:MM" times; the
 * absolute moment is composed with the event date. The guest app uses these to
 * drive the home countdown (walking from station to station) and to mark the
 * running station in the schedule tab.
 */

export type ScheduleStatus =
  | { kind: 'before'; station: ScheduleStation; target: Date } // count down to this (first/next) station
  | { kind: 'during'; station: ScheduleStation } // this station is happening now
  | { kind: 'after' }; // the last station has ended
export type TimedStation = ScheduleStation & { start: Date; end: Date | null };

/**
 * Composes the event's calendar day with a station's "HH:MM" into an absolute
 * Date in the runtime's local time zone. Returns null for a missing/malformed
 * time so callers can skip untimed stations.
 */
export function stationMoment(dateIso: string, time: string | null): Date | null {
  if (!time) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const base = new Date(dateIso);
  if (Number.isNaN(base.getTime())) return null;
  const composed = new Date(base);
  composed.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return composed;
}

/**
 * Only the stations that have a valid start time, with their absolute start and
 * an effective end. A station's end is its own `ends_at` when set, otherwise the
 * next timed station's start; the last station stays open-ended (null).
 */
export function timedStations(dateIso: string, stations: ScheduleStation[]): TimedStation[] {
  const withStart = stations
    .map((s) => ({ station: s, start: stationMoment(dateIso, s.starts_at) }))
    .filter((x): x is { station: ScheduleStation; start: Date } => x.start !== null);

  return withStart.map(({ station, start }, i) => {
    const ownEnd = stationMoment(dateIso, station.ends_at);
    const nextStart = i + 1 < withStart.length ? withStart[i + 1].start : null;
    return { ...station, start, end: ownEnd ?? nextStart };
  });
}

/**
 * Where the event stands at `now`: counting down to the next station, inside a
 * running station, or finished. Returns null when there is no timed station to
 * reason about (the home screen then falls back to the plain event countdown).
 */
export function scheduleStatus(
  dateIso: string,
  stations: ScheduleStation[],
  now: Date = new Date()
): ScheduleStatus | null {
  const timed = timedStations(dateIso, stations);
  if (timed.length === 0) return null;

  const t = now.getTime();

  if (t < timed[0].start.getTime()) {
    return { kind: 'before', station: timed[0], target: timed[0].start };
  }

  for (let i = 0; i < timed.length; i++) {
    const station = timed[i];
    const startMs = station.start.getTime();
    const endMs = station.end ? station.end.getTime() : null;

    // Inside this station: started, and either open-ended or not yet ended.
    if (t >= startMs && (endMs === null || t < endMs)) {
      return { kind: 'during', station };
    }

    // In the gap after this station but before the next one starts.
    const next = timed[i + 1];
    if (endMs !== null && next && t >= endMs && t < next.start.getTime()) {
      return { kind: 'before', station: next, target: next.start };
    }
  }

  return { kind: 'after' };
}

/**
 * The single station the home screen should point at right now: the running
 * one, or the next one to come, or — once everything is over — the last stop
 * (so guests can still navigate to where the party was). Null when there is no
 * timed station, so the home screen keeps showing the plain venue.
 */
export function focusStation(
  dateIso: string,
  stations: ScheduleStation[],
  now: Date = new Date()
): ScheduleStation | null {
  const status = scheduleStatus(dateIso, stations, now);
  if (!status) return null;
  if (status.kind === 'during' || status.kind === 'before') return status.station;

  const timed = timedStations(dateIso, stations);
  return timed.length ? timed[timed.length - 1] : null;
}

/**
 * Per-station marker for the schedule list: whether it is running now, already
 * over, or still upcoming. Untimed stations are always 'upcoming'.
 */
export function stationState(
  dateIso: string,
  station: ScheduleStation,
  now: Date = new Date()
): 'now' | 'past' | 'upcoming' {
  const start = stationMoment(dateIso, station.starts_at);
  if (!start) return 'upcoming';

  const t = now.getTime();
  if (t < start.getTime()) return 'upcoming';

  const end = stationMoment(dateIso, station.ends_at);
  if (end && t >= end.getTime()) return 'past';

  return 'now';
}
