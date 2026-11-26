import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import { Alert, PageHeader } from '../components/UI';
import { PRIORITIES, PRIORITY_HELP } from '../lib/format';

export default function CreateTicket() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ title: '', description: '', category_id: '', priority: 'Medium' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.getCategories(token).then(setCategories).catch((err) => setError(err.message)); }, [token]);
  const update = (f) => (e) => setForm({ ...form, [f]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const ticket = await api.createTicket(token, { ...form, category_id: Number(form.category_id) });
      navigate(`/tickets/${ticket.id}`, { state: { created: true } });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="page page-narrow">
      <PageHeader title="Report an issue" subtitle="Tell IT what is wrong. You can follow the ticket and reply at any time." />
      <form className="card form" onSubmit={handleSubmit}>
        <Alert>{error}</Alert>

        <div className="field">
          <span>Category</span>
          <div className="chip-grid">
            {categories.map((c) => (
              <label key={c.id} className={`chip ${String(form.category_id) === String(c.id) ? 'is-selected' : ''}`}>
                <input type="radio" name="category" value={c.id} checked={String(form.category_id) === String(c.id)} onChange={update('category_id')} required />
                {c.name}
              </label>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Short summary</span>
          <input value={form.title} onChange={update('title')} maxLength={150} placeholder="e.g. Wi-Fi keeps dropping on the 2nd floor of the library" required />
        </label>

        <label className="field">
          <span>Details</span>
          <textarea rows={6} value={form.description} onChange={update('description')}
            placeholder="What happened? Where are you? When did it start? Any error message?" required />
        </label>

        <fieldset className="field">
          <legend>How urgent is it?</legend>
          <div className="priority-grid">
            {PRIORITIES.map((p) => (
              <label key={p} className={`priority-option p-${p.toLowerCase()} ${form.priority === p ? 'is-selected' : ''}`}>
                <input type="radio" name="priority" value={p} checked={form.priority === p} onChange={update('priority')} />
                <strong>{p}</strong>
                <span>{PRIORITY_HELP[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={loading || !form.category_id}>
            {loading ? 'Submitting…' : 'Submit ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
