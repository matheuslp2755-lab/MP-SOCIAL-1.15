import React, { createContext, useState, useContext, useEffect } from 'react';

// Only 'pt' is a valid language now.
type Language = 'pt';

interface LanguageContextType {
  language: Language;
  // Keep setLanguage as a no-op function for components that might still call it, to avoid crashes.
  setLanguage: (language: Language) => void;
  t: (key: string, replacements?: { [key: string]: string | number }) => string;
  loading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Hardcode the language to Portuguese.
  const language: Language = 'pt';
  const [messages, setMessages] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // This function does nothing, as the language is fixed.
  const setLanguage = (lang: Language) => {};

  useEffect(() => {
    const loadTranslations = async () => {
      setLoading(true);
      try {
        // Always load the Portuguese translation file.
        const response = await fetch(`/locales/pt.json`);
        if (!response.ok) throw new Error('Failed to load translations');
        const newMessages = await response.json();
        setMessages(newMessages);
      } catch (error) {
        console.error(`Could not load translation file for pt.`, error);
        setMessages({});
      } finally {
        setLoading(false);
      }
    };

    loadTranslations();
  }, []); // The effect runs only once on mount.

  const t = (key: string, replacements?: { [key:string]: string | number }): string => {
    let message = key.split('.').reduce((o, i) => (o ? o[i] : undefined), messages) || key;
    if (replacements && typeof message === 'string') {
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
