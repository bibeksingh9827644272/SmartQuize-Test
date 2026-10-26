import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Brand } from '../components/Brand';
import { useAuth } from '../data/auth';
import { roleHome } from '../lib/auth';

export default function NotFoundPage() {
  const { user } = useAuth();
  const destination = user ? roleHome(user.role) : '/login?role=student';
  const destinationLabel = !user
    ? 'Sign in'
    : user.role === 'admin'
      ? 'Admin studio'
      : 'Student exam hall';

  return (
    <div className="not-found-page">
      <header className="not-found-nav">
        <Brand />
      </header>
      <main className="not-found-card">
        <span className="not-found-icon">
          <Compass size={28} />
        </span>
        <p className="eyebrow">404 · Page not found</p>
        <h1>This page missed the exam.</h1>
        <p>
          The link may be old, or the exam may have been removed from this browser's workspace.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={17} />
            Back to the start
          </Link>
          <Link to={destination} className="btn btn-secondary">
            {destinationLabel}
          </Link>
        </div>
      </main>
    </div>
  );
}
