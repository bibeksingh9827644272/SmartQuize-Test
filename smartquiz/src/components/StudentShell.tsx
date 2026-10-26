import type { ReactNode } from 'react';
import { Brand } from './Brand';
import { AccountBadge } from './AccountBadge';
import { DeveloperCredit } from './DeveloperCredit';
import { InstallButton } from './InstallApp';

export function StudentShell({ children }: { children: ReactNode }) {
  return (
    <div className="student-shell">
      <header className="student-topbar">
        <Brand to="/student" />
        <div className="student-topbar-right">
          <AccountBadge />
          <InstallButton />
          <span className="topbar-credit-divider" aria-hidden="true" />
          <DeveloperCredit className="student-credit" />
        </div>
      </header>
      <main className="student-main">{children}</main>
      <footer className="student-footer">
        <span>SmartQuiz · browser-local</span>
        <span>Exams and results stay in this browser.</span>
      </footer>
    </div>
  );
}
