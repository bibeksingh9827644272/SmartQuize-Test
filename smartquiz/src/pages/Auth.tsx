import { useEffect, useState, type FormEvent } from 'react';
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { Brand } from '../components/Brand';
import { DeveloperCredit } from '../components/DeveloperCredit';
import { InstallButton } from '../components/InstallApp';
import { PasswordMeter, PhoneField } from '../components/AuthFields';
import { useToast } from '../components/Toast';
import { useAuth } from '../data/auth';
import {
  AuthError,
  detectDefaultCountry,
  getPasswordIssue,
  isValidEmail,
  normalizeEmail,
  roleHome,
  toE164,
  type CountryCode,
  type UserRole,
} from '../lib/auth';

type AuthMode = 'signin' | 'register';
type SignInMethod = 'email' | 'phone';
type FieldKey = 'name' | 'email' | 'phone' | 'password' | 'confirm';
type FormErrors = Partial<Record<FieldKey, string>>;

interface AuthPageProps {
  initialMode?: AuthMode;
}

export default function AuthPage({ initialMode = 'signin' }: AuthPageProps) {
  const { user, hasAdmin, login, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { notify } = useToast();

  const requestedRole = searchParams.get('role');
  const initialRole: UserRole = requestedRole === 'admin' ? 'admin' : 'student';
  const [role, setRole] = useState<UserRole>(initialRole);
  const [method, setMethod] = useState<SignInMethod>('email');
  const [signInEmail, setSignInEmail] = useState('');
  const [signInCountry, setSignInCountry] = useState<CountryCode>(detectDefaultCountry);
  const [signInPhone, setSignInPhone] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState<CountryCode>(detectDefaultCountry);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const mode: AuthMode = initialMode;
  const isRegister = mode === 'register';
  const adminBlocked = isRegister && role === 'admin' && hasAdmin;
  const locationState = location.state;
  const from = (locationState as { from?: string } | null)?.from;

  useEffect(() => {
    if (requestedRole === 'admin' || requestedRole === 'student') {
      setRole(requestedRole);
    }
  }, [requestedRole]);

  useEffect(() => {
    setErrors({});
    setFormError('');
    setSignInEmail('');
    setSignInPhone('');
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  }, [mode, role]);

  useEffect(() => {
    const prefill = (location.state as { prefillIdentifier?: string } | null)?.prefillIdentifier;
    if (!prefill) return;
    if (prefill.includes('@')) {
      setMethod('email');
      setSignInEmail(prefill);
    } else {
      setMethod('phone');
      setSignInPhone(prefill);
    }
  }, [location.state]);

  useEffect(() => {
    setFormError('');
  }, [signInEmail, signInPhone, name, email, phone, password, confirmPassword]);

  const goHomeFor = (nextRole: UserRole): string => {
    const base = roleHome(nextRole);
    if (
      from &&
      (from === base || from.startsWith(`${base}/`) || from.startsWith(`${base}?`))
    ) {
      return from;
    }
    return base;
  };

  if (user) {
    return <Navigate to={goHomeFor(user.role)} replace />;
  }

  const selectRole = (nextRole: UserRole) => {
    if (nextRole === role) return;
    setRole(nextRole);
    navigate(`${isRegister ? '/register' : '/login'}?role=${nextRole}`, {
      replace: true,
      state: locationState,
    });
  };

  const applyAuthError = (error: unknown) => {
    if (!(error instanceof AuthError)) {
      setFormError('Something went wrong. Please try again.');
      return;
    }
    switch (error.code) {
      case 'invalid_name':
        setErrors((previous) => ({ ...previous, name: error.message }));
        break;
      case 'invalid_email':
      case 'duplicate_email':
        setErrors((previous) => ({ ...previous, email: error.message }));
        break;
      case 'invalid_phone':
      case 'duplicate_phone':
        setErrors((previous) => ({ ...previous, phone: error.message }));
        break;
      case 'weak_password':
        setErrors((previous) => ({ ...previous, password: error.message }));
        break;
      case 'password_mismatch':
        setErrors((previous) => ({ ...previous, confirm: error.message }));
        break;
      default:
        setFormError(error.message);
    }
  };

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;

    const nextErrors: FormErrors = {};
    let identifier = '';

    if (method === 'email') {
      if (!isValidEmail(signInEmail)) {
        nextErrors.email = 'Enter the email address on your account.';
      } else {
        identifier = normalizeEmail(signInEmail);
      }
    } else {
      const normalized = toE164(signInPhone, signInCountry);
      if (!normalized) {
        nextErrors.phone = 'Enter a valid phone number for the selected country.';
      } else {
        identifier = normalized;
      }
    }
    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const account = await login({ identifier, password });
      if (account.role === role) {
        notify(`Welcome back, ${account.name.split(' ')[0]}.`);
      } else {
        notify(
          `Signed in as a ${account.role} account. Opening your ${
            account.role === 'admin' ? 'admin studio' : 'exam hall'
          }.`,
          'info',
        );
      }
      navigate(goHomeFor(account.role), { replace: true });
    } catch (error) {
      applyAuthError(error);
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || adminBlocked) return;

    const nextErrors: FormErrors = {};
    if (name.trim().length < 2) {
      nextErrors.name = 'Enter your full name.';
    }
    if (!isValidEmail(email)) {
      nextErrors.email = 'Enter a valid email address, such as you@gmail.com.';
    }
    if (!toE164(phone, country)) {
      nextErrors.phone = 'Enter a valid phone number for the selected country.';
    }
    const passwordIssue = getPasswordIssue(password);
    if (passwordIssue) {
      nextErrors.password = passwordIssue;
    } else if (password !== confirmPassword) {
      nextErrors.confirm = 'The two passwords do not match.';
    }

    setErrors(nextErrors);
    setFormError('');
    if (Object.keys(nextErrors).length > 0) return;

    setBusy(true);
    try {
      const account = await register({
        name,
        email,
        phone,
        country,
        role,
        password,
        confirmPassword,
      });
      notify(
        account.role === 'admin'
          ? 'Administrator registered. Welcome to the studio.'
          : 'Student account created. Your exam hall is ready.',
      );
      navigate(goHomeFor(account.role), { replace: true });
    } catch (error) {
      applyAuthError(error);
    } finally {
      setBusy(false);
    }
  };

  const RoleIcon = role === 'admin' ? LayoutDashboard : GraduationCap;
  const signInEmailDescribedBy = errors.email
    ? 'signin-email-error'
    : 'signin-email-hint';
  const passwordErrorDescribedBy = errors.password
    ? 'auth-password-error'
    : undefined;

  return (
    <div className="auth-page">
      <header className="auth-nav">
        <Brand />
        <div className="auth-nav-right">
          <Link to="/" className="auth-back-link">
            <ArrowLeft size={15} />
            Back to home
          </Link>
          <InstallButton />
          <span className="auth-credit-divider" aria-hidden="true" />
          <DeveloperCredit className="auth-credit" />
        </div>
      </header>

      <main className="auth-layout">
        <section className="auth-story">
          <p className="eyebrow">
            <span className="eyebrow-rule" />
            SmartQuiz accounts
          </p>
          <h1>
            One studio.
            <br />
            <em>Two doors.</em>
          </h1>
          <p className="auth-lede">
            Sign in as a teacher or examiner to build and publish papers, or as a student to sit a
            timed exam. Accounts and the workspace stay together in this browser.
          </p>

          <div className="auth-story-cards">
            <article className={`auth-story-card${role === 'admin' ? ' is-current' : ''}`}>
              <span className="auth-story-icon">
                <LayoutDashboard size={19} />
              </span>
              <strong>Teacher / examiner</strong>
              <p>Build a paper, publish a code, and review every attempt.</p>
            </article>
            <article className={`auth-story-card${role === 'student' ? ' is-current' : ''}`}>
              <span className="auth-story-icon">
                <GraduationCap size={19} />
              </span>
              <strong>Student</strong>
              <p>Join with a code, sit the timer, and keep your marked paper.</p>
            </article>
          </div>

          <div className="auth-workspace-status">
            <span className={`local-dot${hasAdmin ? '' : ' is-amber'}`} aria-hidden="true" />
            <div>
              <strong>
                {hasAdmin
                  ? 'Workspace administrator ready'
                  : 'Workspace waiting for its administrator'}
              </strong>
              <span>
                {hasAdmin
                  ? 'Students can join published exams in this browser.'
                  : 'Create the administrator account before publishing papers.'}
              </span>
            </div>
          </div>

          <p className="auth-contact-line">
            <ShieldCheck size={14} />
            Sign in with a Gmail address or an international phone number.
          </p>
        </section>

        <section className="auth-panel" aria-label="Account access">
          <div className="auth-card">
            <div className="auth-card-head">
              <span className="auth-card-kicker">
                <LockKeyhole size={13} />
                Local sign-in
              </span>
              <h2>
                {isRegister
                  ? role === 'admin'
                    ? 'Set up the studio.'
                    : 'Join the exam hall.'
                  : 'Welcome back.'}
              </h2>
              <p>
                {isRegister
                  ? role === 'admin'
                    ? 'This teacher-examiner account will own the studio: papers, publish codes, and results.'
                    : 'One student account keeps your attempts and marks under your name.'
                  : role === 'admin'
                    ? 'Use the email or phone number on the teacher / administrator account.'
                    : 'Use the email or phone number you registered with.'}
              </p>
            </div>

            <div className="auth-tabs" role="tablist" aria-label="Account action">
              <Link
                to={`/login?role=${role}`}
                state={locationState}
                role="tab"
                aria-selected={!isRegister}
                className={`auth-tab${!isRegister ? ' is-active' : ''}`}
              >
                Sign in
              </Link>
              <Link
                to={`/register?role=${role}`}
                state={locationState}
                role="tab"
                aria-selected={isRegister}
                className={`auth-tab${isRegister ? ' is-active' : ''}`}
              >
                Create account
              </Link>
            </div>

            <div className="auth-roles" aria-label="Choose your side">
              <button
                type="button"
                className={`auth-role${role === 'student' ? ' is-active' : ''}`}
                aria-pressed={role === 'student'}
                onClick={() => selectRole('student')}
              >
                <span className="auth-role-icon">
                  <GraduationCap size={18} />
                </span>
                <span className="auth-role-copy">
                  <small>Student side</small>
                  <strong>Student</strong>
                  <span>Join timed exams</span>
                </span>
                <span className="auth-role-check" aria-hidden="true">
                  {role === 'student' ? <Check size={13} /> : null}
                </span>
              </button>
              <button
                type="button"
                className={`auth-role${role === 'admin' ? ' is-active' : ''}`}
                aria-pressed={role === 'admin'}
                onClick={() => selectRole('admin')}
              >
                <span className="auth-role-icon">
                  <LayoutDashboard size={18} />
                </span>
                <span className="auth-role-copy">
                  <small>Teacher / examiner side</small>
                  <strong>Teacher / Examiner</strong>
                  <span>{hasAdmin ? 'Administrator studio' : 'Set up the studio'}</span>
                </span>
                <span className="auth-role-check" aria-hidden="true">
                  {role === 'admin' ? <Check size={13} /> : null}
                </span>
              </button>
            </div>

            {formError && (
              <div className="auth-alert" role="alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {adminBlocked && (
              <div className="auth-notice" role="status">
                <LockKeyhole size={17} />
                <div>
                  <strong>Administrator already set up</strong>
                  <p>
                    This browser workspace has one workspace owner. Sign in with that account,
                    or switch to a student account.
                  </p>
                  <Link to={`/login?role=admin`} state={locationState} className="auth-inline-link">
                    Go to administrator sign-in
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}

            {!hasAdmin && role === 'admin' && !isRegister && (
              <div className="auth-notice auth-notice--setup" role="status">
                <Sparkles size={17} />
                <div>
                  <strong>First time in this workspace?</strong>
                  <p>
                    No administrator is registered yet. Claim the studio before students can sit
                    exams.
                  </p>
                  <Link
                    to={`/register?role=admin`}
                    state={locationState}
                    className="auth-inline-link"
                  >
                    Create the administrator account
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            )}

            {isRegister ? (
              <form className="auth-form" onSubmit={handleRegister} noValidate aria-busy={busy}>
                <div className={`field auth-field${errors.name ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="register-name">
                    Full name
                  </label>
                  <div className="input-shell">
                    <UserRound size={16} />
                    <input
                      id="register-name"
                      type="text"
                      autoComplete="name"
                      value={name}
                      maxLength={60}
                      placeholder="e.g. Anika Sharma"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? 'register-name-error' : undefined}
                      onChange={(event) => {
                        setName(event.target.value);
                        setErrors((previous) => ({ ...previous, name: undefined }));
                      }}
                    />
                  </div>
                  {errors.name && (
                    <span className="field-error" id="register-name-error">
                      {errors.name}
                    </span>
                  )}
                </div>

                <div className={`field auth-field${errors.email ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="register-email">
                    Email address
                    <span className="optional-label">gmail works</span>
                  </label>
                  <div className="input-shell">
                    <Mail size={16} />
                    <input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      maxLength={120}
                      placeholder="you@gmail.com"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? 'register-email-error' : 'register-email-hint'}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        setErrors((previous) => ({ ...previous, email: undefined }));
                      }}
                    />
                  </div>
                  {errors.email ? (
                    <span className="field-error" id="register-email-error">
                      {errors.email}
                    </span>
                  ) : (
                    <span className="field-hint" id="register-email-hint">
                      No verification email is sent in this browser-only build.
                    </span>
                  )}
                </div>

                <PhoneField
                  id="register-phone"
                  label="Phone number"
                  hint="Used to sign in. No SMS is sent; the account stays in this browser."
                  error={errors.phone}
                  country={country}
                  phone={phone}
                  onCountryChange={(nextCountry) => {
                    setCountry(nextCountry);
                    setErrors((previous) => ({ ...previous, phone: undefined }));
                  }}
                  onPhoneChange={(nextPhone) => {
                    setPhone(nextPhone);
                    setErrors((previous) => ({ ...previous, phone: undefined }));
                  }}
                />

                <div className={`field auth-field${errors.password ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="register-password">
                    Password
                  </label>
                  <div className="input-shell has-toggle">
                    <LockKeyhole size={16} />
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={password}
                      maxLength={128}
                      placeholder="At least 8 characters"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password ? 'register-password-error' : 'password-meter-note'
                      }
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((previous) => ({ ...previous, password: undefined }));
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
                  {errors.password ? (
                    <span className="field-error" id="register-password-error">
                      {errors.password}
                    </span>
                  ) : (
                    <div id="password-meter-note">
                      <PasswordMeter password={password} />
                    </div>
                  )}
                </div>

                <div className={`field auth-field${errors.confirm ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="register-confirm">
                    Confirm password
                  </label>
                  <div className="input-shell">
                    <LockKeyhole size={16} />
                    <input
                      id="register-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirmPassword}
                      maxLength={128}
                      placeholder="Type it again"
                      aria-invalid={Boolean(errors.confirm)}
                      aria-describedby={errors.confirm ? 'register-confirm-error' : undefined}
                      onChange={(event) => {
                        setConfirmPassword(event.target.value);
                        setErrors((previous) => ({ ...previous, confirm: undefined }));
                      }}
                    />
                  </div>
                  {errors.confirm && (
                    <span className="field-error" id="register-confirm-error">
                      {errors.confirm}
                    </span>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg auth-submit"
                  disabled={busy || adminBlocked}
                >
                  {busy ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      <RoleIcon size={17} />
                      Create {role === 'admin' ? 'administrator' : 'student'} account
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleSignIn} noValidate aria-busy={busy}>
                <div className="auth-method-switch" role="tablist" aria-label="Sign-in method">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={method === 'email'}
                    className={method === 'email' ? 'is-active' : ''}
                    onClick={() => {
                      setMethod('email');
                      setErrors({});
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
                      setErrors({});
                      setFormError('');
                    }}
                  >
                    <Phone size={15} />
                    Phone
                  </button>
                </div>

                {method === 'email' ? (
                  <div className={`field auth-field${errors.email ? ' has-error' : ''}`}>
                    <label className="field-label" htmlFor="signin-email">
                      Email address
                      <span className="optional-label">gmail works</span>
                    </label>
                    <div className="input-shell">
                      <Mail size={16} />
                      <input
                        id="signin-email"
                        type="email"
                        autoComplete="email"
                        value={signInEmail}
                        maxLength={120}
                        placeholder="you@gmail.com"
                        aria-invalid={Boolean(errors.email)}
                        aria-describedby={signInEmailDescribedBy}
                        onChange={(event) => {
                          setSignInEmail(event.target.value);
                          setErrors((previous) => ({ ...previous, email: undefined }));
                        }}
                      />
                    </div>
                    {errors.email ? (
                      <span className="field-error" id="signin-email-error">
                        {errors.email}
                      </span>
                    ) : (
                      <span className="field-hint" id="signin-email-hint">
                        Use the email on your account.
                      </span>
                    )}
                  </div>
                ) : (
                  <PhoneField
                    id="signin-phone"
                    label="Phone number"
                    hint="Choose your country, then the national number you registered."
                    error={errors.phone}
                    country={signInCountry}
                    phone={signInPhone}
                    onCountryChange={(nextCountry) => {
                      setSignInCountry(nextCountry);
                      setErrors((previous) => ({ ...previous, phone: undefined }));
                    }}
                    onPhoneChange={(nextPhone) => {
                      setSignInPhone(nextPhone);
                      setErrors((previous) => ({ ...previous, phone: undefined }));
                    }}
                  />
                )}

                <div className={`field auth-field${errors.password ? ' has-error' : ''}`}>
                  <label className="field-label" htmlFor="signin-password">
                    Password
                  </label>
                  <div className="input-shell has-toggle">
                    <LockKeyhole size={16} />
                    <input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      maxLength={128}
                      placeholder="Your account password"
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={passwordErrorDescribedBy}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setErrors((previous) => ({ ...previous, password: undefined }));
                      }}
                    />
                    <button
                      type="button"
                      className="input-toggle"
                      onClick={() => setShowPassword((previous) => !previous)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="field-error" id="auth-password-error">
                      {errors.password}
                    </span>
                  )}
                </div>

                <div className="auth-forgot-row">
                  <Link
                    to={`/forgot-password?role=${role}`}
                    state={locationState}
                    className="auth-forgot-link"
                  >
                    <KeyRound size={13} />
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-block btn-lg auth-submit"
                  disabled={busy}
                >
                  {busy ? (
                    <>
                      <span className="auth-spinner" aria-hidden="true" />
                      Checking details…
                    </>
                  ) : (
                    <>
                      Sign in to {role === 'admin' ? 'the studio' : 'the exam hall'}
                      <ArrowRight size={17} />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="auth-switch-note">
              {isRegister ? 'Already have an account?' : 'New to SmartQuiz?'}{' '}
              <Link
                to={`${isRegister ? '/login' : '/register'}?role=${role}`}
                state={locationState}
              >
                {isRegister ? 'Sign in instead' : 'Create an account'}
              </Link>
            </p>
          </div>

          <p className="auth-demo-note">
            <LockKeyhole size={15} />
            <span>
              <strong>Browser-local security.</strong> Passwords are salted and hashed with PBKDF2
              in this browser. Email and phone are validated, not verified; no emails or SMS are
              sent. Password recovery uses a one-time code shown on screen. Use a password you do
              not reuse elsewhere.
            </span>
          </p>
        </section>
      </main>

      <footer className="auth-footer">
        <span>SmartQuiz · local exam studio</span>
        <span>Accounts, exams and marks stay in this browser.</span>
      </footer>
    </div>
  );
}
