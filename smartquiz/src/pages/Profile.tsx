import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  FileStack,
  IdCard,
  ImagePlus,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  Trophy,
  Users,
} from 'lucide-react';
import { useAppStore } from '../data/store';
import { useAuth } from '../data/auth';
import { useToast } from '../components/Toast';
import { UserAvatar } from '../components/UserAvatar';
import { createAvatarDataUrl } from '../lib/image';
import {
  formatDate,
  formatDateTime,
  formatPercent,
  formatRelative,
} from '../lib/format';

export default function ProfilePage() {
  const { user, accounts, updateProfile } = useAuth();
  const { exams, attempts, activeAttempts } = useAppStore();
  const { notify } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [avatar, setAvatar] = useState<string | null>(user?.avatar ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReadingPhoto, setIsReadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState('');

  useEffect(() => {
    setName(user?.name ?? '');
    setAvatar(user?.avatar ?? null);
    setPhotoError('');
  }, [user?.id, user?.name, user?.avatar]);

  if (!user) return null;

  const isStudent = user.role === 'student';
  const myAttempts = attempts.filter((attempt) => attempt.studentId === user.id);
  const myActive = activeAttempts.filter((attempt) => attempt.studentId === user.id);
  const studentAccounts = accounts.filter((account) => account.role === 'student');
  const publishedExams = exams.filter((exam) => exam.status === 'published');
  const averageScore =
    myAttempts.length > 0
      ? Math.round(
          myAttempts.reduce((sum, attempt) => sum + attempt.percent, 0) / myAttempts.length,
        )
      : null;
  const bestScore =
    myAttempts.length > 0 ? Math.max(...myAttempts.map((attempt) => attempt.percent)) : null;
  const passedCount = myAttempts.filter((attempt) => attempt.passed).length;
  const recentResults = [...myAttempts]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 4);
  const workspaceAverage =
    attempts.length > 0
      ? Math.round(attempts.reduce((sum, attempt) => sum + attempt.percent, 0) / attempts.length)
      : null;

  const dirty =
    name.trim() !== user.name || (avatar ?? null) !== (user.avatar ?? null);

  const openPhotoPicker = () => {
    if (isReadingPhoto) return;
    fileInputRef.current?.click();
  };

  const handlePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setIsReadingPhoto(true);
    setPhotoError('');
    try {
      const dataUrl = await createAvatarDataUrl(file);
      setAvatar(dataUrl);
      notify('Photo ready. Save your profile to apply it.', 'info');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'That image could not be read.';
      setPhotoError(message);
      notify(message, 'error');
    } finally {
      setIsReadingPhoto(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateProfile({ name, avatar });
      notify('Profile saved. Your details are up to date.');
    } catch (error) {
      notify(
        error instanceof Error ? error.message : 'The profile could not be saved.',
        'error',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const resetChanges = () => {
    setName(user.name);
    setAvatar(user.avatar);
    setPhotoError('');
  };

  return (
    <div className="page profile-page">
      <header className="page-head profile-head">
        <div>
          <p className="eyebrow">Your account · this browser</p>
          <h1>Profile &amp; {isStudent ? 'student ID' : 'examiner ID'}</h1>
          <p className="page-lede">
            Your roll number is issued by SmartQuiz. Update your photo and display name whenever
            you like — login details stay fixed.
          </p>
        </div>
        <span className="profile-role-pill">
          <ShieldCheck size={16} />
          {isStudent ? 'Authorised student' : 'Authorised examiner'}
        </span>
      </header>

      <div className="profile-layout">
        <section className="profile-id-card" aria-label="SmartQuiz identity card">
          <div className="profile-id-top">
            <span className="profile-id-mark">
              <IdCard size={17} />
              SmartQuiz ID
            </span>
            <span className="profile-id-role">{isStudent ? 'Student' : 'Examiner'}</span>
          </div>

          <div className="profile-id-body">
            <button
              type="button"
              className="profile-avatar-button"
              onClick={openPhotoPicker}
              aria-label="Upload a profile photo"
              title="Upload a profile photo"
            >
              <UserAvatar name={user.name} avatar={avatar} className="profile-avatar" />
              <span className="profile-avatar-camera">
                <Camera size={14} />
              </span>
            </button>
            <div className="profile-id-copy">
              <p className="profile-id-label">Roll number</p>
              <strong className="profile-roll">{user.rollNumber}</strong>
              <h2>{name.trim() || user.name}</h2>
              <span>{user.email}</span>
            </div>
          </div>

          <dl className="profile-id-details">
            <div>
              <dt>Member since</dt>
              <dd>{formatDate(user.createdAt)}</dd>
            </div>
            <div>
              <dt>Last sign-in</dt>
              <dd>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'First session'}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phone}</dd>
            </div>
            <div>
              <dt>Country</dt>
              <dd>{user.country}</dd>
            </div>
          </dl>

          <div className="profile-id-foot">
            <span className="local-dot" />
            Stored in this browser · never sent to a server
          </div>
        </section>

        <section className="panel profile-edit-panel">
          <div className="panel-head profile-panel-head">
            <div>
              <p className="eyebrow">Personal details</p>
              <h2>Edit your profile</h2>
              <p>Only your name and photo can change. Your roll number is permanent.</p>
            </div>
            <span className="profile-photo-state">
              <ImagePlus size={15} />
              {isReadingPhoto
                ? 'Preparing photo…'
                : avatar && avatar !== user.avatar
                  ? 'Photo ready to save'
                  : 'Photo stored locally'}
            </span>
          </div>

          <form className="profile-form" onSubmit={handleSubmit}>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => void handlePhoto(event)}
            />

            <div className="profile-photo-row">
              <UserAvatar name={user.name} avatar={avatar} className="profile-photo-preview" />
              <div className="profile-photo-copy">
                <strong>Profile photo</strong>
                <p>JPG, PNG, WEBP or GIF. SmartQuiz crops it to a square and stores it locally.</p>
                {photoError && <span className="field-error">{photoError}</span>}
                <div className="profile-photo-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={openPhotoPicker}
                    disabled={isReadingPhoto}
                  >
                    <Camera size={15} />
                    {avatar ? 'Change photo' : 'Upload photo'}
                  </button>
                  {avatar && (
                    <button
                      type="button"
                      className="btn btn-quiet btn-sm"
                      onClick={() => setAvatar(null)}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label className="field">
              <span className="field-label">Display name</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your full name"
                maxLength={60}
                autoComplete="name"
              />
            </label>

            <div className="profile-readouts">
              <div>
                <span>
                  <Mail size={14} />
                  Email
                </span>
                <strong>{user.email}</strong>
              </div>
              <div>
                <span>
                  <Phone size={14} />
                  Phone
                </span>
                <strong>{user.phone}</strong>
              </div>
              <div>
                <span>
                  <IdCard size={14} />
                  Roll number
                </span>
                <strong>{user.rollNumber}</strong>
              </div>
              <div>
                <span>
                  <ShieldCheck size={14} />
                  Access
                </span>
                <strong>{isStudent ? 'Student panel' : 'Admin studio'}</strong>
              </div>
            </div>

            <div className="profile-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!dirty || isSaving || isReadingPhoto}
              >
                <Save size={16} />
                {isSaving ? 'Saving…' : 'Save profile'}
              </button>
              <button
                type="button"
                className="btn btn-quiet"
                onClick={resetChanges}
                disabled={!dirty || isSaving}
              >
                Reset changes
              </button>
            </div>
          </form>

          <div className="profile-security-note">
            <ShieldCheck size={17} />
            <p>
              <strong>Sign-in details are locked.</strong> Your email, phone number and password can
              only change through the recovery flow on the sign-in page.
            </p>
          </div>
        </section>
      </div>

      <section className="profile-stats-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">At a glance</p>
            <h2>{isStudent ? 'Your exam record' : 'Your workspace'}</h2>
          </div>
          <span className="section-note">
            <Clock3 size={14} /> Updated live from this browser
          </span>
        </div>

        <div className="stat-grid profile-stat-grid">
          {isStudent ? (
            <>
              <article className="stat-card">
                <span className="stat-icon stat-icon--forest">
                  <BookOpenCheck size={19} />
                </span>
                <p>Exams submitted</p>
                <strong>{myAttempts.length}</strong>
                <span className="stat-meta">
                  {myActive.length > 0
                    ? `${myActive.length} attempt${myActive.length === 1 ? '' : 's'} in progress`
                    : 'All handed in'}
                </span>
              </article>
              <article className="stat-card">
                <span className="stat-icon stat-icon--amber">
                  <Trophy size={19} />
                </span>
                <p>Average score</p>
                <strong>{averageScore === null ? '—' : formatPercent(averageScore)}</strong>
                <span className="stat-meta">
                  Best {bestScore === null ? '—' : formatPercent(bestScore)}
                </span>
              </article>
              <article className="stat-card">
                <span className="stat-icon stat-icon--blue">
                  <CheckCircle2 size={19} />
                </span>
                <p>Papers passed</p>
                <strong>{passedCount}</strong>
                <span className="stat-meta">
                  {myAttempts.length > 0
                    ? `${Math.round((passedCount / myAttempts.length) * 100)}% pass rate`
                    : 'No results yet'}
                </span>
              </article>
              <article className="stat-card">
                <span className="stat-icon stat-icon--rose">
                  <CalendarDays size={19} />
                </span>
                <p>Member since</p>
                <strong className="profile-stat-date">{formatDate(user.createdAt)}</strong>
                <span className="stat-meta">Roll {user.rollNumber}</span>
              </article>
            </>
          ) : (
            <>
              <article className="stat-card">
                <span className="stat-icon stat-icon--forest">
                  <Users size={19} />
                </span>
                <p>Students enrolled</p>
                <strong>{studentAccounts.length}</strong>
                <span className="stat-meta">In this browser workspace</span>
              </article>
              <article className="stat-card">
                <span className="stat-icon stat-icon--amber">
                  <FileStack size={19} />
                </span>
                <p>Question papers</p>
                <strong>{exams.length}</strong>
                <span className="stat-meta">{publishedExams.length} published</span>
              </article>
              <article className="stat-card">
                <span className="stat-icon stat-icon--blue">
                  <BookOpenCheck size={19} />
                </span>
                <p>Submissions</p>
                <strong>{attempts.length}</strong>
                <span className="stat-meta">Across every paper</span>
              </article>
              <article className="stat-card">
                <span className="stat-icon stat-icon--rose">
                  <BarChart3 size={19} />
                </span>
                <p>Average score</p>
                <strong>{workspaceAverage === null ? '—' : formatPercent(workspaceAverage)}</strong>
                <span className="stat-meta">
                  {attempts[0]
                    ? `Latest ${formatRelative(attempts[0].submittedAt)}`
                    : 'No attempts yet'}
                </span>
              </article>
            </>
          )}
        </div>
      </section>

      {isStudent && recentResults.length > 0 && (
        <section className="panel profile-history">
          <div className="panel-head">
            <div>
              <p className="eyebrow">Marked papers</p>
              <h2>Recent results</h2>
            </div>
            <span className="section-note">Signed in as {user.name}</span>
          </div>
          <div className="profile-result-list">
            {recentResults.map((attempt) => (
              <Link
                key={attempt.id}
                to={`/student/result/${attempt.id}`}
                className="profile-result-row"
              >
                <span className={`result-dot${attempt.passed ? ' is-pass' : ' is-fail'}`}>
                  {attempt.passed ? <CheckCircle2 size={17} /> : <BookOpenCheck size={17} />}
                </span>
                <span className="profile-result-copy">
                  <strong>{attempt.examTitle}</strong>
                  <em>
                    {formatDate(attempt.submittedAt)} · {attempt.correctCount}/
                    {attempt.questions.length} correct
                  </em>
                </span>
                <span className={`score-pill ${attempt.passed ? 'is-pass' : 'is-fail'}`}>
                  {attempt.percent}%
                </span>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </section>
      )}

      {!isStudent && (
        <Link to="/admin/students" className="profile-directory-cta">
          <span className="profile-directory-icon">
            <Users size={21} />
          </span>
          <span>
            <strong>See everyone enrolled</strong>
            <em>
              {studentAccounts.length} student{studentAccounts.length === 1 ? '' : 's'} · open the
              enrolled-users directory
            </em>
          </span>
          <ArrowRight size={18} />
        </Link>
      )}
    </div>
  );
}
