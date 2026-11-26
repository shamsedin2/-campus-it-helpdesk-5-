import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/auth';
import Icon from './Icons';
import { Avatar } from './UI';
import { RolePill } from './Badges';

const STUDENT_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home', end: true },
  { to: '/tickets', label: 'My tickets', icon: 'ticket', end: true },
  { to: '/tickets/new', label: 'Report an issue', icon: 'plus' },
];
const STAFF_NAV = [
  { to: '/staff', label: 'Dashboard', icon: 'home', end: true },
  { to: '/staff/tickets', label: 'All tickets', icon: 'list' },
  { to: '/staff/reports', label: 'Reports', icon: 'chart' },
];

export function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Icon name="shield" size={18} /></span>
      <span className="brand-text"><strong>Campus IT</strong><span>Help Desk</span></span>
    </div>
  );
}

export default function Layout() {
  const { user, isStaff, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const nav = isStaff ? [...STAFF_NAV, ...(isAdmin ? [{ to: '/admin/users', label: 'Manage users', icon: 'users' }] : [])] : STUDENT_NAV;

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'is-open' : ''}`}>
        <div className="sidebar-head">
          <Brand />
          <button className="icon-btn sidebar-close" onClick={() => setOpen(false)} aria-label="Close menu"><Icon name="x" /></button>
        </div>
        <nav className="side-nav">
          <span className="side-section">{isStaff ? 'IT staff' : 'Student'}</span>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="side-link" onClick={() => setOpen(false)}>
              <Icon name={n.icon} /> {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-user">
          <Avatar name={user.name} size={36} tone="light" />
          <div className="side-user-info">
            <span className="side-user-name">{user.name}</span>
            <RolePill role={user.role} />
          </div>
          <button className="icon-btn" title="Log out" aria-label="Log out" onClick={() => { logout(); navigate('/login'); }}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <Brand />
          <span style={{ width: 36 }} />
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
