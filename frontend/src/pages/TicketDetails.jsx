import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/auth';
import Icon from '../components/Icons';
import { StatusBadge, PriorityBadge, RolePill } from '../components/Badges';
import { Alert, Avatar, Lifecycle, Spinner } from '../components/UI';
import { fullDate, timeAgo, PRIORITIES } from '../lib/format';

function actionLabel(from, to) {
  if (to === 'In Progress') return from === 'Resolved' ? 'Reopen ticket' : from === 'Waiting for Student' ? 'Resume work' : 'Start work';
  if (to === 'Waiting for Student') return 'Ask student for info';
  if (to === 'Resolved') return 'Mark resolved';
  if (to === 'Closed') return 'Close ticket';
  return to;
}

function describe(h) {
  switch (h.field) {
    case 'created': return 'submitted the ticket';
    case 'status': return <>changed status from <b>{h.old_value}</b> to <b>{h.new_value}</b></>;
    case 'technician': return h.new_value ? <>assigned <b>{h.new_value}</b>{h.old_value ? <> (was {h.old_value})</> : ''}</> : <>unassigned <b>{h.old_value}</b></>;
    case 'priority': return <>changed priority from <b>{h.old_value}</b> to <b>{h.new_value}</b></>;
    case 'category_id': return 'changed the category';
    case 'title': return <>renamed the ticket to <b>{h.new_value}</b></>;
    case 'description': return 'edited the description';
    default: return `changed ${h.field}`;
  }
}

