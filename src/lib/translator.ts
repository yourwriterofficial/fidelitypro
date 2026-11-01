import { supabase } from './supabaseClient';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'tl', name: 'Filipino', nativeName: 'Filipino', flag: '🇵🇭' },
];

// In-memory translation cache to eliminate duplicate network calls
const translationCache = new Map<string, { translated: string; sourceLang: string }>();

/**
 * Detect the user's browser language automatically
 */
export function detectBrowserLanguage(): string {
  if (typeof navigator === 'undefined') return 'en';
  const navLang = navigator.language || (navigator.languages && navigator.languages[0]) || 'en';
  const lower = navLang.toLowerCase();

  if (lower.startsWith('zh-cn') || lower.startsWith('zh-hans')) return 'zh-CN';
  if (lower.startsWith('zh')) return 'zh-CN';
  
  const twoLetter = lower.split('-')[0];
  const matched = SUPPORTED_LANGUAGES.find(l => l.code === twoLetter);
  return matched ? matched.code : 'en';
}

/**
 * Sync detected browser language to profile in Supabase
 */
export async function syncBrowserLanguage(userId?: string): Promise<string> {
  const detected = detectBrowserLanguage();
  if (typeof window !== 'undefined') {
    localStorage.setItem('rpm_browser_language', detected);
  }

  if (userId) {
    try {
      await supabase
        .from('profiles')
        .update({ browser_language: detected })
        .eq('id', userId);
    } catch {
      // Non-fatal background sync
    }
  }

  return detected;
}

export const DEFAULT_READING_LANGUAGE = 'en';

/**
 * Get the saved READING language preference for incoming messages.
 * Default is strictly 'en' (English) unless the user explicitly changed it.
 */
export function getSavedReadingLanguage(userId?: string): string {
  if (typeof window === 'undefined') return DEFAULT_READING_LANGUAGE;
  const userKey = userId ? `rpm_reading_language_${userId}` : null;
  const savedUser = userKey ? localStorage.getItem(userKey) : null;
  const savedGlobal = localStorage.getItem('rpm_reading_language');
  const candidate = savedUser || savedGlobal;
  if (candidate && SUPPORTED_LANGUAGES.some(l => l.code === candidate)) {
    return candidate;
  }
  return DEFAULT_READING_LANGUAGE;
}

/**
 * Save the user's preferred READING language for incoming messages.
 * Emits an event so all mounted chat bubbles update live.
 */
