import { useState } from 'react';
import { imageSrc } from '../utils/format';

export default function ItemImage({ item, className = 'item-img', tileClass = 'item-tile', alt }) {
  const [failed, setFailed] = useState(false);
  const src = imageSrc(item.image_url || item.item_image);
  if (src && !failed) {
    return <img className={className} src={src} alt={alt ?? item.title ?? item.item_title ?? ''} loading="lazy" onError={() => setFailed(true)} />;
  }
  return (
    <div className={`${tileClass} tile-plain`} aria-hidden="true">
      <span>{item.category_name || 'No photo'}</span>
    </div>
  );
}