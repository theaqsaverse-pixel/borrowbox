import { STATUS_LABELS } from '../utils/format';

/** Coloured booking status pill (same colours everywhere) + optional OVERDUE flag. */
export default function StatusBadge({ status, overdue = false }) {
  return (
    <span className="row" style={{ gap: 6, display: 'inline-flex' }}>
      <span className={`badge badge-${status}`}>{STATUS_LABELS[status] || status}</span>
      {overdue && <span className="badge badge-overdue">Overdue</span>}
    </span>
  );
}