export async function saveReadingLanguage(lang: string, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!SUPPORTED_LANGUAGES.some(l => l.code === lang)) return;

  if (userId) {
    localStorage.setItem(`rpm_reading_language_${userId}`, lang);
  }
  localStorage.setItem('rpm_reading_language', lang);

  window.dispatchEvent(new CustomEvent('rpm_reading_language_changed', { detail: { lang } }));

  if (userId) {
    try {
      await supabase
        .from('profiles')
        .update({ preferred_reading_lang: lang, preferred_translation_lang: lang })
        .eq('id', userId);
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Get the saved COMPOSE language preference for outgoing messages.
 * Default is 'en' (or whatever language they choose to translate outgoing drafts into).
 */
export function getSavedComposeLanguage(userId?: string): string {
  if (typeof window === 'undefined') return 'en';
  const userKey = userId ? `rpm_compose_language_${userId}` : null;
  const savedUser = userKey ? localStorage.getItem(userKey) : null;
  const savedGlobal = localStorage.getItem('rpm_compose_language');
  const candidate = savedUser || savedGlobal;
  if (candidate && SUPPORTED_LANGUAGES.some(l => l.code === candidate)) {
    return candidate;
  }
  return 'en';
}

/**
 * Save COMPOSE language preference for outgoing drafts.
 * Does NOT overwrite the reading language preference!
 */
export async function saveComposeLanguage(lang: string, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!SUPPORTED_LANGUAGES.some(l => l.code === lang)) return;

  if (userId) {
    localStorage.setItem(`rpm_compose_language_${userId}`, lang);
  }
  localStorage.setItem('rpm_compose_language', lang);
}

/**
 * Backwards-compatible aliases
 */
export function getSavedTargetLanguage(userId?: string): string {
  return getSavedComposeLanguage(userId);
}

export async function saveTargetLanguage(lang: string, userId?: string): Promise<void> {
  return saveComposeLanguage(lang, userId);
}

/**
 * Translate text into the target language with caching and error resilience
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<{ text: string; sourceLang: string }> {
  const clean = text.trim();
  if (!clean) return { text: '', sourceLang: 'en' };

  // If source and target are the same, return as-is
  if (sourceLang !== 'auto' && sourceLang === targetLang) {
    return { text: clean, sourceLang };
  }

  const cacheKey = `${sourceLang}:${targetLang}:${clean}`;
  if (translationCache.has(cacheKey)) {
    return {
      text: translationCache.get(cacheKey)!.translated,
      sourceLang: translationCache.get(cacheKey)!.sourceLang,
    };
  }

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(
      sourceLang
    )}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(clean)}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Translation HTTP error ${res.status}`);
    }

    const data = await res.json();
    let translated = '';
    if (Array.isArray(data) && Array.isArray(data[0])) {
      translated = data[0].map((item: any) => item[0]).join('');
    }

    const detectedSource = (data && data[2]) || 'en';
    const resultText = translated || clean;

    translationCache.set(cacheKey, { translated: resultText, sourceLang: detectedSource });
    return { text: resultText, sourceLang: detectedSource };
  } catch (err) {
    console.warn('Translation service warning (using original):', err);
    return { text: clean, sourceLang: 'en' };
  }
}

/**
 * Helper to get user-friendly language name from code
 */
export function getLanguageName(code?: string): string {
  if (!code) return 'Original language';
  const clean = code.toLowerCase().trim();
  const matched = SUPPORTED_LANGUAGES.find(
    l => l.code.toLowerCase() === clean || l.code.split('-')[0].toLowerCase() === clean
  );
  return matched ? matched.name : code.toUpperCase();
}

export interface SentTranslationRecord {
  originalText: string;
  translatedText: string;
  targetLangName?: string;
  timestamp: number;
}

// In-memory cache for sent translations
const sentTranslationsMemory = new Map<string, SentTranslationRecord>();
const SENT_TRANS_STORAGE_KEY = 'rpm_sent_translations_v2';

function getStoredSentTranslations(): Record<string, SentTranslationRecord> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SENT_TRANS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Record a translated outgoing message so the user can always see the English
 * (or original draft) version behind the translation they sent.
 */
export function saveSentTranslation(
  translatedText: string,
  originalText: string,
  targetLangName?: string,
  messageId?: string
): void {
  const cleanTrans = translatedText?.trim();
  const cleanOrig = originalText?.trim();
  if (!cleanTrans || !cleanOrig) return;

  const record: SentTranslationRecord = {
    originalText: cleanOrig,
    translatedText: cleanTrans,
    targetLangName: targetLangName || 'English',
    timestamp: Date.now(),
  };

  const textKey = cleanTrans.toLowerCase();
  sentTranslationsMemory.set(textKey, record);

  if (messageId) {
    sentTranslationsMemory.set(`id:${messageId}`, record);
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = getStoredSentTranslations();
      stored[textKey] = record;
      if (messageId) {
        stored[`id:${messageId}`] = record;
      }
      // Bound localStorage to last 300 entries
      const keys = Object.keys(stored);
      if (keys.length > 300) {
        const prune = keys.slice(0, keys.length - 300);
        prune.forEach(k => delete stored[k]);
      }
      localStorage.setItem(SENT_TRANS_STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Non-fatal
    }
  }
}

/**
 * Retrieve the original draft (English version) of a sent translated message.
 */
export function getSentTranslation(
  text: string,
  messageId?: string
): SentTranslationRecord | null {
  if (messageId && sentTranslationsMemory.has(`id:${messageId}`)) {
    return sentTranslationsMemory.get(`id:${messageId}`)!;
  }

  const clean = text?.trim().toLowerCase();
  if (clean && sentTranslationsMemory.has(clean)) {
    return sentTranslationsMemory.get(clean)!;
  }

  if (typeof window !== 'undefined') {
    const stored = getStoredSentTranslations();
    if (messageId && stored[`id:${messageId}`]) {
      sentTranslationsMemory.set(`id:${messageId}`, stored[`id:${messageId}`]);
      return stored[`id:${messageId}`];
    }
    if (clean && stored[clean]) {
      sentTranslationsMemory.set(clean, stored[clean]);
      return stored[clean];
    }
  }

  return null;
}

/**
 * Quick check if a sent message was translated
 */
export function hasSentTranslation(text: string, messageId?: string): boolean {
  return getSentTranslation(text, messageId) !== null;
}
