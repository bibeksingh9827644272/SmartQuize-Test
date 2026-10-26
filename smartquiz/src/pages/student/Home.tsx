import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  GraduationCap,
  KeyRound,
  ListChecks,
  LockKeyhole,
  Play,
  ShieldCheck,
  Target,
  Timer,
  Trophy,
} from 'lucide-react';

import { useAppStore } from '../../data/store';
import { useAuth } from '../../data/auth';
import {
  formatClock,
  formatDate,
  formatRelative,
} from '../../lib/format';
import { examAvailability, formatScheduleMoment } from '../../lib/schedule';
import type { Exam } from '../../types';

type StudentExamState = 'open' | 'scheduled' | 'closed';

function StudentExamCard({
  exam,
  state = 'open',
  resultId,
}: {
  exam: Exam;
  state?: StudentExamState;
  resultId?: string;
}) {
  const kicker =
    state === 'scheduled'
      ? 'Scheduled paper'
      : state === 'closed'
        ? 'Closed paper'
        : 'Question paper';

  return (
    <article className={`open-exam-card is-${state}`}>
      <div className="open-exam-top">
        <span className="subject-tag">{exam.subject || 'Uncategorised'}</span>
        <span className="open-exam-code">{exam.code}</span>
      </div>
      <div className="open-exam-body">
        <span className="open-exam-kicker">{kicker}</span>
        <h3>{exam.title}</h3>
        <p>{exam.description || 'Read the cover page carefully before you begin.'}</p>
      </div>
      <div className="open-exam-meta">
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
      </div>
      <div className="open-exam-foot">
        <span className={state === 'open' ? undefined : 'scheduled-open'}>
          {state === 'scheduled' && exam.opensAt ? (
            <>
              <CalendarClock size={14} />
              Opens {formatScheduleMoment(exam.opensAt)}
            </>
          ) : state === 'closed' && exam.closesAt ? (
            <>
              <LockKeyhole size={14} />
              Closed {formatScheduleMoment(exam.closesAt)}
            </>
          ) : (
            <>Updated {formatRelative(exam.updatedAt)}</>
          )}
        </span>
        {state === 'open' ? (
          <Link to={`/student/exam/${exam.id}`} className="btn btn-primary">
            Start exam
            <ArrowRight size={16} />
          </Link>
        ) : state === 'closed' && resultId ? (
          <Link to={`/student/result/${resultId}`} className="btn btn-secondary">
            View result
            <ArrowRight size={16} />
          </Link>
        ) : (
          <span className="btn btn-secondary scheduled-lock" aria-disabled="true">
            <LockKeyhole size={15} />
            {state === 'closed' ? 'Window closed' : 'Not open yet'}
          </span>
        )}
      </div>
    </article>
  );
}

