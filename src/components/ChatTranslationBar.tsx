import { useState, useEffect } from 'react';
import { Languages, Send, Check, X, RefreshCw, ChevronDown, BookOpen } from 'lucide-react';
import { 
  SUPPORTED_LANGUAGES, 
  getSavedComposeLanguage, 
  saveComposeLanguage, 
  getSavedReadingLanguage, 
  saveReadingLanguage, 
  translateText,
  saveSentTranslation
} from '../lib/translator';
import { toast } from 'sonner';

interface ChatTranslationBarProps {
  hasAccess: boolean;
  currentDraft: string;
  onApplyTranslation: (text: string) => void;
  onSendDirectly: (text: string) => void;
  partnerLanguageHint?: string;
  currentUserId?: string;
  className?: string;
}

export default function ChatTranslationBar({
  hasAccess,
  currentDraft,
  onApplyTranslation,
  onSendDirectly,
  partnerLanguageHint,
  currentUserId,
  className = '',
}: ChatTranslationBarProps) {
  const [targetLang, setTargetLang] = useState<string>(() => {
    return getSavedComposeLanguage(currentUserId) || 'en';
  });

  const [readingLang, setReadingLang] = useState<string>(() => {
    return getSavedReadingLanguage(currentUserId) || 'en';
  });

  const [isTranslating, setIsTranslating] = useState(false);
  const [preview, setPreview] = useState<{ original: string; translated: string; targetName: string } | null>(null);
  const [composeDropdownOpen, setComposeDropdownOpen] = useState(false);
  const [readingDropdownOpen, setReadingDropdownOpen] = useState(false);

  useEffect(() => {
    const handleReadingChanged = (e: any) => {
      if (e.detail?.lang) {
        setReadingLang(e.detail.lang);
      }
    };
    window.addEventListener('rpm_reading_language_changed', handleReadingChanged);
    return () => window.removeEventListener('rpm_reading_language_changed', handleReadingChanged);
  }, []);

  // 100% Stealth: If user is not entitled, render absolutely nothing
  if (!hasAccess) return null;

  const handleSelectComposeLanguage = (code: string) => {
    setTargetLang(code);
    saveComposeLanguage(code, currentUserId);
    setComposeDropdownOpen(false);
    // If a preview was open, refresh translation for new language
    if (preview && currentDraft.trim()) {
      doTranslate(currentDraft, code);
    }
  };

  const handleSelectReadingLanguage = (code: string) => {
    setReadingLang(code);
    saveReadingLanguage(code, currentUserId);
    setReadingDropdownOpen(false);
    const matched = SUPPORTED_LANGUAGES.find(l => l.code === code);
    toast.success(`Incoming messages will now display in ${matched?.name || code}`);
  };

  const doTranslate = async (textToTranslate: string, langCode: string) => {
    const clean = textToTranslate.trim();
    if (!clean) {
      toast.info('Please type a message first to translate');
      return;
    }

    setIsTranslating(true);
    try {
      const res = await translateText(clean, langCode, 'auto');
      const targetObj = SUPPORTED_LANGUAGES.find(l => l.code === langCode);
      setPreview({
        original: clean,
        translated: res.text,
        targetName: targetObj?.name || langCode,
      });
    } catch (err: any) {
      toast.error('Could not translate draft: ' + (err.message || 'Network error'));
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranslateClick = () => {
    doTranslate(currentDraft, targetLang);
  };

  const handleSendTranslated = () => {
    if (!preview) return;
    saveSentTranslation(preview.translated, preview.original, preview.targetName);
    onSendDirectly(preview.translated);
    setPreview(null);
  };

  const handleApplyToInput = () => {
    if (!preview) return;
    saveSentTranslation(preview.translated, preview.original, preview.targetName);
    onApplyTranslation(preview.translated);
    setPreview(null);
  };

  const currentLangObj = SUPPORTED_LANGUAGES.find(l => l.code === targetLang) || SUPPORTED_LANGUAGES[0];
  const currentReadingObj = SUPPORTED_LANGUAGES.find(l => l.code === readingLang) || SUPPORTED_LANGUAGES[0];
  const partnerLangObj = partnerLanguageHint ? SUPPORTED_LANGUAGES.find(l => l.code === partnerLanguageHint) : null;

  return (
    <div className={`space-y-2 ${className}`}>
      {/* ── PREVIEW CARD (Visible when translation generated) ────────────── */}
      {preview && (
        <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/90 border border-indigo-200/80 rounded-2xl p-3.5 shadow-sm text-left animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100 mb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <Languages size={14} className="text-indigo-600" />
              <span>Preview Translation ({preview.targetName})</span>
            </div>
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="p-1 hover:bg-indigo-100 rounded-lg text-gray-400 hover:text-gray-700 transition"
              title="Close preview"
            >
              <X size={14} />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100/60">
              <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">Original (Draft)</span>
              <p className="text-gray-700 whitespace-pre-wrap">{preview.original}</p>
            </div>

            <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-xs">
              <span className="text-[10px] uppercase font-bold text-indigo-200 block mb-0.5">
                {currentLangObj.flag} Translated ({preview.targetName})
              </span>
              <p className="font-medium whitespace-pre-wrap">{preview.translated}</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-indigo-100/60">
            <button
              type="button"
              onClick={() => setPreview(null)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100/80 rounded-xl transition font-medium"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleApplyToInput}
              className="px-3 py-1.5 text-xs bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200 rounded-xl transition font-semibold flex items-center gap-1"
            >
              <Check size={12} /> Use in Input
            </button>
            <button
              type="button"
              onClick={handleSendTranslated}
              className="px-3.5 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition font-bold shadow-xs flex items-center gap-1"
            >
              <Send size={12} /> Send Translated
            </button>
          </div>
        </div>
      )}

      {/* ── TOOLBAR: Language Pickers & Translate Trigger ─────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          {/* Outgoing target language selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setComposeDropdownOpen(!composeDropdownOpen);
                setReadingDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition text-[11px] border border-slate-200/60 dark:border-slate-700/60"
              title="Select language to translate your outgoing message into"
            >
              <Languages size={12} className="text-indigo-600 dark:text-indigo-400" />
              <span>Translate draft:</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <span>{currentLangObj.flag}</span>
                <span>{currentLangObj.name}</span>
              </span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>

            {composeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setComposeDropdownOpen(false)} />
                <div className="absolute left-0 bottom-full mb-1 z-50 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 p-1.5 divide-y divide-gray-50 dark:divide-slate-800">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Draft Translation Target
                  </div>
                  <div className="py-1">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectComposeLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition ${
                          targetLang === lang.code
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-bold'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm">{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                        <span className="text-[10px] text-gray-400">{lang.nativeName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Reading language preference selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setReadingDropdownOpen(!readingDropdownOpen);
                setComposeDropdownOpen(false);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition text-[11px] border border-slate-200/60 dark:border-slate-700/60"
              title="Language you want to read all incoming messages in"
            >
              <BookOpen size={12} className="text-emerald-600 dark:text-emerald-400" />
              <span>Read in:</span>
              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                <span>{currentReadingObj.flag}</span>
                <span>{currentReadingObj.name}</span>
              </span>
              <ChevronDown size={11} className="text-slate-400" />
            </button>

            {readingDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setReadingDropdownOpen(false)} />
                <div className="absolute left-0 bottom-full mb-1 z-50 w-56 max-h-64 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-100 dark:border-slate-800 p-1.5 divide-y divide-gray-50 dark:divide-slate-800">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Default Reading Language
                  </div>
                  <div className="py-1">
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectReadingLanguage(lang.code)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left text-xs transition ${
                          readingLang === lang.code
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-bold'
                            : 'hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-sm">{lang.flag}</span>
                          <span>{lang.name}</span>
                        </span>
                        <span className="text-[10px] text-gray-400">{lang.nativeName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Hint if partner's browser language is detected */}
          {partnerLangObj && targetLang !== partnerLangObj.code && (
            <button
              type="button"
              onClick={() => handleSelectComposeLanguage(partnerLangObj.code)}
              className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1"
              title={`Partner uses ${partnerLangObj.name} browser`}
            >
              <span>Match recipient's language ({partnerLangObj.flag} {partnerLangObj.name})</span>
            </button>
          )}
        </div>

        {/* Translate action button */}
        <button
          type="button"
          onClick={handleTranslateClick}
          disabled={!currentDraft.trim() || isTranslating}
          className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-40 disabled:hover:bg-indigo-50 text-indigo-700 dark:text-indigo-300 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 rounded-xl font-bold transition text-[11px] border border-indigo-200/60 dark:border-indigo-800/60"
        >
          {isTranslating ? (
            <>
              <RefreshCw size={11} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              <span>Translating...</span>
            </>
          ) : (
            <>
              <Languages size={11} className="text-indigo-600 dark:text-indigo-400" />
              <span>Translate & Preview</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
