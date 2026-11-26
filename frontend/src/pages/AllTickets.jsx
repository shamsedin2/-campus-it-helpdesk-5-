import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { StatusBadge, PriorityBadge } from '../components/Badges';
import { Alert, Avatar, Empty, PageHeader, Pagination, Spinner } from '../components/UI';
import { STATUSES, PRIORITIES, timeAgo } from '../lib/format';

const LIMIT = 25;
const DEFAULTS = { q: '', status: '', priority: '', category_id: '', technician: '', active: 'true', sort: 'priority' };

export default function AllTickets() {
  const { token } = useAuth();
  const [params, setParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [staff, setStaff] = useState([]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // Filters live in the URL so a filtered view can be bookmarked or shared.
  const f = { ...DEFAULTS, ...Object.fromEntries(params) };
  f.active = params.get('active') ?? (params.get('status') ? 'false' : 'true');
  const offset = Number(params.get('offset') || 0);

  const write = (next) =>
    setParams(Object.fromEntries(Object.entries(next).filter(([k, v]) => k !== 'offset' && v !== '' && v !== DEFAULTS[k])), { replace: true });
  const setFilter = (key, value) => write({ ...f, [key]: value });

  useEffect(() => {
    api.getCategories(token).then(setCategories).catch(() => {});
    api.getUsers(token, { role: 'staff' }).then((r) => setStaff(r.users)).catch(() => {});
  }, [token]);

  const key = params.toString();
  useEffect(() => {
    const t = setTimeout(() => {
      api.getTickets(token, { ...f, active: f.active === 'true' ? 'true' : '', limit: LIMIT, offset })
        .then((d) => { setData(d); setError(''); })
        .catch((err) => setError(err.message));
    }, f.q ? 250 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  const activeFilters = ['q', 'status', 'priority', 'category_id', 'technician'].filter((k) => f[k]).length + (f.active === 'true' ? 0 : 1);

  return (
    <div className="page page-wide">
      <PageHeader title="All tickets" subtitle={data ? `${data.total} ticket${data.total === 1 ? '' : 's'} match` : 'Search, filter, and triage every request.'} />

      <div className="filters card">
        <label className="search search-wide">
          <Icon name="search" />
          <input placeholder="Search title, description, student, or #id" value={f.q} onChange={(e) => setFilter('q', e.target.value)} />
        </label>
        <select value={f.active === 'true' && !f.status ? 'active' : f.status || 'any'} onChange={(e) => {
          const v = e.target.value;
          write({ ...f, status: v === 'active' || v === 'any' ? '' : v, active: v === 'active' ? 'true' : 'false' });
        }} aria-label="Status">
          <option value="active">Active (not resolved)</option>
          <option value="any">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={f.priority} onChange={(e) => setFilter('priority', e.target.value)} aria-label="Priority">
          <option value="">Any priority</option>
          <option value="Urgent,High">Urgent + High</option>
          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={f.category_id} onChange={(e) => setFilter('category_id', e.target.value)} aria-label="Category">
          <option value="">Any category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={f.technician} onChange={(e) => setFilter('technician', e.target.value)} aria-label="Technician">
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="none">Unassigned</option>
          {staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={f.sort} onChange={(e) => setFilter('sort', e.target.value)} aria-label="Sort">
          <option value="priority">Sort: Priority</option>
          <option value="newest">Sort: Newest</option>
          <option value="oldest">Sort: Oldest</option>
          <option value="updated">Sort: Recently updated</option>
        </select>
        {activeFilters > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>Clear</button>}
      </div>

      <Alert>{error}</Alert>
      <section className="card card-flush">
        {!data ? <Spinner /> : data.tickets.length === 0 ? <Empty title="No tickets match these filters" icon="search" /> : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>Ticket</th><th>Student</th><th>Priority</th><th>Status</th><th>Technician</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {data.tickets.map((t) => (
                    <tr key={t.id} className={t.priority === 'Urgent' && !['Resolved', 'Closed'].includes(t.status) ? 'is-urgent' : ''}>
                      <td className="cell-title">
                        <Link to={`/tickets/${t.id}`} className="row-link">
                          <span className="tr-id">#{t.id}</span>
                          <span className="tr-text">{t.title}</span>
                        </Link>
                        <span className="cell-sub">{t.category}</span>
                      </td>
                      <td>{t.student.name}</td>
                      <td><PriorityBadge priority={t.priority} /></td>
                      <td><StatusBadge status={t.status} /></td>
                      <td>{t.technician ? <span className="cell-person"><Avatar name={t.technician.name} size={22} tone="staff" />{t.technician.name}</span> : <em className="unassigned">Unassigned</em>}</td>
                      <td className="muted nowrap">{timeAgo(t.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={data.total} limit={LIMIT} offset={offset}
              onChange={(o) => { const n = new URLSearchParams(params); n.set('offset', o); setParams(n, { replace: true }); window.scrollTo({ top: 0 }); }} />
          </>
        )}
      </section>
    </div>
  );
}
