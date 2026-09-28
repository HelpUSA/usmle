"use client";

import { useLanguage } from "@/context/LanguageContext";
import type { SupportedLanguage } from "@/context/LanguageContext";

const OPTIONS: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "pt", label: "PT", flag: "🇧🇷" },
  { code: "es", label: "ES", flag: "🇪🇸" },
];

type LanguageSelectorProps = {
  isMobile?: boolean;
};

export default function LanguageSelector({ isMobile = false }: LanguageSelectorProps) {
  const { language, setLanguage } = useLanguage();

  if (isMobile) {
    return (
      <div style={{ display: "flex", gap: "8px", margin: "8px 0" }}>
        {OPTIONS.map((opt) => (
          <button
            key={opt.code}
            type="button"
            onClick={() => setLanguage(opt.code)}
            style={{
              flex: 1,
              padding: "8px",
              borderRadius: "8px",
              border: language === opt.code ? "2px solid #2563eb" : "1px solid #e2e8f0",
              backgroundColor: language === opt.code ? "#eff6ff" : "#ffffff",
              color: language === opt.code ? "#2563eb" : "#475569",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span>{opt.flag}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", display: "inline-block", margin: "0 4px" }}>
      <select
        aria-label="Select language"
        value={language}
        onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          padding: "8px 24px 8px 10px",
          borderRadius: "8px",
          border: "1px solid #cbd5e1",
          backgroundColor: "#ffffff",
          color: "#334155",
          fontSize: "13px",
          fontWeight: 700,
          cursor: "pointer",
          backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px top 50%",
          backgroundSize: "8px auto",
        }}
      >
        <option value="en">🇺🇸 EN</option>
        <option value="pt">🇧🇷 PT</option>
        <option value="es">🇪🇸 ES</option>
      </select>
    </div>
  );
}
