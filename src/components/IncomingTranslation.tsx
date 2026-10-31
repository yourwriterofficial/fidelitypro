import { useState } from 'react';
import { Languages, RefreshCw } from 'lucide-react';
import { 
  translateText, 
  getSentTranslation, 
  saveSentTranslation, 
  getSavedTargetLanguage, 
  SUPPORTED_LANGUAGES, 
  getLanguageName 
} from '../lib/translator';
import { toast } from 'sonner';

export interface IncomingTranslationProps {
  hasAccess: boolean;
  messageText: string;
  isMe: boolean;
  messageId?: string;
  currentUserId?: string;
  className?: string;
}

export default function IncomingTranslation({
  hasAccess,
  messageText,
  isMe,
  messageId,
  currentUserId,
  className = '',
}: IncomingTranslationProps) {
  // ── GATING: If user does not have translation gift, render plain text only ──
  if (!hasAccess || !messageText?.trim()) {
    return (
      <p className={`leading-relaxed break-words font-medium ${className}`}>
        {messageText}
      </p>
    );
  }

  // ── OUTGOING MESSAGES (Sent by current user) ───────────────────────────────
  // Feature: See the English version of what was sent behind the translation.
  // Smaller text = language sent. Bigger text = English / original draft.
  if (isMe) {
    return (
      <OutgoingMessageTranslation
        messageText={messageText}
        messageId={messageId}
        className={className}
      />
    );
  }

  // ── INCOMING MESSAGES (Sent by recipient) ──────────────────────────────────
  // Feature: Translate to defaulted language.
  // Smaller text = language sent. Bigger text = defaulted language.
  return (
    <IncomingMessageTranslation
      messageText={messageText}
      currentUserId={currentUserId}
      className={className}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Outgoing Message Translation View
// ─────────────────────────────────────────────────────────────────────────────
function OutgoingMessageTranslation({
  messageText,
  messageId,
  className,
}: {
  messageText: string;
  messageId?: string;
  className: string;
}) {
  const sentRecord = getSentTranslation(messageText, messageId);
  const [showEnglish, setShowEnglish] = useState(false);
  const [liveEnglish, setLiveEnglish] = useState<string | null>(null);
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  const [loadingEnglish, setLoadingEnglish] = useState(false);
  const [alreadyEnglish, setAlreadyEnglish] = useState(false);

  const effectiveEnglish = sentRecord?.originalText || liveEnglish;
  const effectiveLangName = sentRecord?.targetLangName || detectedLang;

  const handleToggleEnglish = async () => {
    if (showEnglish) {
      setShowEnglish(false);
      return;
    }

    if (effectiveEnglish) {
      setShowEnglish(true);
      return;
    }

    setLoadingEnglish(true);
    try {
      const res = await translateText(messageText, 'en', 'auto');
      if (res.sourceLang === 'en' || res.text.trim().toLowerCase() === messageText.trim().toLowerCase()) {
        setAlreadyEnglish(true);
        setTimeout(() => setAlreadyEnglish(false), 3000);
      } else {
        const langName = getLanguageName(res.sourceLang);
        setLiveEnglish(res.text);
        setDetectedLang(langName);
        saveSentTranslation(messageText, res.text, langName, messageId);
        setShowEnglish(true);
      }
    } catch {
      toast.error('Could not retrieve English version');
    } finally {
      setLoadingEnglish(false);
    }
  };

  // State A: English view active
  // Bigger text = English version. Smaller text = language sent.
  if (showEnglish && effectiveEnglish) {
    return (
      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold text-white/80 uppercase tracking-wider mb-0.5 select-none">
            <span className="flex items-center gap-1">
              <Languages size={10} className="text-white/90" />
              <span>English version:</span>
            </span>
            <button
              type="button"
              onClick={() => setShowEnglish(false)}
              className="text-[9px] text-white/80 hover:text-white underline font-normal transition"
            >
              Show sent only
            </button>
          </div>
          {/* Bigger text: English version behind the translation */}
          <p className={`leading-relaxed break-words font-medium text-sm md:text-[15px] ${className}`}>
            {effectiveEnglish}
          </p>
        </div>

        {/* Smaller text: Language sent */}
        <div className="pt-1.5 border-t border-white/20 text-[11px] text-white/85">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-white/70 block mb-0.5">
            Sent {effectiveLangName ? `in ${effectiveLangName}` : 'message'}:
          </span>
          <p className="italic leading-relaxed whitespace-pre-wrap">{messageText}</p>
        </div>
      </div>
    );
  }

  // State B: Standard sent view with toggle action
  return (
    <div>
      <p className={`leading-relaxed break-words font-medium ${className}`}>
        {messageText}
      </p>
      <div className="mt-1 flex items-center gap-1.5 select-none">
        <button
          type="button"
          onClick={handleToggleEnglish}
          disabled={loadingEnglish}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-white/80 hover:text-white bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-md transition backdrop-blur-xs disabled:opacity-50"
          title="See English version of what you sent"
        >
          {loadingEnglish ? (
            <>
              <RefreshCw size={10} className="animate-spin text-white/90" />
              <span>Translating...</span>
            </>
          ) : (
            <>
              <Languages size={10} className="text-white/90" />
              <span>{effectiveEnglish ? 'See English version' : 'See English version'}</span>
            </>
          )}
        </button>
        {alreadyEnglish && (
          <span className="text-[10px] text-white/70 italic">Already in English</span>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subcomponent: Incoming Message Translation View
// ─────────────────────────────────────────────────────────────────────────────
function IncomingMessageTranslation({
  messageText,
  currentUserId,
  className,
}: {
  messageText: string;
  currentUserId?: string;
  className: string;
}) {
  const defaultLangCode = getSavedTargetLanguage(currentUserId) || 'en';
  const defaultLangObj = SUPPORTED_LANGUAGES.find(l => l.code === defaultLangCode) || SUPPORTED_LANGUAGES[0];

  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  const [showTranslated, setShowTranslated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alreadyDefault, setAlreadyDefault] = useState(false);

  const handleTranslate = async () => {
    if (translatedText) {
      setShowTranslated(true);
      return;
    }

    setLoading(true);
    try {
      const res = await translateText(messageText, defaultLangCode, 'auto');
      if (res.sourceLang === defaultLangCode || res.text.trim().toLowerCase() === messageText.trim().toLowerCase()) {
        setAlreadyDefault(true);
        setTimeout(() => setAlreadyDefault(false), 3000);
      } else {
        setSourceLang(res.sourceLang);
        setTranslatedText(res.text);
        setShowTranslated(true);
      }
    } catch {
      toast.error('Could not translate message');
    } finally {
      setLoading(false);
    }
  };

  // State A: Translated view active
  // Bigger text = defaulted language. Smaller text = language sent.
  if (showTranslated && translatedText) {
    return (
      <div className="space-y-1.5">
        <div>
          <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mb-0.5 select-none">
            <span className="flex items-center gap-1">
              <Languages size={10} />
              <span>{defaultLangObj.name} (Default):</span>
            </span>
            <button
              type="button"
              onClick={() => setShowTranslated(false)}
              className="text-[9px] text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 underline font-normal transition"
            >
              Show original only
            </button>
          </div>
          {/* Bigger text: Defaulted language version */}
          <p className={`leading-relaxed break-words font-medium text-sm md:text-[15px] ${className}`}>
            {translatedText}
          </p>
        </div>

        {/* Smaller text: Language sent */}
        <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 block mb-0.5">
            Sent {sourceLang ? `in ${getLanguageName(sourceLang)}` : 'by sender'}:
          </span>
          <p className="italic leading-relaxed whitespace-pre-wrap text-slate-600 dark:text-slate-300">
            {messageText}
          </p>
        </div>
      </div>
    );
  }

  // State B: Standard original view with translate action
  return (
    <div>
      <p className={`leading-relaxed break-words font-medium ${className}`}>
        {messageText}
      </p>
      <div className="mt-1 flex items-center gap-2 select-none">
        <button
          type="button"
          onClick={handleTranslate}
          disabled={loading}
          className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-bold flex items-center gap-1 transition opacity-80 hover:opacity-100 disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw size={10} className="animate-spin text-indigo-600 dark:text-indigo-400" />
              <span>Translating...</span>
            </>
          ) : (
            <>
              <Languages size={10} className="text-indigo-600 dark:text-indigo-400" />
              <span>
                {translatedText ? `View ${defaultLangObj.name} translation` : `Translate to ${defaultLangObj.name}`}
              </span>
            </>
          )}
        </button>
        {alreadyDefault && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">
            Already in {defaultLangObj.name}
          </span>
        )}
      </div>
    </div>
  );
}

// Alias for semantic clarity
export { IncomingTranslation as ChatMessageContent };
