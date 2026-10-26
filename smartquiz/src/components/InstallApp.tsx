import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, MonitorDown, Share2, SquarePlus } from 'lucide-react';
import { Modal } from './Modal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALL_EVENT = 'smartquiz:install';
const INSTALLED_EVENT = 'smartquiz:installed';

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function InstallButton({ className = '' }: { className?: string }) {
  const [installed, setInstalled] = useState(isStandalone);
  const { pathname } = useLocation();

  useEffect(() => {
    const onInstalled = () => setInstalled(true);
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const onDisplayMode = () => setInstalled(isStandalone());

    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener(INSTALLED_EVENT, onInstalled);
    displayMode.addEventListener?.('change', onDisplayMode);
    return () => {
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener(INSTALLED_EVENT, onInstalled);
      displayMode.removeEventListener?.('change', onDisplayMode);
    };
  }, []);

  if (installed || pathname.startsWith('/student/exam/')) return null;

  return (
    <button
      type="button"
      className={`install-trigger${className ? ` ${className}` : ''}`}
      onClick={() => window.dispatchEvent(new Event(INSTALL_EVENT))}
      title="Install SmartQuiz as an app"
    >
      <Download size={14} aria-hidden="true" />
      <span>Install app</span>
    </button>
  );
}

export function InstallApp() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(null);
      setGuideOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  useEffect(() => {
    const onTrigger = async () => {
      if (!deferredPrompt) {
        setGuideOpen(true);
        return;
      }
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          window.dispatchEvent(new Event(INSTALLED_EVENT));
        }
        setDeferredPrompt(null);
      } catch {
        setDeferredPrompt(null);
        setGuideOpen(true);
      }
    };

    window.addEventListener(INSTALL_EVENT, onTrigger);
    return () => window.removeEventListener(INSTALL_EVENT, onTrigger);
  }, [deferredPrompt]);

  return (
    <Modal
      open={guideOpen}
      onClose={() => setGuideOpen(false)}
      title="Install SmartQuiz"
      eyebrow="Home-screen app"
      size="sm"
      footer={
        <button type="button" className="btn btn-primary" onClick={() => setGuideOpen(false)}>
          Got it
        </button>
      }
    >
      <p className="install-intro">
        Install once, then open SmartQuiz from your home screen or app list — with its own icon and
        a full-screen window. No app store needed.
      </p>
      <div className="install-steps">
        <div className="install-step">
          <span className="install-step-icon" aria-hidden="true">
            <Share2 size={16} />
          </span>
          <div>
            <strong>iPhone / iPad</strong>
            <p>
              Open this site in Safari, tap <b>Share</b>, choose <b>Add to Home Screen</b>, then tap{' '}
              <b>Add</b>.
            </p>
          </div>
        </div>
        <div className="install-step">
          <span className="install-step-icon" aria-hidden="true">
            <SquarePlus size={16} />
          </span>
          <div>
            <strong>Android</strong>
            <p>
              In Chrome, open the <b>⋮</b> menu and choose <b>Install app</b> or{' '}
              <b>Add to Home screen</b>.
            </p>
          </div>
        </div>
        <div className="install-step">
          <span className="install-step-icon" aria-hidden="true">
            <MonitorDown size={16} />
          </span>
          <div>
            <strong>Windows / macOS</strong>
            <p>
              In Chrome or Edge, use the install icon in the address bar. On Mac Safari 17+, choose{' '}
              <b>File → Add to Dock</b>.
            </p>
          </div>
        </div>
      </div>
      <p className="install-note">
        Accounts, exams, and marks still stay in this browser. Reconnect once after installing so
        the app shell can cache for offline use.
      </p>
    </Modal>
  );
}
