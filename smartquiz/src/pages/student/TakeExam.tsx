import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  ListChecks,
  LogOut,
  Send,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { Brand } from '../../components/Brand';
import { ConfirmDialog, Modal } from '../../components/Modal';
import { DeveloperCredit } from '../../components/DeveloperCredit';
import { useToast } from '../../components/Toast';
import { useAppStore } from '../../data/store';
import { useAuth } from '../../data/auth';
import {
  formatClock,
  formatDateTime,
  formatDurationWords,
} from '../../lib/format';
import { uid } from '../../lib/ids';
import { OPTION_LETTERS, scoreAttempt, stripQuestionForSnapshot, totalPoints } from '../../lib/quiz';
import { examAvailability, formatScheduleMoment } from '../../lib/schedule';
import type { ActiveAttempt, Answers, Question } from '../../types';

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SQ';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

interface AnswerSheetContentProps {
  questions: Question[];
  answers: Answers;
  remaining: number;
  onJump: (questionId: string) => void;
  onRequestSubmit: () => void;
}

function AnswerSheetContent({
  questions,
  answers,
  remaining,
  onJump,
  onRequestSubmit,
}: AnswerSheetContentProps) {
  const answeredCount = questions.filter((question) => Boolean(answers[question.id])).length;
  const unansweredCount = questions.length - answeredCount;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const urgent = remaining <= 300;

  return (
    <div className="answer-sheet-content">
      <div className="sheet-timer">
        <span>
          <Clock3 size={16} />
          Time left
        </span>
        <strong className={urgent ? 'is-urgent' : ''}>{formatClock(remaining)}</strong>
      </div>

      <div className="sheet-progress-label">
        <span>{answeredCount} answered</span>
        <span>
          {unansweredCount} unanswered
        </span>
      </div>
      <div className="sheet-progress-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="answer-grid" aria-label="Question navigator">
        {questions.map((question, index) => {
          const answered = Boolean(answers[question.id]);
          return (
            <button
              type="button"
              key={question.id}
              className={`answer-grid-button${answered ? ' is-answered' : ''}`}
              onClick={() => onJump(question.id)}
              aria-label={`Question ${index + 1}, ${answered ? 'answered' : 'not answered'}`}
            >
              {index + 1}
              {answered && <span className="answered-dot" />}
            </button>
          );
        })}
      </div>

      <div className="sheet-legend">
        <span>
          <i className="legend-dot is-answered" /> Answered
        </span>
        <span>
          <i className="legend-dot" /> Not yet
        </span>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={onRequestSubmit}>
        <Send size={16} />
        Hand in paper
      </button>
      <p className="sheet-save-note">
        <CheckCircle2 size={13} />
        Answers save automatically in this browser.
      </p>
    </div>
  );
}

