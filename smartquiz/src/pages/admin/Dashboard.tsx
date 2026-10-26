import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Clock3,
  Copy,
  FilePlus2,
  FileStack,
  ListChecks,
  PencilLine,
  Plus,
  Radio,
  ScanText,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import { useAppStore } from '../../data/store';
import { useAuth } from '../../data/auth';
import { useToast } from '../../components/Toast';
import { ConfirmDialog } from '../../components/Modal';
import { formatClock, formatPercent, formatRelative, greetingFor, initials } from '../../lib/format';
import { examAvailability, formatScheduleMoment, scheduleSummary } from '../../lib/schedule';
import { copyToClipboard } from '../../lib/clipboard';
import type { Exam } from '../../types';

export default function AdminDashboard() {
  const { exams, attempts, addSampleExam, deleteExam } = useAppStore();
  const { accounts } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [examToDelete, setExamToDelete] = useState<Exam | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedExams = useMemo(
    () => [...exams].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [exams],
  );
  const publishedExams = exams.filter((exam) => exam.status === 'published');
  const openExams = publishedExams.filter((exam) => examAvailability(exam, now) === 'open');
  const scheduledExams = publishedExams.filter(
    (exam) => examAvailability(exam, now) === 'scheduled',
  );
  const closedExams = publishedExams.filter((exam) => examAvailability(exam, now) === 'closed');
  const recentAttempts = useMemo(
    () => [...attempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 5),
    [attempts],
  );
  const averageScore =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / attempts.length)
      : null;
  const studentAccounts = accounts.filter((account) => account.role === 'student');
  const studentsWithResults = studentAccounts.filter((student) =>
    attempts.some(
      (attempt) =>
        attempt.studentId === student.id ||
        (!attempt.studentId && attempt.studentEmail === student.email),
    ),
  ).length;

  const copyCode = async (code: string) => {
    const copied = await copyToClipboard(code);
    notify(copied ? `Exam code ${code} copied.` : `Exam code: ${code}`, copied ? 'success' : 'info');
  };

  const loadSample = () => {
    const sample = addSampleExam();
    notify('Sample exam loaded. It is published and ready to try.');
    navigate(`/admin/exams/${sample.id}/results`);
  };

  const handleDelete = () => {
    if (!examToDelete) return;
    deleteExam(examToDelete.id);
    notify(`"${examToDelete.title}" and its results were deleted.`, 'info');
    setExamToDelete(null);
  };

  return (
    <div className="page dashboard-page">
      <header className="page-head dashboard-head">
        <div>
          <p className="eyebrow">Admin studio · local workspace</p>
          <h1>{greetingFor()}, examiner.</h1>
          <p className="page-lede">
            Build a paper from a scan, open the exam hall, and keep every score in one place.
          </p>
        </div>
        <Link to="/admin/exams/new/edit" className="btn btn-primary">
          <Plus size={18} />
          New exam
        </Link>
      </header>

      {exams.length === 0 ? (
        <section className="empty-dashboard">
          <div className="empty-dashboard-copy">
            <span className="empty-spark">
              <Sparkles size={17} />
            </span>
            <p className="eyebrow">Your desk is clear</p>
            <h2>Turn your first paper into a live quiz.</h2>
            <p>
              Start with a PDF, a phone photo, or a handwritten page. SmartQuiz reads the questions,
              you check the details, and students can sit the exam in minutes.
            </p>
            <div className="empty-actions">
              <Link to="/admin/exams/new/edit" className="btn btn-primary">
                <FilePlus2 size={17} />
                Create an exam
              </Link>
              <button type="button" className="btn btn-secondary" onClick={loadSample}>
                <Sparkles size={17} />
                Load sample exam
              </button>
            </div>
            <div className="empty-features">
              <span>
                <ScanText size={15} /> Local OCR import
              </span>
              <span>
                <ListChecks size={15} /> Editable MCQs
              </span>
              <span>
                <BarChart3 size={15} /> Instant marking
              </span>
            </div>
          </div>

          <div className="empty-dashboard-art" aria-hidden="true">
            <div className="empty-paper empty-paper--back" />
            <div className="empty-paper empty-paper--front">
              <div className="empty-paper-head">
                <span>Section A</span>
                <span>MCQ</span>
              </div>
              <div className="empty-paper-q">1. Which planet is known as the Red Planet?</div>
              <div className="empty-paper-options">
                <span>A · Venus</span>
                <span className="is-marked">B · Mars</span>
                <span>C · Jupiter</span>
                <span>D · Mercury</span>
              </div>
              <div className="empty-ocr-chip">
                <ScanText size={14} />
                Questions captured
              </div>
            </div>
            <div className="empty-tag">05 questions found</div>
          </div>
        </section>
      ) : (
        <>
          <section className="stat-grid" aria-label="Workspace summary">
            <article className="stat-card">
              <span className="stat-icon stat-icon--forest">
                <FileStack size={19} />
              </span>
              <p>Total exams</p>
              <strong>{exams.length}</strong>
              <span className="stat-meta">
                {exams.length - publishedExams.length} draft
                {exams.length - publishedExams.length === 1 ? '' : 's'} ·{' '}
                {publishedExams.length} published
              </span>
            </article>
            <article className="stat-card">
              <span className="stat-icon stat-icon--amber">
                <Radio size={19} />
              </span>
              <p>Open exams</p>
              <strong>{openExams.length}</strong>
              <span className="stat-meta">
                {scheduledExams.length > 0 || closedExams.length > 0
                  ? `${scheduledExams.length} scheduled · ${closedExams.length} closed`
                  : 'Accepting attempts now'}
              </span>
            </article>
            <Link to="/admin/students" className="stat-card stat-card--link">
              <span className="stat-icon stat-icon--blue">
                <Users size={19} />
              </span>
              <p>Students enrolled</p>
              <strong>{studentAccounts.length}</strong>
              <span className="stat-meta">
                {studentsWithResults} with results · {attempts.length} submission
                {attempts.length === 1 ? '' : 's'}
              </span>
              <ArrowRight size={15} className="stat-link-arrow" />
            </Link>
            <article className="stat-card">
              <span className="stat-icon stat-icon--rose">
                <BarChart3 size={19} />
              </span>
              <p>Average score</p>
              <strong>{averageScore === null ? '—' : formatPercent(averageScore)}</strong>
              <span className="stat-meta">
                {recentAttempts[0]
                  ? `Latest ${formatRelative(recentAttempts[0].submittedAt)}`
                  : 'No attempts yet'}
              </span>
            </article>
          </section>

          <div className="dashboard-grid">
            <section className="panel exam-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">Exam desk</p>
                  <h2>Your question papers</h2>
                </div>
              </div>

              <div className="exam-list">
                {sortedExams.map((exam) => {
                  const examAttempts = attempts
                    .filter((attempt) => attempt.examId === exam.id)
                    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
                  const examAverage =
                    examAttempts.length > 0
                      ? Math.round(
                          examAttempts.reduce((sum, attempt) => sum + attempt.percent, 0) /
                            examAttempts.length,
                        )
                      : null;
                  const availability =
                    exam.status === 'published' ? examAvailability(exam, now) : 'draft';
                  const statusLabel =
                    availability === 'scheduled'
                      ? 'Scheduled'
                      : availability === 'closed'
                        ? 'Closed'
                        : availability === 'open'
                          ? 'Published'
                          : 'Draft';
                  const windowLabel =
                    availability === 'scheduled' && exam.opensAt
                      ? `Opens ${formatScheduleMoment(exam.opensAt)}`
                      : availability === 'closed' && exam.closesAt
                        ? `Closed ${formatScheduleMoment(exam.closesAt)}`
                        : exam.closesAt
                          ? `Closes ${formatScheduleMoment(exam.closesAt)}`
                          : null;

                  return (
                    <article className="exam-card" key={exam.id}>
                      <div className="exam-card-top">
                        <div className="exam-card-title">
                          <div className="exam-tag-row">
                            <span className="subject-tag">{exam.subject || 'Uncategorised'}</span>
                            <span className={`status-badge status-badge--${availability}`}>
                              <span />
                              {statusLabel}
                            </span>
                          </div>
                          <h3>
                            <Link to={`/admin/exams/${exam.id}/edit`}>{exam.title || 'Untitled exam'}</Link>
                          </h3>
                          <p>{exam.description || 'No description added yet.'}</p>
                        </div>
                        <button
                          type="button"
                          className="code-chip"
                          onClick={() => void copyCode(exam.code)}
                          title="Copy exam code"
                        >
                          <span>Join code</span>
                          <strong>{exam.code}</strong>
                          <Copy size={13} />
                        </button>
                      </div>

                      <div className="exam-meta-row">
                        <span>
                          <ListChecks size={15} />
                          {exam.questions.length} question{exam.questions.length === 1 ? '' : 's'}
                        </span>
                        <span>
                          <Clock3 size={15} />
                          {exam.durationMinutes} min
                        </span>
                        <span>
                          <Target size={15} />
                          Pass {exam.passPercent}%
                        </span>
                        <span>
                          <Users size={15} />
                          {examAttempts.length} attempt{examAttempts.length === 1 ? '' : 's'}
                        </span>
                        {windowLabel && (
                          <span title={scheduleSummary(exam)}>
                            <CalendarClock size={15} />
                            {windowLabel}
                          </span>
                        )}
                        {examAverage !== null && (
                          <span>
                            <BarChart3 size={15} />
                            Avg {examAverage}%
                          </span>
                        )}
                      </div>

                      <div className="exam-card-footer">
                        <span className="updated-label">Updated {formatRelative(exam.updatedAt)}</span>
                        <div className="exam-actions">
                          <button
                            type="button"
                            className="icon-btn icon-btn--quiet"
                            onClick={() => setExamToDelete(exam)}
                            aria-label={`Delete ${exam.title}`}
                          >
                            <Trash2 size={16} />
                          </button>
                          <Link
                            to={`/admin/exams/${exam.id}/edit`}
                            className="btn btn-quiet btn-sm"
                          >
                            <PencilLine size={15} />
                            Edit
                          </Link>
                          <Link
                            to={`/admin/exams/${exam.id}/results`}
                            className="btn btn-secondary btn-sm"
                          >
                            <BarChart3 size={15} />
                            Results
                            {examAttempts.length > 0 && (
                              <span className="button-count">{examAttempts.length}</span>
                            )}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="dashboard-aside">
              <section className="panel activity-panel">
                <div className="panel-head panel-head--compact">
                  <div>
                    <p className="eyebrow">Live from the hall</p>
                    <h2>Recent submissions</h2>
                  </div>
                  <Clock3 size={18} className="muted-icon" />
                </div>

                {recentAttempts.length === 0 ? (
                  <div className="activity-empty">
                    <span className="activity-empty-icon">
                      <FilePlus2 size={22} />
                    </span>
                    <h3>No papers handed in yet.</h3>
                    <p>Publish an exam and share its join code. Student submissions appear here live.</p>
                    <Link to="/admin/exams/new/edit" className="btn btn-secondary btn-sm">
                      <FilePlus2 size={15} />
                      Create an exam
                    </Link>
                  </div>
                ) : (
                  <div className="activity-list">
                    {recentAttempts.map((attempt) => (
                      <Link
                        to={`/admin/exams/${attempt.examId}/results`}
                        className="activity-row"
                        key={attempt.id}
                      >
                        <span className="avatar">{initials(attempt.studentName)}</span>
                        <span className="activity-copy">
                          <strong>{attempt.studentName}</strong>
                          <span>{attempt.examTitle}</span>
                          <em>
                            {formatRelative(attempt.submittedAt)} · {formatClock(attempt.timeSpentSec)}
                          </em>
                        </span>
                        <span className={`score-pill ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
                          {attempt.percent}%
                        </span>
                      </Link>
                    ))}
                    {attempts.length > recentAttempts.length && (
                      <p className="activity-more">
                        {attempts.length - recentAttempts.length} more submission
                        {attempts.length - recentAttempts.length === 1 ? '' : 's'} in exam results.
                      </p>
                    )}
                  </div>
                )}
              </section>

              <section className="panel quick-panel">
                <div className="quick-mark">
                  <ScanText size={19} />
                </div>
                <p className="eyebrow">A cleaner exam day</p>
                <h3>Scan once. Reuse forever.</h3>
                <p>
                  Keep every paper in your local question library. Duplicate the flow, not the
                  typing.
                </p>
                <Link to="/admin/exams/new/edit" className="text-link">
                  Start another exam
                  <ArrowRight size={15} />
                </Link>
              </section>
            </aside>
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(examToDelete)}
        title="Delete this exam?"
        description={
          examToDelete
            ? `"${examToDelete.title}" will be removed, along with ${exams.length > 0 ? attempts.filter((attempt) => attempt.examId === examToDelete.id).length : 0} saved result(s). This cannot be undone.`
            : ''
        }
        confirmLabel="Delete exam"
        onCancel={() => setExamToDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
