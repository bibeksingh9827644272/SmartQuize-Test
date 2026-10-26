import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  LoaderCircle,
  Lock,
  RefreshCw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from './Toast';
import {
  AIReviewError,
  AI_PROVIDERS,
  AI_QUESTION_LIMIT,
  clearAIKey,
  findingTotals,
  getAIProvider,
  loadAIConfig,
  normalizeAIConfig,
  readAIKey,
  reviewPaper,
  reviewResponses,
  runAIReview,
  saveAIConfig,
  saveAIKey,
  validateAIConfig,
  type AIConfig,
  type AIProviderId,
  type AIReviewOutput,
  type QuestionResponseStat,
  type ReviewFinding,
  type ReviewMode,
} from '../lib/aiReview';
import type { Attempt, ExamContent } from '../types';

interface AdminAIReviewProps {
  open: boolean;
  onClose: () => void;
  mode: ReviewMode;
  content: ExamContent;
  attempts?: Attempt[];
}

const severityOrder: Record<ReviewFinding['severity'], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const severityMeta: Record<ReviewFinding['severity'], typeof AlertTriangle> = {
  high: AlertTriangle,
  medium: AlertCircle,
  low: Info,
};

function sortFindings(findings: ReviewFinding[]): ReviewFinding[] {
  return [...findings].sort(
    (a, b) =>
      severityOrder[a.severity] - severityOrder[b.severity] ||
      (a.questionIndex ?? 999) - (b.questionIndex ?? 999),
  );
}

function HealthRing({ value }: { value: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);
  const tone = value >= 85 ? 'good' : value >= 60 ? 'warn' : 'risk';

  return (
    <div
      className={`ai-health-ring ai-health-ring--${tone}`}
      role="img"
      aria-label={`On-device health score ${value} out of 100`}
    >
      <svg viewBox="0 0 76 76" aria-hidden="true">
        <circle className="ai-health-track" cx="38" cy="38" r={radius} />
        <circle
          className="ai-health-value"
          cx="38"
          cy="38"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="ai-health-label">
        <strong>{value}</strong>
        <span>health</span>
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: ReviewFinding }) {
  const Icon = severityMeta[finding.severity];

  return (
    <li className={`ai-finding ai-finding--${finding.severity}`}>
      <span className="ai-finding-icon" aria-hidden="true">
        <Icon size={15} />
      </span>
      <div className="ai-finding-body">
        <div className="ai-finding-head">
          {finding.questionIndex !== undefined && (
            <span className="ai-qtag">Q{finding.questionIndex}</span>
          )}
          <strong>{finding.title}</strong>
          {finding.source === 'ai' && (
            <span className="ai-source-tag">
              <Sparkles size={10} />
              AI
            </span>
          )}
        </div>
        {finding.detail && <p>{finding.detail}</p>}
        {finding.suggestion && (
          <span className="ai-suggestion">
            <ArrowRight size={12} />
            {finding.suggestion}
          </span>
        )}
      </div>
    </li>
  );
}

function ResponseRow({ stat }: { stat: QuestionResponseStat }) {
  const rate = Math.round(stat.correctRate * 100);
  const tone = rate < 40 ? 'is-low' : rate >= 80 ? 'is-high' : '';

  return (
    <li className="ai-response-row">
      <span className="question-number">{String(stat.index + 1).padStart(2, '0')}</span>
      <div className="ai-response-main">
        <strong>{stat.prompt.trim() || 'Untitled question'}</strong>
        <div className="ai-response-meta">
          {stat.keyLetter && <span>Key {stat.keyLetter}</span>}
          <span>{stat.answered} answered</span>
          {stat.skipped > 0 && <span>{stat.skipped} skipped</span>}
          {stat.discrimination !== null && (
            <span>
              separation {stat.discrimination >= 0 ? '+' : ''}
              {stat.discrimination.toFixed(2)}
            </span>
          )}
        </div>
        <div className="ai-dist-chips" aria-label="Option distribution">
          {stat.options.map((option) => (
            <span
              className={option.isKey ? 'is-key' : ''}
              key={option.optionId}
              title={`${option.letter}: ${option.count} of ${stat.answered} answerers`}
            >
              {option.letter} {option.percent}%
            </span>
          ))}
          {stat.other > 0 && (
            <span className="is-other">Other {stat.other}</span>
          )}
        </div>
      </div>
      <div className={`ai-response-rate ${tone}`}>
        <strong>{rate}%</strong>
        <span>correct</span>
        <div className="ai-mini-bar">
          <span style={{ width: `${rate}%` }} />
        </div>
      </div>
    </li>
  );
}

