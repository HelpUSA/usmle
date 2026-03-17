/**
 * SettingsPage
 *
 * 📍 Localização:
 * src/app/settings/page.tsx
 *
 * Objetivo:
 * - Criar a primeira página real de configurações do usuário
 * - Oferecer uma área clara para preferências pessoais e de estudo
 * - Funcionar bem em celular e desktop
 *
 * Escopo desta primeira versão:
 * - Account:
 *   - nome
 *   - email
 *   - logout
 * - Study defaults:
 *   - exame padrão
 *   - modo padrão
 *   - quantidade padrão para Practice
 * - Session preferences:
 *   - abrir review automaticamente ao final
 *   - confirmar antes de abandonar sessão
 *   - timer destacado
 * - Support:
 *   - link para WhatsApp HelpUS
 *   - link para site HelpUS
 *
 * Persistência nesta fase:
 * - Preferências ficam salvas em localStorage
 * - Isso permite UX funcional antes de criar backend específico de settings
 *
 * Observações:
 * - Em versão futura, essas preferências podem migrar para users_profile/settings_json
 * - A UI já foi organizada pensando nessa evolução
 *
 * ✅ Atualização (2026-03-17):
 * - Primeira página real de Settings criada
 * - Mobile-first
 * - Persistência local habilitada
 * - Botão de reset para restaurar padrões
 */

"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";

type StudyMode = "practice" | "timed_block" | "exam_sim";
type ExamType = "step1";

type UserSettings = {
  defaultExam: ExamType;
  defaultMode: StudyMode;
  practiceQuestionCount: number;
  autoOpenReviewAfterSubmit: boolean;
  confirmBeforeLeavingSession: boolean;
  emphasizeTimer: boolean;
};

type ToggleSettingKey =
  | "autoOpenReviewAfterSubmit"
  | "confirmBeforeLeavingSession"
  | "emphasizeTimer";

const HELPUS_SITE_URL = "https://helpusbr.com";
const HELPUS_WHATSAPP_URL = "https://wa.me/5583998721848";
const SETTINGS_STORAGE_KEY = "usmle_user_settings_v1";

const defaultSettings: UserSettings = {
  defaultExam: "step1",
  defaultMode: "practice",
  practiceQuestionCount: 10,
  autoOpenReviewAfterSubmit: true,
  confirmBeforeLeavingSession: true,
  emphasizeTimer: true,
};

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      defaultExam: parsed.defaultExam === "step1" ? "step1" : defaultSettings.defaultExam,
      defaultMode:
        parsed.defaultMode === "practice" ||
        parsed.defaultMode === "timed_block" ||
        parsed.defaultMode === "exam_sim"
          ? parsed.defaultMode
          : defaultSettings.defaultMode,
      practiceQuestionCount:
        typeof parsed.practiceQuestionCount === "number" &&
        parsed.practiceQuestionCount >= 1 &&
        parsed.practiceQuestionCount <= 200
          ? parsed.practiceQuestionCount
          : defaultSettings.practiceQuestionCount,
      autoOpenReviewAfterSubmit:
        typeof parsed.autoOpenReviewAfterSubmit === "boolean"
          ? parsed.autoOpenReviewAfterSubmit
          : defaultSettings.autoOpenReviewAfterSubmit,
      confirmBeforeLeavingSession:
        typeof parsed.confirmBeforeLeavingSession === "boolean"
          ? parsed.confirmBeforeLeavingSession
          : defaultSettings.confirmBeforeLeavingSession,
      emphasizeTimer:
        typeof parsed.emphasizeTimer === "boolean"
          ? parsed.emphasizeTimer
          : defaultSettings.emphasizeTimer,
    };
  } catch {
    return defaultSettings;
  }
}

function modeLabel(mode: StudyMode) {
  switch (mode) {
    case "practice":
      return "Practice";
    case "timed_block":
      return "Timed block";
    case "exam_sim":
      return "Exam simulation";
    default:
      return mode;
  }
}