export default function TakeExamPage() {
  const { examId = '' } = useParams();
  const navigate = useNavigate();
  const { exams, activeAttempts, saveActiveAttempt, saveAttempt, deleteActiveAttempt } =
    useAppStore();
  const { user } = useAuth();
  const { notify } = useToast();

  const exam = exams.find((item) => item.id === examId);
  const active = useMemo(
    () =>
      [...activeAttempts]
        .filter((attempt) => attempt.examId === examId && attempt.studentId === user?.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0],
    [activeAttempts, examId, user?.id],
  );

  const [session, setSession] = useState<ActiveAttempt | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [now, setNow] = useState(Date.now());
  const [submitOpen, setSubmitOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const submittedRef = useRef(false);

  const cover = session ?? active;
  const questions = session?.questions ?? cover?.questions ?? exam?.questions ?? [];
  const coverTitle = session?.examTitle ?? cover?.examTitle ?? exam?.title ?? 'Saved attempt';
  const coverCode = session?.examCode ?? cover?.examCode ?? exam?.code ?? '';
  const coverSubject = exam?.subject ?? 'Saved attempt';
  const coverDescription =
    exam?.description ||
    (cover
      ? 'This saved attempt can still be completed and handed in.'
      : 'A timed multiple-choice examination.');
  const coverInstructions =
    exam?.instructions ||
    'Attempt every question. Each question has one correct answer. You can review and change your answers before submitting.';
  const durationMinutes =
    session?.durationMinutes ?? cover?.durationMinutes ?? exam?.durationMinutes ?? 0;
  const passPercent = session?.passPercent ?? cover?.passPercent ?? exam?.passPercent ?? 0;
  const points = totalPoints(questions);

  const remaining = session
    ? Math.max(0, Math.ceil((new Date(session.deadlineAt).getTime() - now) / 1000))
    : active
      ? Math.max(0, Math.ceil((new Date(active.deadlineAt).getTime() - now) / 1000))
      : 0;

  const answeredCount = questions.filter((question) => Boolean(answers[question.id])).length;
  const unansweredCount = questions.length - answeredCount;

  useEffect(() => {
    if (!session && !active) {
      const timer = window.setInterval(() => setNow(Date.now()), 30_000);
      return () => window.clearInterval(timer);
    }
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [session?.id, active?.id]);

  useEffect(() => {
    if (!session) return;
    saveActiveAttempt({
      ...session,
      answers,
      lastSavedAt: new Date().toISOString(),
    });
  }, [answers, session, saveActiveAttempt]);

  const finalize = useCallback(
    (autoSubmitted: boolean) => {
      if (!session || submittedRef.current) return;
      submittedRef.current = true;
      const submittedAt = new Date().toISOString();
      const attempt = scoreAttempt({
        exam: {
          id: session.examId,
          title: session.examTitle,
          code: session.examCode,
          passPercent: session.passPercent,
          durationMinutes: session.durationMinutes,
        },
        questions: session.questions,
        answers,
        studentId: session.studentId,
        studentName: session.studentName,
        studentEmail: session.studentEmail,
        startedAt: session.startedAt,
        submittedAt,
        autoSubmitted,
      });
      saveAttempt(attempt);
      deleteActiveAttempt(session.id);
      navigate(`/student/result/${attempt.id}`, {
        replace: true,
        state: { attempt },
      });
    },
    [answers, deleteActiveAttempt, navigate, saveAttempt, session],
  );

  useEffect(() => {
    if (!session || submittedRef.current) return;
    if (remaining > 0) return;
    finalize(true);
  }, [finalize, remaining, session]);

  const startAttempt = (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      notify('Sign in with a student account to sit this exam.', 'error');
      navigate('/login?role=student');
      return;
    }
    if (!exam || exam.status !== 'published') {
      notify('This exam is not open.', 'error');
      return;
    }
    if (examAvailability(exam) !== 'open') {
      notify(
        examAvailability(exam) === 'scheduled'
          ? `This exam opens ${exam.opensAt ? formatScheduleMoment(exam.opensAt) : 'later'}.`
          : 'This exam window has closed.',
        'error',
      );
      return;
    }
    if (exam.questions.length === 0) {
      notify('This exam has no questions yet.', 'error');
      return;
    }

    const started = new Date();
    const durationDeadline = started.getTime() + exam.durationMinutes * 60_000;
    const windowDeadline = exam.closesAt ? new Date(exam.closesAt).getTime() : null;
    const deadline =
      windowDeadline !== null && Number.isFinite(windowDeadline)
        ? Math.min(durationDeadline, windowDeadline)
        : durationDeadline;
    const attempt: ActiveAttempt = {
      id: uid('active'),
      examId: exam.id,
      examTitle: exam.title,
      examCode: exam.code,
      studentId: user.id,
      studentName: user.name,
      studentEmail: user.email,
      startedAt: started.toISOString(),
      deadlineAt: new Date(deadline).toISOString(),
      lastSavedAt: started.toISOString(),
      durationMinutes: exam.durationMinutes,
      passPercent: exam.passPercent,
      questions: exam.questions.map(stripQuestionForSnapshot),
      answers: {},
    };
    submittedRef.current = false;
    setAnswers({});
    setNow(started.getTime());
    setSession(attempt);
    setSubmitOpen(false);
    setSheetOpen(false);
    saveActiveAttempt(attempt);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const resumeAttempt = () => {
    if (!active) return;
    submittedRef.current = false;
    setAnswers(active.answers ?? {});
    setNow(Date.now());
    setSession(active);
    setSubmitOpen(false);
    setSheetOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const discardAttempt = () => {
    if (!active) return;
    deleteActiveAttempt(active.id);
    setDiscardOpen(false);
    notify('Saved attempt discarded. You can start fresh.', 'info');
  };

  const selectAnswer = (questionId: string, optionId: string) => {
    setAnswers((previous) => ({ ...previous, [questionId]: optionId }));
  };

  const clearAnswer = (questionId: string) => {
    setAnswers((previous) => {
      const next = { ...previous };
      delete next[questionId];
      return next;
    });
  };

  const jumpToQuestion = (questionId: string) => {
    setSheetOpen(false);
    window.setTimeout(() => {
      document
        .getElementById(`exam-${questionId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 70);
  };

  const requestSubmit = () => {
    setSheetOpen(false);
    setSubmitOpen(true);
  };

  const availability = exam ? examAvailability(exam, now) : null;
  const unavailable =
    !cover &&
    (!exam || exam.status !== 'published' || availability === 'scheduled' || availability === 'closed');
  const urgent = remaining <= 300;

  if (unavailable) {
    const notYetOpen = exam?.status === 'published' && availability === 'scheduled';
    return (
      <div className="take-shell take-shell--intro">
        <header className="take-nav">
          <Brand to="/student" />
          <Link to="/student" className="btn btn-quiet btn-sm">
            <ArrowLeft size={16} />
            Exam hall
          </Link>
        </header>
        <main className="take-unavailable">
          <span className="state-icon">
            <FileText size={26} />
          </span>
          <p className="eyebrow">Exam unavailable</p>
          <h1>
            {notYetOpen
              ? 'This exam opens later.'
              : exam
                ? 'This exam window has closed.'
                : 'This paper is not here.'}
          </h1>
          <p>
            {notYetOpen && exam?.opensAt
              ? `The paper is listed in your exam hall. It opens ${formatScheduleMoment(exam.opensAt)}${
                  exam.closesAt ? ` and closes ${formatScheduleMoment(exam.closesAt)}` : ''
                }.`
              : exam && availability === 'closed'
                ? exam.closesAt
                  ? `New attempts closed ${formatScheduleMoment(exam.closesAt)}. Ask your examiner if the window can be extended.`
                  : 'New attempts are not being accepted. Ask your examiner to reopen the exam.'
                : exam
                  ? 'New attempts are not being accepted. Ask your examiner to reopen the exam.'
                  : 'The exam may have been deleted from this browser. Ask your examiner for a new code.'}
          </p>
          <Link to="/student" className="btn btn-primary">
            <ArrowLeft size={16} />
            Back to exam hall
          </Link>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="take-shell take-shell--intro">
        <header className="take-nav">
          <Brand to="/student" />
          <div className="take-nav-actions">
            <Link to="/student" className="btn btn-quiet btn-sm">
              <ArrowLeft size={16} />
              Exam hall
            </Link>
          </div>
        </header>

        <main className="take-intro">
          <section className="take-cover">
            <div className="cover-margin-line" aria-hidden="true" />
            <div className="cover-topline">
              <span>Question paper</span>
              <span>{coverCode}</span>
            </div>
            <p className="eyebrow">{coverSubject}</p>
            <h1>{coverTitle}</h1>
            <p className="cover-description">{coverDescription}</p>

            <div className="cover-stats">
              <span>
                <ListChecks size={18} />
                <strong>{questions.length}</strong>
                Questions
              </span>
              <span>
                <Timer size={18} />
                <strong>{formatDurationWords(durationMinutes * 60)}</strong>
                Time limit
              </span>
              <span>
                <ClipboardCheck size={18} />
                <strong>{points}</strong>
                Total points
              </span>
              <span>
                <ShieldCheck size={18} />
                <strong>{passPercent}%</strong>
                Pass mark
              </span>
            </div>

            <div className="cover-instructions">
              <p className="eyebrow">Instructions</p>
              <p className="instructions-copy">{coverInstructions}</p>
            </div>

            <div className="cover-footer">
              <span className="cover-seal">
                <BookOpenCheck size={16} />
                SmartQuiz
              </span>
              <span>{coverCode}</span>
            </div>
          </section>

          <aside className="start-card">
            {active ? (
              <>
                <p className="eyebrow">Attempt saved</p>
                <h2>Welcome back, {active.studentName.split(' ')[0]}.</h2>
                <p className="start-lede">
                  {remaining === 0
                    ? 'Time has ended, but your saved answers are still here. Hand them in to finish.'
                    : 'Your answers are still here. The clock is still running, so pick up where you left off.'}
                </p>
                <div className="resume-details">
                  <div>
                    <span>Time left</span>
                    <strong className={remaining <= 300 ? 'is-urgent' : ''}>
                      {formatClock(remaining)}
                    </strong>
                  </div>
                  <div>
                    <span>Answered</span>
                    <strong>
                      {questions.filter((question) => Boolean(active.answers[question.id])).length}
                      <small> / {questions.length}</small>
                    </strong>
                  </div>
                </div>
                {remaining === 0 && (
                  <div className="inline-notice inline-notice--amber inline-notice--compact">
                    <Clock3 size={16} />
                    <div>
                      <strong>Time has ended.</strong>
                      <p>Continue to hand in the answers already saved.</p>
                    </div>
                  </div>
                )}
                {exam?.status !== 'published' && (
                  <div className="inline-notice inline-notice--amber inline-notice--compact">
                    <ShieldCheck size={16} />
                    <div>
                      <strong>This exam is closed.</strong>
                      <p>Your saved attempt can still be finished and submitted.</p>
                    </div>
                  </div>
                )}
                <button type="button" className="btn btn-primary btn-block btn-lg" onClick={resumeAttempt}>
                  {remaining === 0 ? 'Submit saved answers' : 'Resume exam'}
                  <ArrowRight size={18} />
                </button>
                <p className="start-small-note">
                  Started {formatDateTime(active.startedAt)} · Answers saved locally
                </p>
                {exam?.status === 'published' && (
                  <button
                    type="button"
                    className="text-button text-button--danger discard-button"
                    onClick={() => setDiscardOpen(true)}
                  >
                    <X size={14} />
                    Discard this attempt and start over
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="eyebrow">Before you begin</p>
                <h2>Your paper is ready.</h2>
                <p className="start-lede">
                  This attempt is signed with your student account, so every answer and mark stays
                  with you.
                </p>
                <div className="start-identity">
                  <span className="account-avatar" aria-hidden="true">
                    {initialsFor(user?.name ?? 'Student')}
                  </span>
                  <div>
                    <strong>{user?.name ?? 'Signed-in student'}</strong>
                    {user?.email && <span>{user.email}</span>}
                    {user?.phone && <span>{user.phone}</span>}
                  </div>
                  <span className="start-identity-badge">
                    <BadgeCheck size={13} />
                    Signed in
                  </span>
                </div>
                <form className="start-form" onSubmit={startAttempt} noValidate>
                  <ul className="start-rules">
                    <li>
                      <Clock3 size={15} /> The {durationMinutes}-minute timer starts when you click
                      begin.
                    </li>
                    <li>
                      <CheckCircle2 size={15} /> You can move between questions freely.
                    </li>
                    <li>
                      <ShieldCheck size={15} /> Answers auto-submit when time runs out.
                    </li>
                  </ul>

                  <button type="submit" className="btn btn-primary btn-block btn-lg">
                    Begin the exam
                    <ArrowRight size={18} />
                  </button>
                </form>
                <p className="start-small-note">
                  <ShieldCheck size={13} />
                  Your answers are saved in this browser and linked to your account.
                </p>
              </>
            )}
          </aside>
        </main>

        <footer className="take-intro-footer">
          <span>Good luck. Read each question twice.</span>
          <DeveloperCredit inline />
          <span>SmartQuiz · browser-local</span>
        </footer>

        <ConfirmDialog
          open={discardOpen}
          title="Discard this attempt?"
          description="Your saved answers and remaining time will be cleared. This cannot be undone."
          confirmLabel="Discard attempt"
          onCancel={() => setDiscardOpen(false)}
          onConfirm={discardAttempt}
        />
      </div>
    );
  }

  return (
    <div className="take-shell take-shell--exam">
      <header className="take-topbar">
        <div className="take-topbar-left">
          <Brand to="/student" compact />
          <span className="topbar-divider" aria-hidden="true" />
          <div className="take-title-block">
            <span>{coverSubject}</span>
            <strong>{coverTitle}</strong>
          </div>
        </div>
        <div className="take-topbar-right">
          <div className={`timer-pill${urgent ? ' is-urgent' : ''}`} role="timer" aria-live="off">
            <Clock3 size={16} />
            <span>Time left</span>
            <strong>{formatClock(remaining)}</strong>
          </div>
          <Link to="/student" className="btn btn-quiet btn-sm save-exit">
            <LogOut size={15} />
            Save &amp; exit
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={requestSubmit}>
            Submit
          </button>
        </div>
      </header>

      <div className="exam-progress-bar" aria-hidden="true">
        <span style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }} />
      </div>

      <main className="exam-layout">
        <section className="exam-main">
          <div className="exam-progress-head">
            <div>
              <p className="eyebrow">In progress</p>
              <h2>{coverTitle}</h2>
            </div>
            <div className="exam-progress-copy">
              <strong>
                {answeredCount} of {questions.length}
              </strong>
              <span>answered</span>
            </div>
          </div>

          <div className="exam-meta-strip">
            <span>
              <ListChecks size={15} /> {questions.length} questions
            </span>
            <span>
              <Clock3 size={15} /> {formatDurationWords(durationMinutes * 60)}
            </span>
            <span>
              <ShieldCheck size={15} /> Pass {passPercent}%
            </span>
            <span className="exam-meta-student">{session.studentName}</span>
          </div>

          <div className="question-list exam-question-list">
            {questions.map((question, index) => {
              const selected = answers[question.id];
              return (
                <article
                  className="exam-question"
                  id={`exam-${question.id}`}
                  key={question.id}
                >
                  <header className="exam-question-head">
                    <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="question-points">
                      {Math.max(1, question.points)} point{question.points === 1 ? '' : 's'}
                    </span>
                  </header>
                  <h3>{question.prompt || 'Untitled question'}</h3>
                  <div className="exam-options" role="radiogroup" aria-label={`Question ${index + 1}`}>
                    {question.options.map((option, optionIndex) => {
                      const isSelected = selected === option.id;
                      return (
                        <label
                          className={`exam-option${isSelected ? ' is-selected' : ''}`}
                          key={option.id}
                        >
                          <input
                            type="radio"
                            name={question.id}
                            value={option.id}
                            checked={isSelected}
                            onChange={() => selectAnswer(question.id, option.id)}
                          />
                          <span className="option-letter">
                            {OPTION_LETTERS[optionIndex] ?? '?'}
                          </span>
                          <span className="exam-option-text">{option.text}</span>
                          <span className="option-radio-ui" aria-hidden="true">
                            {isSelected && <CheckCircle2 size={17} />}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {selected && (
                    <button
                      type="button"
                      className="text-button exam-clear"
                      onClick={() => clearAnswer(question.id)}
                    >
                      Clear selection
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <div className="exam-finish-card">
            <div>
              <p className="eyebrow">When you're ready</p>
              <h3>Check your answers before handing in.</h3>
              <p>
                {unansweredCount === 0
                  ? 'Every question has an answer.'
                  : `${unansweredCount} question${unansweredCount === 1 ? '' : 's'} are still unanswered.`}
              </p>
            </div>
            <button type="button" className="btn btn-primary" onClick={requestSubmit}>
              <Send size={16} />
              Hand in paper
            </button>
          </div>
        </section>

        <aside className="exam-sidebar">
          <div className="answer-sheet-card">
            <div className="answer-sheet-head">
              <p className="eyebrow">Answer sheet</p>
              <span className="saving-pill">
                <CheckCircle2 size={13} />
                Auto-saved
              </span>
            </div>
            <AnswerSheetContent
              questions={questions}
              answers={answers}
              remaining={remaining}
              onJump={jumpToQuestion}
              onRequestSubmit={requestSubmit}
            />
          </div>
          <p className="exam-aside-note">
            <ShieldCheck size={14} />
            Keep this tab open. If time runs out, your saved answers will be submitted
            automatically.
          </p>
        </aside>
      </main>

      <div className="mobile-exam-footer">
        <div>
          <strong>
            {answeredCount}/{questions.length}
          </strong>
          <span>answered</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSheetOpen(true)}>
          <ListChecks size={15} />
          Answer sheet
        </button>
      </div>

      <Modal
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Answer sheet"
        eyebrow="Jump to any question"
        size="sm"
      >
        <AnswerSheetContent
          questions={questions}
          answers={answers}
          remaining={remaining}
          onJump={jumpToQuestion}
          onRequestSubmit={requestSubmit}
        />
      </Modal>

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Hand in your paper?"
        eyebrow="Final step"
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setSubmitOpen(false)}>
              Keep working
            </button>
            <button type="button" className="btn btn-primary" onClick={() => finalize(false)}>
              <Send size={16} />
              Submit &amp; see result
            </button>
          </>
        }
      >
        <div className="submit-summary">
          <span className="submit-summary-icon">
            <ClipboardCheck size={24} />
          </span>
          <h3>
            {answeredCount} of {questions.length} answered
          </h3>
          <p>
            Once submitted, your paper is marked immediately and your answers can no longer be
            changed.
          </p>
          <div className="submit-stats">
            <span>
              <strong>{answeredCount}</strong>
              Answered
            </span>
            <span>
              <strong className={unansweredCount > 0 ? 'is-warning' : ''}>{unansweredCount}</strong>
              Unanswered
            </span>
            <span>
              <strong>{formatClock(remaining)}</strong>
              Remaining
            </span>
          </div>
          {unansweredCount > 0 && (
            <div className="inline-notice inline-notice--amber inline-notice--compact">
              <Clock3 size={16} />
              <div>
                <strong>You still have blanks.</strong>
                <p>You can go back to finish them, or hand in now as it is.</p>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
