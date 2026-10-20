export default function Loader({ label = 'Loading...' }) {
  return (
    <div className="loader" role="status" aria-live="polite">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function Spinner() {
  return <span className="spinner spinner-sm" aria-hidden="true" />;
}
