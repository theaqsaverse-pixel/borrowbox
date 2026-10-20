import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page">
      <div className="empty">
        <div className="icon">🧭</div>
        <h3>Page not found</h3>
        <p className="muted">The page you are looking for does not exist.</p>
        <Link to="/" className="btn btn-primary">Back to browse</Link>
      </div>
    </div>
  );
}
