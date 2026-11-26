import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { PriorityBadge } from '../components/Badges';
import { Alert, PageHeader, Spinner, StatCard } from '../components/UI';
import { BarList, WeeklyLine } from '../components/Charts';
import { hours, shortDate } from '../lib/format';

const RANGES = [['30', 'Last 30 days'], ['90', 'Last 90 days'], ['', 'All time']];
const SERIES = [
  { key: 'created', label: 'Tickets created', short: 'new', color: 'var(--series-1)' },
  { key: 'resolved', label: 'Tickets resolved', short: 'fixed', color: 'var(--series-2)' },
];

export default function Reports() {
  const { token } = useAuth();
  const [days, setDays] = useState('');
  const [result, setResult] = useState({ days: null, data: null });
  const r = result.days === days ? result.data : null;
  const [error, setError] = useState('');
  const [showTable, setShowTable] = useState(false);

  useEffect(() => {
    api.getReport(token, days).then((data) => setResult({ days, data })).catch((e) => setError(e.message));
  }, [token, days]);

  const exportCsv = () => {
    const rows = [['section', 'name', 'tickets', 'pct', 'median_hours'],
      ...r.byCategory.map((c) => ['category', c.category, c.tickets, c.pct, c.median_hours ?? '']),
      ...r.byPriority.map((p) => ['priority', p.priority, p.tickets, p.pct, p.median_hours ?? '']),
      ...r.byStatus.map((s) => ['status', s.status, s.tickets, '', ''])];
    const blob = new Blob([rows.map((x) => x.join(',')).join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `helpdesk-report-${days || 'all'}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="page page-wide">
      <PageHeader title="Reports" subtitle="Where requests come from and how fast they get fixed.">
        {r && <button className="btn btn-secondary" onClick={exportCsv}><Icon name="list" /> Export CSV</button>}
      </PageHeader>

      <div className="toolbar">
        <div className="tabs">
          {RANGES.map(([v, l]) => <button key={l} className={`tab ${days === v ? 'is-active' : ''}`} onClick={() => setDays(v)}>{l}</button>)}
        </div>
        <label className="toggle"><input type="checkbox" checked={showTable} onChange={(e) => setShowTable(e.target.checked)} /> Show data tables</label>
      </div>

      <Alert>{error}</Alert>
      {!r ? <Spinner label="Crunching the numbers…" /> : (
        <>
          <div className="stat-grid stat-grid-5">
            <StatCard label="Tickets" value={r.overall.total} icon="ticket" hint={`${r.overall.open} still open`} />
            <StatCard label="Resolved" value={`${r.overall.pct_resolved}%`} icon="check" tone="green" hint={`${r.overall.resolved} tickets`} />
            <StatCard label="Median time to fix" value={hours(r.overall.median_hours)} icon="clock" tone="blue" hint={`Mean ${hours(r.overall.mean_hours)}`} />
            <StatCard label="90th percentile" value={hours(r.overall.p90_hours)} icon="clock" hint="9 in 10 fixed within this" />
            <StatCard label="Unassigned now" value={r.overall.unassigned} icon="inbox" tone="amber" />
          </div>

          <div className="report-grid">
            <section className="card span-2">
              <div className="card-head"><h2>Weekly volume</h2><span className="muted">Created vs. resolved</span></div>
              {r.weekly.length > 0 ? <WeeklyLine data={r.weekly} series={SERIES} xLabel={(d) => shortDate(d.week + 'T12:00:00')} /> : <p className="muted">No data in this range.</p>}
              {showTable && (
                <table className="table table-compact">
                  <thead><tr><th>Week of</th><th>Created</th><th>Resolved</th></tr></thead>
                  <tbody>{r.weekly.map((w) => <tr key={w.week}><td>{shortDate(w.week + 'T12:00:00')}</td><td>{w.created}</td><td>{w.resolved}</td></tr>)}</tbody>
                </table>
              )}
            </section>

            <section className="card">
              <div className="card-head"><h2>Tickets by category</h2></div>
              <BarList data={r.byCategory} label={(d) => d.category} value={(d) => d.tickets}
                format={(v) => v} tooltip={(d) => `${d.category}: ${d.tickets} tickets (${d.pct}%) · median fix ${hours(d.median_hours)}`} />
              {r.byCategory.length >= 2 && r.overall.total > 0 && (
                <p className="insight">
                  <Icon name="alert" size={15} /> <b>{r.byCategory[0].category}</b> and <b>{r.byCategory[1].category}</b> make up{' '}
                  {Math.round((r.byCategory[0].pct + r.byCategory[1].pct) * 10) / 10}% of all tickets.
                </p>
              )}
              {showTable && (
                <table className="table table-compact">
                  <thead><tr><th>Category</th><th>Tickets</th><th>Share</th><th>Median fix</th></tr></thead>
                  <tbody>{r.byCategory.map((c) => <tr key={c.category}><td>{c.category}</td><td>{c.tickets}</td><td>{c.pct}%</td><td>{hours(c.median_hours)}</td></tr>)}</tbody>
                </table>
              )}
            </section>

            <section className="card">
              <div className="card-head"><h2>Median time to fix, by priority</h2></div>
              <BarList data={r.byPriority} label={(d) => d.priority} value={(d) => d.median_hours || 0}
                format={(v) => hours(v)} tooltip={(d) => `${d.priority}: median ${hours(d.median_hours)}, mean ${hours(d.mean_hours)}, ${d.resolved}/${d.tickets} resolved`} />
              <table className="table table-compact">
                <thead><tr><th>Priority</th><th>Tickets</th><th>Share</th><th>Resolved</th><th>Mean</th><th>Median</th></tr></thead>
                <tbody>
                  {r.byPriority.map((p) => (
                    <tr key={p.priority}><td><PriorityBadge priority={p.priority} /></td><td>{p.tickets}</td><td>{p.pct}%</td><td>{p.resolved}</td><td>{hours(p.mean_hours)}</td><td><b>{hours(p.median_hours)}</b></td></tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="card-head"><h2>Tickets by status</h2></div>
              <BarList data={r.byStatus} label={(d) => d.status} value={(d) => d.tickets}
                tooltip={(d) => `${d.status}: ${d.tickets} (${r.overall.total ? Math.round((1000 * d.tickets) / r.overall.total) / 10 : 0}%)`} />
            </section>

            <section className="card">
              <div className="card-head"><h2>Still unresolved after…</h2></div>
              <div className="survival">
                {r.unresolvedAfter.map((u) => (
                  <div key={u.hours} className="survival-item">
                    <span className="survival-value">{u.pct}%</span>
                    <span className="survival-label">{u.hours} hours</span>
                  </div>
                ))}
              </div>
              <p className="muted small">Share of tickets not yet resolved after 24, 48, and 72 hours. Only tickets old enough to have reached each mark are counted, so tickets that are still open are included correctly.</p>
            </section>

            <section className="card span-2">
              <div className="card-head"><h2>Technician workload</h2></div>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Technician</th><th>Open assigned</th><th>Resolved</th><th>Median time to fix</th></tr></thead>
                  <tbody>
                    {r.byTechnician.map((t) => (
                      <tr key={t.name}><td><strong>{t.name}</strong></td><td>{t.open_assigned}</td><td>{t.resolved}</td><td>{hours(t.median_hours)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <p className="muted small center">Figures come from the database as of {new Date(r.generated_at).toLocaleString()}. Demo data is synthetic test data, not real campus tickets.</p>
        </>
      )}
    </div>
  );
}
