const slug = (s = '') => s.toLowerCase().replace(/[^a-z]+/g, '-');

export function StatusBadge({ status }) {
  return <span className={`badge status-${slug(status)}`}><span className="dot" />{status}</span>;
}

export function PriorityBadge({ priority }) {
  return <span className={`badge priority-${slug(priority)}`}>{priority === 'Urgent' && '! '}{priority}</span>;
}

export function RolePill({ role }) {
  return <span className={`role-pill role-${role}`}>{role === 'technician' ? 'IT staff' : role}</span>;
}
