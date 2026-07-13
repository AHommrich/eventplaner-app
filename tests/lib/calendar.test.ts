import { ScheduleStation } from '../../lib/guest';
import { scheduleCalendarEvents, stationCalendarEvent, stationHasTime } from '../../lib/calendar';

const DATE = '2027-06-05T00:00:00.000Z';

function station(over: Partial<ScheduleStation>): ScheduleStation {
  return {
    id: over.id ?? 1,
    title: over.title ?? 'Station',
    starts_at: over.starts_at ?? null,
    ends_at: over.ends_at ?? null,
    location_name: over.location_name ?? null,
    address: over.address ?? null,
    lat: over.lat ?? null,
    lng: over.lng ?? null,
  };
}

function at(h: number, m = 0): number {
  const d = new Date(DATE);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

const registry = station({
  id: 1,
  title: 'Standesamt',
  starts_at: '11:00',
  ends_at: '11:30',
  address: 'Zentralplatz 2, 56068 Koblenz',
});
const lunch = station({ id: 2, title: 'Mittagessen', starts_at: '13:00', ends_at: null });
const party = station({ id: 3, title: 'Feier', starts_at: '18:00', ends_at: null });

describe('lib/calendar', () => {
  it('maps a station to title, start, end and location', () => {
    const ev = stationCalendarEvent(DATE, [registry], 1)!;
    expect(ev.title).toBe('Standesamt');
    expect(ev.start.getTime()).toBe(at(11, 0));
    expect(ev.end.getTime()).toBe(at(11, 30));
    expect(ev.location).toBe('Zentralplatz 2, 56068 Koblenz');
  });

  it('falls back to the next station start as the end when ends_at is null', () => {
    const ev = stationCalendarEvent(DATE, [lunch, party], 2)!;
    expect(ev.start.getTime()).toBe(at(13, 0));
    expect(ev.end.getTime()).toBe(at(18, 0));
  });

  it('gives an open-ended last station a default 2h duration', () => {
    const ev = stationCalendarEvent(DATE, [party], 3)!;
    expect(ev.end.getTime() - ev.start.getTime()).toBe(2 * 60 * 60 * 1000);
  });

  it('uses the location name when there is no address', () => {
    const s = station({ id: 5, title: 'X', starts_at: '10:00', location_name: 'Grillhütte' });
    expect(stationCalendarEvent(DATE, [s], 5)!.location).toBe('Grillhütte');
  });

  it('maps every timed station in order', () => {
    const events = scheduleCalendarEvents(DATE, [registry, lunch, party]);
    expect(events.map((e) => e.title)).toEqual(['Standesamt', 'Mittagessen', 'Feier']);
  });

  it('returns null / empty when there is nothing timed', () => {
    expect(stationCalendarEvent(DATE, [station({ id: 9, starts_at: null })], 9)).toBeNull();
    expect(stationCalendarEvent(DATE, [registry], 999)).toBeNull();
    expect(scheduleCalendarEvents(DATE, [])).toEqual([]);
  });

  it('reports whether a station can produce a calendar entry', () => {
    expect(stationHasTime(DATE, registry)).toBe(true);
    expect(stationHasTime(DATE, station({ starts_at: null }))).toBe(false);
  });
});
