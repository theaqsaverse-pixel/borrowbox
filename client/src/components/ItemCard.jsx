import { Link } from 'react-router-dom';
import ItemImage from './ItemImage';
import { RatingBadge } from './StarRating';
import { formatShort, plural } from '../utils/format';

export default function ItemCard({ item, from, to }) {
  const query = from && to ? `?from=${from}&to=${to}` : '';
  const dates = from && to ? (from === to ? formatShort(from) : `${formatShort(from)} - ${formatShort(to)}`) : null;
  return (
    <Link to={`/items/${item.id}${query}`} className="item-card">
      <ItemImage item={item} />
      <div className="item-body">
        <div className="item-title">{item.title}</div>
        <div className="item-meta">
          {item.category_name} | max {plural(item.max_days, 'day')}
        </div>
        <div className="item-meta">Condition: {item.condition}</div>
        <div className="item-foot">
          <RatingBadge score={item.owner_rating} count={item.owner_review_count} />
          <span className="pill pill-green" title={dates ? `Free on ${dates}` : undefined}>
            Available
          </span>
        </div>
      </div>
    </Link>
  );
}

export function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton sk-img" />
      <div className="sk-body">
        <div className="skeleton sk-line" style={{ width: '70%' }} />
        <div className="skeleton sk-line" style={{ width: '45%' }} />
        <div className="skeleton sk-line" style={{ width: '30%' }} />
      </div>
    </div>
  );
}
