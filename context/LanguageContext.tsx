import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

type Language = 'en' | 'pt';

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => Promise<void>;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('pt');
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const loadTranslations = useCallback(async () => {
    setLoading(true);
    try {
        const response = await fetch(`/locales/pt.json`);
        if (!response.ok) {
            console.error(`Failed to load pt.json. This is a critical error.`);
            throw new Error('Failed to load Portuguese translations.');
        }
        const newMessages = await response.json();
        setMessages(newMessages);
        setLanguageState('pt');
    } catch (error) {
        console.error("Could not load translation file.", error);
        setMessages({});
    } finally {
        setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadTranslations();
  }, [loadTranslations]);

  const setLanguage = async (lang: Language) => {
    // This function is now a no-op as the language is fixed to Portuguese.
    return Promise.resolve();
  };

  const t = (key: string, replacements?: { [key:string]: string | number }): string => {
    let message = key.split('.').reduce((o, i) => (o ? o[i] : undefined), messages as any) || key;
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        message = message.replace(`{${placeholder}}`, String(replacements[placeholder]));
      });
    }
    return message;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, loading }}>
      {loading ? (
        <div className="bg-zinc-50 dark:bg-black min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sky-500"></div>
        </div>
      ) : children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
