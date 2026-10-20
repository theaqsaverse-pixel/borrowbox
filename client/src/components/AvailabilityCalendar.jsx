import { useMemo, useState } from 'react';
import { pad, toISO, todayISO } from '../utils/format';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

/** Every date (YYYY-MM-DD) from start to end, inclusive. */
export function expandRange(start, end) {
  const out = [];
  const [sy, sm, sd] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const last = Date.UTC(ey, em - 1, ed);
  while (cur.getTime() <= last) {
    out.push(`${cur.getUTCFullYear()}-${pad(cur.getUTCMonth() + 1)}-${pad(cur.getUTCDate())}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/**
 * Month calendar that greys out booked and past dates.
 * The user clicks a start date and then an end date.
 */
export default function AvailabilityCalendar({ bookedRanges = [], start, end, onChange }) {
  const today = todayISO();
  const initial = start || today;
  const [view, setView] = useState({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 });

  const booked = useMemo(() => {
    const set = new Set();
    bookedRanges.forEach((r) => expandRange(r.start_date, r.end_date).forEach((d) => set.add(d)));
    return set;
  }, [bookedRanges]);

  const thisMonth = { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 };
  const atCurrentMonth = view.y === thisMonth.y && view.m === thisMonth.m;

  const go = (delta) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  // Monday-first grid
  const firstDow = (new Date(Date.UTC(view.y, view.m, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(view.y, view.m, d));

  const pick = (iso) => {
    if (!start || (start && end) || iso < start) onChange({ start: iso, end: '' });
    else onChange({ start, end: iso });
  };

  return (
    <div className="cal">
      <div className="cal-head">
        <button type="button" className="cal-nav" onClick={() => go(-1)} disabled={atCurrentMonth} aria-label="Previous month">
          ‹
        </button>
        <span>
          {MONTH_NAMES[view.m]} {view.y}
        </span>
        <button type="button" className="cal-nav" onClick={() => go(1)} aria-label="Next month">
          ›
        </button>
      </div>

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <button key={`b${i}`} type="button" className="cal-day blank" disabled tabIndex={-1} />;
          const isPast = iso < today;
          const isBooked = booked.has(iso);
          const isStart = iso === start;
          const isEnd = iso === end;
          const inRange = start && end && iso > start && iso < end;
          const cls = ['cal-day'];
          if (iso === today) cls.push('today');
          if (isPast) cls.push('past');
          if (isBooked) cls.push('booked');
          if (inRange) cls.push('in-range');
          if (isStart) cls.push('sel');
          else if (isEnd) cls.push('sel-end');
          return (
            <button
              key={iso}
              type="button"
              className={cls.join(' ')}
              disabled={isPast || isBooked}
              onClick={() => pick(iso)}
              aria-label={`${iso}${isBooked ? ' (booked)' : ''}`}
              aria-pressed={isStart || isEnd}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span className="lg-booked">Booked</span>
        <span className="lg-yours">Your dates</span>
        <span className="lg-free">Free</span>
      </div>
    </div>
  );
}
