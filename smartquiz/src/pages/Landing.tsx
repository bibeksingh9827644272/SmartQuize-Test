import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FilePlus2,
  GraduationCap,
  LayoutDashboard,
  ScanText,
  ShieldCheck,
  Sparkles,
  Timer,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { AccountBadge } from '../components/AccountBadge';
import { DeveloperCredit } from '../components/DeveloperCredit';
import { InstallButton } from '../components/InstallApp';
import { useAuth } from '../data/auth';
import { roleHome } from '../lib/auth';

const workflow = [
  {
    number: '01',
    title: 'Drop the paper',
    copy: 'Upload a PDF, a phone photo, or a handwritten page. Printed PDFs are read instantly.',
    icon: ScanText,
  },
  {
    number: '02',
    title: 'Fix and publish',
    copy: 'Review the parsed questions, set the answer key, and share a six-character exam code.',
    icon: Sparkles,
  },
  {
    number: '03',
    title: 'Mark automatically',
    copy: 'Students sit a focused, timed quiz and get an instant score. Every attempt lands in results.',
    icon: Timer,
  },
];

export default function LandingPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const panelHome = user ? roleHome(user.role) : '/login';

  return (
    <div className="landing">
      <header className="landing-nav">
        <Brand />
        <div className="landing-nav-right">
          {user ? (
            <>
              <Link to={panelHome} className="btn btn-primary btn-sm landing-panel-btn">
                {isAdmin ? <LayoutDashboard size={15} /> : <GraduationCap size={15} />}
                Open {isAdmin ? 'studio' : 'exam hall'}
              </Link>
              <AccountBadge className="landing-account" />
            </>
          ) : (
            <>
              <Link to="/student" className="landing-text-link">
                Student hall
              </Link>
              <Link to="/login" className="landing-signin-link">
                Sign in
              </Link>
              <Link to="/admin" className="btn btn-primary btn-sm landing-admin-btn">
                Admin studio
                <ArrowUpRight size={16} />
              </Link>
            </>
          )}
          <InstallButton className="install-trigger--landing" />
        </div>
        <div className="landing-credit-slot">
          <span className="landing-credit-divider" aria-hidden="true" />
          <DeveloperCredit className="landing-credit" />
        </div>
      </header>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-rule" />
              Local-first exam studio
            </p>
            <h1>
              Paper in.
              <br />
              <span>Exam out.</span>
            </h1>
            <p className="hero-lede">
              Turn the questions you already have into a clean online exam. Read a PDF or a
              photographed page, check the MCQs, publish, and let the marking take care of itself.
            </p>
            <div className="hero-actions">
              {user ? (
                isAdmin ? (
                  <>
                    <Link to="/admin" className="btn btn-primary btn-lg">
                      <LayoutDashboard size={18} />
                      Open admin studio
                      <ArrowRight size={18} />
                    </Link>
                    <Link to="/admin/exams/new/edit" className="btn btn-secondary btn-lg">
                      <FilePlus2 size={18} />
                      Create a new exam
                    </Link>
                  </>
                ) : (
                  <Link to="/student" className="btn btn-primary btn-lg">
                    <GraduationCap size={18} />
                    Enter exam hall
                    <ArrowRight size={18} />
                  </Link>
                )
              ) : (
                <>
                  <Link to="/admin/exams/new/edit" className="btn btn-primary btn-lg">
                    Build your first exam
                    <ArrowRight size={18} />
                  </Link>
                  <Link to="/student" className="btn btn-secondary btn-lg">
                    <GraduationCap size={18} />
                    Enter exam hall
                  </Link>
                </>
              )}
            </div>
            <p className="hero-note">
              <ShieldCheck size={15} />
              {user
                ? isAdmin
                  ? `Signed in as ${user.name}. Only administrators can open the studio.`
                  : `Signed in as ${user.name}. Every mark is linked to your account.`
                : 'Email or phone sign-in. Accounts and exams stay in this browser.'}
            </p>
          </div>

          <div className="hero-stage" aria-hidden="true">
            <div className="paper-sheet paper-sheet--back" />
            <div className="paper-sheet paper-sheet--middle" />
            <div className="paper-sheet paper-sheet--main">
              <div className="fake-paper-head">
                <span>General science · Set A</span>
                <span>10 min</span>
              </div>
              <div className="fake-question">
                <span className="fake-q-num">04</span>
                <div>
                  <p>What is 15% of 200?</p>
                  <div className="fake-options">
                    <span>
                      <i>A</i> 15
                    </span>
                    <span>
                      <i>B</i> 20
                    </span>
                    <span className="is-selected">
                      <i>C</i> 30
                      <Check size={12} />
                    </span>
                    <span>
                      <i>D</i> 45
                    </span>
                  </div>
                </div>
              </div>
              <div className="fake-question fake-question--faded">
                <span className="fake-q-num">05</span>
                <div>
                  <p>Who wrote Pride and Prejudice?</p>
                  <div className="fake-line" />
                  <div className="fake-line fake-line--short" />
                </div>
              </div>
              <div className="scan-beam" />
              <div className="scan-chip">
                <ScanText size={15} />
                Reading paper…
              </div>
            </div>
            <div className="floating-card floating-card--score">
              <span>Auto-marked</span>
              <strong>06/06</strong>
              <em>Perfect paper</em>
              <div className="tiny-score-ring">
                <Check size={16} />
              </div>
            </div>
            <div className="floating-card floating-card--count">
              <span>Questions found</span>
              <strong>06</strong>
              <em>3 answer keys missing</em>
            </div>
            <div className="floating-note">
              <span>Neat handwriting?</span>
              We will try our best.
            </div>
          </div>
        </section>

        <section className="workflow">
          <div className="section-intro">
            <p className="eyebrow">
              <span className="eyebrow-rule" />
              The paper trail
            </p>
            <h2>One calm workflow, from stack to score sheet.</h2>
          </div>
          <div className="workflow-grid">
            {workflow.map((item) => {
              const Icon = item.icon;
              return (
                <article className="workflow-step" key={item.number}>
                  <span className="workflow-number">{item.number}</span>
                  <span className="workflow-icon">
                    <Icon size={20} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.copy}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="portals">
          <article className="portal-card portal-card--admin">
            <div className="portal-head">
              <span className="portal-label">
                <LayoutDashboard size={15} />
                For teachers &amp; examiners
              </span>
              <span className="portal-index">01</span>
            </div>
            <h2>
              Your question paper,
              <br />
              <em>ready to run.</em>
            </h2>
            <p>
              A builder made for teachers, not form designers. Scan, edit, set answers, and share
              one code.
            </p>
            <ul className="portal-list">
              <li>
                <Check size={15} /> PDF, photo and handwriting import
              </li>
              <li>
                <Check size={15} /> Editable questions with answer keys
              </li>
              <li>
                <Check size={15} /> On-device checks and optional AI review
              </li>
              <li>
                <Check size={15} /> Timed attempts and results export
              </li>
            </ul>
            <Link to="/admin" className="portal-cta">
              Open admin studio
              <ArrowUpRight size={18} />
            </Link>
          </article>

          <article className="portal-card portal-card--student">
            <div className="portal-head">
              <span className="portal-label">
                <GraduationCap size={15} />
                For students
              </span>
              <span className="portal-index">02</span>
            </div>
            <div className="student-card-demo" aria-hidden="true">
              <div className="demo-topline">
                <span>Question 02</span>
                <span className="demo-timer">09:42</span>
              </div>
              <p>Which part of the human body produces insulin?</p>
              <div className="demo-option">
                <span>A</span> Liver
              </div>
              <div className="demo-option is-chosen">
                <span>B</span> Pancreas
                <Check size={14} />
              </div>
              <div className="demo-option">
                <span>C</span> Kidneys
              </div>
            </div>
            <h2>
              Sit the quiz.
              <br />
              <em>See the score.</em>
            </h2>
            <p>
              Sign in with your student account, enter the code, and take a focused, timed exam in
              the browser. One account keeps every attempt and mark together.
            </p>
            <Link to="/student" className="portal-cta">
              Enter exam hall
              <ArrowRight size={18} />
            </Link>
          </article>
        </section>

        <section className="local-note">
          <ShieldCheck size={22} />
          <div>
            <h3>Local-first, with real role checks</h3>
            <p>
              Administrator / teacher and student accounts live in this browser, and every page
              enforces the right role. Papers, answers and marks stay on this device — nothing is
              uploaded to a server.
            </p>
          </div>
          <Link to="/admin/exams/new/edit" className="btn btn-secondary">
            Try the builder
            <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <footer className="landing-footer">
        <Brand compact />
        <p>SmartQuiz · smart exam studio</p>
        <span>Built for a simpler exam day.</span>
      </footer>
    </div>
  );
}
