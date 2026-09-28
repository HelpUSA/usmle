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
  welcome_back: { en: "Welcome back", pt: "Bem-vindo de volta", es: "Bienvenido de nuevo" },
  total_sessions: { en: "Total sessions", pt: "Total de sessões", es: "Total de sesiones" },
  completion_rate: { en: "Completion rate", pt: "Taxa de conclusão", es: "Tasa de finalización" },
  most_used_mode: { en: "Most used mode", pt: "Modo mais usado", es: "Modo más usado" },
  open_sessions: { en: "Open sessions", pt: "Sessões abertas", es: "Sesiones abiertas" },
  activity: { en: "Activity", pt: "Atividade", es: "Actividad" },
  mode_mix: { en: "Mode mix", pt: "Distribuição de modos", es: "Mezcla de modos" },
  status_mix: { en: "Status mix", pt: "Status das sessões", es: "Estado de sesiones" },
  study_hub: { en: "Study hub", pt: "Central de Estudos", es: "Centro de Estudio" },
  quick_navigation: { en: "Quick navigation", pt: "Navegação rápida", es: "Navegación rápida" },
  open_study: { en: "Open Study", pt: "Abrir Estudos", es: "Abrir Estudio" },
  continue_google: { en: "Continue with Google", pt: "Continuar com o Google", es: "Continuar con Google" },
  sign_out: { en: "Sign out", pt: "Sair da conta", es: "Cerrar sesión" },
  day_streak: { en: "day streak", pt: "dias seguidos", es: "días seguidos" },
  daily_goal: { en: "Daily Goal", pt: "Meta Diária", es: "Meta Diaria" },
  break_timer: { en: "USMLE 2026 Break Timer", pt: "Cronômetro de Pausa USMLE 2026", es: "Temporizador de Pausa USMLE 2026" },
  log_practice_exam: { en: "Log Practice Exam (NBME / Free 120)", pt: "Registrar Simulado (NBME / Free 120)", es: "Registrar Examen (NBME / Free 120)" },
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
