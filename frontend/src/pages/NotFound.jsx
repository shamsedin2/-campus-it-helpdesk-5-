import { Link } from 'react-router-dom';
import { Empty } from '../components/UI';

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <Empty title="Page not found" icon="search">
        <p>That page does not exist.</p>
        <Link to="/" className="btn btn-primary btn-sm">Go home</Link>
      </Empty>
    </div>
  );
}
