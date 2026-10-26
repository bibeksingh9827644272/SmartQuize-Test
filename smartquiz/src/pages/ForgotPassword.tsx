import { useEffect, useState, type FormEvent } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useSearchParams,
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { DeveloperCredit } from '../components/DeveloperCredit';
import { PasswordMeter, PhoneField } from '../components/AuthFields';
import { useToast } from '../components/Toast';
import { useAuth } from '../data/auth';
import {
  AuthError,
  RESET_CODE_TTL_MINUTES,
  RESET_RESEND_COOLDOWN_SECONDS,
  completePasswordReset,
  detectDefaultCountry,
  getPasswordIssue,
  isValidEmail,
  normalizeEmail,
  requestPasswordReset,
  resendPasswordResetCode,
  roleHome,
  toE164,
  verifyPasswordResetCode,
  type CountryCode,
  type PasswordResetTicket,
  type PasswordResetVerification,
  type ResetChannel,
  type UserRole,
} from '../lib/auth';

type ResetStep = 'identify' | 'verify' | 'password' | 'done';

interface FieldErrors {
  contact?: string;
  code?: string;
  password?: string;
  confirm?: string;
}

interface CompletedReset {
  name: string;
  role: UserRole;
  identifier: string;
}

const STEPS: Array<{ key: ResetStep; label: string }> = [
  { key: 'identify', label: 'Account' },
  { key: 'verify', label: 'Code' },
  { key: 'password', label: 'New password' },
];

function stepIndex(step: ResetStep): number {
  if (step === 'done') return STEPS.length;
  return Math.max(0, STEPS.findIndex((item) => item.key === step));
}

