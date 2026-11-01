import { useState, useMemo } from 'react';
import { MoreHorizontal, ChevronDown, ChevronUp } from 'lucide-react';

interface QuotedEmailBodyProps {
  html?: string;
  text?: string;
  className?: string;
}

export default function QuotedEmailBody({
  html,
  text,
  className = '',
}: QuotedEmailBodyProps) {
  const [showQuoted, setShowQuoted] = useState(false);

  const { mainHtml, quotedHtml, hasQuote } = useMemo(() => {
    const rawHtml = (html || '').trim();
    const rawText = (text || '').trim();

    // 1. Browser-based DOM parsing if HTML is available
    if (rawHtml && typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, 'text/html');

        // Selectors commonly used for quoted text in Gmail, Yahoo, Outlook, Apple Mail
        const quoteSelector = [
          '.gmail_quote',
          '.gmail_quote_container',
          '.gmail_attr',
          'blockquote',
          '#divRplyFwdMsg',
          '#isForwardContent',
          '#appendonsend',
          '.yahoo_quoted',
          '[name="quote"]',
        ].join(', ');

        const quoteEl = doc.body.querySelector(quoteSelector);

        if (quoteEl) {
          // Clone the quoted element HTML
          const quotedSnippet = quoteEl.outerHTML;

          // Remove the quote element from document
          quoteEl.remove();

          const mainContent = doc.body.innerHTML.trim();
          const cleanText = doc.body.textContent?.trim() || '';

          // Only treat as split if there is actual new message text
          if (cleanText.length > 0) {
            return {
              mainHtml: mainContent,
              quotedHtml: quotedSnippet,
              hasQuote: true,
            };
          }
        }
      } catch {
        // Fall back to regex if DOMParser fails
      }
    }

    // 2. Regex fallback for HTML
    if (rawHtml) {
      const quoteSplitRegex =
        /(?:<div[^>]*class=["'][^"']*(?:gmail_quote|gmail_quote_container|yahoo_quoted)[^"']*["'][^>]*>|<blockquote|<div[^>]*id=["'](?:divRplyFwdMsg|isForwardContent|appendonsend)["']|-----Original Message-----|<div[^>]*class=["'][^"']*gmail_attr[^"']*["'])/i;

      const match = rawHtml.match(quoteSplitRegex);
      if (match && match.index !== undefined && match.index > 0) {
        const main = rawHtml.slice(0, match.index).replace(/(?:<br\s*\/?>|\s)+$/gi, '');
        const quote = rawHtml.slice(match.index);

        if (main.replace(/<[^>]+>/g, '').trim().length > 0) {
          return {
            mainHtml: main,
            quotedHtml: quote,
            hasQuote: true,
          };
        }
      }

      // Check "On ... wrote:" in HTML
      const onWroteRegex = /(?:<br\s*\/?>|\n|\s*)On\s+(?:[A-Za-z]+,?\s+)?[A-Za-z]+\s+\d{1,2},?\s+\d{4}[^<]+wrote:/i;
      const onWroteMatch = rawHtml.match(onWroteRegex);
      if (onWroteMatch && onWroteMatch.index !== undefined && onWroteMatch.index > 0) {
        const main = rawHtml.slice(0, onWroteMatch.index).replace(/(?:<br\s*\/?>|\s)+$/gi, '');
        const quote = rawHtml.slice(onWroteMatch.index);
        if (main.replace(/<[^>]+>/g, '').trim().length > 0) {
          return {
            mainHtml: main,
            quotedHtml: quote,
            hasQuote: true,
          };
        }
      }
    }

    // 3. Plain Text splitting (e.g. "On Sun, Nov 1, 2026 at ... wrote:")
    if (rawText) {
      const textSplitRegex =
        /(?:\r?\n)(?:On\s+(?:[A-Za-z]+,?\s+)?[A-Za-z]+\s+\d{1,2},?\s+\d{4}[^\n]+wrote:|On\s+\d{1,2}\/\d{1,2}\/\d{2,4}[^\n]+wrote:|-----Original Message-----|From:\s+[^\n]+|<[^>]+@[\w.-]+>\s+wrote:|>+\s*[\s\S]{20,})/i;

      const textMatch = rawText.match(textSplitRegex);
      if (textMatch && textMatch.index !== undefined && textMatch.index > 0) {
        const main = rawText.slice(0, textMatch.index).trim();
        const quote = rawText.slice(textMatch.index).trim();
        if (main.length > 0) {
          return {
            mainHtml: `<div style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(main)}</div>`,
            quotedHtml: `<div style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(quote)}</div>`,
            hasQuote: true,
          };
        }
      }
    }

    // Default: no quote detected or entire content is one piece
    return {
      mainHtml: rawHtml || `<div style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(rawText)}</div>`,
      quotedHtml: '',
      hasQuote: false,
    };
  }, [html, text]);

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Primary Clean Message Body (Prominent & Uncluttered) */}
      <div
        className="text-xs sm:text-sm leading-relaxed overflow-x-auto break-words text-slate-900 bg-white font-normal [&_table]:max-w-full [&_table]:table-auto [&_td]:break-words [&_th]:break-words [&_img]:max-w-full [&_a]:text-blue-600 [&_a]:underline"
        dangerouslySetInnerHTML={{ __html: mainHtml }}
      />

      {/* Quoted History Accordion (Ultra-compact, zero-clutter) */}
      {hasQuote && (
        <div className="pt-1 select-none">
          <button
            type="button"
            onClick={() => setShowQuoted(!showQuoted)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100/90 hover:bg-slate-200/90 rounded-md transition border border-slate-200 active:scale-95 shadow-2xs"
            title={showQuoted ? 'Hide quoted email history' : 'Show quoted email history'}
          >
            <MoreHorizontal size={13} className="text-slate-400" />
            <span>{showQuoted ? 'Hide quoted text' : '··· Show quoted text'}</span>
            {showQuoted ? <ChevronUp size={11} className="text-slate-400" /> : <ChevronDown size={11} className="text-slate-400" />}
          </button>

          {showQuoted && (
            <div className="mt-2 p-3 rounded-xl bg-slate-50 border-l-2 border-slate-300 text-slate-600 text-xs sm:text-[13px] leading-relaxed overflow-x-auto transition shadow-2xs">
              <div
                className="[&_table]:max-w-full [&_img]:max-w-full text-slate-500 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-2.5 [&_blockquote]:my-1.5 [&_blockquote]:italic"
                dangerouslySetInnerHTML={{ __html: quotedHtml }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
