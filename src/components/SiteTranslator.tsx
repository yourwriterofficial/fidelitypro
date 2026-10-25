import { useEffect, useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { SUPPORTED_LANGUAGES, detectBrowserLanguage, syncBrowserLanguage } from '../lib/translator';
import { useAuthStore } from '../store/authStore';

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: any;
  }
}

export default function SiteTranslator() {
  const { profile } = useAuthStore();
  const [currentLang, setCurrentLang] = useState<string>('en');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    // 1. Silently record the browser language to profile if user is authenticated
    syncBrowserLanguage(profile?.id);

    // 2. Check if user already chose a site language or detect from browser
    const saved = localStorage.getItem('rpm_site_language');
    const detected = detectBrowserLanguage();
    const effective = saved || (detected !== 'en' ? detected : 'en');
    setCurrentLang(effective);

    // Only inject Google Translate script passively if effective language is non-English
    // NEVER call window.location.reload() on mount
    if (effective !== 'en') {
      const domain = window.location.hostname;
      const cookieValue = `/en/${effective}`;
      document.cookie = `googtrans=${cookieValue}; path=/;`;
      document.cookie = `googtrans=${cookieValue}; path=/; domain=.${domain};`;

      if (!document.getElementById('google-translate-script')) {
        window.googleTranslateElementInit = () => {
          if (window.google?.translate?.TranslateElement) {
            new window.google.translate.TranslateElement(
              {
                pageLanguage: 'en',
                autoDisplay: false,
                includedLanguages: SUPPORTED_LANGUAGES.map(l => l.code).join(','),
              },
              'google_translate_element'
            );
          }
        };

        const script = document.createElement('script');
        script.id = 'google-translate-script';
        script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        script.async = true;
        document.body.appendChild(script);
      }
    }
  }, [profile?.id]);

  const handleSelect = (langCode: string) => {
    setDropdownOpen(false);
    setCurrentLang(langCode);
    localStorage.setItem('rpm_site_language', langCode);

    const domain = window.location.hostname;
    if (langCode === 'en') {
      // Reset to English
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=.${domain};`;
      window.location.reload();
      return;
    }

    const cookieValue = `/en/${langCode}`;
    document.cookie = `googtrans=${cookieValue}; path=/;`;
    document.cookie = `googtrans=${cookieValue}; path=/; domain=.${domain};`;

    const combo = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
    if (combo) {
      combo.value = langCode;
      combo.dispatchEvent(new Event('change'));
    } else {
      window.location.reload();
    }
  };

  const currentObj = SUPPORTED_LANGUAGES.find(l => l.code === currentLang) || SUPPORTED_LANGUAGES.find(l => l.code === 'en')!;

  return (
    <>
      {/* Hidden container required by Google Translate */}
      <div id="google_translate_element" style={{ display: 'none' }} />

      {/* Global CSS to suppress default Google banners and maintain native UI look */}
      <style>{`
        .goog-te-banner-frame { display: none !important; }
        .goog-te-banner-frame.skiptranslate { display: none !important; }
        body { top: 0px !important; }
        #goog-gt-tt, .goog-te-balloon-frame { display: none !important; }
        .goog-text-highlight { background: none !important; box-shadow: none !important; }
        .VIpgJd-ZVi9od-aZ2wEe-wOHMyf { display: none !important; }
      `}</style>

      {/* Floating or embedded discreet language toggle */}
      <div className="relative inline-block text-left notranslate" translate="no">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-xs transition text-xs font-semibold notranslate"
          title="Change language / Cambiar idioma"
          translate="no"
        >
          <Globe size={13} className="text-brand shrink-0" />
          <span className="flex items-center gap-1 notranslate" translate="no">
            <span className="text-sm notranslate" translate="no">{currentObj.flag}</span>
            <span className="uppercase text-[11px] font-bold text-slate-600 notranslate" translate="no">{currentObj.code}</span>
          </span>
          <ChevronDown size={11} className="text-slate-400 shrink-0" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute right-0 mt-2 z-50 w-52 max-h-72 overflow-y-auto bg-white rounded-2xl shadow-xl border border-gray-100 p-1 divide-y divide-gray-50 notranslate" translate="no">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 notranslate">
                Site Language / Idioma
              </div>
              <div className="py-1 notranslate">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelect(lang.code)}
                    className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-left text-xs transition notranslate ${
                      currentLang === lang.code
                        ? 'bg-brand/10 text-brand font-bold'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                    translate="no"
                  >
                    <span className="flex items-center gap-2 notranslate" translate="no">
                      <span className="text-sm notranslate">{lang.flag}</span>
                      <span className="notranslate">{lang.name}</span>
                    </span>
                    <span className="text-[10px] text-gray-400 notranslate">{lang.nativeName}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
