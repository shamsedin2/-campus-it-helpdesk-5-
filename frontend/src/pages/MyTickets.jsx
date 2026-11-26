import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { Alert, Empty, PageHeader, Pagination, Spinner, TicketRows } from '../components/UI';

const TABS = [
  { label: 'Active', params: { active: 'true' } },
  { label: 'Needs reply', params: { status: 'Waiting for Student,Resolved' } },
  { label: 'Closed', params: { status: 'Closed' } },
  { label: 'All', params: {} },
];
const LIMIT = 15;

export default function MyTickets() {
  const { token } = useAuth();
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      api.getTickets(token, { ...TABS[tab].params, q, limit: LIMIT, offset, sort: 'updated' })
        .then(setData).catch((err) => setError(err.message));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [token, tab, q, offset]);

  return (
    <div className="page">
      <PageHeader title="My tickets" subtitle="Everything you have reported to IT.">
        <Link className="btn btn-primary" to="/tickets/new"><Icon name="plus" /> Report an issue</Link>
      </PageHeader>

      <div className="toolbar">
        <div className="tabs" role="tablist">
          {TABS.map((t, i) => (
            <button key={t.label} role="tab" aria-selected={tab === i} className={`tab ${tab === i ? 'is-active' : ''}`}
              onClick={() => { setTab(i); setOffset(0); }}>{t.label}</button>
          ))}
        </div>
        <label className="search">
          <Icon name="search" />
          <input placeholder="Search your tickets" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
        </label>
      </div>

      <Alert>{error}</Alert>
      <section className="card card-flush">
        {!data ? <Spinner /> : data.tickets.length === 0 ? (
          <Empty title="No tickets here">{tab === 0 && !q && <p>You have no open requests right now.</p>}</Empty>
        ) : (
          <>
            <TicketRows tickets={data.tickets} showTech />
            <Pagination total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />
          </>
        )}
      </section>
    </div>
  );
}
