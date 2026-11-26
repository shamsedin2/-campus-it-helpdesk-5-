// Small inline icon set (stroke icons, 20×20) so the app needs no icon library.
const P = {
  home: 'M3 10.5 10 4l7 6.5M5 9v7h4v-4h2v4h4V9',
  ticket: 'M3 6.5V5h14v1.5a2 2 0 0 0 0 4V15H3v-4.5a2 2 0 0 0 0-4ZM12 5v10',
  plus: 'M10 4v12M4 10h12',
  list: 'M7 5h10M7 10h10M7 15h10M3.5 5h.01M3.5 10h.01M3.5 15h.01',
  chart: 'M4 16V9M8.5 16V4M13 16v-5M17 16V7M3 16.5h15',
  users: 'M7.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 17c.5-3 2.7-4.5 5.5-4.5S12.5 14 13 17M13 3.3a3 3 0 0 1 0 5.4M15 12.7c1.6.6 2.7 2 3 4.3',
  logout: 'M8 4H4v12h4M12 6l4 4-4 4M16 10H8',
  menu: 'M3 5h14M3 10h14M3 15h14',
  x: 'M5 5l10 10M15 5 5 15',
  search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM17 17l-3.5-3.5',
  alert: 'M10 3 2 17h16L10 3ZM10 8v4M10 14.5h.01',
  clock: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM10 6v4l3 2',
  check: 'M4 10.5 8 14.5 16 6',
  user: 'M10 9a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 18c.6-3.5 3.2-5.5 6.5-5.5s5.9 2 6.5 5.5',
  inbox: 'M3 11h4l1 2h4l1-2h4M3 11l2-7h10l2 7v5H3v-5Z',
  arrowLeft: 'M16 10H4M9 5l-5 5 5 5',
  chevronLeft: 'M12.5 5 7.5 10l5 5',
  chevronRight: 'M7.5 5l5 5-5 5',
  message: 'M3 4h14v10H8l-4 3v-3H3V4Z',
  history: 'M3.5 10a6.5 6.5 0 1 0 2-4.7M3 3v3.5h3.5M10 6.5V10l2.5 1.5',
  trash: 'M4 6h12M8 6V4h4v2M6 6l1 11h6l1-11',
  refresh: 'M16 4v4h-4M4 16v-4h4M15.3 8A6 6 0 0 0 4.6 7M4.7 12a6 6 0 0 0 10.7 1',
  shield: 'M10 2.5 3.5 5v5c0 4 2.8 6.6 6.5 7.5 3.7-.9 6.5-3.5 6.5-7.5V5L10 2.5Z',
  wifi: 'M2.5 7.5a11 11 0 0 1 15 0M5 10.3a7.5 7.5 0 0 1 10 0M7.5 13a4 4 0 0 1 5 0M10 16h.01',
};

export default function Icon({ name, size = 18, className = '', title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6"
      strokeLinecap="round" strokeLinejoin="round" className={`icon ${className}`} aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      <path d={P[name]} />
    </svg>
  );
}
