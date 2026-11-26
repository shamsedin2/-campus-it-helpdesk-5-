import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import { Alert } from '../components/UI';
import AuthShell from './AuthShell';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.register({ name: form.name, email: form.email, password: form.password });
      login(token, user);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Create your account</h1>
        <p className="subtitle">For students reporting technology issues.</p>
        <Alert>{error}</Alert>
        <label className="field"><span>Full name</span>
          <input autoComplete="name" value={form.name} onChange={update('name')} required maxLength={100} />
        </label>
        <label className="field"><span>Campus email</span>
          <input type="email" autoComplete="email" value={form.email} onChange={update('email')} placeholder="you@campus.edu" required />
        </label>
        <div className="field-row">
          <label className="field"><span>Password</span>
            <input type="password" autoComplete="new-password" minLength={8} value={form.password} onChange={update('password')} required />
          </label>
          <label className="field"><span>Confirm</span>
            <input type="password" autoComplete="new-password" minLength={8} value={form.confirm} onChange={update('confirm')} required />
          </label>
        </div>
        <p className="field-hint">At least 8 characters.</p>
        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}