export default function SettingsPage() {
  const { data: session, status } = useSession();

  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [saved, setSaved] = useState(false);

  const isSignedIn = !!session?.user?.email;

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);

    const t = window.setTimeout(() => setSaved(false), 1200);
    return () => window.clearTimeout(t);
  }, [settings]);

  async function handleSignOut() {
    await signOut({ callbackUrl: "/" });
  }

  function handleResetDefaults() {
    setSettings(defaultSettings);
  }

  function updateToggle(key: ToggleSettingKey, value: boolean) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  return (
    <main
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <section
        style={{
          padding: 18,
          borderRadius: 22,
          border: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {status === "loading"
            ? "Loading session…"
            : isSignedIn
            ? `Signed in as ${session?.user?.email}`
            : "Not signed in"}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                lineHeight: 1.08,
                fontWeight: 900,
              }}
            >
              Settings
            </h1>
            <div style={{ marginTop: 6, color: "#4b5563", lineHeight: 1.55 }}>
              Personalize your account and study defaults.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={handleResetDefaults}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#374151",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Reset defaults
            </button>

            <div
              style={{
                minWidth: 110,
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #dbeafe",
                background: saved ? "#eff6ff" : "#f9fafb",
                color: saved ? "#1d4ed8" : "#6b7280",
                fontSize: 12,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              {saved ? "Saved" : "Local settings"}
            </div>
          </div>
        </div>
      </section>

      {!isSignedIn ? (
        <section
          style={{
            padding: 18,
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 20 }}>Sign in to use settings</div>
          <div style={{ marginTop: 8, color: "#555", lineHeight: 1.6 }}>
            Settings are more useful when tied to your study account.
          </div>
        </section>
      ) : (
        <>
          {/* Account */}
          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Account</div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid #eef2f7",
                  background: "#fcfcfd",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>Name</div>
                <div style={{ marginTop: 6, fontWeight: 800 }}>
                  {session?.user?.name ?? "—"}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  border: "1px solid #eef2f7",
                  background: "#fcfcfd",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>Email</div>
                <div
                  style={{
                    marginTop: 6,
                    fontWeight: 800,
                    wordBreak: "break-word",
                  }}
                >
                  {session?.user?.email ?? "—"}
                </div>
              </div>
            </div>

            <button
              onClick={handleSignOut}
              style={{
                width: "100%",
                maxWidth: 220,
                padding: "12px 14px",
                borderRadius: 14,
                border: "1px solid #d1d5db",
                background: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Sign out
            </button>
          </section>

          {/* Study defaults */}
          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Study defaults</div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#555" }}>Default exam</label>
              <select
                value={settings.defaultExam}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultExam: e.target.value as ExamType,
                  }))
                }
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "white",
                }}
              >
                <option value="step1">Step 1</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#555" }}>Default mode</label>
              <select
                value={settings.defaultMode}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    defaultMode: e.target.value as StudyMode,
                  }))
                }
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "white",
                }}
              >
                <option value="practice">Practice</option>
                <option value="timed_block">Timed block</option>
                <option value="exam_sim">Exam simulation</option>
              </select>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Current default: <strong>{modeLabel(settings.defaultMode)}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#555" }}>
                Practice question count
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={settings.practiceQuestionCount}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    practiceQuestionCount: Math.min(
                      200,
                      Math.max(1, Number(e.target.value) || 1)
                    ),
                  }))
                }
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                }}
              />
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Used as the preferred count for daily untimed study.
              </div>
            </div>
          </section>

          {/* Session behavior */}
          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Session behavior</div>

            {[
              {
                key: "autoOpenReviewAfterSubmit" as ToggleSettingKey,
                label: "Open review automatically after session submit",
              },
              {
                key: "confirmBeforeLeavingSession" as ToggleSettingKey,
                label: "Confirm before leaving an active session",
              },
              {
                key: "emphasizeTimer" as ToggleSettingKey,
                label: "Show timer in highlighted mode during timed sessions",
              },
            ].map((item) => (
              <label
                key={item.key}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #eef2f7",
                  background: "#fcfcfd",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={settings[item.key]}
                  onChange={(e) => updateToggle(item.key, e.target.checked)}
                  style={{
                    marginTop: 2,
                    transform: "scale(1.1)",
                  }}
                />
                <div style={{ lineHeight: 1.5 }}>{item.label}</div>
              </label>
            ))}
          </section>

          {/* Support */}
          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Support</div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <a
                href={HELPUS_WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "1px solid #d9f0df",
                  background: "#f6fff8",
                  textDecoration: "none",
                  color: "#166534",
                  fontWeight: 900,
                }}
              >
                Open WhatsApp
              </a>

              <a
                href={HELPUS_SITE_URL}
                target="_blank"
                rel="noreferrer"
                style={{
                  padding: "14px 16px",
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  background: "#fcfcfd",
                  textDecoration: "none",
                  color: "#111827",
                  fontWeight: 900,
                }}
              >
                Visit HelpUS site
              </a>
            </div>
          </section>
        </>
      )}
    </main>
  );
}