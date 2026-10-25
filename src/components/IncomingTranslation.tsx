import { useState } from 'react';
import { Languages, RefreshCw } from 'lucide-react';
import { translateText } from '../lib/translator';

interface IncomingTranslationProps {
  hasAccess: boolean;
  messageText: string;
  isMe: boolean;
}

export default function IncomingTranslation({
  hasAccess,
  messageText,
  isMe,
}: IncomingTranslationProps) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Stealth: only available for users with translator gifted or admins, and only on messages from others
  if (!hasAccess || isMe || !messageText.trim()) return null;

  const handleTranslate = async () => {
    if (translated) {
      setIsDismissed(false);
      return;
    }

    setLoading(true);
    try {
      const res = await translateText(messageText, 'en', 'auto');
      // If detected source is already English and identical, let them know
      if (res.sourceLang === 'en' || res.text.toLowerCase() === messageText.trim().toLowerCase()) {
        setSourceLang('en');
        setTranslated('Already in English');
      } else {
        setSourceLang(res.sourceLang);
        setTranslated(res.text);
      }
    } catch {
      setTranslated('Translation error');
    } finally {
      setLoading(false);
    }
  };

  if (translated && !isDismissed) {
    return (
      <div className="mt-1.5 pt-1.5 border-t border-slate-200/60 text-xs">
        <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-indigo-600 mb-0.5">
          <span className="flex items-center gap-1">
            <Languages size={10} />
            <span>English translation {sourceLang && sourceLang !== 'en' ? `(from ${sourceLang.toUpperCase()})` : ''}:</span>
          </span>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="text-[9px] text-gray-400 hover:text-gray-600 underline font-normal"
          >
            Hide
          </button>
        </div>
        <p className="text-slate-800 font-medium italic whitespace-pre-wrap">{translated}</p>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        onClick={handleTranslate}
        disabled={loading}
        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 transition opacity-75 hover:opacity-100"
      >
        {loading ? (
          <>
            <RefreshCw size={9} className="animate-spin text-indigo-600" />
            <span>Translating...</span>
          </>
        ) : (
          <>
            <Languages size={9} className="text-indigo-600" />
            <span>Translate to English</span>
          </>
        )}
      </button>
    </div>
  );
}
