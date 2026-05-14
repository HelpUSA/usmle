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
 * - Settings can later migrate to users_profile/settings_json or the
 *   user_study_preferences/user_excluded_medical_areas tables.
 */

"use client";

import { useEffect, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

type StudyMode = "practice" | "timed_block" | "exam_sim";
type ExamType = "step1" | "step2ck" | "step3";
type DifficultyDefault = "easy" | "medium" | "hard" | "all";
type DifficultyOrderMode = "random" | "ascending" | "descending";
type AreaOrderMode = "random" | "by_area";

type MedicalArea = {
  slug: string;
  name: string;
  description: string;
};

type UserSettings = {
  defaultExam: ExamType;
  defaultMode: StudyMode;
  practiceQuestionCount: number;
  autoOpenReviewAfterSubmit: boolean;
  confirmBeforeLeavingSession: boolean;
  emphasizeTimer: boolean;
  excludedAreaSlugs: string[];
  difficultyDefault: DifficultyDefault;
  difficultyOrderMode: DifficultyOrderMode;
  areaOrderMode: AreaOrderMode;
};

type ToggleSettingKey =
  | "autoOpenReviewAfterSubmit"
  | "confirmBeforeLeavingSession"
  | "emphasizeTimer";

const HELPUS_SITE_URL = "https://helpusbr.com";
const HELPUS_WHATSAPP_URL = "https://wa.me/5583998721848";
const SETTINGS_STORAGE_KEY = "usmle_user_settings_v1";

const MEDICAL_AREAS: MedicalArea[] = [
  {
    slug: "cardiology",
    name: "Cardiology",
    description:
      "Cardiovascular physiology, pathology, pharmacology, and congenital or acquired heart disease.",
  },
  {
    slug: "pulmonology",
    name: "Pulmonology",
    description:
      "Respiratory physiology, pulmonary pathology, ventilation, and gas exchange.",
  },
  {
    slug: "renal",
    name: "Renal",
    description:
      "Kidney physiology, electrolytes, acid-base, nephrology, and diuretics.",
  },
  {
    slug: "gastroenterology",
    name: "Gastroenterology",
    description:
      "Gastrointestinal physiology, malabsorption, hepatobiliary disease, and nutrition.",
  },
  {
    slug: "endocrinology",
    name: "Endocrinology",
    description: "Hormonal physiology and endocrine pathology.",
  },
  {
    slug: "hematology",
    name: "Hematology",
    description:
      "Anemias, coagulation, hemolysis, transfusion medicine, and blood cell disorders.",
  },
  {
    slug: "immunology",
    name: "Immunology",
    description:
      "Immune mechanisms, hypersensitivity, immunodeficiency, and autoimmunity.",
  },
  {
    slug: "microbiology",
    name: "Microbiology",
    description:
      "Bacteria, viruses, fungi, parasites, antimicrobial mechanisms, and infectious disease.",
  },
  {
    slug: "pharmacology",
    name: "Pharmacology",
    description:
      "Drug mechanisms, adverse effects, contraindications, and therapeutic sequencing.",
  },
  {
    slug: "neurology",
    name: "Neurology",
    description:
      "Neuroanatomy, neuromuscular disease, neurologic pathology, and neurophysiology.",
  },
  {
    slug: "biochemistry_genetics",
    name: "Biochemistry/Genetics",
    description:
      "Metabolism, molecular genetics, inherited disease, and biochemical pathways.",
  },
  {
    slug: "pediatrics",
    name: "Pediatrics",
    description:
      "Neonatal and pediatric disease, development, and congenital conditions.",
  },
  {
    slug: "reproductive_gynecology",
    name: "Reproductive/Gynecology",
    description:
      "Reproductive endocrinology, gynecology, pregnancy-related medicine, and menstrual disorders.",
  },
  {
    slug: "pathology",
    name: "Pathology",
    description:
      "Core pathologic mechanisms, biomarkers, tissue injury, and disease patterns.",
  },
  {
    slug: "physiology",
    name: "Physiology",
    description:
      "Normal and abnormal physiologic mechanisms across organ systems.",
  },
  {
    slug: "psychiatry_behavioral",
    name: "Psychiatry/Behavioral",
    description:
      "Psychiatry, behavioral science, substance use, and patient behavior.",
  },
  {
    slug: "biostatistics_ethics",
    name: "Biostatistics/Ethics",
    description:
      "Biostatistics, epidemiology, ethics, patient safety, and communication.",
  },
];

const defaultSettings: UserSettings = {
  defaultExam: "step1",
  defaultMode: "practice",
  practiceQuestionCount: 10,
  autoOpenReviewAfterSubmit: true,
  confirmBeforeLeavingSession: true,
  emphasizeTimer: true,
  excludedAreaSlugs: [],
  difficultyDefault: "easy",
  difficultyOrderMode: "random",
  areaOrderMode: "random",
};

function isStudyMode(value: unknown): value is StudyMode {
  return value === "practice" || value === "timed_block" || value === "exam_sim";
}

function isExamType(value: unknown): value is ExamType {
  return value === "step1" || value === "step2ck" || value === "step3";
}

function isDifficultyDefault(value: unknown): value is DifficultyDefault {
  return value === "easy" || value === "medium" || value === "hard" || value === "all";
}

function isDifficultyOrderMode(value: unknown): value is DifficultyOrderMode {
  return value === "random" || value === "ascending" || value === "descending";
}

function isAreaOrderMode(value: unknown): value is AreaOrderMode {
  return value === "random" || value === "by_area";
}

function isValidAreaSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    MEDICAL_AREAS.some((area) => area.slug === value)
  );
}

function normalizeExcludedAreaSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.filter(isValidAreaSlug)));
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

      excludedAreaSlugs: normalizeExcludedAreaSlugs(parsed.excludedAreaSlugs),

      difficultyDefault: isDifficultyDefault(parsed.difficultyDefault)
        ? parsed.difficultyDefault
        : defaultSettings.difficultyDefault,

      difficultyOrderMode: isDifficultyOrderMode(parsed.difficultyOrderMode)
        ? parsed.difficultyOrderMode
        : defaultSettings.difficultyOrderMode,

      areaOrderMode: isAreaOrderMode(parsed.areaOrderMode)
        ? parsed.areaOrderMode
        : defaultSettings.areaOrderMode,
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
    case "step2ck":
      return "Step 2 CK";
    case "step3":
      return "Step 3";
    default: {
      const exhaustiveCheck: never = exam;
      return exhaustiveCheck;
    }
  }
}

function difficultyDefaultLabel(value: DifficultyDefault): string {
  switch (value) {
    case "easy":
      return "Easy only";
    case "medium":
      return "Medium only";
    case "hard":
      return "Hard only";
    case "all":
      return "All difficulties / balanced";
    default: {
      const exhaustiveCheck: never = value;
      return exhaustiveCheck;
    }
  }
}

function difficultyOrderLabel(value: DifficultyOrderMode): string {
  switch (value) {
    case "random":
      return "Random";
    case "ascending":
      return "Ascending: Easy → Medium → Hard";
    case "descending":
      return "Descending: Hard → Medium → Easy";
    default: {
      const exhaustiveCheck: never = value;
      return exhaustiveCheck;
    }
  }
}

