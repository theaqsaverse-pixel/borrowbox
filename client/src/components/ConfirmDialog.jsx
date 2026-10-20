import { Spinner } from './Loader';
import Modal from './Modal';

/** "Are you sure?" dialog - every delete / destructive action in the app goes through this. */
export default function ConfirmDialog({
  title = 'Are you sure?',
  message,
  confirmText = 'Delete',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal title={title} onClose={onCancel} locked={loading}>
      <p className="muted">{message}</p>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm} disabled={loading}>
          {loading && <Spinner />} {confirmText}
        </button>
      </div>
    </Modal>
  );
}
