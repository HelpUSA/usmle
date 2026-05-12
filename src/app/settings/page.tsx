/*
 * File: src/app/settings/page.tsx
 *
 * Responsibility:
 * - Render the user Settings page.
 * - Let the signed-in user review account information.
 * - Let the user configure local study preferences used by:
 *   - src/app/study/page.tsx;
 *   - src/app/session/[sessionId]/page.tsx;
 *   - src/app/ProtectedNavLink.tsx.
 *
 * Current persistence strategy:
 * - Settings are stored in localStorage under usmle_user_settings_v1.
 * - This keeps the UX functional before a backend settings table/profile field
 *   is introduced.
 *
 * Important behavior:
 * - Does not overwrite saved localStorage values before hydration completes.
 * - Keeps the local settings schema compatible with the rest of the app.
 * - Settings can later migrate to users_profile/settings_json.
 */

"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

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

function isStudyMode(value: unknown): value is StudyMode {
  return value === "practice" || value === "timed_block" || value === "exam_sim";
}

function isExamType(value: unknown): value is ExamType {
  return value === "step1";
}

function clampPracticeQuestionCount(value: unknown): number {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return defaultSettings.practiceQuestionCount;
  }

  return Math.min(200, Math.max(1, Math.round(numeric)));
}

function loadSettings(): UserSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      defaultExam: isExamType(parsed.defaultExam)
        ? parsed.defaultExam
        : defaultSettings.defaultExam,

      defaultMode: isStudyMode(parsed.defaultMode)
        ? parsed.defaultMode
        : defaultSettings.defaultMode,

      practiceQuestionCount: clampPracticeQuestionCount(
        parsed.practiceQuestionCount
      ),

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

function modeLabel(mode: StudyMode): string {
  switch (mode) {
    case "practice":
      return "Practice";
    case "timed_block":
      return "Timed block";
    case "exam_sim":
      return "Exam simulation";
    default: {
      const exhaustiveCheck: never = mode;
      return exhaustiveCheck;
    }
  }
}

function examLabel(exam: ExamType): string {
  switch (exam) {
    case "step1":
      return "Step 1";
    default: {
      const exhaustiveCheck: never = exam;
      return exhaustiveCheck;
    }
  }
}

export default function SettingsPage() {
  const { data: session, status } = useSession();

  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAuthLoading = status === "loading";
  const isSignedIn =
    status === "authenticated" && Boolean(session?.user?.email);

  useEffect(() => {
    setSettings(loadSettings());
    setHasLoadedSettings(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSettings || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);

    const timer = window.setTimeout(() => setSaved(false), 1200);

    return () => window.clearTimeout(timer);
  }, [settings, hasLoadedSettings]);

  async function handleSignIn() {
    await signIn("google", { callbackUrl: "/settings" });
  }

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
          {isAuthLoading
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

            <div
              style={{
                marginTop: 6,
                color: "#4b5563",
                lineHeight: 1.55,
              }}
            >
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
              type="button"
              onClick={handleResetDefaults}
              disabled={!hasLoadedSettings}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#374151",
                fontSize: 12,
                fontWeight: 800,
                cursor: hasLoadedSettings ? "pointer" : "not-allowed",
                opacity: hasLoadedSettings ? 1 : 0.55,
              }}
            >
              Reset defaults
            </button>

            <div
              style={{
                minWidth: 116,
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
              {!hasLoadedSettings
                ? "Loading"
                : saved
                ? "Saved"
                : "Local settings"}
            </div>
          </div>
        </div>
      </section>

      {isAuthLoading ? (
        <section
          style={{
            padding: 18,
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          Loading your account…
        </section>
      ) : !isSignedIn ? (
        <section
          style={{
            padding: 18,
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "white",
            display: "grid",
            gap: 12,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 20 }}>
            Sign in to use settings
          </div>

          <div style={{ color: "#555", lineHeight: 1.6 }}>
            Settings are more useful when tied to your study account. Local
            preferences will still be preserved in this browser.
          </div>

          <button
            type="button"
            onClick={() => void handleSignIn()}
            style={{
              width: "100%",
              maxWidth: 260,
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
          >
            Continue with Google
          </button>
        </section>
      ) : (
        <>
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
              <InfoCard label="Name" value={session?.user?.name ?? "—"} />

              <InfoCard label="Email" value={session?.user?.email ?? "—"} />
            </div>

            <button
              type="button"
              onClick={() => void handleSignOut()}
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
              <label style={{ fontSize: 13, color: "#555" }}>
                Default exam
              </label>

              <select
                value={settings.defaultExam}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  setSettings((prev) => ({
                    ...prev,
                    defaultExam: isExamType(nextValue)
                      ? nextValue
                      : defaultSettings.defaultExam,
                  }));
                }}
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "white",
                }}
              >
                <option value="step1">Step 1</option>
              </select>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Current default:{" "}
                <strong>{examLabel(settings.defaultExam)}</strong>
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#555" }}>
                Default mode
              </label>

              <select
                value={settings.defaultMode}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  setSettings((prev) => ({
                    ...prev,
                    defaultMode: isStudyMode(nextValue)
                      ? nextValue
                      : defaultSettings.defaultMode,
                  }));
                }}
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
                Current default:{" "}
                <strong>{modeLabel(settings.defaultMode)}</strong>
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
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    practiceQuestionCount: clampPracticeQuestionCount(
                      event.target.value
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
                Used as the preferred count for daily untimed study. Allowed
                range: 1 to 200.
              </div>
            </div>
          </section>

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
            <div style={{ fontWeight: 900, fontSize: 20 }}>
              Session behavior
            </div>

            {[
              {
                key: "autoOpenReviewAfterSubmit" as const,
                label: "Open review automatically after session submit",
                description:
                  "After finishing a session, go straight to the review page instead of the results page.",
              },
              {
                key: "confirmBeforeLeavingSession" as const,
                label: "Confirm before leaving an active session",
                description:
                  "Show a warning before navigating away from an active session route.",
              },
              {
                key: "emphasizeTimer" as const,
                label: "Show timer in highlighted mode during timed sessions",
                description:
                  "Make the countdown visually stronger in timed blocks and exam simulation.",
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
                  onChange={(event) =>
                    updateToggle(item.key, event.target.checked)
                  }
                  style={{
                    marginTop: 3,
                    transform: "scale(1.1)",
                  }}
                />

                <div style={{ lineHeight: 1.5 }}>
                  <div style={{ fontWeight: 800 }}>{item.label}</div>
                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    {item.description}
                  </div>
                </div>
              </label>
            ))}
          </section>

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

function InfoCard(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        border: "1px solid #eef2f7",
        background: "#fcfcfd",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>

      <div
        style={{
          marginTop: 6,
          fontWeight: 800,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  );
}