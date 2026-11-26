import { Link } from 'react-router-dom';
import Icon from './Icons';
import { StatusBadge, PriorityBadge } from './Badges';
import { initials, timeAgo } from '../lib/format';

export const Spinner = ({ label = 'Loading…' }) => (
  <div className="spinner-wrap" role="status"><span className="spinner" />{label}</div>
);

export const Alert = ({ children, tone = 'error' }) =>
  children ? <div className={`alert alert-${tone}`} role="alert"><Icon name={tone === 'error' ? 'alert' : 'check'} />{children}</div> : null;

export function Empty({ icon = 'inbox', title, children }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={22} /></span>
      <strong>{title}</strong>
      {children && <div className="empty-body">{children}</div>}
    </div>
  );
}

export const Avatar = ({ name, size = 32, tone }) => (
  <span className={`avatar ${tone ? `avatar-${tone}` : ''}`} style={{ width: size, height: size, fontSize: size * 0.38 }}>{initials(name)}</span>
);

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, tone = 'default', hint, to }) {
  const body = (
    <>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {icon && <span className={`stat-icon tone-${tone}`}><Icon name={icon} size={16} /></span>}
      </div>
      <span className="stat-value">{value ?? '—'}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </>
  );
  return to ? <Link to={to} className="stat-card stat-link">{body}</Link> : <div className="stat-card">{body}</div>;
}

// Ticket rows used on dashboards and lists. `showStudent` for staff views.
export function TicketRows({ tickets, showStudent = false, showTech = false }) {
  return (
    <ul className="ticket-rows">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link to={`/tickets/${t.id}`} className={`ticket-row ${t.priority === 'Urgent' && !['Resolved', 'Closed'].includes(t.status) ? 'is-urgent' : ''}`}>
            <div className="tr-main">
              <div className="tr-title">
                <span className="tr-id">#{t.id}</span>
                <span className="tr-text">{t.title}</span>
              </div>
              <div className="tr-meta">
                <span>{t.category}</span>
                {showStudent && <span>· {t.student?.name}</span>}
                {showTech && <span>· {t.technician?.name || <em className="unassigned">Unassigned</em>}</span>}
                <span>· {timeAgo(t.updated_at)}</span>
                {t.comment_count > 0 && <span className="tr-comments"><Icon name="message" size={13} />{t.comment_count}</span>}
              </div>
            </div>
            <div className="tr-badges">
              <PriorityBadge priority={t.priority} />
              <StatusBadge status={t.status} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function Pagination({ total, limit, offset, onChange }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="pagination">
      <span className="muted">{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <div className="pagination-buttons">
        <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => onChange(offset - limit)} aria-label="Previous page"><Icon name="chevronLeft" /></button>
        <span className="page-num">Page {page} of {pages}</span>
        <button className="btn btn-ghost btn-sm" disabled={page === pages} onClick={() => onChange(offset + limit)} aria-label="Next page"><Icon name="chevronRight" /></button>
      </div>
    </div>
  );
}

// The five-stage lifecycle as a progress stepper.
const STEPS = ['Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed'];
export function Lifecycle({ status, waited = true }) {
  const idx = STEPS.indexOf(status);
  return (
    <ol className="lifecycle" aria-label={`Ticket status: ${status}`}>
      {STEPS.map((s, i) => {
        const state = i < idx ? 'done' : i === idx ? 'current' : 'todo';
        // "Waiting for Student" is optional; show it as skipped if the ticket never went there.
        const skipped = s === 'Waiting for Student' && state === 'done' && !waited;
        return (
          <li key={s} className={`step step-${state} ${skipped ? 'step-skipped' : ''}`}>
            <span className="step-dot">{skipped ? '–' : state === 'done' ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="step-label">{s}{skipped && ' (skipped)'}</span>
          </li>
        );
      })}
    </ol>
  );
}
