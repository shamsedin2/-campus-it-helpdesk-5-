import { Brand } from '../components/Layout';
import Icon from '../components/Icons';

// Two-column sign-in layout: a short pitch on the left, the form on the right.
export default function AuthShell({ children }) {
  return (
    <div className="auth">
      <section className="auth-hero">
        <Brand />
        <div className="auth-hero-copy">
          <h2>One place to report and track every tech problem on campus.</h2>
          <ul>
            <li><Icon name="ticket" /> Submit a ticket in under a minute</li>
            <li><Icon name="clock" /> See its status and replies any time</li>
            <li><Icon name="shield" /> Only you and IT staff can see your tickets</li>
          </ul>
        </div>
        <p className="auth-hero-foot">Holy Family University · BUIN-439 Final Project</p>
      </section>
      <section className="auth-panel">{children}</section>
    </div>
  );
}
