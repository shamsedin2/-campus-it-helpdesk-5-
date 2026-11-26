import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { RolePill } from '../components/Badges';
import { Alert, Avatar, Empty, PageHeader, Spinner, StatCard } from '../components/UI';
import { shortDate } from '../lib/format';

export default function ManageUsers() {
  const { token, user: me } = useAuth();
  const [role, setRole] = useState('');
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'technician' });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => api.getUsers(token, { role, q }).then(setData).catch((e) => setError(e.message)), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [token, role, q, reload]);

  const changeRole = async (u, newRole) => {
    setError(''); setNotice('');
    try {
      await api.setRole(token, u.id, newRole);
      setNotice(`${u.name} is now ${newRole === 'technician' ? 'IT staff' : `a${newRole === 'admin' ? 'n' : ''} ${newRole}`}.`);
      setReload((n) => n + 1);
    } catch (e) { setError(e.message); }
  };

  const create = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    try {
      await api.createUser(token, form);
      setNotice(`Account created for ${form.name}.`);
      setForm({ name: '', email: '', password: '', role: 'technician' });
      setShowNew(false);
      setReload((n) => n + 1);
    } catch (e2) { setError(e2.message); }
  };

  const counts = data?.counts || {};

  return (
    <div className="page page-wide">
      <PageHeader title="Manage users" subtitle="Add IT staff and change account roles.">
        <button className="btn btn-primary" onClick={() => setShowNew((v) => !v)}><Icon name="plus" /> New account</button>
      </PageHeader>

      <div className="stat-grid">
        <StatCard label="Students" value={counts.student ?? 0} icon="users" />
        <StatCard label="Technicians" value={counts.technician ?? 0} icon="shield" tone="blue" />
        <StatCard label="Admins" value={counts.admin ?? 0} icon="shield" tone="purple" />
      </div>

      <Alert>{error}</Alert>
      <Alert tone="success">{notice}</Alert>

      {showNew && (
        <form className="card form form-inline" onSubmit={create}>
          <h2 className="card-title">New account</h2>
          <div className="form-grid">
            <label className="field"><span>Name</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label className="field"><span>Temporary password</span><input type="text" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
            <label className="field"><span>Role</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="technician">Technician</option><option value="admin">Admin</option><option value="student">Student</option>
              </select>
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowNew(false)}>Cancel</button>
            <button className="btn btn-primary" type="submit">Create account</button>
          </div>
        </form>
      )}

      <div className="toolbar">
        <div className="tabs">
          {[['', 'Everyone'], ['staff', 'IT staff'], ['student', 'Students']].map(([v, l]) => (
            <button key={l} className={`tab ${role === v ? 'is-active' : ''}`} onClick={() => setRole(v)}>{l}</button>
          ))}
        </div>
        <label className="search"><Icon name="search" /><input placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      </div>

      <section className="card card-flush">
        {!data ? <Spinner /> : data.users.length === 0 ? <Empty title="No users found" icon="users" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th>Tickets</th><th>Joined</th><th>Change role</th></tr></thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td><span className="cell-person"><Avatar name={u.name} size={30} tone={u.role !== 'student' ? 'staff' : undefined} /><span><strong>{u.name}</strong><span className="cell-sub">{u.email}</span></span></span></td>
                    <td><RolePill role={u.role} /></td>
                    <td className="muted">{u.role === 'student' ? `${u.tickets_submitted} submitted` : `${u.open_assigned} open assigned`}</td>
                    <td className="muted nowrap">{shortDate(u.created_at)}</td>
                    <td>
                      {u.id === me.id ? <span className="muted">You</span> : (
                        <select className="select-sm" value={u.role} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Role for ${u.name}`}>
                          <option value="student">Student</option><option value="technician">Technician</option><option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {data && data.users.length >= 100 && <p className="muted center">Showing the first 100. Search to narrow it down.</p>}
    </div>
  );
}
