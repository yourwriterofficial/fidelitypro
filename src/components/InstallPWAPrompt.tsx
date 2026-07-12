import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, Share, X, PlusSquare } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed';

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's proprietary flag — not in the DOM lib types.
    (window.navigator as any).standalone === true
  );
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream;
}

export default function InstallPWAPrompt() {
  const location = useLocation();
  const [installed, setInstalled] = useState(isStandalone());
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(DISMISS_KEY) === '1'
  );
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 767px)').matches
  );

  useEffect(() => {
    if (installed) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const mq = window.matchMedia('(max-width: 767px)');
    const onMqChange = () => setIsMobile(mq.matches);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    mq.addEventListener('change', onMqChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      mq.removeEventListener('change', onMqChange);
    };
  }, [installed]);

  const iOS = isIOS();

  // Nothing to nudge: already installed, dismissed for this browser session,
  // on desktop, or (Android/Chrome) the browser hasn't offered an install
  // event yet and it isn't iOS Safari (which never fires one at all).
  if (installed || dismissed || !isMobile) return null;
  if (!iOS && !deferredPrompt) return null;

  const dismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const onApp = location.pathname.startsWith('/app');

  return (
    <div
      className={`md:hidden fixed inset-x-3 z-40 ${onApp ? 'bottom-24' : 'bottom-4'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-sheet-up">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
          <Download size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Install the RPM App</p>
          {iOS ? (
            <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
              Tap <Share size={12} className="inline -mt-0.5" /> Share, then{' '}
              <PlusSquare size={12} className="inline -mt-0.5" /> "Add to Home Screen" for the full app experience.
            </p>
          ) : (
            <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
              Add RPM to your home screen for faster, full-screen access.
            </p>
          )}
          {!iOS && (
            <button
              onClick={handleInstall}
              className="mt-2.5 bg-white text-gray-900 text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-gray-100 transition"
            >
              Install App
            </button>
          )}
        </div>
        <button
          onClick={dismiss}
          className="p-1 text-white/50 hover:text-white transition shrink-0"
          title="Dismiss"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
