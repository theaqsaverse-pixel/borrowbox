import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { Spinner } from './Loader';
import { StarInput } from './StarRating';
import { reviewsApi } from '../api';
import { getErrorMessage } from '../api/axios';

/**
 * Create a review (pass `bookingId`) or edit one (pass `review`).
 * onDone(savedReview) is called after a successful save.
 */
export default function ReviewModal({ bookingId, review, who, onClose, onDone }) {
  const editing = !!review;
  const [rating, setRating] = useState(review?.rating || 0);
  const [comment, setComment] = useState(review?.comment || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Please choose a rating from 1 to 5 stars');
    setSaving(true);
    setError('');
    try {
      const res = editing
        ? await reviewsApi.update(review.id, { rating, comment })
        : await reviewsApi.create(bookingId, { rating, comment });
      toast.success(editing ? 'Review updated' : 'Review submitted');
      onDone?.(res.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit your review' : `Rate ${who || 'this user'}`} onClose={onClose} locked={saving}>
      <form onSubmit={submit} noValidate>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="field">
          <span className="label">Rating</span>
          <StarInput value={rating} onChange={setRating} disabled={saving} />
        </div>
        <div className="field">
          <label htmlFor="rv-comment">Comment (optional)</label>
          <textarea id="rv-comment" className="textarea" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="How did it go?" />
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" disabled={saving}>{saving && <Spinner />} {editing ? 'Save changes' : 'Submit review'}</button>
        </div>
      </form>
    </Modal>
  );
}
