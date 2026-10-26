import { LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../data/auth';
import { useToast } from './Toast';
import { UserAvatar } from './UserAvatar';

interface AccountBadgeProps {
  tone?: 'light' | 'dark';
  className?: string;
}

export function AccountBadge({ tone = 'light', className }: AccountBadgeProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { notify } = useToast();

  if (!user) return null;

  const profilePath = user.role === 'admin' ? '/admin/profile' : '/student/profile';

  const handleSignOut = () => {
    logout();
    notify('Signed out. Your local exams and results are still here.', 'info');
    navigate(`/login?role=${user.role}`, { replace: true });
  };

  return (
    <div
      className={`account-badge account-badge--${tone}${className ? ` ${className}` : ''}`}
      title={`${user.rollNumber} · ${user.email} · ${user.phone}`}
    >
      <Link
        to={profilePath}
        className="account-profile-link"
        aria-label={`Open ${user.name}'s profile`}
        title="Open your profile"
      >
        <UserAvatar name={user.name} avatar={user.avatar} />
        <span className="account-copy">
          <strong>{user.name}</strong>
          <em>{user.role === 'admin' ? 'Admin · Teacher' : 'Student'}</em>
        </span>
      </Link>
      <button
        type="button"
        className="account-signout"
        onClick={handleSignOut}
        aria-label={`Sign out of ${user.name}'s account`}
        title="Sign out"
      >
        <LogOut size={15} />
      </button>
    </div>
  );
}
