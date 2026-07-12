import { ScheduleStation } from '../../lib/guest';
import { focusStation, scheduleStatus, stationState, timedStations } from '../../lib/schedule';

const DATE = '2027-06-05T00:00:00.000Z';

function station(over: Partial<ScheduleStation>): ScheduleStation {
  return {
    id: over.id ?? 1,
    title: over.title ?? 'Station',
    starts_at: over.starts_at ?? null,
    ends_at: over.ends_at ?? null,
    location_name: null,
    address: null,
    lat: null,
    lng: null,
  };
}

// Local wall-clock Date on the event day.
function at(h: number, m = 0): Date {
  const d = new Date(DATE);
  d.setHours(h, m, 0, 0);
  return d;
}

const registry = station({ id: 1, title: 'Registry', starts_at: '11:00', ends_at: '11:30' });
const lunch = station({ id: 2, title: 'Lunch', starts_at: '13:00', ends_at: '15:00' });
const party = station({ id: 3, title: 'Party', starts_at: '18:00', ends_at: null });

describe('lib/schedule', () => {
  it('skips untimed stations and derives effective ends', () => {
    const timed = timedStations(DATE, [station({ starts_at: null }), registry, party]);
    expect(timed.map((s) => s.title)).toEqual(['Registry', 'Party']);
    // Registry keeps its own end; open-ended party stays null.
    expect(timed[0].end).not.toBeNull();
    expect(timed[1].end).toBeNull();
  });

  it('uses the next station start as an effective end when ends_at is null', () => {
    const openRegistry = station({ id: 1, title: 'Registry', starts_at: '11:00', ends_at: null });
    const timed = timedStations(DATE, [openRegistry, lunch]);
    expect(timed[0].end?.getTime()).toBe(at(13, 0).getTime());
  });

  it('counts down to the first station before it starts', () => {
    const s = scheduleStatus(DATE, [registry, lunch, party], at(9, 0));
    expect(s).toMatchObject({ kind: 'before', station: { title: 'Registry' } });
  });

  it('reports the running station during its window', () => {
    const s = scheduleStatus(DATE, [registry, lunch, party], at(11, 15));
    expect(s).toMatchObject({ kind: 'during', station: { title: 'Registry' } });
  });

  it('counts down to the next station in the gap between stations', () => {
    const s = scheduleStatus(DATE, [registry, lunch, party], at(12, 0));
    expect(s).toMatchObject({ kind: 'before', station: { title: 'Lunch' } });
  });

  it('stays on an open-ended last station indefinitely', () => {
    const s = scheduleStatus(DATE, [registry, lunch, party], at(23, 30));
    expect(s).toMatchObject({ kind: 'during', station: { title: 'Party' } });
  });

  it('reports after once the last timed station has ended', () => {
    const s = scheduleStatus(DATE, [registry, lunch], at(16, 0));
    expect(s).toEqual({ kind: 'after' });
  });

  it('returns null when there is no timed station', () => {
    expect(scheduleStatus(DATE, [station({ starts_at: null })], at(12, 0))).toBeNull();
    expect(scheduleStatus(DATE, [], at(12, 0))).toBeNull();
  });

  it('focuses the next station before, the running one during, the last one after', () => {
    expect(focusStation(DATE, [registry, lunch, party], at(9, 0))?.title).toBe('Registry');
    expect(focusStation(DATE, [registry, lunch, party], at(11, 15))?.title).toBe('Registry');
    expect(focusStation(DATE, [registry, lunch, party], at(12, 0))?.title).toBe('Lunch');
    // After the last timed station with an end, focus stays on it.
    expect(focusStation(DATE, [registry, lunch], at(16, 0))?.title).toBe('Lunch');
    expect(focusStation(DATE, [], at(12, 0))).toBeNull();
  });

  it('marks per-station state as upcoming / now / past', () => {
    expect(stationState(DATE, registry, at(10, 0))).toBe('upcoming');
    expect(stationState(DATE, registry, at(11, 15))).toBe('now');
    expect(stationState(DATE, registry, at(12, 0))).toBe('past');
    // Open-ended station never turns 'past'.
    expect(stationState(DATE, party, at(23, 59))).toBe('now');
  });
});
