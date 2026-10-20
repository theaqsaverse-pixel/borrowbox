import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import Loader, { Spinner } from './Loader';
import AvailabilityCalendar, { expandRange } from './AvailabilityCalendar';
import { bookingsApi, itemsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { daysBetween, plural, todayISO } from '../utils/format';

/** Borrower edits dates / message while the booking is still REQUESTED. */
export default function EditBookingModal({ booking, onClose, onDone }) {
  const [booked, setBooked] = useState(null);
  const [dates, setDates] = useState({ start: booking.start_date, end: booking.end_date });
  const [message, setMessage] = useState(booking.message || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const today = todayISO();

  useEffect(() => {
    itemsApi.availability(booking.item_id).then((r) => setBooked(r.data)).catch(() => setBooked([]));
  }, [booking.item_id]);

  const bookedSet = useMemo(() => {
    const set = new Set();
    (booked || []).forEach((r) => expandRange(r.start_date, r.end_date).forEach((d) => set.add(d)));
    return set;
  }, [booked]);

  const check = useMemo(() => {
    const { start, end } = dates;
    if (!start || !end) return { valid: false, text: 'Pick a start and an end date', tone: '' };
    const unchanged = start === booking.start_date && end === booking.end_date;
    if (!unchanged && start < today) return { valid: false, text: 'Start date cannot be in the past', tone: 'bad' };
    if (end < start) return { valid: false, text: 'End date must be on or after the start date', tone: 'bad' };
    const days = daysBetween(start, end);
    if (days > booking.item_max_days) return { valid: false, text: `${plural(days, 'day')} selected - max ${booking.item_max_days} allowed`, tone: 'bad' };
    if (expandRange(start, end).some((d) => bookedSet.has(d))) return { valid: false, text: 'Your range includes dates that are already booked', tone: 'bad' };
    return { valid: true, text: `${plural(days, 'day')} selected (max ${booking.item_max_days} allowed)`, tone: 'ok' };
  }, [dates, booking, bookedSet, today]);

  const submit = async (e) => {
    e.preventDefault();
    if (!check.valid) return;
    setSaving(true);
    setError('');
    try {
      const res = await bookingsApi.update(booking.id, { start_date: dates.start, end_date: dates.end, message });
      toast.success('Request updated');
      onDone(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit borrow request" onClose={onClose} locked={saving} wide>
      <p className="muted small"><strong>{booking.item_title}</strong> - dates and message can be changed while the request is still waiting for the owner.</p>
      {booked === null ? <Loader label="Loading availability..." /> : (
        <form onSubmit={submit} noValidate>
          {error && <div className="alert alert-error">{error}</div>}
          <AvailabilityCalendar bookedRanges={booked} start={dates.start} end={dates.end} onChange={setDates} />
          <div className="date-row">
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="eb-from">From</label>
              <input id="eb-from" type="date" className="input" value={dates.start} onChange={(e) => setDates({ ...dates, start: e.target.value })} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label htmlFor="eb-to">To</label>
              <input id="eb-to" type="date" className="input" min={dates.start} value={dates.end} onChange={(e) => setDates({ ...dates, end: e.target.value })} />
            </div>
          </div>
          <p className={`live-msg ${check.tone}`} style={{ marginTop: 10 }}>{check.tone === 'ok' ? '✔ ' : check.tone === 'bad' ? '⚠ ' : ''}{check.text}</p>
          <div className="field">
            <label htmlFor="eb-msg">Message</label>
            <textarea id="eb-msg" className="textarea" maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" disabled={!check.valid || saving}>{saving && <Spinner />} Save changes</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