export default function ForgotPasswordPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const roleHint: UserRole = searchParams.get('role') === 'admin' ? 'admin' : 'student';
  const from = (location.state as { from?: string } | null)?.from;

  const [step, setStep] = useState<ResetStep>('identify');
  const [method, setMethod] = useState<ResetChannel>('email');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<CountryCode>(detectDefaultCountry);
  const [phone, setPhone] = useState('');
  const [ticket, setTicket] = useState<PasswordResetTicket | null>(null);
  const [verification, setVerification] = useState<PasswordResetVerification | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [completed, setCompleted] = useState<CompletedReset | null>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  if (user) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  const backRole = ticket?.role ?? verification?.role ?? roleHint;
  const backState = from ? { from } : undefined;

  const startOver = () => {
    setStep('identify');
    setTicket(null);
    setVerification(null);
    setCode('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setFieldErrors({});
    setFormError('');
    setResendIn(0);
  };

  const applyResetError = (error: unknown) => {
    if (!(error instanceof AuthError)) {
      setFormError('Something went wrong. Please try again.');
      return;
    }
    switch (error.code) {
      case 'invalid_email':
      case 'invalid_phone':
      case 'account_not_found':
        setFieldErrors((previous) => ({ ...previous, contact: error.message }));
        break;
      case 'invalid_otp':
        setFieldErrors((previous) => ({ ...previous, code: error.message }));
        setTicket((previous) =>
          previous
            ? { ...previous, attemptsRemaining: Math.max(0, previous.attemptsRemaining - 1) }
            : previous,
        );
        break;
      case 'reset_attempts_exceeded':
        setFormError(error.message);
        setTicket((previous) =>
          previous ? { ...previous, attemptsRemaining: 0 } : previous,
        );
        break;
      case 'reset_expired':
      case 'reset_not_found':
        startOver();
        setFormError(error.message);
        break;
      case 'weak_password':
        setFieldErrors((previous) => ({ ...previous, password: error.message }));
        break;
      case 'password_mismatch':
        setFieldErrors((previous) => ({ ...previous, confirm: error.message }));
        break;
      case 'reset_not_verified':
        setFormError(error.message);
        break;
      default:
        setFormError(error.message);
    }
  };

  const handleIdentify = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const nextErrors: FieldErrors = {};
    let identifier = '';
    if (method === 'email') {
      if (!isValidEmail(email)) {
        nextErrors.contact = 'Enter the email address on the account you want to recover.';
      } else {
        identifier = normalizeEmail(email);
      }
    } else {
      const normalized = toE164(phone, country);
      if (!normalized) {
        nextErrors.contact = 'Enter a valid phone number for the selected country.';
      } else {
        identifier = normalized;
      }
    }

    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const nextTicket = await requestPasswordReset({
        identifier,
        channel: method,
        country,
      });
      setTicket(nextTicket);
      setVerification(null);
      setCode('');
      setPassword('');
      setConfirmPassword('');
      setStep('verify');
      setResendIn(RESET_RESEND_COOLDOWN_SECONDS);
      notify('Recovery code prepared on this screen.', 'info');
    } catch (error) {
      applyResetError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !ticket) return;

    const digits = code.replace(/\D/g, '');
    if (digits.length !== 6) {
      setFieldErrors({ code: 'Enter all six digits of the one-time code.' });
      return;
    }

    setFieldErrors({});
    setFormError('');
    setBusy(true);
    try {
      const verified = await verifyPasswordResetCode(ticket.challengeId, digits);
      setVerification(verified);
      setStep('password');
      setPassword('');
      setConfirmPassword('');
      notify('Code verified. Choose a new password.');
    } catch (error) {
      applyResetError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleResend = async () => {
    if (busy || !ticket) return;
    setBusy(true);
    try {
      const nextTicket = await resendPasswordResetCode(ticket.challengeId);
      setTicket(nextTicket);
      setVerification(null);
      setCode('');
      setFieldErrors({});
      setFormError('');
      setResendIn(RESET_RESEND_COOLDOWN_SECONDS);
      notify('A fresh recovery code is ready on this screen.', 'info');
    } catch (error) {
      applyResetError(error);
    } finally {
      setBusy(false);
    }
  };

  const handlePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !ticket) return;

    const nextErrors: FieldErrors = {};
    const issue = getPasswordIssue(password);
    if (issue) {
      nextErrors.password = issue;
    } else if (password !== confirmPassword) {
      nextErrors.confirm = 'The two passwords do not match.';
    }
    setFieldErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const account = await completePasswordReset({
        challengeId: ticket.challengeId,
        password,
        confirmPassword,
      });
      setCompleted({ name: account.name, role: account.role, identifier: account.email });
      setStep('done');
      setPassword('');
      setConfirmPassword('');
      notify('Password updated. Sign in with your new password.');
    } catch (error) {
      applyResetError(error);
    } finally {
      setBusy(false);
    }
  };

  const copyDemoCode = async () => {
    if (!ticket) return;
    try {
      await navigator.clipboard.writeText(ticket.demoCode);
      notify('Recovery code copied.', 'info');
    } catch {
      notify('Select the code shown in the card to copy it.', 'error');
    }
  };

  const activeIndex = stepIndex(step);
  const headline =
    step === 'identify'
      ? 'Recover your account.'
      : step === 'verify'
        ? 'Enter the one-time code.'
        : step === 'password'
          ? 'Choose a new password.'
          : 'Password updated.';
  const subhead =
    step === 'identify'
      ? 'Use the Gmail address or any-country phone number saved on your administrator, teacher or student profile.'
      : step === 'verify'
        ? `A one-time code was prepared for ${ticket?.maskedDestination ?? 'your account'}. It replaces the old password once verified.`
        : step === 'password'
          ? `This changes the password for ${verification?.accountName ?? 'your account'}. The old password stops working immediately.`
          : 'The old password no longer works. Sign in again with the new one.';

  return (
    <div className="auth-page">
      <header className="auth-nav">
        <Brand />
        <div className="auth-nav-right">
          <Link
            to={`/login?role=${backRole}`}
            state={backState}
            className="auth-back-link"
          >
            <ArrowLeft size={15} />
            Back to sign in
          </Link>
          <span className="auth-credit-divider" aria-hidden="true" />
          <DeveloperCredit className="auth-credit" />
        </div>
      </header>

      <main className="auth-layout">
        <section className="auth-story">
          <p className="eyebrow">
            <span className="eyebrow-rule" />
            Account recovery
          </p>
          <h1>
            Lost the key.
            <br />
            <em>Not the paper.</em>
          </h1>
          <p className="auth-lede">
            Recover an administrator / teacher or student account with the email or phone number
            saved on it. A fresh password keeps every paper and mark under the right name.
          </p>

          <div className="recovery-points">
            <article className="recovery-point">
              <span className="recovery-point-icon">
                <Mail size={17} />
              </span>
              <div>
                <strong>Email or any-country phone</strong>
                <p>Use the same contact saved when the profile was created.</p>
              </div>
            </article>
            <article className="recovery-point">
              <span className="recovery-point-icon">
                <KeyRound size={17} />
              </span>
              <div>
                <strong>Six-digit, single-use code</strong>
                <p>Five tries, {RESET_CODE_TTL_MINUTES} minutes, then a fresh code is needed.</p>
              </div>
            </article>
            <article className="recovery-point">
              <span className="recovery-point-icon">
                <LockKeyhole size={17} />
              </span>
              <div>
                <strong>PBKDF2-protected replacement</strong>
                <p>The new password is salted and hashed, never stored as plain text.</p>
              </div>
            </article>
          </div>

          <p className="auth-contact-line">
            <ShieldCheck size={14} />
            Works for administrator, teacher and student accounts.
          </p>
        </section>

        <section className="auth-panel" aria-label="Password recovery">
          <div className="auth-card auth-card--recovery">
            <div className="auth-card-head">
              <span className="auth-card-kicker">
                <KeyRound size={13} />
                Account recovery
              </span>
              <h2>{headline}</h2>
              <p>{subhead}</p>
            </div>

            {step !== 'done' && (
              <ol className="reset-steps" aria-label="Recovery progress">
                {STEPS.map((item, index) => {
                  const state =
                    index < activeIndex ? 'is-complete' : index === activeIndex ? 'is-active' : '';
                  return (
                    <li className={`reset-step ${state}`.trim()} key={item.key}>
                      <span className="reset-step-index">
                        {index < activeIndex ? <Check size={11} /> : index + 1}
                      </span>
                      <span className="reset-step-label">{item.label}</span>
                    </li>
                  );
                })}
              </ol>
            )}

            {formError && (
              <div className="auth-alert" role="alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {step === 'identify' && (
              <form className="auth-form" onSubmit={handleIdentify} noValidate aria-busy={busy}>
                <div className="auth-method-switch" role="tablist" aria-label="Recovery contact method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={method === 'email'}
                    className={method === 'email' ? 'is-active' : ''}
                    onClick={() => {
                      setMethod('email');
                      setFieldErrors({});
                      setFormError('');
                    }}
                  >
                    <Mail size={15} />
                    Email
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={method === 'phone'}
                    className={method === 'phone' ? 'is-active' : ''}
                    onClick={() => {
                      setMethod('phone');
                      setFieldErrors({});
                      setFormError('');
                    }}
                  >
                    <Phone size={15} />
                    Phone
                  </button>
                </div>

                {method === 'email' ? (
                  <div className={`field auth-field${fieldErrors.contact ? ' has-error' : ''}`}>
                    <label className="field-label" htmlFor="reset-email">
                      Account email
                      <span className="optional-label">gmail works</span>
                    </label>
                    <div className="input-shell">
                      <Mail size={16} />
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        maxLength={120}
                        placeholder="you@gmail.com"
                        aria-invalid={Boolean(fieldErrors.contact)}
                        aria-describedby={fieldErrors.contact ? 'reset-contact-error' : 'reset-contact-hint'}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setFieldErrors((previous) => ({ ...previous, contact: undefined }));
                          setFormError('');
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <PhoneField
                    id="reset-phone"
                    label="Account phone"
                    country={country}
                    phone={phone}
                    error={fieldErrors.contact}
                    hint="Choose the country used when this account was created."
                    onCountryChange={(nextCountry) => {
                      setCountry(nextCountry);
                      setFieldErrors((previous) => ({ ...previous, contact: undefined }));
                      setFormError('');
                    }}
                    onPhoneChange={(nextPhone) => {
                      setPhone(nextPhone);
                      setFieldErrors((previous) => ({ ...previous, contact: undefined }));
                      setFormError('');
                    }}
                  />
                )}

                {method === 'email' &&
                  (fieldErrors.contact ? (
                    <span className="field-error" id="reset-contact-error">
                      {fieldErrors.contact}
                    </span>
                  ) : (
                    <span className="field-hint" id="reset-contact-hint">
                      The account must already exist in this browser workspace.
                    </span>
                  ))}

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg auth-submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Preparing code…
                    </>
                  ) : (
                    <>
                      <KeyRound size={17} />
                      Send one-time code
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <p className="auth-switch-note">
                  Remembered it?{' '}
                  <Link to={`/login?role=${roleHint}`} state={backState}>
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}

            {step === 'verify' && ticket && (
              <form className="auth-form" onSubmit={handleVerify} noValidate aria-busy={busy}>
                <div className="otp-demo-card" role="status">
                  <div className="otp-demo-head">
                    <span className="otp-demo-label">
                      <Sparkles size={14} />
                      Recovery code
                    </span>
                    <span className="otp-demo-channel">
                      {ticket.channel === 'email' ? <Mail size={13} /> : <Phone size={13} />}
                      {ticket.maskedDestination}
                    </span>
                  </div>
                  <p>
                    No email or SMS was sent. This browser displays the one-time code:
                  </p>
                  <div className="otp-code-line">
                    <strong className="otp-code" aria-label={`One-time recovery code ${ticket.demoCode}`}>
                      {ticket.demoCode}
                    </strong>
                    <button type="button" className="otp-copy" onClick={copyDemoCode}>
                      <Copy size={14} />
                      Copy
                    </button>
                  </div>
                  <span className="otp-expiry">
                    {ticket.accountName} ·{' '}
                    {ticket.role === 'admin' ? 'administrator / teacher' : 'student'} · valid for{' '}
                    {RESET_CODE_TTL_MINUTES} minutes
                  </span>
                </div>

                <div className={`field auth-field${fieldErrors.code ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="reset-code">
                    One-time code
                    <span className="optional-label">6 digits</span>
                  </label>
                  <input
                    id="reset-code"
                    className="otp-input"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    maxLength={6}
                    placeholder="000000"
                    aria-invalid={Boolean(fieldErrors.code)}
                    aria-describedby={fieldErrors.code ? 'reset-code-error' : 'reset-code-hint'}
                    onChange={(event) => {
                      setCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                      setFieldErrors((previous) => ({ ...previous, code: undefined }));
                      setFormError('');
                    }}
                  />
                  {fieldErrors.code ? (
                    <span className="field-error" id="reset-code-error">
                      {fieldErrors.code}
                    </span>
                  ) : (
                    <span className="field-hint" id="reset-code-hint">
                      {ticket.attemptsRemaining} of 5 attempts remain for this code.
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg auth-submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Checking code…
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={17} />
                      Verify code
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>

                <div className="otp-resend-row">
                  <span className="otp-resend-copy">Need a fresh code?</span>
                  <button
                    type="button"
                    className="otp-resend"
                    onClick={handleResend}
                    disabled={
                      busy || (resendIn > 0 && ticket.attemptsRemaining > 0)
                    }
                  >
                    <RefreshCw size={12} />
                    {resendIn > 0 && ticket.attemptsRemaining > 0
                      ? `Resend in ${resendIn}s`
                      : 'Resend code'}
                  </button>
                </div>

                <button type="button" className="reset-text-button" onClick={startOver}>
                  Use a different email or phone
                </button>
              </form>
            )}

            {step === 'password' && ticket && (
              <form className="auth-form" onSubmit={handlePassword} noValidate aria-busy={busy}>
                {verification && (
                  <div className="verified-banner">
                    <CheckCircle2 size={16} />
                    <span>
                      Code verified for {verification.maskedDestination}. Set a new password for{' '}
                      {verification.accountName}.
                    </span>
                  </div>
                )}

                <div className={`field auth-field${fieldErrors.password ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="reset-password">
                    New password
                  </label>
                  <div className="input-shell has-toggle">
                    <LockKeyhole size={16} />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      maxLength={128}
                      placeholder="At least 8 characters"
                      aria-invalid={Boolean(fieldErrors.password)}
                      aria-describedby={
                        fieldErrors.password ? 'reset-password-error' : 'reset-password-meter'
                      }
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setFieldErrors((previous) => ({ ...previous, password: undefined }));
                        setFormError('');
                      }}
                    />
                    <button
                      type="button"
                      className="input-toggle"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {fieldErrors.password ? (
                    <span className="field-error" id="reset-password-error">
                      {fieldErrors.password}
                    </span>
                  ) : (
                    <div id="reset-password-meter">
                      <PasswordMeter password={password} />
                    </div>
                  )}
                </div>

                <div className={`field auth-field${fieldErrors.confirm ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="reset-confirm">
                    Confirm new password
                  </label>
                  <div className="input-shell">
                    <LockKeyhole size={16} />
                    <input
                      id="reset-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      maxLength={128}
                      placeholder="Type it again"
                      aria-invalid={Boolean(fieldErrors.confirm)}
                      aria-describedby={fieldErrors.confirm ? 'reset-confirm-error' : undefined}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setFieldErrors((previous) => ({ ...previous, confirm: undefined }));
                        setFormError('');
                      }}
                    />
                  </div>
                  {fieldErrors.confirm && (
                    <span className="field-error" id="reset-confirm-error">
                      {fieldErrors.confirm}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg auth-submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Saving new password…
                    </>
                  ) : (
                    <>
                      <LockKeyhole size={17} />
                      Save new password
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            {step === 'done' && completed && (
              <div className="reset-success">
                <span className="reset-success-icon">
                  <CheckCircle2 size={29} />
                </span>
                <h3>You can sign in again.</h3>
                <p>
                  The password for <strong>{completed.name}</strong> was updated. Use the new
                  password with your {completed.role === 'admin' ? 'administrator / teacher' : 'student'}{' '}
                  account.
                </p>
                <div className="reset-success-actions">
                  <Link
                    to={`/login?role=${completed.role}`}
                    state={{
                      ...(from ? { from } : {}),
                      prefillIdentifier: completed.identifier,
                    }}
                    className="btn btn-primary btn-block btn-lg"
                  >
                    <KeyRound size={17} />
                    Sign in with the new password
                    <ArrowRight size={17} />
                  </Link>
                  <Link to="/" className="btn btn-secondary btn-block">
                    Back to SmartQuiz home
                  </Link>
                </div>
              </div>
            )}
          </div>

          <p className="auth-demo-note">
            <LockKeyhole size={15} />
            <span>
              <strong>Recovery code.</strong> No email or SMS is sent and the code is shown on
              this screen, so it cannot prove ownership of the contact. A public deployment needs a
              backend and an email or SMS provider. The reset itself stays in this browser.
            </span>
          </p>
        </section>
      </main>

      <footer className="auth-footer">
        <span>SmartQuiz · account recovery</span>
        <span>Administrator, teacher and student accounts</span>
      </footer>
    </div>
  );
}
