"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type SupportedLanguage = "en" | "pt" | "es";

type Translations = Record<string, Record<SupportedLanguage, string>>;

const translations: Translations = {
  nav_dashboard: { en: "Dashboard", pt: "Painel", es: "Panel" },
  nav_study: { en: "Study", pt: "Estudo", es: "Estudio" },
  nav_flashcards: { en: "Flashcards", pt: "Flashcards", es: "Fichas" },
  nav_results: { en: "Results", pt: "Resultados", es: "Resultados" },
  nav_progress: { en: "Progress", pt: "Progresso", es: "Progreso" },
  nav_settings: { en: "Settings", pt: "Configurações", es: "Configuración" },
  nav_whatsapp: { en: "WhatsApp", pt: "WhatsApp", es: "WhatsApp" },
  lang_en: { en: "English", pt: "Inglês", es: "Inglés" },
  lang_pt: { en: "Português", pt: "Português", es: "Portugués" },
  lang_es: { en: "Español", pt: "Espanhol", es: "Español" },
};

type LanguageContextType = {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = "usmle_selected_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && ["en", "pt", "es"].includes(saved)) {
        setLanguageState(saved);
      }
    } catch {
      // Ignore local storage errors
    }
  }, []);

  function setLanguage(lang: SupportedLanguage) {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  }

  function t(key: string): string {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
