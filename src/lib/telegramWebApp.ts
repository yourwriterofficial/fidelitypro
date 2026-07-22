/**
 * Telegram WebApp (TWA) Integration Helper
 * Detects if app is running inside Telegram WebApp container and syncs UI/Auth
 */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: any;
    };
  }
}

export function isTelegramWebApp(): boolean {
  return typeof window !== 'undefined' && Boolean(window.Telegram?.WebApp?.initData);
}

export function getTelegramWebApp() {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

export function initTelegramWebApp() {
  const tg = getTelegramWebApp();
  if (!tg) return;

  try {
    tg.ready();
    tg.expand();

    // Set viewport fit
    if (tg.enableClosingConfirmation) {
      tg.enableClosingConfirmation();
    }
  } catch (err) {
    console.warn('Failed to initialize Telegram WebApp SDK:', err);
  }
}

export function getTelegramUser() {
  const tg = getTelegramWebApp();
  if (tg && tg.initDataUnsafe?.user) {
    return tg.initDataUnsafe.user;
  }
  return null;
}
