import type { Locale } from '../i18n';
import { SUPPORTED_LOCALES } from '../i18n';

export function LanguageSwitcher({ locale, onChange, dark = false }: { locale: Locale; onChange: (locale: Locale) => void; dark?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-1 rounded-full border p-1 text-xs font-bold ${dark ? 'border-slate-600 bg-slate-900/80 text-white' : 'border-slate-200 bg-white/10 text-white'}`} role="group" aria-label="Language / Idioma / Taal">
      {SUPPORTED_LOCALES.map(language => (
        <button
          type="button"
          key={language}
          onClick={() => onChange(language)}
          aria-pressed={locale === language}
          className={`rounded-full px-2.5 py-1.5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 ${locale === language ? 'bg-cyan-400 text-slate-950' : 'hover:bg-white/20'}`}
        >{language.toUpperCase()}</button>
      ))}
    </div>
  );
}
