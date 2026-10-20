import { Link } from 'react-router-dom';
import { Stars } from './StarRating';
import { formatDate } from '../utils/format';

/** List of reviews. `canManage(review)` decides whether Edit / Delete buttons appear. */
export default function ReviewList({ reviews, canManage, onEdit, onDelete, showItem = false }) {
  return (
    <div>
      {reviews.map((r) => (
        <div className="review" key={r.id}>
          <div className="review-head">
            <Stars value={r.rating} />
            <strong>
              <Link to={`/profile/${r.reviewer_id}`}>{r.reviewer_name}</Link>
            </strong>
            <span className="muted small">{formatDate(r.created_at)}</span>
            {showItem && r.item_title && (
              <span className="pill pill-grey">
                <Link to={`/items/${r.item_id}`}>{r.item_title}</Link>
              </span>
            )}
          </div>
          {r.comment ? <p style={{ margin: 0 }}>{r.comment}</p> : <p className="muted small" style={{ margin: 0 }}>No comment</p>}
          {canManage?.(r) && (
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => onEdit(r)}>Edit</button>
              <button className="btn btn-outline-danger btn-sm" onClick={() => onDelete(r)}>Delete</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