function areaOrderLabel(value: AreaOrderMode): string {
  switch (value) {
    case "random":
      return "Random";
    case "by_area":
      return "Group by medical area";
    default: {
      const exhaustiveCheck: never = value;
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

  const includedAreaCount =
    MEDICAL_AREAS.length - settings.excludedAreaSlugs.length;

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

  function handleIncludeAllAreas() {
    setSettings((prev) => ({
      ...prev,
      excludedAreaSlugs: [],
    }));
  }

  function updateToggle(key: ToggleSettingKey, value: boolean) {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function updateAreaInclusion(areaSlug: string, shouldInclude: boolean) {
    setSettings((prev) => {
      const excluded = new Set(prev.excludedAreaSlugs);

      if (shouldInclude) {
        excluded.delete(areaSlug);
      } else {
        const currentlyIncluded = MEDICAL_AREAS.length - excluded.size;

        if (currentlyIncluded <= 1) {
          return prev;
        }

        excluded.add(areaSlug);
      }

      return {
        ...prev,
        excludedAreaSlugs: Array.from(excluded).filter(isValidAreaSlug),
      };
    });
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
                <option value="step2ck">Step 2 CK</option>
                <option value="step3">Step 3</option>
                <option value="step2ck">Step 2 CK</option>
                <option value="step3">Step 3</option>
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
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>
                Question filters and order
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#6b7280",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                These settings are applied when a new session is generated.
                Existing sessions keep their original question sequence.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>
                  Default difficulty
                </label>

                <select
                  value={settings.difficultyDefault}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    setSettings((prev) => ({
                      ...prev,
                      difficultyDefault: isDifficultyDefault(nextValue)
                        ? nextValue
                        : defaultSettings.difficultyDefault,
                    }));
                  }}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    background: "white",
                  }}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="all">All difficulties / balanced</option>
                </select>

                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Current:{" "}
                  <strong>
                    {difficultyDefaultLabel(settings.difficultyDefault)}
                  </strong>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>
                  Difficulty order
                </label>

                <select
                  value={settings.difficultyOrderMode}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    setSettings((prev) => ({
                      ...prev,
                      difficultyOrderMode: isDifficultyOrderMode(nextValue)
                        ? nextValue
                        : defaultSettings.difficultyOrderMode,
                    }));
                  }}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    background: "white",
                  }}
                >
                  <option value="random">Random</option>
                  <option value="ascending">Ascending: Easy → Medium → Hard</option>
                  <option value="descending">Descending: Hard → Medium → Easy</option>
                </select>

                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Current:{" "}
                  <strong>
                    {difficultyOrderLabel(settings.difficultyOrderMode)}
                  </strong>
                </div>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>
                  Area order
                </label>

                <select
                  value={settings.areaOrderMode}
                  onChange={(event) => {
                    const nextValue = event.target.value;

                    setSettings((prev) => ({
                      ...prev,
                      areaOrderMode: isAreaOrderMode(nextValue)
                        ? nextValue
                        : defaultSettings.areaOrderMode,
                    }));
                  }}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    background: "white",
                  }}
                >
                  <option value="random">Random</option>
                  <option value="by_area">Group by medical area</option>
                </select>

                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  Current:{" "}
                  <strong>{areaOrderLabel(settings.areaOrderMode)}</strong>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: 14,
                borderRadius: 16,
                border: "1px solid #eef2f7",
                background: "#fcfcfd",
                display: "grid",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>Medical areas</div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    Included by default: {includedAreaCount} of{" "}
                    {MEDICAL_AREAS.length}. Uncheck areas you do not want to
                    see.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleIncludeAllAreas}
                  disabled={settings.excludedAreaSlugs.length === 0}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: "1px solid #d1d5db",
                    background: "white",
                    color: "#374151",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor:
                      settings.excludedAreaSlugs.length === 0
                        ? "not-allowed"
                        : "pointer",
                    opacity: settings.excludedAreaSlugs.length === 0 ? 0.55 : 1,
                  }}
                >
                  Include all areas
                </button>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                }}
              >
                {MEDICAL_AREAS.map((area) => {
                  const isIncluded = !settings.excludedAreaSlugs.includes(
                    area.slug
                  );

                  return (
                    <label
                      key={area.slug}
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "flex-start",
                        padding: 12,
                        borderRadius: 14,
                        border: isIncluded
                          ? "1px solid #bfdbfe"
                          : "1px solid #e5e7eb",
                        background: isIncluded ? "#f8fbff" : "#f9fafb",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={(event) =>
                          updateAreaInclusion(area.slug, event.target.checked)
                        }
                        style={{
                          marginTop: 3,
                          transform: "scale(1.1)",
                        }}
                      />

                      <div style={{ lineHeight: 1.45 }}>
                        <div style={{ fontWeight: 850 }}>{area.name}</div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: "#6b7280",
                          }}
                        >
                          {area.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                At least one medical area must remain selected. Areas without
                available questions will simply not contribute items until
                content is added.
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
