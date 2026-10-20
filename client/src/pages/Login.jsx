import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api/axios';
import { Spinner } from '../components/Loader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/dashboard';

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && !loading) return <Navigate to={from} replace />;

  const validate = () => {
    const e = {};
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address';
    if (!form.password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(user.role === 'admin' && from === '/dashboard' ? '/admin' : from, { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div className="container page">
      <div className="auth-wrap card">
        <h1>Log in</h1>
        <p className="muted">Welcome back to BorrowBox.</p>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" className={`input${errors.email ? ' invalid' : ''}`} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            {errors.email && <span className="error-text">{errors.email}</span>}
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" className={`input${errors.password ? ' invalid' : ''}`} autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {errors.password && <span className="error-text">{errors.password}</span>}
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>{loading && <Spinner />} Log in</button>
        </form>
        <p className="center small" style={{ marginTop: 16 }}>
          New here? <Link to="/register">Create an account</Link>
        </p>
        <div className="alert alert-info small" style={{ marginTop: 12, marginBottom: 0 }}>
          <strong>Demo accounts</strong> (after running the seed): <br />
          Admin: admin@borrowbox.com / Admin@123<br />
          Member: ali@example.com / Password@123
        </div>
      </div>
    </div>
  );
}
