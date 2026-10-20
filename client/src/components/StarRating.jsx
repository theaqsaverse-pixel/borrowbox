import { useState } from 'react';

/** Read-only stars for a whole number rating (1-5). */
export function Stars({ value = 0 }) {
  const full = Math.round(value);
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? '' : 'off'}>
          ★
        </span>
      ))}
    </span>
  );
}

/** "★ 4.8 (12)" or "No reviews yet" */
export function RatingBadge({ score, count, showCount = true }) {
  if (score === null || score === undefined || !count) {
    return <span className="rating none">No reviews yet</span>;
  }
  return (
    <span className="rating">
      <span className="star">★</span> {Number(score).toFixed(1)}
      {showCount && <span className="count">({count})</span>}
    </span>
  );
}

/** Clickable 1-5 star input. */
export function StarInput({ value, onChange, disabled = false }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="star-input" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star-btn${n <= shown ? ' on' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          disabled={disabled}
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
