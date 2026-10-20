import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { Spinner } from './Loader';
import { bookingsApi } from '../api';
import { getErrorMessage } from '../api/axios';
import { CONDITIONS } from '../utils/format';

const CONFIG = {
  reject: { title: 'Reject this request', label: 'Reason (optional)', placeholder: 'e.g. Already promised to someone else', button: 'Reject request', danger: true, success: 'Request rejected', field: 'reason', condition: false },
  pickup: { title: 'Mark as picked up', label: 'Condition note', placeholder: 'e.g. Good, one scratch on the handle', button: 'Confirm pickup', danger: false, success: 'Marked as picked up', field: 'note', condition: true },
  return: { title: 'Mark as returned', label: 'Condition note', placeholder: 'e.g. Returned clean and charged', button: 'Confirm return', danger: false, success: 'Marked as returned', field: 'note', condition: true },
};

/** Owner actions that need a note: reject (reason), pickup (handover log), return (return log). */
export default function BookingActionModal({ action, booking, defaultCondition = 'good', onClose, onDone }) {
  const cfg = CONFIG[action];
  const [text, setText] = useState('');
  const [condition, setCondition] = useState(defaultCondition);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { action, [cfg.field]: text.trim() || undefined };
      if (cfg.condition) payload.condition = condition;
      const res = await bookingsApi.setStatus(booking.id, payload);
      toast.success(cfg.success);
      onDone(res.data.booking);
    } catch (err) {
      setError(getErrorMessage(err));
      toast.error(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={cfg.title} onClose={onClose} locked={saving}>
      <p className="muted small">
        <strong>{booking.item_title}</strong> · {booking.borrower_name}
      </p>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        {cfg.condition && (
          <div className="field">
            <label htmlFor="ba-cond">Item condition now</label>
            <select id="ba-cond" className="select" value={condition} onChange={(e) => setCondition(e.target.value)}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="ba-text">{cfg.label}</label>
          <textarea id="ba-text" className="textarea" maxLength={500} placeholder={cfg.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
          {cfg.condition && <span className="hint">This is saved permanently as an audit record and cannot be edited later.</span>}
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={`btn ${cfg.danger ? 'btn-danger' : 'btn-primary'}`} disabled={saving}>{saving && <Spinner />} {cfg.button}</button>
        </div>
      </form>
    </Modal>
  );
}
