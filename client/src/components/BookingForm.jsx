import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AvailabilityCalendar, { expandRange } from './AvailabilityCalendar';
import { Spinner } from './Loader';
import { bookingsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { daysBetween, plural, todayISO } from '../utils/format';

/**
 * "Request to borrow" panel: calendar + live validation + message + send button.
 * Business rules 2, 3 and 4 are checked live here (the API checks them again).
 */
export default function BookingForm({ item, bookedRanges, initialFrom = '', initialTo = '' }) {
  const navigate = useNavigate();
  const [dates, setDates] = useState({ start: initialFrom, end: initialTo });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const today = todayISO();

  const bookedSet = useMemo(() => {
    const set = new Set();
    bookedRanges.forEach((r) => expandRange(r.start_date, r.end_date).forEach((d) => set.add(d)));
    return set;
  }, [bookedRanges]);

  // live validation of the selected range
  const check = useMemo(() => {
    const { start, end } = dates;
    if (!start) return { valid: false, text: 'Pick a start date on the calendar', tone: '' };
    if (!end) return { valid: false, text: 'Now pick an end date', tone: '' };
    if (start < today) return { valid: false, text: 'Start date cannot be in the past', tone: 'bad' };
    if (end < start) return { valid: false, text: 'End date must be on or after the start date', tone: 'bad' };
    const days = daysBetween(start, end);
    if (days > item.max_days) {
      return { valid: false, text: `${plural(days, 'day')} selected - this item allows at most ${item.max_days}`, tone: 'bad' };
    }
    if (expandRange(start, end).some((d) => bookedSet.has(d))) {
      return { valid: false, text: 'Your range includes dates that are already booked', tone: 'bad' };
    }
    return { valid: true, text: `${plural(days, 'day')} selected (max ${item.max_days} allowed)`, tone: 'ok' };
  }, [dates, item.max_days, bookedSet, today]);

  const setDate = (key) => (e) => {
    const value = e.target.value;
    setDates((d) => ({ ...d, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!check.valid || submitting) return;
    setSubmitting(true);
    setServerError('');
    try {
      await bookingsApi.create({ item_id: item.id, start_date: dates.start, end_date: dates.end, message });
      toast.success('Borrow request sent! The owner will review it.');
      navigate('/dashboard?tab=borrowings');
    } catch (err) {
      setServerError(getErrorMessage(err));
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate>
      <AvailabilityCalendar bookedRanges={bookedRanges} start={dates.start} end={dates.end} onChange={setDates} />

      <div className="date-row">
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="bk-from">From</label>
          <input id="bk-from" type="date" className="input" min={today} value={dates.start} onChange={setDate('start')} />
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="bk-to">To</label>
          <input id="bk-to" type="date" className="input" min={dates.start || today} value={dates.end} onChange={setDate('end')} />
        </div>
      </div>

      <p className={`live-msg ${check.tone}`} role="status" style={{ marginTop: 10 }}>
        {check.tone === 'ok' ? '✔ ' : check.tone === 'bad' ? '⚠ ' : ''}
        {check.text}
      </p>

      <div className="field">
        <label htmlFor="bk-msg">Message to the owner</label>
        <textarea
          id="bk-msg"
          className="textarea"
          maxLength={500}
          placeholder="Hi, I need it for... I will return it on time."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {serverError && <div className="alert alert-error">{serverError}</div>}

      <button className="btn btn-primary btn-block" disabled={!check.valid || submitting}>
        {submitting && <Spinner />} Send Request
      </button>
    </form>
  );
}
