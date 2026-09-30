import React, { useEffect, useId, useState } from 'react';
import type { Language } from '../types';
import { tr } from '../i18n';

export const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', zh: '中文', ms: 'Bahasa Melayu' };

export default function LanguageSelector({ language, onChange }: { language: Language; onChange: (language: Language) => void }) {
  return <select aria-label={tr(language, 'Language', '语言', 'Bahasa')} value={language}
    onChange={event => onChange(event.target.value as Language)}
    className="min-h-12 max-w-full rounded-xl border border-zinc-300 bg-white px-3 text-base font-semibold text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white">
    {(['en', 'zh', 'ms'] as Language[]).map(code => <option key={code} value={code}>{LANGUAGE_NAMES[code]}</option>)}
  </select>;
}

export function LocalizedNameEditor({ value, onChange, language, label, error, inputRef }: {
  value: Partial<Record<Language, string>>;
  onChange: (value: Partial<Record<Language, string>>) => void;
  language: Language;
  label: string;
  error?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const [nameLanguage, setNameLanguage] = useState<Language>(language);
  useEffect(() => setNameLanguage(language), [language]);
  const id = useId();
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block text-sm font-bold text-zinc-700 dark:text-zinc-200">{label}</label>
    <div role="group" aria-label={tr(language, 'Name language', '名称语言', 'Bahasa nama')} className="flex flex-wrap gap-1">
      {(['en', 'zh', 'ms'] as Language[]).map(code => <button key={code} type="button" aria-pressed={nameLanguage === code}
        onClick={() => setNameLanguage(code)} className={`min-h-12 rounded-lg px-3 text-sm font-semibold ${nameLanguage === code ? 'bg-primary text-on-primary' : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'}`}>
        {LANGUAGE_NAMES[code]}
      </button>)}
    </div>
    <input ref={inputRef} id={id} type="text" autoComplete="off" value={value[nameLanguage] ?? ''}
      onChange={event => onChange({ ...value, [nameLanguage]: event.target.value })}
      aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : `${id}-help`}
      className="min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-950 outline-none focus:border-emphasis focus:ring-2 focus:ring-emphasis/25 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
    <p id={`${id}-help`} className="text-sm leading-5 text-zinc-500 dark:text-zinc-400">{tr(language, 'One name is enough. Other languages are optional.', '至少填写一种名称，其他语言可选。', 'Satu nama sudah memadai. Bahasa lain adalah pilihan.')}</p>
    {error && <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-red-600 dark:text-red-400">{error}</p>}
  </div>;
}
