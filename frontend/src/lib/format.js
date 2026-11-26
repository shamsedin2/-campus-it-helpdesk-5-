export function timeAgo(value) {
  if (!value) return '';
  const diff = (Date.now() - new Date(value).getTime()) / 1000;
  if (diff < 60) return 'just now';
  const steps = [[60, 'min'], [24, 'hr'], [7, 'day'], [4.35, 'wk'], [12, 'mo']];
  let n = diff / 60;
  for (let i = 0; i < steps.length; i++) {
    const [size, unit] = steps[i];
    if (n < size || i === steps.length - 1) {
      const v = Math.floor(n);
      return `${v} ${unit}${v === 1 ? '' : 's'} ago`;
    }
    n /= size;
  }
  return '';
}

export const fullDate = (v) =>
  v ? new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export const shortDate = (v) => (v ? new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

export function hours(h) {
  if (h == null) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

export const STATUSES = ['Open', 'In Progress', 'Waiting for Student', 'Resolved', 'Closed'];
export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const PRIORITY_HELP = {
  Low: 'A general question or a minor issue with an easy workaround',
  Medium: 'Slows you down but does not stop your work',
  High: 'Prevents you from completing coursework',
  Urgent: 'Affects a class in session or many people at once',
};