export default function StudentHome() {
  const { exams, attempts, activeAttempts } = useAppStore();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [now, setNow] = useState(Date.now());
  const userId = user?.id;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const publishedExams = useMemo(
    () => exams.filter((exam) => exam.status === 'published'),
    [exams],
  );

  const openExams = useMemo(
    () =>
      publishedExams
        .filter((exam) => examAvailability(exam, now) === 'open')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [publishedExams, now],
  );

  const scheduledExams = useMemo(
    () =>
      publishedExams
        .filter((exam) => examAvailability(exam, now) === 'scheduled')
        .sort((a, b) => (a.opensAt ?? '').localeCompare(b.opensAt ?? '')),
    [publishedExams, now],
  );

  const closedExams = useMemo(
    () =>
      publishedExams
        .filter((exam) => examAvailability(exam, now) === 'closed')
        .sort((a, b) => (b.closesAt ?? '').localeCompare(a.closesAt ?? '')),
    [publishedExams, now],
  );

  const myAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.studentId === userId),
    [attempts, userId],
  );

  const latestResultByExam = useMemo(() => {
    const map = new Map<string, string>();
    [...myAttempts]
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
      .forEach((attempt) => {
        if (!map.has(attempt.examId)) map.set(attempt.examId, attempt.id);
      });
    return map;
  }, [myAttempts]);

  const myActiveAttempts = useMemo(
    () => activeAttempts.filter((attempt) => attempt.studentId === userId),
    [activeAttempts, userId],
  );

  const recentResults = useMemo(
    () => [...myAttempts].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 3),
    [myAttempts],
  );

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) {
      setJoinError('Enter the full six-character exam code.');
      return;
    }
    const exam = exams.find((item) => item.code.toUpperCase() === code);
    if (!exam) {
      setJoinError(
        'No exam matches that code in this browser. Exams are local, so ask your examiner to publish it in this same browser.',
      );
      return;
    }
    if (exam.status !== 'published') {
      setJoinError('That exam is still a draft. Ask your examiner to publish it first.');
      return;
    }
    const availability = examAvailability(exam);
    if (availability === 'scheduled') {
      setJoinError(
        exam.opensAt
          ? `That exam has not opened yet. It opens ${formatScheduleMoment(exam.opensAt)}.`
          : 'That exam has not opened yet.',
      );
      return;
    }
    if (availability === 'closed') {
      setJoinError(
        exam.closesAt
          ? `That exam window closed ${formatScheduleMoment(exam.closesAt)}.`
          : 'That exam window has closed.',
      );
      return;
    }
    setJoinError('');
    navigate(`/student/exam/${exam.id}`);
  };

  return (
    <div className="page student-home">
      <section className="student-hero">
        <div className="student-hero-copy">
          <p className="eyebrow">
            <span className="eyebrow-rule" />
            Student exam hall
          </p>
          <h1>
            Take your seat.
            <br />
            <em>Bring your focus.</em>
          </h1>
          <p className="student-hero-lede">
            Join with the code from your examiner, answer at your own pace, and see your marked
            paper the moment you hand it in.
          </p>
          <div className="student-hero-points">
            <span>
              <Timer size={16} /> Timed attempts
            </span>
            <span>
              <CheckCircle2 size={16} /> Instant marking
            </span>
            <span>
              <ShieldCheck size={16} /> Linked to your account
            </span>
          </div>
        </div>

        <div className="join-wrap">
          <div className="join-card">
            <div className="join-perforation" aria-hidden="true">
              <span />
              <span />
            </div>
            <div className="join-card-head">
              <span className="join-icon">
                <KeyRound size={21} />
              </span>
              <div>
                <p className="eyebrow">Admit one</p>
                <h2>Join an exam</h2>
              </div>
            </div>

            <form onSubmit={handleJoin} noValidate>
              <label className="field" htmlFor="join-code">
                <span className="field-label">Your six-character code</span>
                <input
                  id="join-code"
                  className={`join-code-input${joinError ? ' has-error' : ''}`}
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={6}
                  placeholder="ABC123"
                  value={joinCode}
                  aria-describedby={joinError ? 'join-error' : 'join-hint'}
                  aria-invalid={Boolean(joinError)}
                  onChange={(event) => {
                    setJoinCode(
                      event.target.value
                        .toUpperCase()
                        .replace(/[^A-Z0-9]/g, '')
                        .slice(0, 6),
                    );
                    setJoinError('');
                  }}
                />
              </label>
              {joinError ? (
                <p className="join-error" id="join-error" role="alert">
                  {joinError}
                </p>
              ) : (
                <p className="join-hint" id="join-hint">
                  Ask your examiner for the code. It is shown on their exam results page.
                </p>
              )}
              <button type="submit" className="btn btn-primary btn-block btn-lg">
                Enter the exam
                <ArrowRight size={18} />
              </button>
            </form>

            <div className="join-foot">
              <span className="local-dot" />
              Browser-local · the examiner must publish on this browser for the paper to appear.
            </div>
          </div>
        </div>
      </section>

      {myActiveAttempts.length > 0 && (
        <section className="resume-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">In progress</p>
              <h2>Pick up where you stopped.</h2>
            </div>
            <span className="section-note">Your answers are saved in this browser.</span>
          </div>
          <div className="resume-list">
            {myActiveAttempts.map((active) => {
              const secondsLeft = Math.max(
                0,
                Math.ceil((new Date(active.deadlineAt).getTime() - now) / 1000),
              );
              const answered = Object.keys(active.answers).length;
              return (
                <article className="resume-card" key={active.id}>
                  <span className={`resume-pulse${secondsLeft === 0 ? ' is-ended' : ''}`} />
                  <div className="resume-copy">
                    <span className="resume-label">
                      {secondsLeft === 0 ? 'Time ended · ready to submit' : 'Resumable attempt'}
                    </span>
                    <h3>{active.examTitle}</h3>
                    <p>
                      {active.studentName} · {answered} of {active.questions.length} answered
                    </p>
                  </div>
                  <div className="resume-timer">
                    <span>Time left</span>
                    <strong>{formatClock(secondsLeft)}</strong>
                  </div>
                  <Link to={`/student/exam/${active.examId}`} className="btn btn-secondary">
                    <Play size={16} />
                    Continue
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className="open-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Open now</p>
            <h2>Exams ready for you</h2>
          </div>
          <span className="section-note">
            {openExams.length} exam{openExams.length === 1 ? '' : 's'} accepting attempts
          </span>
        </div>

        {openExams.length === 0 ? (
          <div className="student-empty">
            <span className="student-empty-icon">
              <GraduationCap size={27} />
            </span>
            <h3>The hall is quiet.</h3>
            <p>
              No exams are open right now.{' '}
              {scheduledExams.length > 0
                ? 'A scheduled paper is waiting below and will unlock at its opening time.'
                : closedExams.length > 0
                  ? 'Past papers are listed below with their results.'
                  : 'Your examiner can publish one from the admin studio — it will appear here immediately.'}
            </p>
          </div>
        ) : (
          <>
            <div className="exam-access-note">
              <ShieldCheck size={16} />
              <span>
                <strong>Account checked.</strong> Only signed-in student accounts can start these
                papers. Attempts and marks are saved to {user?.name ?? 'your account'}.
              </span>
            </div>
            <div className="open-exam-grid">
              {openExams.map((exam) => (
                <StudentExamCard exam={exam} key={exam.id} />
              ))}
            </div>
          </>
        )}
      </section>

      {scheduledExams.length > 0 && (
        <section className="open-section scheduled-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Coming up</p>
              <h2>Scheduled exams</h2>
            </div>
            <span className="section-note">
              {scheduledExams.length} paper{scheduledExams.length === 1 ? '' : 's'} waiting to open
            </span>
          </div>
          <div className="exam-access-note exam-access-note--schedule">
            <CalendarClock size={16} />
            <span>
              <strong>Scheduled papers stay visible.</strong> Start unlocks automatically when the
              exam window opens — no refresh needed.
            </span>
          </div>
          <div className="open-exam-grid">
            {scheduledExams.map((exam) => (
              <StudentExamCard exam={exam} state="scheduled" key={exam.id} />
            ))}
          </div>
        </section>
      )}

      {closedExams.length > 0 && (
        <section className="open-section closed-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Past window</p>
              <h2>Closed exams</h2>
            </div>
            <span className="section-note">
              {closedExams.length} paper{closedExams.length === 1 ? '' : 's'} kept for reference
            </span>
          </div>
          <div className="exam-access-note exam-access-note--closed">
            <LockKeyhole size={16} />
            <span>
              <strong>Nothing disappears.</strong> Published papers stay here after their window
              closes. New attempts are blocked; saved results remain under Recent results.
            </span>
          </div>
          <div className="open-exam-grid">
            {closedExams.map((exam) => (
              <StudentExamCard
                exam={exam}
                state="closed"
                resultId={latestResultByExam.get(exam.id)}
                key={exam.id}
              />
            ))}
          </div>
        </section>
      )}

      {recentResults.length > 0 && (
        <section className="recent-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Your marks</p>
              <h2>Recent results</h2>
            </div>
            <span className="section-note">
              <Trophy size={14} /> Linked to your account
            </span>
          </div>
          <div className="recent-results">
            {recentResults.map((attempt) => (
              <Link
                to={`/student/result/${attempt.id}`}
                className="recent-result-card"
                key={attempt.id}
              >
                <span className={`result-dot${attempt.passed ? ' is-pass' : ' is-fail'}`}>
                  {attempt.passed ? <CheckCircle2 size={18} /> : <BookOpenCheck size={18} />}
                </span>
                <span className="recent-result-copy">
                  <strong>{attempt.examTitle}</strong>
                  <em>
                    {formatDate(attempt.submittedAt)} · {attempt.correctCount}/
                    {attempt.questions.length} correct
                  </em>
                </span>
                <span className={`score-pill ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
                  {attempt.percent}%
                </span>
                <ArrowRight size={15} className="recent-arrow" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="student-local-note">
        <ShieldCheck size={19} />
        <p>
          <strong>Your account, your marks:</strong> signed in as {user?.name ?? 'a student'}.
          Attempts and results stay linked to this account in this browser — nothing is sent to a
          server.
        </p>
      </div>
    </div>
  );
}