export default function TicketDetails() {
  const { id } = useParams();
  const { token, isStaff, isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [ticket, setTicket] = useState(null);
  const [staff, setStaff] = useState([]);
  const [categories, setCategories] = useState([]);
  const [comment, setComment] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(location.state?.created ? 'Your ticket was submitted. IT staff will reply here.' : '');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tab, setTab] = useState('conversation');

  const load = useCallback(() => api.getTicket(token, id).then(setTicket).catch((err) => setError(err.message)), [token, id]);

  useEffect(() => {
    load();
    if (isStaff) {
      api.getUsers(token, { role: 'staff' }).then((r) => setStaff(r.users)).catch(() => {});
      api.getCategories(token).then(setCategories).catch(() => {});
    }
  }, [load, isStaff, token]);

  const run = async (fn, message) => {
    setBusy(true); setError(''); setNotice('');
    try {
      const updated = await fn();
      if (updated) setTicket(updated);
      if (message) setNotice(message);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (error && !ticket) {
    return <div className="page page-narrow"><Alert>{error}</Alert><Link to="/" className="link">Go back home</Link></div>;
  }
  if (!ticket) return <div className="page"><Spinner /></div>;

  const isOwner = ticket.student.id === user.id;
  const closed = ticket.status === 'Closed';
  const backTo = isStaff ? '/staff/tickets' : '/tickets';

  const submitComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    if (await run(() => api.addComment(token, id, comment.trim()))) setComment('');
  };

  return (
    <div className="page page-wide">
      <Link to={backTo} className="back-link"><Icon name="arrowLeft" size={16} /> Back to tickets</Link>

      <div className="ticket-head">
        <div>
          <span className="eyebrow">Ticket #{ticket.id} · {ticket.category}</span>
          <h1>{ticket.title}</h1>
          <div className="badge-row">
            <PriorityBadge priority={ticket.priority} />
            <StatusBadge status={ticket.status} />
            <span className="muted">Opened {timeAgo(ticket.created_at)}</span>
          </div>
        </div>
      </div>

      <Lifecycle status={ticket.status} waited={ticket.history.some((h) => h.field === 'status' && h.new_value === 'Waiting for Student')} />
      <Alert>{error}</Alert>
      <Alert tone="success">{notice}</Alert>

      {!isStaff && isOwner && ticket.status === 'Resolved' && (
        <div className="callout callout-green">
          <div>
            <strong>IT marked this as resolved. Is it fixed?</strong>
            <p>If you do not reply, it will close automatically 7 days after it was resolved.</p>
          </div>
          <div className="callout-actions">
            <button className="btn btn-success" disabled={busy} onClick={() => run(() => api.setStatus(token, id, 'Closed'), 'Thanks! The ticket is now closed.')}>
              <Icon name="check" /> Yes, it’s fixed
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => run(() => api.setStatus(token, id, 'In Progress', 'This is still not working.'), 'Reopened. IT staff will take another look.')}>
              Still not working
            </button>
          </div>
        </div>
      )}
      {!isStaff && ticket.status === 'Waiting for Student' && (
        <div className="callout callout-purple">
          <div><strong>IT is waiting for your reply.</strong><p>Answer in the conversation below and the ticket goes straight back to the technician.</p></div>
        </div>
      )}

      <div className="detail-layout">
        <div className="detail-main">
          <section className="card">
            <h2 className="card-title">Description</h2>
            <p className="ticket-description">{ticket.description}</p>
          </section>

          <section className="card">
            <div className="tabs tabs-inline" role="tablist">
              <button role="tab" aria-selected={tab === 'conversation'} className={`tab ${tab === 'conversation' ? 'is-active' : ''}`} onClick={() => setTab('conversation')}>
                <Icon name="message" size={15} /> Conversation <span className="count">{ticket.comments.length}</span>
              </button>
              <button role="tab" aria-selected={tab === 'history'} className={`tab ${tab === 'history' ? 'is-active' : ''}`} onClick={() => setTab('history')}>
                <Icon name="history" size={15} /> History <span className="count">{ticket.history.length}</span>
              </button>
            </div>

            {tab === 'conversation' ? (
              <>
                <ul className="thread">
                  {ticket.comments.length === 0 && <li className="muted thread-empty">No messages yet.</li>}
                  {ticket.comments.map((c) => (
                    <li key={c.id} className={`msg ${c.author_role !== 'student' ? 'msg-staff' : ''}`}>
                      <Avatar name={c.author} size={34} tone={c.author_role !== 'student' ? 'staff' : undefined} />
                      <div className="msg-body">
                        <div className="msg-head">
                          <strong>{c.author}</strong>
                          {c.author_role !== 'student' && <RolePill role={c.author_role} />}
                          <time title={fullDate(c.created_at)}>{timeAgo(c.created_at)}</time>
                        </div>
                        <p>{c.body}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                {closed ? (
                  <p className="muted thread-closed">This ticket is closed. If the problem comes back, please <Link to="/tickets/new" className="link">open a new ticket</Link>.</p>
                ) : (
                  <form className="composer" onSubmit={submitComment}>
                    <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
                      placeholder={isStaff ? 'Reply to the student…' : 'Write a reply to IT…'} maxLength={5000} />
                    <div className="composer-actions">
                      <button className="btn btn-primary" type="submit" disabled={busy || !comment.trim()}>Send reply</button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <ol className="timeline">
                {ticket.history.map((h) => (
                  <li key={h.id}>
                    <span className={`tl-dot tl-${h.field}`} />
                    <div><b>{h.changed_by}</b> {describe(h)}<time title={fullDate(h.changed_at)}>{fullDate(h.changed_at)}</time></div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="detail-side">
          {isStaff && !closed && (
            <section className="card">
              <h2 className="card-title">Actions</h2>
              {ticket.allowed_transitions.length > 0 && (
                <>
                  <textarea className="note-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional note to the student (posted with the status change)" />
                  <div className="action-stack">
                    {ticket.allowed_transitions.map((s) => (
                      <button key={s} className={`btn ${s === 'Resolved' ? 'btn-success' : s === 'Closed' ? 'btn-secondary' : 'btn-primary'} btn-block`}
                        disabled={busy || (s === 'In Progress' && ticket.status === 'Open' && !ticket.technician)}
                        onClick={async () => { if (await run(() => api.setStatus(token, id, s, note))) setNote(''); }}>
                        {actionLabel(ticket.status, s)}
                      </button>
                    ))}
                  </div>
                  {ticket.status === 'Open' && !ticket.technician && <p className="field-hint">Assign a technician to start work. Assigning moves the ticket to In Progress.</p>}
                </>
              )}

              <label className="field">
                <span>Technician</span>
                <select value={ticket.technician?.id || ''} disabled={busy} onChange={(e) => run(() => api.assign(token, id, e.target.value ? Number(e.target.value) : null))}>
                  <option value="">Unassigned</option>
                  {staff.map((t) => <option key={t.id} value={t.id}>{t.name}{t.id === user.id ? ' (me)' : ''} · {t.open_assigned} open</option>)}
                </select>
              </label>
              {ticket.technician?.id !== user.id && (
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => run(() => api.assign(token, id, user.id))}>Assign to me</button>
              )}

              <div className="field-row">
                <label className="field">
                  <span>Priority</span>
                  <select value={ticket.priority} disabled={busy} onChange={(e) => run(() => api.updateTicket(token, id, { priority: e.target.value }))}>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Category</span>
                  <select value={ticket.category_id} disabled={busy} onChange={(e) => run(() => api.updateTicket(token, id, { category_id: Number(e.target.value) }))}>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </label>
              </div>
            </section>
          )}

          <section className="card">
            <h2 className="card-title">Details</h2>
            <dl className="details">
              <dt>Submitted by</dt>
              <dd><Avatar name={ticket.student.name} size={24} /> <span>{ticket.student.name}{isStaff && <small>{ticket.student.email}</small>}</span></dd>
              <dt>Technician</dt>
              <dd>{ticket.technician ? <><Avatar name={ticket.technician.name} size={24} tone="staff" /> {ticket.technician.name}</> : <em className="unassigned">Not assigned yet</em>}</dd>
              <dt>Created</dt><dd>{fullDate(ticket.created_at)}</dd>
              <dt>Last update</dt><dd>{fullDate(ticket.updated_at)}</dd>
              {ticket.resolved_at && <><dt>Resolved</dt><dd>{fullDate(ticket.resolved_at)}</dd></>}
              {ticket.closed_at && <><dt>Closed</dt><dd>{fullDate(ticket.closed_at)}</dd></>}
            </dl>
          </section>

          {isAdmin && (
            <section className="card card-danger">
              <h2 className="card-title">Danger zone</h2>
              {!confirmDelete ? (
                <button className="btn btn-danger-ghost btn-block" onClick={() => setConfirmDelete(true)}><Icon name="trash" /> Delete ticket</button>
              ) : (
                <>
                  <p className="field-hint">This permanently deletes the ticket, its messages, and its history.</p>
                  <div className="action-row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                    <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(async () => { await api.deleteTicket(token, id); navigate(backTo); })}>Delete for good</button>
                  </div>
                </>
              )}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