export function AdminAIReview({
  open,
  onClose,
  mode,
  content,
  attempts = [],
}: AdminAIReviewProps) {
  const { notify } = useToast();
  const [config, setConfig] = useState<AIConfig>(loadAIConfig);
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [aiResult, setAIResult] = useState<AIReviewOutput | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [showAllResponses, setShowAllResponses] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    const stored = loadAIConfig();
    setConfig(stored);
    setSavedKey(Boolean(readAIKey()));
    setApiKey('');
    setShowKey(false);
    setShowSetup(false);
    setAIResult(null);
    setAIError(null);
    setRunning(false);
    setShowAllResponses(false);
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const provider = getAIProvider(config.provider);
  const keyReady = !provider.requiresKey || savedKey || Boolean(apiKey.trim());
  const configured = Boolean(config.baseUrl.trim() && config.model.trim() && keyReady);

  const paperReview = useMemo(() => reviewPaper(content), [content]);
  const responseReview = useMemo(
    () => reviewResponses(content, attempts),
    [content, attempts],
  );
  const localReview = mode === 'paper' ? paperReview : responseReview;
  const localFindings = localReview.findings;
  const localSorted = useMemo(() => sortFindings(localFindings), [localFindings]);
  const totals = findingTotals(localFindings);

  const statsWithData = useMemo(
    () => responseReview.stats.filter((stat) => stat.responses > 0),
    [responseReview],
  );
  const visibleStats = showAllResponses ? statsWithData : statsWithData.slice(0, 8);
  const limited = content.questions.length > AI_QUESTION_LIMIT;

  const heroTitle =
    mode === 'paper'
      ? localReview.score >= 85 && totals.high === 0
        ? 'This paper clears the first pass.'
        : localReview.score >= 60
          ? 'A few things deserve a look.'
          : 'Fix the flagged items first.'
      : responseReview.attempts === 0
        ? 'No submissions to analyse yet.'
        : localReview.score >= 85 && totals.high === 0
          ? 'The response pattern looks steady.'
          : localReview.score >= 60
            ? 'A few response signals need a look.'
            : 'Some questions need attention.';

  const heroCopy =
    mode === 'paper'
      ? `${content.questions.length} question${content.questions.length === 1 ? '' : 's'} · ${paperReview.checks} on-device checks · AI pass optional.`
      : `${responseReview.attempts} submission${responseReview.attempts === 1 ? '' : 's'} · average ${responseReview.averagePercent}% · pass rate ${responseReview.passRate}%.`;

  const selectProvider = (id: AIProviderId) => {
    const preset = getAIProvider(id);
    setConfig({ provider: id, baseUrl: preset.baseUrl, model: preset.model });
    setAIError(null);
    setShowSetup(true);
  };

  const forgetKey = () => {
    clearAIKey();
    setSavedKey(false);
    setApiKey('');
    setShowKey(false);
    setShowSetup(true);
    setAIError(null);
    notify('AI key removed from this tab.', 'info');
  };

  const startReview = async () => {
    if (running) return;
    const normalized = normalizeAIConfig(config);
    const typedKey = apiKey.trim();
    const key = typedKey || readAIKey();
    const issue = validateAIConfig(normalized, key);
    if (issue) {
      setAIError(issue);
      setShowSetup(true);
      return;
    }

    saveAIConfig(normalized);
    if (typedKey) {
      const stored = saveAIKey(typedKey);
      setSavedKey(stored || Boolean(readAIKey()));
      if (stored) setApiKey('');
    }
    setConfig(normalized);
    setShowSetup(false);
    setAIError(null);
    setAIResult(null);
    setRunning(true);

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    try {
      const result = await runAIReview({
        mode,
        content,
        config: normalized,
        apiKey: key,
        stats: mode === 'responses' ? responseReview.stats : undefined,
        overall:
          mode === 'responses'
            ? {
                attempts: responseReview.attempts,
                averagePercent: responseReview.averagePercent,
                passRate: responseReview.passRate,
              }
            : undefined,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setAIResult(result);
      notify(
        result.findings.length > 0
          ? `AI review finished with ${result.findings.length} finding${result.findings.length === 1 ? '' : 's'}.`
          : 'AI review finished with no extra findings.',
        result.findings.length > 0 ? 'info' : 'success',
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof AIReviewError) {
        setAIError(error.message);
        if (error.code === 'auth' || error.code === 'config') setShowSetup(true);
      } else {
        setAIError('The AI review could not finish. Try again.');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setRunning(false);
      }
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={mode === 'paper' ? 'Before the room' : 'After the room'}
      title={mode === 'paper' ? 'AI paper check' : 'AI response review'}
      size="lg"
      footer={
        <>
          <span className="ai-footer-note">
            <Lock size={13} />
            Local checks stay on this device. AI runs only when you ask.
          </span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close review
          </button>
        </>
      }
    >
      <div className="ai-review">
        <section className="ai-hero">
          <HealthRing value={localReview.score} />
          <div className="ai-hero-copy">
            <p className="eyebrow">
              <Sparkles size={12} />
              On-device review
            </p>
            <h3>{heroTitle}</h3>
            <p>{heroCopy}</p>
          </div>
          <div className="ai-hero-counts">
            {totals.high === 0 && totals.medium === 0 && totals.low === 0 ? (
              <span className="ai-sev ai-sev--clean">
                <CheckCircle2 size={13} />
                No issues found
              </span>
            ) : (
              <>
                {totals.high > 0 && (
                  <span className="ai-sev ai-sev--high">
                    <strong>{totals.high}</strong> high
                  </span>
                )}
                {totals.medium > 0 && (
                  <span className="ai-sev ai-sev--medium">
                    <strong>{totals.medium}</strong> check
                  </span>
                )}
                {totals.low > 0 && (
                  <span className="ai-sev ai-sev--low">
                    <strong>{totals.low}</strong> note{totals.low === 1 ? '' : 's'}
                  </span>
                )}
              </>
            )}
          </div>
        </section>

        {mode === 'responses' && (
          <section className="ai-section">
            <div className="ai-section-head">
              <div>
                <p className="eyebrow">Response signals</p>
                <h3>How the room answered</h3>
              </div>
              <span>
                {responseReview.attempts} submission
                {responseReview.attempts === 1 ? '' : 's'}
              </span>
            </div>
            <p className="ai-section-note">
              Separation compares each question with the total score. A negative value can point
              to a key or wording problem.
            </p>
            {statsWithData.length === 0 ? (
              <div className="ai-empty">
                <Info size={18} />
                <div>
                  <strong>No matching submissions yet.</strong>
                  <p>Collect an attempt and the per-question signals will appear here.</p>
                </div>
              </div>
            ) : (
              <>
                <ul className="ai-response-list">
                  {visibleStats.map((stat) => (
                    <ResponseRow stat={stat} key={stat.questionId} />
                  ))}
                </ul>
                {statsWithData.length > 8 && (
                  <button
                    type="button"
                    className="text-button ai-show-more"
                    onClick={() => setShowAllResponses((value) => !value)}
                  >
                    {showAllResponses
                      ? 'Show fewer questions'
                      : `Show all ${statsWithData.length} questions`}
                    <ChevronDown
                      size={14}
                      className={showAllResponses ? 'is-flipped' : undefined}
                    />
                  </button>
                )}
              </>
            )}
          </section>
        )}

        <section className={`ai-lab${configured ? ' is-connected' : ''}`}>
          <div className="ai-lab-head">
            <div>
              <p className="eyebrow">Optional AI pass</p>
              <h3>
                {mode === 'paper' ? 'A second pair of eyes' : 'Read between the responses'}
              </h3>
              <p>
                {mode === 'paper'
                  ? 'A model can catch ambiguous wording, weak distractors, and answer-key mistakes the instant checks cannot see.'
                  : 'A model can connect score patterns, option spread, and wording to suggest what to review first.'}
              </p>
            </div>
            <span className={`ai-connection-pill${configured ? ' is-on' : ''}`}>
              <span className="ai-connection-dot" />
              {configured ? config.model : 'Not connected'}
            </span>
          </div>

          {showSetup ? (
            <form
              className="ai-setup"
              onSubmit={(event) => {
                event.preventDefault();
                void startReview();
              }}
            >
              <div className="ai-setup-grid">
                <label className="ai-field">
                  <span>Provider</span>
                  <select
                    value={config.provider}
                    onChange={(event) => selectProvider(event.target.value as AIProviderId)}
                  >
                    {AI_PROVIDERS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ai-field">
                  <span>Base URL</span>
                  <input
                    type="url"
                    value={config.baseUrl}
                    onChange={(event) =>
                      setConfig((previous) => ({ ...previous, baseUrl: event.target.value }))
                    }
                    placeholder="https://api.openai.com/v1"
                    spellCheck={false}
                  />
                </label>
                <label className="ai-field">
                  <span>Model</span>
                  <input
                    type="text"
                    value={config.model}
                    onChange={(event) =>
                      setConfig((previous) => ({ ...previous, model: event.target.value }))
                    }
                    placeholder="gpt-4o-mini"
                    spellCheck={false}
                  />
                </label>
              </div>

              <label className="ai-field ai-field--key">
                <span>
                  API key
                  {!provider.requiresKey && <em> optional for this endpoint</em>}
                  <em> session only</em>
                </span>
                <div className="ai-key-wrap">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder={
                      savedKey ? 'Key saved in this tab — type to replace' : 'Paste your key'
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="ai-key-toggle"
                    onClick={() => setShowKey((value) => !value)}
                    aria-label={showKey ? 'Hide API key' : 'Show API key'}
                  >
                    {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <div className="ai-setup-meta">
                <span>
                  <KeyRound size={13} />
                  {provider.hint}
                </span>
                <span>
                  <Lock size={13} />
                  The key is sent only to the endpoint above.
                </span>
              </div>

              {limited && (
                <p className="ai-limit-note">
                  One AI pass reads the first {AI_QUESTION_LIMIT} questions.
                </p>
              )}

              <div className="ai-setup-actions">
                <button type="submit" className="btn btn-primary" disabled={running}>
                  {running ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {running ? 'Running review…' : 'Save & run review'}
                </button>
                {savedKey && (
                  <button
                    type="button"
                    className="text-button text-button--muted"
                    onClick={forgetKey}
                  >
                    Forget saved key
                  </button>
                )}
                <button
                  type="button"
                  className="text-button ai-cancel-setup"
                  onClick={() => {
                    setShowSetup(false);
                    setAIError(null);
                  }}
                >
                  Cancel
                </button>
              </div>
              <p className="ai-lab-note">
                The endpoint must allow browser (CORS) requests. Static hosting cannot reach a
                local http endpoint from an https page.
              </p>
            </form>
          ) : configured ? (
            <div className="ai-run-bar">
              <span className="ai-run-icon">
                <Sparkles size={17} />
              </span>
              <div className="ai-run-copy">
                <strong>
                  {provider.label} · {config.model}
                </strong>
                <span>
                  {savedKey
                    ? 'Key saved for this tab'
                    : provider.requiresKey
                      ? 'Ready to run'
                      : 'No key needed for this endpoint'}
                </span>
              </div>
              <button
                type="button"
                className="text-button ai-connection-edit"
                onClick={() => setShowSetup(true)}
                disabled={running}
              >
                <Settings2 size={14} />
                Connection
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void startReview()}
                disabled={running}
              >
                {running ? (
                  <LoaderCircle className="spin" size={15} />
                ) : aiResult ? (
                  <RefreshCw size={15} />
                ) : (
                  <Sparkles size={15} />
                )}
                {running ? 'Working…' : aiResult ? 'Run again' : 'Run AI review'}
              </button>
            </div>
          ) : (
            <div className="ai-lab-intro">
              <div>
                <strong>Use your own AI endpoint</strong>
                <p>
                  Works with OpenAI, OpenRouter, Groq, Ollama, or any compatible Chat Completions
                  API. No key is stored on a server.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowSetup(true)}
              >
                <KeyRound size={15} />
                Connect a model
              </button>
            </div>
          )}

          {running && (
            <div className="ai-running" role="status">
              <LoaderCircle className="spin" size={15} />
              {mode === 'paper'
                ? 'Reading the paper and checking each option…'
                : 'Reading the response patterns…'}
            </div>
          )}

          {aiError && (
            <div className="ai-error" role="alert">
              <AlertCircle size={16} />
              <p>{aiError}</p>
            </div>
          )}

          {aiResult && (
            <div className="ai-result">
              <div className="ai-result-head">
                <span className="ai-result-icon">
                  <Sparkles size={16} />
                </span>
                <div>
                  <p className="eyebrow">Model summary</p>
                  <p className="ai-result-summary">{aiResult.summary}</p>
                </div>
              </div>
              {aiResult.findings.length > 0 ? (
                <ul className="ai-finding-list ai-finding-list--ai">
                  {aiResult.findings.map((finding) => (
                    <FindingCard finding={finding} key={finding.id} />
                  ))}
                </ul>
              ) : (
                <div className="ai-empty ai-empty--good">
                  <CheckCircle2 size={18} />
                  <div>
                    <strong>The model found no extra issues.</strong>
                    <p>Its own pass agrees with the on-device checks.</p>
                  </div>
                </div>
              )}
              <p className="ai-model-note">
                <Info size={13} />
                AI can be wrong. Check any suggested answer key against the source paper before
                changing the exam.
              </p>
            </div>
          )}
        </section>

        <section className="ai-section">
          <div className="ai-section-head">
            <div>
              <p className="eyebrow">On-device checks</p>
              <h3>
                {mode === 'paper' ? 'Instant paper checks' : 'Instant response checks'}
              </h3>
            </div>
            <span>
              {mode === 'paper'
                ? `${paperReview.checks} checks · ${localFindings.length} finding${localFindings.length === 1 ? '' : 's'}`
                : `${localFindings.length} finding${localFindings.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {localSorted.length === 0 ? (
            <div className="ai-empty ai-empty--good">
              <CheckCircle2 size={18} />
              <div>
                <strong>Nothing to fix in the instant checks.</strong>
                <p>
                  {mode === 'paper'
                    ? 'Keys, options, duplication, timing, and answer spread all look consistent.'
                    : 'Answer spread, separation, skips, and timing patterns all look reasonable.'}
                </p>
              </div>
            </div>
          ) : (
            <ul className="ai-finding-list">
              {localSorted.map((finding) => (
                <FindingCard finding={finding} key={finding.id} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </Modal>
  );
}
