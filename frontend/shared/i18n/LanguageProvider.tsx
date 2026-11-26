'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { translate, type Language } from './messages';

const LanguageContext = createContext({ language: 'en' as Language, setLanguage: (_language: Language) => {}, t: (message: string, ...values: (string | number | null | undefined)[]) => translate('en', message, ...values) });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>('en');
  useEffect(() => {
    try { if (localStorage.getItem('weave-language') === 'zh-CN') updateLanguage('zh-CN'); } catch { /* Storage can be disabled; switching still works in memory. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next);
    try { localStorage.setItem('weave-language', next); } catch { /* Keep the in-memory preference. */ }
  }, []);
  const t = useCallback((message: string, ...values: (string | number | null | undefined)[]) => translate(language, message, ...values), [language]);
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <Button type="button" variant="outline" size="sm" className="shrink-0" aria-label={language === 'en' ? '切换到中文' : 'Switch to English'} onClick={() => setLanguage(language === 'en' ? 'zh-CN' : 'en')}><span lang="en" className={language === 'en' ? 'font-semibold' : 'opacity-60'}>EN</span><span aria-hidden="true">/</span><span lang="zh-CN" className={language === 'zh-CN' ? 'font-semibold' : 'opacity-60'}>中文</span></Button>;
}
