import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  FilePlus2,
  LayoutDashboard,
  ScanText,
  UserRound,
  Users,
} from 'lucide-react';
import { Brand } from './Brand';
import { AccountBadge } from './AccountBadge';
import { DeveloperCredit } from './DeveloperCredit';
import { InstallButton } from './InstallApp';

export function AdminShell({ children }: { children: ReactNode }) {
  const navClass = ({ isActive }: { isActive: boolean }) =>
    `sidebar-link${isActive ? ' is-active' : ''}`;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Brand to="/admin" tone="light" />
        </div>

        <div className="sidebar-block">
          <p className="sidebar-kicker">Admin studio</p>
          <nav className="sidebar-nav" aria-label="Admin navigation">
            <NavLink to="/admin" end className={navClass}>
              <LayoutDashboard size={18} />
              <span>Overview</span>
            </NavLink>
            <NavLink to="/admin/exams/new/edit" className={navClass}>
              <FilePlus2 size={18} />
              <span>New exam</span>
            </NavLink>
            <NavLink to="/admin/students" className={navClass}>
              <Users size={18} />
              <span>Students</span>
            </NavLink>
            <NavLink to="/admin/profile" className={navClass}>
              <UserRound size={18} />
              <span>My profile</span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-tip">
          <span className="sidebar-tip-icon">
            <ScanText size={18} />
          </span>
          <p>Paper or pixels?</p>
          <span>Upload a PDF, a phone photo, or a handwritten page. Local OCR does the typing.</span>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-account">
            <AccountBadge tone="dark" />
          </div>
          <span className="sidebar-session-note">
            <span className="local-dot" />
            Signed in on this browser
          </span>
        </div>
      </aside>

      <div className="admin-area">
        <header className="admin-topbar">
          <div className="admin-topbar-context">
            <span className="admin-topbar-status">
              <span className="local-dot" />
              Local workspace
            </span>
            <span className="admin-topbar-note">Exams and results stay in this browser</span>
          </div>
          <div className="admin-topbar-actions">
            <InstallButton />
            <AccountBadge />
            <DeveloperCredit className="admin-credit" />
          </div>
        </header>

        <div className="mobile-admin-bar">
          <div className="mobile-admin-topline">
            <Brand to="/admin" />
            <div className="mobile-admin-account">
              <AccountBadge />
              <span className="mobile-credit-divider" aria-hidden="true" />
              <DeveloperCredit className="mobile-dev-credit" />
            </div>
          </div>
          <div className="mobile-admin-actions">
            <NavLink to="/admin" end={true} className={navClass} aria-label="Admin overview">
              <LayoutDashboard size={19} />
            </NavLink>
            <NavLink
              to="/admin/exams/new/edit"
              className={navClass}
              aria-label="Create a new exam"
            >
              <FilePlus2 size={19} />
            </NavLink>
            <NavLink to="/admin/students" className={navClass} aria-label="Enrolled students">
              <Users size={19} />
            </NavLink>
            <span className="mobile-action-divider" aria-hidden="true" />
            <NavLink to="/admin/profile" className={navClass} aria-label="My profile">
              <UserRound size={19} />
            </NavLink>
            <InstallButton />
          </div>
        </div>

        <main className="admin-main">{children}</main>
        <div className="admin-dev-footer">
          <span className="admin-dev-note">
            <span className="local-dot" />
            Browser-local · this browser only
          </span>
          <span className="admin-dev-note">Developed by Bibek Singh</span>
        </div>
      </div>
    </div>
  );
}
