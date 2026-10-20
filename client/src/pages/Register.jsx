import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getFieldErrors } from '../api/axios';
import { Spinner } from '../components/Loader';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', phone: '', area: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  if (isAuthenticated && !loading) return <Navigate to="/dashboard" replace />;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    if (!EMAIL_RE.test(form.email.trim())) e.email = 'Enter a valid email address';
    if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError('');
    if (!validate()) return;
    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim(),
        area: form.area.trim(),
      });
      toast.success('Account created - welcome to BorrowBox!');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(getErrorMessage(err));
      setErrors((prev) => ({ ...prev, ...getFieldErrors(err) }));
      setLoading(false);
    }
  };

  const field = (id, label, props = {}) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className={`input${errors[id] ? ' invalid' : ''}`} value={form[id]} onChange={set(id)} {...props} />
      {errors[id] && <span className="error-text">{errors[id]}</span>}
    </div>
  );

  return (
    <div className="container page">
      <div className="auth-wrap card">
        <h1>Create your account</h1>
        <p className="muted">One account to lend and borrow.</p>
        {serverError && <div className="alert alert-error" role="alert">{serverError}</div>}
        <form onSubmit={submit} noValidate>
          {field('name', 'Full name', { autoComplete: 'name', maxLength: 100 })}
          {field('email', 'Email', { type: 'email', autoComplete: 'email' })}
          <div className="form-grid">
            {field('password', 'Password', { type: 'password', autoComplete: 'new-password' })}
            {field('confirm', 'Confirm password', { type: 'password', autoComplete: 'new-password' })}
          </div>
          <div className="form-grid">
            {field('phone', 'Phone (optional)', { autoComplete: 'tel', maxLength: 30 })}
            {field('area', 'Area (optional)', { placeholder: 'e.g. Block B', maxLength: 120 })}
          </div>
          <button className="btn btn-primary btn-block" disabled={loading}>{loading && <Spinner />} Create account</button>
        </form>
        <p className="center small" style={{ marginTop: 16 }}>
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
