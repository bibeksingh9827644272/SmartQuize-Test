import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  FileText,
  Image as ImageIcon,
  ListChecks,
  LoaderCircle,
  Plus,
  Save,
  ScanText,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
  XCircle,
} from 'lucide-react';
import { useAppStore } from '../../data/store';
import { useToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { AdminAIReview } from '../../components/AdminAIReview';
import { QuestionEditor } from '../../components/QuestionEditor';
import { extractTextFromFile, validateSourceFile, type ExtractionMethod } from '../../lib/ocr';
import { parseMcqs, type ParseResult } from '../../lib/parser';
import {
  newQuestion,
  OPTION_LETTERS,
  totalPoints,
  validateExamContent,
} from '../../lib/quiz';
import {
  examAvailability,
  formatScheduleMoment,
  isoToLocalInput,
  localInputToIso,
  scheduleIssue,
} from '../../lib/schedule';
import { uid } from '../../lib/ids';
import { copyToClipboard } from '../../lib/clipboard';
import type { Exam, ExamContent, Question } from '../../types';

const EMPTY_DRAFT: ExamContent = {
  title: '',
  subject: '',
  description: '',
  instructions:
    'Attempt all questions. Each question has one correct answer. You can review and change your answers before submitting.',
  durationMinutes: 20,
  passPercent: 50,
  questions: [],
  opensAt: null,
  closesAt: null,
};

const STEP_LABELS = [
  { title: 'Exam details', short: 'Details' },
  { title: 'Add questions', short: 'Questions' },
  { title: 'Review & publish', short: 'Review' },
];

interface ImportJob {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: 'working' | 'done' | 'error';
  message: string;
  method?: ExtractionMethod;
  chars?: number;
  error?: string;
}

type BasicErrors = Partial<
  Record<'title' | 'subject' | 'durationMinutes' | 'passPercent' | 'schedule', string>
>;

function examToContent(exam: Exam): ExamContent {
  return {
    title: exam.title,
    subject: exam.subject,
    description: exam.description,
    instructions: exam.instructions,
    durationMinutes: exam.durationMinutes,
    passPercent: exam.passPercent,
    questions: exam.questions.map((question) => ({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    })),
    opensAt: exam.opensAt ?? null,
    closesAt: exam.closesAt ?? null,
  };
}

function basicsErrors(content: ExamContent): BasicErrors {
  const errors: BasicErrors = {};
  if (!content.title.trim()) errors.title = 'Give this exam a title.';
  if (!content.subject.trim()) errors.subject = 'Add a subject.';
  if (!Number.isFinite(content.durationMinutes) || content.durationMinutes < 1) {
    errors.durationMinutes = 'Use at least 1 minute.';
  } else if (content.durationMinutes > 300) {
    errors.durationMinutes = 'Keep it to 300 minutes or less.';
  }
  if (
    !Number.isFinite(content.passPercent) ||
    content.passPercent < 0 ||
    content.passPercent > 100
  ) {
    errors.passPercent = 'Use a pass mark from 0 to 100.';
  }
  const scheduleError = scheduleIssue(content.opensAt, content.closesAt);
  if (scheduleError) errors.schedule = scheduleError;
  return errors;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function methodLabel(method?: ExtractionMethod): string {
  if (method === 'pdf-text') return 'PDF text';
  if (method === 'mixed') return 'PDF + OCR';
  if (method === 'ocr') return 'Local OCR';
  return 'Reading';
}

export default function ExamBuilder() {
  const { examId = 'new' } = useParams();
  const navigate = useNavigate();
  const { exams, createExam, updateExam, publishExam } = useAppStore();
  const { notify } = useToast();

  const existing = examId === 'new' ? undefined : exams.find((exam) => exam.id === examId);
  const isMissing = examId !== 'new' && !existing;

  const [draft, setDraft] = useState<ExamContent>(() =>
    existing ? examToContent(existing) : EMPTY_DRAFT,
  );
  const [savedId, setSavedId] = useState<string | null>(
    examId === 'new' ? null : (existing?.id ?? null),
  );
  const [step, setStep] = useState(1);
  const [showBasicsErrors, setShowBasicsErrors] = useState(false);
  const [openQuestionId, setOpenQuestionId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const [rawText, setRawText] = useState('');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [parseMessage, setParseMessage] = useState<string | null>(null);

  const previousRouteRef = useRef(examId);
  const examsRef = useRef(exams);
  examsRef.current = exams;
  const processingRef = useRef(false);
  const importSessionRef = useRef(0);

  const savedExam = savedId ? exams.find((exam) => exam.id === savedId) : undefined;
  const isPublished = savedExam?.status === 'published';
  const savedAvailability = savedExam ? examAvailability(savedExam) : null;
  const windowState = examAvailability(draft);
  const issues = useMemo(() => validateExamContent(draft), [draft]);
  const missingKeys = draft.questions.filter((question) => !question.correctOptionId).length;
  const basics = basicsErrors(draft);
  const allBasicsValid = Object.keys(basics).length === 0;
  const points = totalPoints(draft.questions);
  const parsedMissingKeys =
    parseResult?.questions.filter((question) => question.correctIndex === null).length ?? 0;

  useEffect(() => {
    if (previousRouteRef.current === examId) return;
    const nextExam =
      examId === 'new' ? undefined : examsRef.current.find((exam) => exam.id === examId);
    previousRouteRef.current = examId;
    setDraft(nextExam ? examToContent(nextExam) : EMPTY_DRAFT);
    setSavedId(nextExam?.id ?? null);
    setStep(1);
    setOpenQuestionId(null);
    setRawText('');
    setJobs([]);
    setParseResult(null);
    setParseMessage(null);
    setPublishOpen(false);
    setAiOpen(false);
    setShowBasicsErrors(false);
    importSessionRef.current += 1;
    processingRef.current = false;
    setIsProcessing(false);
    setIsDragging(false);
  }, [examId]);

  useEffect(() => {
    if (!savedId) return;
    updateExam(savedId, draft);
  }, [draft, savedId, updateExam]);

  const setField = <K extends keyof ExamContent>(key: K, value: ExamContent[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const scrollTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const createSavedDraft = (): string | null => {
    if (!allBasicsValid) {
      setShowBasicsErrors(true);
      notify('Add the exam details before saving.', 'error');
      return null;
    }
    if (savedId) {
      updateExam(savedId, draft);
      return savedId;
    }
    const created = createExam(draft, 'draft');
    previousRouteRef.current = created.id;
    setSavedId(created.id);
    setShowBasicsErrors(false);
    navigate(`/admin/exams/${created.id}/edit`, { replace: true });
    return created.id;
  };

  const saveDraft = () => {
    const id = createSavedDraft();
    if (id) notify('Draft saved in this browser.');
  };

  const continueFromDetails = () => {
    if (!createSavedDraft()) return;
    setStep(2);
    scrollTop();
  };

  const goToPreviousStep = () => {
    if (step === 1) return;
    setStep(step - 1);
    scrollTop();
  };

  const goToStep = (target: number) => {
    if (target > step) return;
    setStep(target);
    scrollTop();
  };

  const updateQuestion = (question: Question) => {
    setDraft((previous) => ({
      ...previous,
      questions: previous.questions.map((item) =>
        item.id === question.id ? question : item,
      ),
    }));
  };

  const deleteQuestion = (id: string) => {
    setDraft((previous) => ({
      ...previous,
      questions: previous.questions.filter((question) => question.id !== id),
    }));
    if (openQuestionId === id) setOpenQuestionId(null);
    notify('Question removed.', 'info');
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= draft.questions.length) return;
    setDraft((previous) => {
      const next = [...previous.questions];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...previous, questions: next };
    });
  };

  const addBlankQuestion = () => {
    const question = newQuestion();
    setDraft((previous) => ({ ...previous, questions: [...previous.questions, question] }));
    setOpenQuestionId(question.id);
    setStep(3);
    scrollTop();
  };

  const addParsedQuestions = () => {
    if (!parseResult || parseResult.questions.length === 0) return;
    const imported: Question[] = parseResult.questions.map((parsed) => {
      const options = parsed.options.map((text) => ({ id: uid('o'), text }));
      return {
        id: uid('q'),
        prompt: parsed.prompt,
        options,
        correctOptionId:
          parsed.correctIndex === null
            ? null
            : (options[parsed.correctIndex]?.id ?? null),
        points: 1,
        explanation: parsed.explanation,
      };
    });
    setDraft((previous) => ({
      ...previous,
      questions: [...previous.questions, ...imported],
    }));
    setOpenQuestionId(imported[0]?.id ?? null);
    setParseResult(null);
    setStep(3);
    notify(`${imported.length} question${imported.length === 1 ? '' : 's'} added. Check the answer keys.`);
    scrollTop();
  };

  const updateJob = (id: string, partial: Partial<ImportJob>) => {
    setJobs((previous) =>
      previous.map((job) => (job.id === id ? { ...job, ...partial } : job)),
    );
  };

  const handleFiles = async (files: File[]) => {
    if (processingRef.current) {
      notify('Let the current scan finish first.', 'info');
      return;
    }
    if (files.length === 0) return;
    if (files.length > 10) {
      notify('Add up to 10 files at a time.', 'error');
      return;
    }

    const session = importSessionRef.current;
    const isCurrent = () => importSessionRef.current === session;
    const updateThisJob = (id: string, partial: Partial<ImportJob>) => {
      if (isCurrent()) updateJob(id, partial);
    };

    const newJobs: { job: ImportJob; file?: File }[] = files.map((file) => {
      const validation = validateSourceFile(file);
      return {
        file: validation ? undefined : file,
        job: {
          id: uid('import'),
          name: file.name,
          size: file.size,
          progress: 0,
          status: validation ? 'error' : 'working',
          message: validation ?? 'Waiting to be read…',
          error: validation ?? undefined,
        },
      };
    });

    setJobs((previous) => [...newJobs.map((entry) => entry.job), ...previous]);
    setParseResult(null);
    setParseMessage(null);

    const validJobs = newJobs.filter(
      (entry): entry is { job: ImportJob; file: File } => Boolean(entry.file),
    );
    if (validJobs.length === 0) {
      notify('Those files could not be read. Use a PDF or image under 20 MB.', 'error');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    let completed = 0;

    for (const entry of validJobs) {
      if (!isCurrent()) return;
      updateThisJob(entry.job.id, { status: 'working', message: 'Preparing the file…' });
      try {
        const extracted = await extractTextFromFile(entry.file, (progress) => {
          updateThisJob(entry.job.id, {
            progress: progress.progress,
            message: progress.message,
            method: progress.method,
          });
        });

        if (!isCurrent()) return;
        if (!extracted.text.trim()) {
          throw new Error('No readable text was found. Try a clearer scan or add questions manually.');
        }

        updateThisJob(entry.job.id, {
          status: 'done',
          progress: 1,
          message:
            extracted.method === 'pdf-text'
              ? 'Text read from the PDF layer.'
              : 'Page read with local OCR.',
          method: extracted.method,
          chars: extracted.text.length,
        });
        setRawText((previous) => {
          const nextText = extracted.text.trim();
          if (!previous.trim()) return nextText;
          return `${previous.trimEnd()}\n\n${nextText}`;
        });
        completed += 1;
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : 'This file could not be read.';
        updateThisJob(entry.job.id, {
          status: 'error',
          message,
          error: message,
        });
        notify(`${entry.file.name}: ${message}`, 'error');
      }
    }

    if (!isCurrent()) return;
    processingRef.current = false;
    setIsProcessing(false);
    if (completed > 0) {
      notify(
        `${completed} file${completed === 1 ? '' : 's'} read. Check the text, then find the questions.`,
      );
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    void handleFiles(files);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    const files = Array.from(event.dataTransfer.files ?? []);
    void handleFiles(files);
  };

  const findQuestions = () => {
    if (!rawText.trim()) {
      setParseMessage('Upload a page or paste some question text first.');
      setParseResult(null);
      return;
    }
    const result = parseMcqs(rawText);
    setParseResult(result);
    setParseMessage(
      result.questions.length === 0
        ? 'No questions were found. Check the numbering and option letters, or add questions manually.'
        : null,
    );
  };

  const copyExamCode = async () => {
    if (!savedExam) return;
    const copied = await copyToClipboard(savedExam.code);
    notify(
      copied ? `Exam code ${savedExam.code} copied.` : `Exam code: ${savedExam.code}`,
      copied ? 'success' : 'info',
    );
  };

  const publish = () => {
    if (!savedId) {
      notify('Save the exam details before publishing.', 'error');
      setStep(1);
      return;
    }
    if (!allBasicsValid) {
      setShowBasicsErrors(true);
      setStep(1);
      notify('Some exam details still need attention.', 'error');
      return;
    }
    const foundIssues = validateExamContent(draft);
    if (foundIssues.length > 0) {
      const firstQuestionIssue = foundIssues.find((issue) => issue.questionId);
      if (firstQuestionIssue?.questionId) {
        setOpenQuestionId(firstQuestionIssue.questionId);
        window.setTimeout(() => {
          document
            .getElementById(`question-${firstQuestionIssue.questionId}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
      notify('Fix the highlighted items before publishing.', 'error');
      return;
    }

    publishExam(savedId, draft);
    setPublishOpen(true);
  };

  if (isMissing) {
    return (
      <div className="page">
        <div className="state-page">
          <span className="state-icon">
            <FileText size={26} />
          </span>
          <p className="eyebrow">Exam not found</p>
          <h1>That paper isn't in this workspace.</h1>
          <p>It may have been deleted, or this browser is using a fresh local workspace.</p>
          <Link to="/admin" className="btn btn-primary">
            <ArrowLeft size={17} />
            Back to overview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page builder-page">
      <Link to="/admin" className="back-link">
        <ArrowLeft size={16} />
        Back to overview
      </Link>

      <header className="builder-head">
        <div className="builder-head-copy">
          <p className="eyebrow">{savedId ? 'Edit exam' : 'New exam'}</p>
          <div className="builder-title-row">
            <h1>{draft.title.trim() || 'Untitled exam'}</h1>
            {savedExam && (
              <span
                className={`status-badge status-badge--${isPublished ? savedAvailability : 'draft'}`}
              >
                <span />
                {isPublished
                  ? savedAvailability === 'scheduled'
                    ? 'Scheduled'
                    : savedAvailability === 'closed'
                      ? 'Closed'
                      : 'Published'
                  : 'Draft'}
              </span>
            )}
          </div>
          <p className="page-lede">
            {savedId ? 'Changes save to this browser automatically.' : 'Start with the details, then add questions.'}
          </p>
        </div>
        <div className="builder-head-actions">
          {savedExam && (
            <button type="button" className="code-chip code-chip--compact" onClick={() => void copyExamCode()}>
              <span>Code</span>
              <strong>{savedExam.code}</strong>
              <Copy size={13} />
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={saveDraft}>
            <Save size={16} />
            Save draft
          </button>
        </div>
      </header>

      <nav className="builder-stepper" aria-label="Exam builder steps">
        {STEP_LABELS.map((label, index) => {
          const number = index + 1;
          const isActive = step === number;
          const isDone = step > number;
          return (
            <button
              type="button"
              className={`builder-step${isActive ? ' is-active' : ''}${isDone ? ' is-done' : ''}`}
              key={label.title}
              onClick={() => goToStep(number)}
              disabled={number > step}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="step-index">{isDone ? <Check size={15} /> : number}</span>
              <span className="step-copy">
                <small>Step {number}</small>
                <strong>{label.title}</strong>
              </span>
              {number < 3 && <ChevronRight className="step-arrow" size={16} />}
            </button>
          );
        })}
      </nav>

      {isPublished && (
        <div className="inline-notice inline-notice--green">
          <CheckCircle2 size={18} />
          <div>
            <strong>This exam is live.</strong>
            <p>
              Edits save as you type. Students who already started keep the paper they began with.
            </p>
          </div>
          <Link to={`/admin/exams/${savedId}/results`} className="btn btn-secondary btn-sm">
            View results
          </Link>
        </div>
      )}

      {step === 1 && (
        <section className="builder-card">
          <div className="builder-card-head">
            <span className="builder-icon">
              <FileText size={20} />
            </span>
            <div>
              <h2>Set the exam details</h2>
              <p>These appear on the student's exam cover before they begin.</p>
            </div>
          </div>

          <div className="form-grid">
            <label className={`field field--full${showBasicsErrors && basics.title ? ' has-error' : ''}`}>
              <span className="field-label">
                Exam title <span className="required-mark">Required</span>
              </span>
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setField('title', event.target.value)}
                placeholder="e.g. Biology Unit 3 — Cells and Transport"
                maxLength={110}
              />
              {showBasicsErrors && basics.title && <span className="field-error">{basics.title}</span>}
            </label>

            <label className={`field${showBasicsErrors && basics.subject ? ' has-error' : ''}`}>
              <span className="field-label">
                Subject <span className="required-mark">Required</span>
              </span>
              <input
                type="text"
                list="subject-suggestions"
                value={draft.subject}
                onChange={(event) => setField('subject', event.target.value)}
                placeholder="Biology"
                maxLength={60}
              />
              <datalist id="subject-suggestions">
                <option value="Biology" />
                <option value="Chemistry" />
                <option value="Physics" />
                <option value="Mathematics" />
                <option value="English" />
                <option value="General Knowledge" />
                <option value="Computer Science" />
              </datalist>
              {showBasicsErrors && basics.subject && (
                <span className="field-error">{basics.subject}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">
                Duration <span className="field-hint">minutes</span>
              </span>
              <div className="number-input">
                <Clock3 size={16} />
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={draft.durationMinutes}
                  onChange={(event) =>
                    setField('durationMinutes', Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </div>
              {showBasicsErrors && basics.durationMinutes && (
                <span className="field-error">{basics.durationMinutes}</span>
              )}
            </label>

            <label className="field">
              <span className="field-label">
                Pass mark <span className="field-hint">percent</span>
              </span>
              <div className="number-input">
                <span className="number-suffix">%</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={draft.passPercent}
                  onChange={(event) =>
                    setField('passPercent', Math.max(0, Number(event.target.value) || 0))
                  }
                />
              </div>
              {showBasicsErrors && basics.passPercent && (
                <span className="field-error">{basics.passPercent}</span>
              )}
            </label>

            <label className="field field--full">
              <span className="field-label">
                Short description <span className="optional-label">optional</span>
              </span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(event) => setField('description', event.target.value)}
                placeholder="A short note to help students know what this paper covers."
                maxLength={280}
              />
              <span className="char-count">{draft.description.length}/280</span>
            </label>

            <label className="field field--full">
              <span className="field-label">Instructions for students</span>
              <textarea
                rows={3}
                value={draft.instructions}
                onChange={(event) => setField('instructions', event.target.value)}
                placeholder="Any rules, guidance, or timing notes."
              />
            </label>

            <div className="schedule-block field--full">
              <div className="schedule-block-head">
                <span className="schedule-block-icon">
                  <CalendarClock size={18} />
                </span>
                <div>
                  <strong>Exam window</strong>
                  <span>Scheduled papers appear in the student exam hall with their opening time.</span>
                </div>
              </div>
              <div className="schedule-fields">
                <label className="field">
                  <span className="field-label">
                    Opens <span className="optional-label">optional</span>
                  </span>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(draft.opensAt)}
                    onChange={(event) =>
                      setField('opensAt', localInputToIso(event.target.value))
                    }
                  />
                </label>
                <label className="field">
                  <span className="field-label">
                    Closes <span className="optional-label">optional</span>
                  </span>
                  <input
                    type="datetime-local"
                    value={isoToLocalInput(draft.closesAt)}
                    onChange={(event) =>
                      setField('closesAt', localInputToIso(event.target.value))
                    }
                  />
                </label>
              </div>
              {basics.schedule ? (
                <span className="field-error">{basics.schedule}</span>
              ) : (
                <span className="schedule-hint">
                  {draft.opensAt || draft.closesAt
                    ? [
                        draft.opensAt ? `Opens ${formatScheduleMoment(draft.opensAt)}.` : 'Open now.',
                        draft.closesAt
                          ? `Closes ${formatScheduleMoment(draft.closesAt)}.`
                          : 'No closing time set.',
                      ].join(' ')
                    : 'Leave both blank to accept attempts as soon as you publish.'}
                </span>
              )}
            </div>
          </div>

          <div className="builder-card-footer">
            <span className="save-note">
              {savedId ? (
                <>
                  <CheckCircle2 size={15} /> Saved locally
                </>
              ) : (
                <>Your draft is created when you continue.</>
              )}
            </span>
            <button type="button" className="btn btn-primary" onClick={continueFromDetails}>
              Continue to questions
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <div className="import-layout">
          <section className="builder-card import-card">
            <div className="builder-card-head">
              <span className="builder-icon">
                <ScanText size={20} />
              </span>
              <div>
                <h2>Read a question paper</h2>
                <p>Upload a PDF or photo, or paste the text directly. OCR runs locally in your browser.</p>
              </div>
            </div>

            <label
              className={`dropzone${isDragging ? ' is-dragging' : ''}${isProcessing ? ' is-busy' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                if (!isProcessing) setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input
                className="sr-only"
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp"
                multiple
                disabled={isProcessing}
                onChange={onFileInput}
              />
              <span className="dropzone-icon">
                {isProcessing ? <LoaderCircle className="spin" size={26} /> : <UploadCloud size={26} />}
              </span>
              <span className="dropzone-title">
                {isProcessing ? 'Reading your paper…' : 'Drop a PDF or photo here'}
              </span>
              <span className="dropzone-sub">
                or <strong>browse files</strong> · PDF, PNG, JPG or WEBP · up to 20 MB each
              </span>
              <span className="dropzone-formats">
                <span>
                  <FileText size={13} /> Digital PDFs read instantly
                </span>
                <span>
                  <ImageIcon size={13} /> Photos use local OCR
                </span>
              </span>
            </label>

            <div className="ocr-note">
              <AlertTriangle size={16} />
              <p>
                Local OCR is best with clear print. Handwriting can be recognised, but always check
                the text and answer keys. Files stay on this device.
              </p>
            </div>

            {jobs.length > 0 && (
              <div className="import-jobs">
                {jobs.map((job) => (
                  <div className={`import-job import-job--${job.status}`} key={job.id}>
                    <span className="import-job-icon">
                      {job.status === 'working' && <LoaderCircle className="spin" size={17} />}
                      {job.status === 'done' && <CheckCircle2 size={17} />}
                      {job.status === 'error' && <AlertTriangle size={17} />}
                    </span>
                    <div className="import-job-main">
                      <div className="import-job-line">
                        <strong>{job.name}</strong>
                        <span>{formatBytes(job.size)}</span>
                        {job.status === 'done' && (
                          <em className="method-chip">{methodLabel(job.method)}</em>
                        )}
                      </div>
                      <p>{job.message}</p>
                      {job.status === 'working' && (
                        <div className="progress-track" aria-hidden="true">
                          <span style={{ width: `${Math.max(3, job.progress * 100)}%` }} />
                        </div>
                      )}
                      {job.status === 'done' && job.chars !== undefined && (
                        <span className="job-chars">{job.chars.toLocaleString()} characters captured</span>
                      )}
                    </div>
                    {job.status === 'error' && (
                      <span className="job-error-icon">
                        <XCircle size={16} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="text-import">
              <div className="text-import-head">
                <label htmlFor="import-text" className="field-label">
                  Extracted or pasted text
                </label>
                <div className="text-import-tools">
                  <span>{rawText.length.toLocaleString()} characters</span>
                  {rawText && (
                    <button
                      type="button"
                      className="text-button text-button--muted"
                      onClick={() => {
                        setRawText('');
                        setParseResult(null);
                        setParseMessage(null);
                        setJobs([]);
                      }}
                      disabled={isProcessing}
                    >
                      <Trash2 size={14} />
                      Clear
                    </button>
                  )}
                </div>
              </div>
              <textarea
                id="import-text"
                className="import-textarea"
                rows={10}
                value={rawText}
                onChange={(event) => {
                  setRawText(event.target.value);
                  setParseResult(null);
                  setParseMessage(null);
                }}
                placeholder={'Paste MCQs here…\n\n1. Which planet is known as the Red Planet?\nA. Venus\nB. Mars\nC. Jupiter\nD. Mercury\nAnswer: B'}
                spellCheck={false}
              />
              <div className="parse-bar">
                <p>
                  Questions need numbers (1., 2.) and options with letters (A., B., C., D.).
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={findQuestions}
                  disabled={isProcessing || !rawText.trim()}
                >
                  <Sparkles size={16} />
                  Find questions
                </button>
              </div>
            </div>

            {parseMessage && (
              <div className="inline-notice inline-notice--amber inline-notice--compact">
                <AlertTriangle size={17} />
                <div>
                  <strong>Nothing to import yet</strong>
                  <p>{parseMessage}</p>
                </div>
              </div>
            )}

            {parseResult && parseResult.questions.length > 0 && (
              <div className="parse-result">
                <div className="parse-result-head">
                  <span className="parse-result-icon">
                    <ClipboardCheck size={21} />
                  </span>
                  <div>
                    <p className="eyebrow">Ready to import</p>
                    <h3>
                      {parseResult.questions.length} question
                      {parseResult.questions.length === 1 ? '' : 's'} found
                    </h3>
                    <p>
                      {parsedMissingKeys === 0
                        ? 'All answer keys were recognised. Review the questions next.'
                        : `${parsedMissingKeys} question${parsedMissingKeys === 1 ? '' : 's'} ${parsedMissingKeys === 1 ? 'needs' : 'need'} a correct answer before publishing.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn icon-btn--quiet"
                    onClick={() => setParseResult(null)}
                    aria-label="Dismiss parsed questions"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="parsed-preview-list">
                  {parseResult.questions.slice(0, 4).map((question, index) => (
                    <div className="parsed-preview" key={`${question.prompt}-${index}`}>
                      <span className="question-number">{String(index + 1).padStart(2, '0')}</span>
                      <div>
                        <strong>{question.prompt || 'Untitled question'}</strong>
                        <span>
                          {question.options.length} options{' '}
                          {question.correctIndex === null
                            ? '· answer key missing'
                            : `· key ${OPTION_LETTERS[question.correctIndex] ?? ''}`}
                        </span>
                      </div>
                    </div>
                  ))}
                  {parseResult.questions.length > 4 && (
                    <p className="parsed-more">
                      + {parseResult.questions.length - 4} more question
                      {parseResult.questions.length - 4 === 1 ? '' : 's'}
                    </p>
                  )}
                </div>

                {parseResult.warnings.length > 0 && (
                  <ul className="parse-warning-list">
                    {parseResult.warnings.slice(0, 3).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                )}

                <button type="button" className="btn btn-primary" onClick={addParsedQuestions}>
                  <Plus size={17} />
                  Add {parseResult.questions.length} question
                  {parseResult.questions.length === 1 ? '' : 's'} to exam
                </button>
              </div>
            )}

            <div className="builder-card-footer builder-card-footer--split">
              <button type="button" className="btn btn-quiet" onClick={goToPreviousStep}>
                <ArrowLeft size={16} />
                Back to details
              </button>
              <div className="footer-action-group">
                <button type="button" className="btn btn-secondary" onClick={addBlankQuestion}>
                  <Plus size={16} />
                  Add manually
                </button>
                <button type="button" className="btn btn-primary" onClick={() => { setStep(3); scrollTop(); }}>
                  Review questions
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          </section>

          <aside className="import-aside">
            <div className="import-mini-card">
              <p className="eyebrow">On this exam so far</p>
              <div className="mini-stat-row">
                <span>
                  <strong>{draft.questions.length}</strong>
                  Questions
                </span>
                <span>
                  <strong>{points}</strong>
                  Points
                </span>
              </div>
              {draft.questions.length > 0 && (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => { setStep(3); scrollTop(); }}
                >
                  Review existing questions
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
            <div className="import-tip-card">
              <ScanText size={20} />
              <h3>A cleaner scan reads better</h3>
              <p>
                Straighten the page, avoid shadows, and use a dark pen on light paper. Digital PDFs
                skip OCR entirely, so they are the most reliable.
              </p>
            </div>
            <div className="import-tip-card import-tip-card--quiet">
              <BookOpenCheck size={20} />
              <h3>Answer keys matter</h3>
              <p>
                SmartQuiz reads “Answer: B” lines and starred options. If a key is missing, set it
                while reviewing — nothing can be published without one.
              </p>
            </div>
          </aside>
        </div>
      )}

      {step === 3 && (
        <div className="review-layout">
          <section className="review-main">
            <div className="review-toolbar">
              <div>
                <p className="eyebrow">The final check</p>
                <h2>
                  {draft.questions.length} question{draft.questions.length === 1 ? '' : 's'} on the
                  paper
                </h2>
                <p>Expand a question to edit its wording, options, points, or answer key.</p>
              </div>
              <div className="review-toolbar-actions">
                <button
                  type="button"
                  className="btn btn-ai"
                  onClick={() => setAiOpen(true)}
                  disabled={draft.questions.length === 0}
                >
                  <Sparkles size={16} />
                  AI paper check
                </button>
                <button type="button" className="btn btn-secondary" onClick={addBlankQuestion}>
                  <Plus size={16} />
                  Add question
                </button>
              </div>
            </div>

            {missingKeys > 0 && (
              <div className="inline-notice inline-notice--amber inline-notice--compact">
                <AlertTriangle size={17} />
                <div>
                  <strong>
                    {missingKeys} question{missingKeys === 1 ? '' : 's'} still{' '}
                    {missingKeys === 1 ? 'needs' : 'need'} an answer key.
                  </strong>
                  <p>Open the highlighted question and choose the correct option.</p>
                </div>
              </div>
            )}

            {draft.questions.length === 0 ? (
              <div className="review-empty">
                <span className="state-icon">
                  <ListChecks size={25} />
                </span>
                <h3>This paper is blank.</h3>
                <p>Go back to add questions from a scan, or type one from scratch.</p>
                <div className="review-empty-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                    <ScanText size={16} />
                    Import questions
                  </button>
                  <button type="button" className="btn btn-primary" onClick={addBlankQuestion}>
                    <Plus size={16} />
                    Add a question
                  </button>
                </div>
              </div>
            ) : (
              <div className="question-list">
                {draft.questions.map((question, index) => (
                  <QuestionEditor
                    key={question.id}
                    question={question}
                    index={index}
                    total={draft.questions.length}
                    open={openQuestionId === question.id}
                    onToggle={() =>
                      setOpenQuestionId((current) =>
                        current === question.id ? null : question.id,
                      )
                    }
                    onChange={updateQuestion}
                    onMove={(direction) => moveQuestion(index, direction)}
                    onDelete={() => deleteQuestion(question.id)}
                  />
                ))}
              </div>
            )}

            {draft.questions.length > 0 && (
              <button type="button" className="add-question-ghost" onClick={addBlankQuestion}>
                <Plus size={18} />
                Add another question
              </button>
            )}

            <div className="builder-card-footer builder-card-footer--split">
              <button type="button" className="btn btn-quiet" onClick={goToPreviousStep}>
                <ArrowLeft size={16} />
                Back to import
              </button>
              <button type="button" className="btn btn-primary" onClick={saveDraft}>
                <Save size={16} />
                Save draft
              </button>
            </div>
          </section>

          <aside className="publish-aside">
            <div className="publish-card">
              <div className="publish-card-head">
                <p className="eyebrow">Publish checklist</p>
                {issues.length === 0 ? (
                  <span className="ready-badge">
                    <CheckCircle2 size={14} />
                    Ready
                  </span>
                ) : (
                  <span className="ready-badge ready-badge--not">
                    <AlertTriangle size={14} />
                    {issues.length} to fix
                  </span>
                )}
              </div>

              <div className="publish-paper">
                <span>{draft.subject || 'Subject'}</span>
                <h3>{draft.title || 'Untitled exam'}</h3>
                <div className="publish-paper-meta">
                  <span>{draft.questions.length} Q</span>
                  <span>{draft.durationMinutes} min</span>
                  <span>{points} pts</span>
                  <span>Pass {draft.passPercent}%</span>
                </div>
                {savedExam && <strong className="publish-code">{savedExam.code}</strong>}
              </div>

              <ul className="readiness-list">
                <li className={allBasicsValid ? 'is-ready' : ''}>
                  {allBasicsValid ? <Check size={14} /> : <X size={14} />}
                  Exam details complete
                </li>
                <li className={draft.questions.length > 0 ? 'is-ready' : ''}>
                  {draft.questions.length > 0 ? <Check size={14} /> : <X size={14} />}
                  At least one question
                </li>
                <li
                  className={
                    draft.questions.length > 0 && missingKeys === 0 ? 'is-ready' : ''
                  }
                >
                  {draft.questions.length > 0 && missingKeys === 0 ? (
                    <Check size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  Every question has a key
                </li>
                <li className={draft.questions.every((q) => q.prompt.trim()) && draft.questions.length > 0 ? 'is-ready' : ''}>
                  {draft.questions.every((q) => q.prompt.trim()) && draft.questions.length > 0 ? (
                    <Check size={14} />
                  ) : (
                    <X size={14} />
                  )}
                  No blank prompts
                </li>
              </ul>

              {issues.length > 0 && (
                <div className="issue-block">
                  <p>Fix before publishing</p>
                  <ul>
                    {issues.slice(0, 4).map((issue, index) => (
                      <li key={`${issue.message}-${index}`}>{issue.message}</li>
                    ))}
                    {issues.length > 4 && <li>+ {issues.length - 4} more issues</li>}
                  </ul>
                  <button type="button" className="text-button" onClick={() => setStep(3)}>
                    Go through the questions
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}

              {isPublished ? (
                <div className="published-actions">
                  <div className={`live-label live-label--${windowState}`}>
                    <span className="live-dot" />
                    {windowState === 'scheduled'
                      ? 'Scheduled for students'
                      : windowState === 'closed'
                        ? 'Window closed'
                        : 'Live for students'}
                  </div>
                  {windowState !== 'open' && savedExam && (
                    <p className="live-detail">
                      {windowState === 'scheduled'
                        ? `Opens ${formatScheduleMoment(savedExam.opensAt!)}.`
                        : savedExam.closesAt
                          ? `Closed ${formatScheduleMoment(savedExam.closesAt)}.`
                          : 'The exam window has ended.'}
                    </p>
                  )}
                  <Link to={`/admin/exams/${savedId}/results`} className="btn btn-primary btn-block">
                    View results
                    <ArrowRight size={16} />
                  </Link>
                  <button type="button" className="btn btn-secondary btn-block" onClick={() => void copyExamCode()}>
                    <Copy size={15} />
                    Copy join code
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary btn-block btn-lg"
                  onClick={publish}
                >
                  <Sparkles size={17} />
                  Publish exam
                </button>
              )}

              <p className="publish-note">
                <CheckCircle2 size={13} />
                Students on this browser join with the code. Saved locally.
              </p>
            </div>
          </aside>
        </div>
      )}

      <AdminAIReview
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        mode="paper"
        content={draft}
      />

      <Modal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        title={
          windowState === 'scheduled'
            ? 'Your exam is scheduled.'
            : windowState === 'closed'
              ? 'Your exam window is closed.'
              : 'Your exam is live.'
        }
        eyebrow="Ready for the room"
        size="sm"
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setPublishOpen(false)}>
            Keep editing
          </button>
        }
      >
        <div className="publish-success">
          <span className="publish-success-icon">
            <Check size={26} />
          </span>
          <p>
            <strong>{draft.title}</strong> is published.{' '}
            {windowState === 'scheduled' ? (
              <>
                Students can see it now under scheduled exams and can join from{' '}
                {draft.opensAt ? formatScheduleMoment(draft.opensAt) : 'the opening time'}.
              </>
            ) : windowState === 'closed' ? (
              <>Its closing time has already passed, so new attempts are blocked.</>
            ) : (
              <>Students can join from the exam hall using this code.</>
            )}
          </p>
          {(draft.opensAt || draft.closesAt) && (
            <div className="publish-schedule">
              <CalendarClock size={15} />
              <span>
                {draft.opensAt ? `Opens ${formatScheduleMoment(draft.opensAt)}` : 'Open now'}
                {draft.closesAt ? ` · Closes ${formatScheduleMoment(draft.closesAt)}` : ''}
              </span>
            </div>
          )}
          <button type="button" className="big-code" onClick={() => void copyExamCode()}>
            <span>{savedExam?.code ?? '------'}</span>
            <Copy size={17} />
          </button>
          <div className="publish-success-actions">
            <Link to={`/admin/exams/${savedId}/results`} className="btn btn-primary">
              Results
              <ArrowRight size={16} />
            </Link>
          </div>
          <p className="modal-footnote">
            The exam is stored in this browser only. Sign out and use a student account to sit it.
          </p>
        </div>
      </Modal>
    </div>
  );
}
