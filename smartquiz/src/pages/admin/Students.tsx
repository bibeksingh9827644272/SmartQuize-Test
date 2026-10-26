import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Download,
  GraduationCap,
  IdCard,
  Mail,
  Phone,
  Search,
  UserRound,
  Users,
} from 'lucide-react';
import { useAuth } from '../../data/auth';
import { useAppStore } from '../../data/store';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { UserAvatar } from '../../components/UserAvatar';
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatRelative,
} from '../../lib/format';
import type { Attempt } from '../../types';
import type { AuthUser } from '../../lib/auth';

type DirectoryFilter = 'all' | 'with-results' | 'new';

interface StudentEntry {
  student: AuthUser;
  attempts: Attempt[];
  average: number | null;
  passed: number;
  latest: Attempt | null;
}

function attemptsForStudent(student: AuthUser, attempts: Attempt[]): Attempt[] {
  return attempts
    .filter(
      (attempt) =>
        attempt.studentId === student.id ||
        (!attempt.studentId && attempt.studentEmail === student.email),
    )
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

function csvCell(value: string | number): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function AdminStudents() {
  const { accounts } = useAuth();
  const { attempts, exams } = useAppStore();
  const { notify } = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<DirectoryFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = useMemo<StudentEntry[]>(
    () =>
      accounts
        .filter((account) => account.role === 'student')
        .map((student) => {
          const studentAttempts = attemptsForStudent(student, attempts);
          const average =
            studentAttempts.length > 0
              ? Math.round(
                  studentAttempts.reduce((sum, attempt) => sum + attempt.percent, 0) /
                    studentAttempts.length,
                )
              : null;
          return {
            student,
            attempts: studentAttempts,
            average,
            passed: studentAttempts.filter((attempt) => attempt.passed).length,
            latest: studentAttempts[0] ?? null,
          };
        })
        .sort((a, b) => b.student.createdAt.localeCompare(a.student.createdAt)),
    [accounts, attempts],
  );

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter === 'with-results' && entry.attempts.length === 0) return false;
      if (filter === 'new' && entry.attempts.length > 0) return false;
      if (!query) return true;
      return [
        entry.student.name,
        entry.student.rollNumber,
        entry.student.email,
        entry.student.phone,
        entry.student.country,
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [entries, filter, search]);

  const withResults = entries.filter((entry) => entry.attempts.length > 0).length;
  const totalSubmissions = entries.reduce((sum, entry) => sum + entry.attempts.length, 0);
  const overallAverage =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / attempts.length)
      : null;
  const selected = selectedId
    ? entries.find((entry) => entry.student.id === selectedId) ?? null
    : null;

  const exportCsv = () => {
    if (entries.length === 0) return;
    const header = [
      'Name',
      'Roll number',
      'Email',
      'Phone',
      'Country',
      'Joined',
      'Last sign-in',
      'Results',
      'Passed',
      'Average %',
    ];
    const rows = entries.map((entry) => [
      entry.student.name,
      entry.student.rollNumber,
      entry.student.email,
      entry.student.phone,
      entry.student.country,
      entry.student.createdAt,
      entry.student.lastLoginAt ?? '',
      entry.attempts.length,
      entry.passed,
      entry.average ?? '',
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `smartquiz-students-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify(`${entries.length} student record${entries.length === 1 ? '' : 's'} exported.`);
  };

  return (
    <div className="page directory-page">
      <header className="page-head directory-head">
        <div>
          <p className="eyebrow">Admin view · enrolled users</p>
          <h1>Students on SmartQuiz</h1>
          <p className="page-lede">
            Every student account created in this browser, with their roll number, contact details
            and exam history. Open a row to check the full profile.
          </p>
        </div>
        <div className="directory-head-actions">
          <Link to="/admin/profile" className="btn btn-secondary">
            <UserRound size={16} />
            My profile
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            onClick={exportCsv}
            disabled={entries.length === 0}
          >
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </header>

      <section className="directory-summary" aria-label="Enrolment summary">
        <article>
          <span className="stat-icon stat-icon--forest">
            <Users size={18} />
          </span>
          <div>
            <strong>{entries.length}</strong>
            <span>Students enrolled</span>
          </div>
        </article>
        <article>
          <span className="stat-icon stat-icon--amber">
            <BadgeCheck size={18} />
          </span>
          <div>
            <strong>{withResults}</strong>
            <span>With exam results</span>
          </div>
        </article>
        <article>
          <span className="stat-icon stat-icon--blue">
            <BookOpenCheck size={18} />
          </span>
          <div>
            <strong>{totalSubmissions}</strong>
            <span>Papers submitted</span>
          </div>
        </article>
        <article>
          <span className="stat-icon stat-icon--rose">
            <GraduationCap size={18} />
          </span>
          <div>
            <strong>{overallAverage === null ? '—' : formatPercent(overallAverage)}</strong>
            <span>Workspace average</span>
          </div>
        </article>
      </section>

      <section className="panel directory-panel">
        <div className="directory-toolbar">
          <div>
            <p className="eyebrow">Enrolment register</p>
            <h2>
              Student directory <span className="heading-count">{entries.length}</span>
            </h2>
          </div>
          <div className="directory-controls">
            <label className="search-field">
              <Search size={16} />
              <span className="sr-only">Search students</span>
              <input
                type="search"
                placeholder="Name, roll, email or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="directory-filters" role="group" aria-label="Filter students">
              <button
                type="button"
                className={filter === 'all' ? 'is-active' : ''}
                onClick={() => setFilter('all')}
              >
                Everyone
              </button>
              <button
                type="button"
                className={filter === 'with-results' ? 'is-active' : ''}
                onClick={() => setFilter('with-results')}
              >
                With results
              </button>
              <button
                type="button"
                className={filter === 'new' ? 'is-active' : ''}
                onClick={() => setFilter('new')}
              >
                No attempts
              </button>
            </div>
          </div>
        </div>

        {entries.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">
              <Users size={25} />
            </span>
            <h3>No students have enrolled yet.</h3>
            <p>
              Students create their own account from the sign-in page on this same browser. Open
              SmartQuiz in this browser and choose <strong>Student</strong> to register the first
              one.
            </p>
          </div>
        ) : visibleEntries.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">
              <Search size={24} />
            </span>
            <h3>No matching students.</h3>
            <p>Try another name, roll number, email or phone number.</p>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearch('');
                setFilter('all');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="directory-table">
            <div className="directory-table-head" aria-hidden="true">
              <span>Student</span>
              <span>Contact</span>
              <span>Enrolled</span>
              <span>Results</span>
              <span />
            </div>
            {visibleEntries.map((entry) => (
              <article className="directory-row" key={entry.student.id}>
                <div className="directory-student">
                  <UserAvatar
                    name={entry.student.name}
                    avatar={entry.student.avatar}
                    className="directory-avatar"
                  />
                  <span className="directory-student-copy">
                    <strong>{entry.student.name}</strong>
                    <em>{entry.student.rollNumber}</em>
                  </span>
                </div>
                <div className="directory-contact">
                  <span>
                    <Mail size={12} />
                    {entry.student.email}
                  </span>
                  <em>
                    <Phone size={11} />
                    {entry.student.phone}
                  </em>
                </div>
                <div className="directory-date">
                  <span>{formatDate(entry.student.createdAt)}</span>
                  <em>
                    {entry.student.lastLoginAt
                      ? `Seen ${formatRelative(entry.student.lastLoginAt)}`
                      : 'Never signed in'}
                  </em>
                </div>
                <div className="directory-results">
                  <strong>
                    {entry.attempts.length === 0
                      ? 'No results'
                      : `${entry.attempts.length} result${entry.attempts.length === 1 ? '' : 's'}`}
                  </strong>
                  <em>
                    {entry.average === null
                      ? 'Not attempted'
                      : `${entry.average}% avg · ${entry.passed} passed`}
                  </em>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm directory-open"
                  onClick={() => setSelectedId(entry.student.id)}
                >
                  View profile
                  <ArrowRight size={14} />
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="directory-note">
        <IdCard size={16} />
        Roll numbers are issued automatically at registration and never change. This directory is
        local to the current browser; a real multi-device deployment needs a shared server.
      </p>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title={selected ? selected.student.name : 'Student profile'}
        eyebrow="Enrolled student"
        size="lg"
        footer={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setSelectedId(null)}
          >
            Close profile
          </button>
        }
      >
        {selected && (
          <div className="student-detail">
            <div className="student-detail-head">
              <UserAvatar
                name={selected.student.name}
                avatar={selected.student.avatar}
                className="student-detail-avatar"
              />
              <div>
                <span className="student-detail-role">Student · {selected.student.country}</span>
                <h3>{selected.student.name}</h3>
                <p>
                  <IdCard size={13} />
                  {selected.student.rollNumber}
                </p>
              </div>
            </div>

            <div className="student-detail-facts">
              <div>
                <span>
                  <Mail size={13} /> Email
                </span>
                <strong>{selected.student.email}</strong>
              </div>
              <div>
                <span>
                  <Phone size={13} /> Phone
                </span>
                <strong>{selected.student.phone}</strong>
              </div>
              <div>
                <span>Enrolled</span>
                <strong>{formatDate(selected.student.createdAt)}</strong>
              </div>
              <div>
                <span>Last sign-in</span>
                <strong>
                  {selected.student.lastLoginAt
                    ? formatDateTime(selected.student.lastLoginAt)
                    : 'Never signed in'}
                </strong>
              </div>
            </div>

            <div className="student-detail-stats">
              <span>
                <strong>{selected.attempts.length}</strong>
                Papers submitted
              </span>
              <span>
                <strong>{selected.average === null ? '—' : `${selected.average}%`}</strong>
                Average score
              </span>
              <span>
                <strong>{selected.passed}</strong>
                Papers passed
              </span>
            </div>

            <div className="modal-section-title">
              <h3>Exam history</h3>
              <span>
                {selected.attempts.length} submission
                {selected.attempts.length === 1 ? '' : 's'}
              </span>
            </div>

            {selected.attempts.length === 0 ? (
              <div className="student-history-empty">
                <BookOpenCheck size={22} />
                <p>This student has not submitted an exam in this browser yet.</p>
              </div>
            ) : (
              <div className="student-history">
                {selected.attempts.map((attempt) => {
                  const examExists = exams.some((exam) => exam.id === attempt.examId);
                  return (
                    <article className="student-history-row" key={attempt.id}>
                      <span
                        className={`result-dot${attempt.passed ? ' is-pass' : ' is-fail'}`}
                      >
                        {attempt.passed ? (
                          <BadgeCheck size={17} />
                        ) : (
                          <BookOpenCheck size={17} />
                        )}
                      </span>
                      <div className="student-history-copy">
                        <strong>{attempt.examTitle}</strong>
                        <em>
                          {attempt.examCode} · {formatDateTime(attempt.submittedAt)} ·{' '}
                          {attempt.correctCount}/{attempt.questions.length} correct
                        </em>
                      </div>
                      <span
                        className={`score-pill ${attempt.passed ? 'is-pass' : 'is-fail'}`}
                      >
                        {attempt.percent}%
                      </span>
                      {examExists ? (
                        <Link
                          to={`/admin/exams/${attempt.examId}/results`}
                          className="btn btn-quiet btn-sm"
                          onClick={() => setSelectedId(null)}
                        >
                          Results
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <span className="student-history-missing">Exam deleted</span>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
