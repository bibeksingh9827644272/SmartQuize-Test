import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../data/auth';
import type { UserRole } from '../lib/auth';
import UnauthorizedPage from '../pages/Unauthorized';

export function RequireRole({ role, children }: { role: UserRole; children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return (
      <Navigate
        to={`/login?role=${role}`}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (user.role !== role) {
    return <UnauthorizedPage requiredRole={role} />;
  }

  return <>{children}</>;
}
