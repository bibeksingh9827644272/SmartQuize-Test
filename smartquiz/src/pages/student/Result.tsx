import { Link, useLocation, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Target,
  Trophy,
} from 'lucide-react';
import { useAppStore } from '../../data/store';
import { useAuth } from '../../data/auth';
import { ScoreRing } from '../../components/ScoreRing';
import { AnswerReview } from '../../components/AnswerReview';
import { formatClock, formatDateTime, formatDurationWords } from '../../lib/format';
import type { Attempt } from '../../types';

export default function StudentResultPage() {
  const { attemptId = '' } = useParams();
  const location = useLocation();
  const { attempts, exams } = useAppStore();
  const { user } = useAuth();
  const stateAttempt = (location.state as { attempt?: Attempt } | null)?.attempt;
  const attempt =
    attempts.find((item) => item.id === attemptId) ??
    (stateAttempt?.id === attemptId ? stateAttempt : undefined);

  if (!attempt) {
    return (
      <div className="state-page state-page--in-shell">
        <span className="state-icon">
          <BookOpenCheck size={26} />
        </span>
        <p className="eyebrow">Result not found</p>
        <h1>This marked paper isn't here.</h1>
        <p>The result may have been removed from this browser's workspace.</p>
        <Link to="/student" className="btn btn-primary">
          <ArrowLeft size={17} />
          Back to exam hall
        </Link>
      </div>
    );
  }

  if (attempt.studentId !== user?.id) {
    return (
      <div className="state-page state-page--in-shell">
        <span className="state-icon">
          <LockKeyhole size={26} />
        </span>
        <p className="eyebrow">Not your paper</p>
        <h1>This result belongs to another account.</h1>
        <p>
          Each student's marked paper stays with the account that sat the exam. Sign in with the
          right student account to open this result.
        </p>
        <Link to="/student" className="btn btn-primary">
          <ArrowLeft size={17} />
          Back to my exam hall
        </Link>
      </div>
    );
  }

  const exam = exams.find((item) => item.id === attempt.examId);
  const firstName = attempt.studentName.trim().split(/\s+/)[0] || '';
  const canRetake = exam?.status === 'published';
  const headline = attempt.passed
    ? attempt.percent >= 90
      ? `A brilliant paper${firstName ? `, ${firstName}` : ''}.`
      : attempt.percent >= 70
        ? `A strong finish${firstName ? `, ${firstName}` : ''}.`
        : `A solid pass${firstName ? `, ${firstName}` : ''}.`
    : `Paper marked${firstName ? `, ${firstName}` : ''}.`;
  const lede = attempt.passed
    ? attempt.percent >= 90
      ? 'You scored at the top of the paper. Open the marked sheet to see every answer.'
      : attempt.percent >= 70
        ? 'You cleared the pass mark comfortably. Open the marked paper to see how every question was scored.'
        : 'You cleared the pass mark. Open the marked paper to see how every question was scored.'
    : 'The pass mark was not reached this time. The marked paper below shows the right answers and explanations.';
  const spareSeconds = Math.max(
    0,
    attempt.durationMinutes * 60 - attempt.timeSpentSec,
  );
  const reviewAnswers = () => {
    document.getElementById('result-review')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="page student-result-page">
      <Link to="/student" className="back-link">
        <ArrowLeft size={16} />
        Back to exam hall
      </Link>

      <section className={`result-hero${attempt.passed ? ' is-pass' : ' is-fail'}`}>
        <div className="result-hero-copy">
          <p className="eyebrow">
            Marked paper · {attempt.examTitle} · {attempt.examCode}
          </p>
          <span className={`result-outcome ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
            {attempt.passed ? <Trophy size={15} /> : <BookOpenCheck size={15} />}
            {attempt.passed ? 'Passed' : 'Marked below the pass mark'}
          </span>
          <h1>{headline}</h1>
          <p>{lede}</p>
          <div className="result-actions">
            <button type="button" className="btn btn-primary" onClick={reviewAnswers}>
              Review answers
              <ArrowRight size={16} />
            </button>
            <Link to="/student" className="btn btn-secondary">
              <GraduationCap size={17} />
              Exam hall
            </Link>
            {canRetake && (
              <Link to={`/student/exam/${attempt.examId}`} className="btn btn-quiet">
                <RotateCcw size={15} />
                Try again
              </Link>
            )}
          </div>
        </div>

        <div className="result-score-panel">
          <ScoreRing percent={attempt.percent} passed={attempt.passed} />
          <div className="result-score-points">
            <strong>
              {attempt.score} <span>/ {attempt.maxScore}</span>
            </strong>
            <em>points earned</em>
          </div>
          <div className="result-pass-line">
            <span>Pass mark</span>
            <strong>{attempt.passPercent}%</strong>
          </div>
        </div>
      </section>

      {attempt.autoSubmitted && (
        <div className="inline-notice inline-notice--amber">
          <Clock3 size={18} />
          <div>
            <strong>Time ran out.</strong>
            <p>Your saved answers were submitted automatically.</p>
          </div>
        </div>
      )}

      <section className="result-detail-grid" aria-label="Result summary">
        <article className="result-detail-card">
          <span className="result-detail-icon">
            <CheckCircle2 size={18} />
          </span>
          <p>Correct answers</p>
          <strong>
            {attempt.correctCount}
            <span> / {attempt.questions.length}</span>
          </strong>
        </article>
        <article className="result-detail-card">
          <span className="result-detail-icon">
            <Clock3 size={18} />
          </span>
          <p>Time taken</p>
          <strong>{formatDurationWords(attempt.timeSpentSec)}</strong>
          <span className="result-detail-meta">of {attempt.durationMinutes} min</span>
        </article>
        <article className="result-detail-card">
          <span className="result-detail-icon">
            <CalendarDays size={18} />
          </span>
          <p>Handed in</p>
          <strong className="result-detail-date">{formatDateTime(attempt.submittedAt)}</strong>
        </article>
        <article className="result-detail-card">
          <span className="result-detail-icon">
            <Target size={18} />
          </span>
          <p>Time to spare</p>
          <strong>{formatClock(attempt.autoSubmitted ? 0 : spareSeconds)}</strong>
          <span className="result-detail-meta">
            {attempt.autoSubmitted ? 'Time expired' : `of ${attempt.durationMinutes} min allowed`}
          </span>
        </article>
      </section>

      <section className="result-review-section" id="result-review">
        <div className="result-review-head">
          <div>
            <p className="eyebrow">Every question</p>
            <h2>Your marked paper</h2>
            <p>
              {attempt.correctCount} correct · {attempt.questions.length - attempt.correctCount}{' '}
              missed · {attempt.passPercent}% needed to pass
            </p>
          </div>
          <span className="result-code">Code {attempt.examCode}</span>
        </div>
        <AnswerReview attempt={attempt} />
      </section>

      <div className="student-local-note">
        <ShieldCheck size={19} />
        <p>
          <strong>Saved on this device.</strong> This result lives in this browser's workspace.
          It has not been sent to your examiner.
        </p>
      </div>
    </div>
  );
}
