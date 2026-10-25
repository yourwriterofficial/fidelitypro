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

/**
 * Get the saved language preference for a user (persisted across sessions)
 * Defaults to 'en' (English).
 */
export function getSavedTargetLanguage(userId?: string): string {
  if (typeof window === 'undefined') return 'en';
  const isExplicit = localStorage.getItem('rpm_trans_target_explicit') === 'true';
  const key = userId ? `rpm_trans_target_${userId}` : 'rpm_trans_target';
  const saved = localStorage.getItem(key);
  if (isExplicit && saved && SUPPORTED_LANGUAGES.some(l => l.code === saved)) {
    return saved;
  }
  return 'en';
}

/**
 * Save language preference for a user
 */
export async function saveTargetLanguage(lang: string, userId?: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const key = userId ? `rpm_trans_target_${userId}` : 'rpm_trans_target';
  localStorage.setItem(key, lang);
  localStorage.setItem('rpm_trans_target', lang);
  localStorage.setItem('rpm_trans_target_explicit', 'true');

  if (userId) {
    try {
      await supabase
        .from('profiles')
        .update({ preferred_translation_lang: lang })
        .eq('id', userId);
    } catch {
      // Non-fatal
    }
  }
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
