import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import { Alert } from '../components/UI';
import AuthShell from './AuthShell';

const DEMO = [
  { label: 'Student', email: 'student@campus.edu', password: 'student123' },
  { label: 'Technician', email: 'tech@campus.edu', password: 'tech123' },
  { label: 'Admin', email: 'admin@campus.edu', password: 'admin123' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, expired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (creds) => {
    setError('');
    setLoading(true);
    try {
      const { token, user } = await api.login(creds);
      login(token, user);
      const fallback = user.role === 'student' ? '/dashboard' : '/staff';
      navigate(location.state?.from && location.state.from !== '/login' ? location.state.from : fallback, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <form className="auth-form" onSubmit={(e) => { e.preventDefault(); submit({ email, password }); }}>
        <h1>Sign in</h1>
        <p className="subtitle">Use your campus email and password.</p>
        {expired && !error && <Alert tone="info">Your session expired. Please sign in again.</Alert>}
        <Alert>{error}</Alert>

        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@campus.edu" required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <button className="btn btn-primary btn-block" type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="auth-switch">New student? <Link to="/register">Create an account</Link></p>

        <div className="demo-box">
          <span className="demo-title">Demo accounts</span>
          <div className="demo-buttons">
            {DEMO.map((d) => (
              <button type="button" key={d.label} className="btn btn-secondary btn-sm" disabled={loading} onClick={() => submit(d)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
