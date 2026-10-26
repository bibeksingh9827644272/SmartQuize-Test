import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  GraduationCap,
  PencilLine,
  Search,
  Sparkles,
  Target,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../../data/store';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { AdminAIReview } from '../../components/AdminAIReview';
import { ScoreRing } from '../../components/ScoreRing';
import { AnswerReview } from '../../components/AnswerReview';
import { copyToClipboard } from '../../lib/clipboard';
import {
  attemptsToCsv,
  downloadTextFile,
  examStats,
  safeFilename,
} from '../../lib/quiz';
import {
  formatClock,
  formatDateTime,
  formatDurationWords,
  formatPercent,
  initials,
} from '../../lib/format';
import type { Attempt } from '../../types';

export default function ExamResults() {
  const { examId = '' } = useParams();
  const { exams, attempts, setExamStatus } = useAppStore();
  const { notify } = useToast();
  const exam = exams.find((item) => item.id === examId);
  const [search, setSearch] = useState('');
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const examAttempts = useMemo(
    () =>
      attempts
        .filter((attempt) => attempt.examId === examId)
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
    [attempts, examId],
  );

  const filteredAttempts = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return examAttempts;
    return examAttempts.filter(
      (attempt) =>
        attempt.studentName.toLowerCase().includes(needle) ||
        attempt.studentEmail.toLowerCase().includes(needle),
    );
  }, [examAttempts, search]);

  if (!exam) {
    return (
      <div className="page">
        <div className="state-page">
          <span className="state-icon">
            <Target size={26} />
          </span>
          <p className="eyebrow">Exam not found</p>
          <h1>This paper isn't on your desk.</h1>
          <p>It may have been deleted from this browser's local workspace.</p>
          <Link to="/admin" className="btn btn-primary">
            <ArrowLeft size={17} />
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  const stats = examStats(exam, attempts);

  const copyCode = async () => {
    const copied = await copyToClipboard(exam.code);
    notify(copied ? `Exam code ${exam.code} copied.` : `Exam code: ${exam.code}`, copied ? 'success' : 'info');
  };

  const exportCsv = () => {
    const csv = attemptsToCsv(examAttempts);
    downloadTextFile(`${safeFilename(exam.title)}-results.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8');
    notify('Results exported as CSV.');
  };

  const closeExam = () => {
    setExamStatus(exam.id, 'draft');
    notify('Exam closed. New students can no longer join.', 'info');
  };

  return (
    <div className="page results-page">
      <Link to="/admin" className="back-link">
        <ArrowLeft size={16} />
        Back to overview
      </Link>

      <header className="page-head results-head">
        <div>
          <div className="exam-tag-row">
            <span className="subject-tag">{exam.subject || 'Uncategorised'}</span>
            <span className={`status-badge status-badge--${exam.status}`}>
              <span />
              {exam.status === 'published' ? 'Published' : 'Draft'}
            </span>
          </div>
          <h1>{exam.title}</h1>
          <p className="page-lede">
            {exam.questions.length} questions · {exam.durationMinutes} minutes · Pass mark{' '}
            {exam.passPercent}%
          </p>
        </div>
        <div className="results-head-actions">
          <Link to={`/admin/exams/${exam.id}/edit`} className="btn btn-secondary">
            <PencilLine size={16} />
            Edit exam
          </Link>
          <button type="button" className="btn btn-primary" onClick={() => void copyCode()}>
            <Copy size={16} />
            {exam.code}
          </button>
        </div>
      </header>

      {exam.status === 'draft' && (
        <div className="inline-notice inline-notice--amber">
          <Clock3 size={18} />
          <div>
            <strong>This exam is not open.</strong>
            <p>
              Publish it from the builder when the questions and answer keys are ready. Existing
              results are still available here.
            </p>
          </div>
          <Link to={`/admin/exams/${exam.id}/edit`} className="btn btn-secondary btn-sm">
            Open builder
          </Link>
        </div>
      )}

      <section className="result-stat-grid" aria-label="Exam results summary">
        <article className="result-stat">
          <span className="result-stat-icon">
            <Users size={18} />
          </span>
          <p>Attempts</p>
          <strong>{stats.attempts}</strong>
        </article>
        <article className="result-stat">
          <span className="result-stat-icon result-stat-icon--green">
            <CheckCircle2 size={18} />
          </span>
          <p>Pass rate</p>
          <strong>{stats.attempts ? formatPercent(stats.passRate) : '—'}</strong>
        </article>
        <article className="result-stat">
          <span className="result-stat-icon result-stat-icon--amber">
            <BarChart3 size={18} />
          </span>
          <p>Average score</p>
          <strong>{stats.attempts ? formatPercent(stats.averagePercent) : '—'}</strong>
        </article>
        <article className="result-stat">
          <span className="result-stat-icon result-stat-icon--rose">
            <Trophy size={18} />
          </span>
          <p>Highest score</p>
          <strong>{stats.attempts ? formatPercent(stats.highestPercent) : '—'}</strong>
        </article>
      </section>

      <section className="panel results-panel">
        <div className="results-toolbar">
          <div>
            <p className="eyebrow">Score sheet</p>
            <h2>
              Submissions <span className="heading-count">{examAttempts.length}</span>
            </h2>
          </div>
          <div className="results-toolbar-actions">
            {examAttempts.length > 0 && (
              <label className="search-field">
                <Search size={16} />
                <span className="sr-only">Search submissions</span>
                <input
                  type="search"
                  placeholder="Search student"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            )}
            <button
              type="button"
              className="btn btn-ai btn-sm"
              onClick={() => setAiOpen(true)}
              disabled={examAttempts.length === 0}
              title={
                examAttempts.length === 0
                  ? 'Collect at least one submission to review responses.'
                  : 'Check question and response patterns with AI.'
              }
            >
              <Sparkles size={15} />
              AI response review
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={exportCsv}
              disabled={examAttempts.length === 0}
            >
              <Download size={15} />
              Export CSV
            </button>
            {exam.status === 'published' ? (
              <button type="button" className="btn btn-quiet btn-sm" onClick={closeExam}>
                <XCircle size={15} />
                Close exam
              </button>
            ) : (
              <span className="mini-hint">Publish from the builder to reopen</span>
            )}
          </div>
        </div>

        {examAttempts.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">
              <GraduationCap size={24} />
            </span>
            <h3>No submissions yet.</h3>
            <p>
              {exam.status === 'published'
                ? 'Share the join code with your students. Their attempts will appear here as they submit.'
                : 'Publish the exam and send students the join code to collect attempts.'}
            </p>
            {exam.status === 'published' && (
              <button type="button" className="btn btn-secondary" onClick={() => void copyCode()}>
                <Copy size={16} />
                Copy join code
              </button>
            )}
          </div>
        ) : filteredAttempts.length === 0 ? (
          <div className="table-empty">
            <span className="table-empty-icon">
              <Search size={23} />
            </span>
            <h3>No matching students.</h3>
            <p>Try a different name or email address.</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
              Clear search
            </button>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="results-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Submitted</th>
                  <th>Time</th>
                  <th>Score</th>
                  <th>Result</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((attempt) => (
                  <tr key={attempt.id}>
                    <td>
                      <div className="student-cell">
                        <span className="avatar">{initials(attempt.studentName)}</span>
                        <span>
                          <strong>{attempt.studentName}</strong>
                          <em>{attempt.studentEmail || 'No email provided'}</em>
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="table-main">{formatDateTime(attempt.submittedAt)}</span>
                      {attempt.autoSubmitted && <span className="table-note">Auto-submitted</span>}
                    </td>
                    <td>
                      <span className="table-main">{formatDurationWords(attempt.timeSpentSec)}</span>
                      <span className="table-note">of {attempt.durationMinutes} min</span>
                    </td>
                    <td>
                      <span className="table-main">
                        {attempt.score} / {attempt.maxScore}
                      </span>
                      <span className="table-note">{attempt.percent}% score</span>
                    </td>
                    <td>
                      <span className={`result-badge ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
                        {attempt.passed ? 'Pass' : 'Fail'}
                      </span>
                    </td>
                    <td className="table-action-cell">
                      <button
                        type="button"
                        className="btn btn-quiet btn-sm"
                        onClick={() => setSelectedAttempt(attempt)}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminAIReview
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        mode="responses"
        content={exam}
        attempts={examAttempts}
      />

      <Modal
        open={Boolean(selectedAttempt)}
        onClose={() => setSelectedAttempt(null)}
        title={selectedAttempt ? `${selectedAttempt.studentName}'s paper` : 'Submission'}
        eyebrow="Submission review"
        size="lg"
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelectedAttempt(null)}
          >
            Close review
          </button>
        }
      >
        {selectedAttempt && (
          <div className="attempt-review">
            <div className="attempt-summary">
              <ScoreRing
                percent={selectedAttempt.percent}
                passed={selectedAttempt.passed}
                size="md"
              />
              <div className="attempt-summary-copy">
                <span
                  className={`result-badge ${selectedAttempt.passed ? 'is-pass' : 'is-fail'}`}
                >
                  {selectedAttempt.passed ? 'Passed' : 'Below pass mark'}
                </span>
                <h3>
                  {selectedAttempt.score} of {selectedAttempt.maxScore} points
                </h3>
                <p>
                  {selectedAttempt.correctCount} of {selectedAttempt.questions.length} correct · Pass
                  mark {selectedAttempt.passPercent}%
                </p>
                <div className="attempt-meta">
                  <span>
                    <Clock3 size={14} />
                    {formatClock(selectedAttempt.timeSpentSec)} taken
                  </span>
                  <span>{formatDateTime(selectedAttempt.submittedAt)}</span>
                  {selectedAttempt.studentEmail && <span>{selectedAttempt.studentEmail}</span>}
                  {selectedAttempt.autoSubmitted && <span>Time expired</span>}
                </div>
              </div>
            </div>
            <div className="modal-section-title">
              <h3>Answer review</h3>
              <span>{selectedAttempt.questions.length} questions</span>
            </div>
            <AnswerReview attempt={selectedAttempt} />
          </div>
        )}
      </Modal>
    </div>
  );
}
