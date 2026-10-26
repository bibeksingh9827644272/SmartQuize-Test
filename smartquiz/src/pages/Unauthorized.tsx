import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  GraduationCap,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { DeveloperCredit } from '../components/DeveloperCredit';
import { useToast } from '../components/Toast';
import { useAuth } from '../data/auth';
import { roleHome, type UserRole } from '../lib/auth';

export default function UnauthorizedPage({ requiredRole }: { requiredRole: UserRole }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();
  const needsAdmin = requiredRole === 'admin';
  const ownRole = user?.role ?? 'student';
  const ownHome = user ? roleHome(user.role) : '/login';
  const OwnIcon = ownRole === 'admin' ? LayoutDashboard : GraduationCap;
  const ownLabel = ownRole === 'admin' ? 'admin studio' : 'exam hall';

  const switchAccount = () => {
    logout();
    notify(
      `Signed out. Sign in with ${needsAdmin ? 'the administrator' : 'a student'} account to continue.`,
      'info',
    );
    navigate(`/login?role=${requiredRole}`, { replace: true });
  };

  return (
    <div className="gate-page">
      <header className="gate-nav">
        <Brand />
        <div className="gate-nav-right">
          <Link to="/" className="auth-back-link">
            <ArrowLeft size={15} />
            Back to home
          </Link>
          <span className="auth-credit-divider" aria-hidden="true" />
          <DeveloperCredit className="gate-credit" />
        </div>
      </header>

      <main className="gate-card">
        <span className="gate-icon">
          <LockKeyhole size={27} />
        </span>
        <p className="eyebrow">403 · Not authorised</p>
        <h1>
          {needsAdmin ? (
            <>
              The admin studio
              <br />
              <em>has its own key.</em>
            </>
          ) : (
            <>
              The exam hall needs
              <br />
              <em>a student account.</em>
            </>
          )}
        </h1>
        <p className="gate-lede">
          {needsAdmin
            ? 'Only the workspace administrator / teacher can create, publish and review exams. Student accounts are kept outside this area.'
            : 'Exams are sat with a student account so every paper and mark stays with the right person. Administrator and teacher accounts use the studio instead.'}
        </p>

        {user && (
          <div className="gate-account">
            <span className={`gate-role-chip gate-role-chip--${user.role}`}>
              {user.role === 'admin' ? <LayoutDashboard size={14} /> : <GraduationCap size={14} />}
              {user.role === 'admin' ? 'Administrator' : 'Student'}
            </span>
            <div>
              <strong>{user.name}</strong>
              <span>
                {user.email} · {user.phone}
              </span>
            </div>
          </div>
        )}

        <div className="gate-actions">
          <Link to={ownHome} className="btn btn-primary">
            <OwnIcon size={17} />
            Go to my {ownLabel}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={switchAccount}>
            <LogOut size={16} />
            Use {needsAdmin ? 'the administrator' : 'a student'} account
          </button>
        </div>

        <p className="gate-note">
          <ShieldAlert size={15} />
          Authorisation is enforced on every page, not just hidden in the navigation.
        </p>
      </main>

      <footer className="gate-footer">
        <span>SmartQuiz · browser workspace</span>
        <Link to="/">Back to the start</Link>
      </footer>
    </div>
  );
}
