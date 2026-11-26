import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { Alert, Empty, PageHeader, Spinner, StatCard, TicketRows } from '../components/UI';

function Queue({ title, icon, tickets, to, empty, tone }) {
  return (
    <section className={`card queue ${tone ? `queue-${tone}` : ''}`}>
      <div className="card-head">
        <h2><Icon name={icon} /> {title}</h2>
        <Link to={to} className="link">See all</Link>
      </div>
      {!tickets ? <Spinner /> : tickets.length === 0 ? <Empty title={empty} icon="check" /> : <TicketRows tickets={tickets} showStudent showTech />}
    </section>
  );
}

export default function StaffDashboard() {
  const { token, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [urgent, setUrgent] = useState(null);
  const [unassigned, setUnassigned] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = (p) => api.getTickets(token, { active: 'true', limit: 6, ...p }).then((r) => r.tickets);
    Promise.all([api.getStats(token), t({ priority: 'Urgent,High' }), t({ technician: 'none', sort: 'oldest' }), t({ technician: 'me' })])
      .then(([s, u, n, m]) => { setStats(s); setUrgent(u); setUnassigned(n); setMine(m); })
      .catch((err) => setError(err.message));
  }, [token]);

  const c = (s) => stats?.byStatus.find((r) => r.status === s)?.count || 0;
  const p = (s) => stats?.openByPriority.find((r) => r.priority === s)?.count || 0;

  return (
    <div className="page">
      <PageHeader title="IT Dashboard" subtitle={`Good to see you, ${user.name.split(' ')[0]}. Here is what needs attention first.`}>
        <Link className="btn btn-secondary" to="/staff/reports"><Icon name="chart" /> Reports</Link>
        <Link className="btn btn-primary" to="/staff/tickets"><Icon name="list" /> All tickets</Link>
      </PageHeader>
      <Alert>{error}</Alert>

      <div className="stat-grid stat-grid-5">
        <StatCard label="Urgent & high" value={stats && p('Urgent') + p('High')} icon="alert" tone="red" to="/staff/tickets?priority=Urgent,High" hint={stats && `${p('Urgent')} urgent`} />
        <StatCard label="Unassigned" value={stats?.unassigned} icon="inbox" tone="amber" to="/staff/tickets?technician=none" hint="Need an owner" />
        <StatCard label="Assigned to me" value={stats?.mine} icon="user" tone="blue" to="/staff/tickets?technician=me" />
        <StatCard label="Waiting on student" value={stats && c('Waiting for Student')} icon="message" tone="purple" to="/staff/tickets?status=Waiting%20for%20Student" />
        <StatCard label="Resolved this week" value={stats?.resolved_7d} icon="check" tone="green" hint={stats && `${stats.last_24h} new in last 24 h`} />
      </div>

      <div className="queue-grid">
        <Queue title="Urgent & high priority" icon="alert" tone="red" tickets={urgent} to="/staff/tickets?priority=Urgent,High" empty="No urgent tickets right now" />
        <Queue title="Unassigned (oldest first)" icon="inbox" tone="amber" tickets={unassigned} to="/staff/tickets?technician=none" empty="Every ticket has an owner" />
      </div>
      <Queue title="My queue" icon="user" tickets={mine} to="/staff/tickets?technician=me" empty="Nothing assigned to you" />
    </div>
  );
}
