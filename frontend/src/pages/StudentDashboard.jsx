import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { Alert, Empty, PageHeader, Spinner, StatCard, TicketRows } from '../components/UI';

export default function StudentDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [active, setActive] = useState(null);
  const [needsYou, setNeedsYou] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getStats(token),
      api.getTickets(token, { active: 'true', limit: 10, sort: 'updated' }),
      api.getTickets(token, { status: 'Waiting for Student,Resolved', limit: 10, sort: 'updated' }),
    ])
      .then(([s, a, n]) => { setStats(s); setActive(a.tickets); setNeedsYou(n.tickets); })
      .catch((err) => setError(err.message));
  }, [token]);

  const c = (s) => stats?.byStatus.find((r) => r.status === s)?.count || 0;

  return (
    <div className="page">
      <PageHeader title={`Hi, ${user.name.split(' ')[0]}`} subtitle="Here is where your support requests stand.">
        <Link className="btn btn-primary" to="/tickets/new"><Icon name="plus" /> Report an issue</Link>
      </PageHeader>
      <Alert>{error}</Alert>

      <div className="stat-grid">
        <StatCard label="Open requests" value={stats && c('Open') + c('In Progress') + c('Waiting for Student')} icon="ticket" tone="blue" />
        <StatCard label="Waiting on you" value={stats && c('Waiting for Student')} icon="message" tone="purple" hint="IT needs more info" />
        <StatCard label="Ready to confirm" value={stats && c('Resolved')} icon="check" tone="green" hint="Confirm the fix worked" />
        <StatCard label="All time" value={stats?.total} icon="history" />
      </div>

      {needsYou.length > 0 && (
        <section className="card card-highlight">
          <div className="card-head">
            <h2><Icon name="alert" /> Needs your attention</h2>
          </div>
          <TicketRows tickets={needsYou} />
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Active requests</h2>
          <Link to="/tickets" className="link">View all</Link>
        </div>
        {!active ? <Spinner /> : active.length === 0 ? (
          <Empty title="Nothing in progress" icon="check">
            <p>Having a problem with Wi-Fi, your account, a printer, or a classroom?</p>
            <Link className="btn btn-primary btn-sm" to="/tickets/new">Report an issue</Link>
          </Empty>
        ) : <TicketRows tickets={active} />}
      </section>
    </div>
  );
}
