/*
 * File: src/app/study/page.tsx
 *
 * Responsibility:
 * - Render the main study entry page.
 * - Let the authenticated user:
 *   - resume the latest open session;
 *   - start Practice;
 *   - start Timed block;
 *   - start Exam simulation;
 *   - start a session using local Settings defaults;
 *   - open recently completed reviews.
 *
 * API contract used:
 * - GET  /api/sessions
 *   Lists recent sessions for the authenticated user.
 * - POST /api/sessions
 *   Creates a new session.
 *   Expected body: { exam, mode }.
 * - POST /api/sessions/:sessionId/items
 *   Generates session items idempotently.
 *   Expected body: { count }.
 *
 * Important auth behavior:
 * - This page relies on NextAuth session state.
 * - It should not inject x-user-id directly.
 * - User resolution should happen in the API/backend layer.
 *
 * UX strategy:
 * - Mobile-first.
 * - Large cards for primary study actions.
 * - Clear distinction between Practice, Timed block, and Exam simulation.
 * - Local Settings are read from localStorage and used as UI/session generation defaults.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiClient";

type SessionMode = "practice" | "timed_block" | "exam_sim";
type ExamType = "step1" | "step2ck" | "step3";
type KnownSessionStatus = "in_progress" | "submitted" | "abandoned";
type DifficultyDefault = "easy" | "medium" | "hard" | "all";
type DifficultyOrderMode = "random" | "ascending" | "descending";
type AreaOrderMode = "random" | "by_area";

type CreateSessionResponse = {
  session_id: string;
  user_id: string;
  mode: SessionMode | string;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: KnownSessionStatus | string | null;
  started_at?: string | null;
  submitted_at?: string | null;
};

type SessionSummary = {
  session_id: string;
  user_id: string;
  mode: SessionMode | string;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: KnownSessionStatus | string | null;
  settings_json?: Record<string, unknown> | null;
  started_at?: string | null;
  submitted_at?: string | null;
};

type SessionsResponse = {
  sessions: SessionSummary[];
};

type UserSettings = {
  defaultExam: ExamType;
  defaultMode: SessionMode;
  practiceQuestionCount: number;
  autoOpenReviewAfterSubmit: boolean;
  confirmBeforeLeavingSession: boolean;
  emphasizeTimer: boolean;
  excludedAreaSlugs: string[];
  difficultyDefault: DifficultyDefault;
  difficultyOrderMode: DifficultyOrderMode;
  areaOrderMode: AreaOrderMode;
};

const SETTINGS_STORAGE_KEY = "usmle_user_settings_v1";

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

function isSessionMode(value: unknown): value is SessionMode {
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

function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(value);
}

function normalizeExcludedAreaSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(isValidSlug)
    )
  );
}

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      defaultExam: isExamType(parsed.defaultExam)
        ? parsed.defaultExam
        : defaultSettings.defaultExam,
      defaultMode: isSessionMode(parsed.defaultMode)
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
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
      return "Easy";
    case "medium":
      return "Medium";
    case "hard":
      return "Hard";
    case "all":
      return "All difficulties";
    default:
      return "Easy";
  }
}

function difficultyOrderLabel(value: DifficultyOrderMode): string {
  switch (value) {
    case "ascending":
      return "Ascending";
    case "descending":
      return "Descending";
    case "random":
    default:
      return "Random";
  }
}

function areaOrderLabel(value: AreaOrderMode): string {
  switch (value) {
    case "by_area":
      return "By medical area";
    case "random":
    default:
      return "Random";
  }
}

function modeLabel(mode?: string | null): string {
  switch (mode) {
    case "practice":
      return "Practice";
    case "timed_block":
      return "Timed block";
    case "exam_sim":
      return "Exam simulation";
    default:
      return mode ?? "Unknown mode";
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function getComparableTime(value?: string | null): number {
  if (!value) return 0;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function getRecommendedCount(mode: SessionMode, settings: UserSettings): number {
  switch (mode) {
    case "practice":
      return settings.practiceQuestionCount;
    case "timed_block":
      return 20;
    case "exam_sim":
      return 20;
    default:
      return 10;
  }
}

function officialFormatSummary(exam: ExamType): string {
  switch (exam) {
    case "step1":
      return "14 blocks x 20 questions";
    case "step2ck":
      return "16 blocks x 18-20 questions";
    case "step3":
      return "Day 1/Day 2 block profiles";
    default: {
      const exhaustiveCheck: never = exam;
      return exhaustiveCheck;
    }
  }
}

function examSimulationDetail(exam: ExamType): string {
  switch (exam) {
    case "step1":
      return "Official target: 14 x 20. Current safe preset: one 20-question block.";
    case "step2ck":
      return "Official target: 16 blocks of 18-20. Current safe preset: one 20-question block.";
    case "step3":
      return "Official target: Day 1/Day 2 profiles. Current safe preset: one 20-question block.";
    default: {
      const exhaustiveCheck: never = exam;
      return exhaustiveCheck;
    }
  }
}

export default function StudyPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [userSettings, setUserSettings] =
    useState<UserSettings>(defaultSettings);

  const isAuthLoading = sessionStatus === "loading";
  const isSignedIn =
    sessionStatus === "authenticated" && Boolean(session?.user?.email);

  useEffect(() => {
    setUserSettings(loadSettings());

    function syncSettings() {
      setUserSettings(loadSettings());
    }

    window.addEventListener("focus", syncSettings);
    window.addEventListener("storage", syncSettings);

    return () => {
      window.removeEventListener("focus", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  const loadSessions = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!isSignedIn) {
      setSessions([]);
      setLoadingSessions(false);
      setErr(null);
      return;
    }

    setLoadingSessions(true);
    setErr(null);

    try {
      const res = await apiFetch<SessionsResponse>("/api/sessions");
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load study sessions"));
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [isAuthLoading, isSignedIn]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = Math.max(
        getComparableTime(a.started_at),
        getComparableTime(a.submitted_at)
      );

      const bTime = Math.max(
        getComparableTime(b.started_at),
        getComparableTime(b.submitted_at)
      );

      return bTime - aTime;
    });
  }, [sessions]);

  const activeSession = useMemo(
    () =>
      sortedSessions.find(
        (sessionItem) => sessionItem.status === "in_progress"
      ) ?? null,
    [sortedSessions]
  );

  const recentCompleted = useMemo(
    () =>
      sortedSessions
        .filter((sessionItem) => sessionItem.status === "submitted")
        .slice(0, 3),
    [sortedSessions]
  );

  const createAndStartSession = useCallback(
    async (mode: SessionMode, customCount?: number) => {
      if (loading) return;

      setLoading(true);
      setErr(null);

      try {
        const effectiveExam = userSettings.defaultExam;
        const effectiveCount =
          typeof customCount === "number"
            ? customCount
            : getRecommendedCount(mode, userSettings);

        const sessionRes = await apiFetch<CreateSessionResponse>(
          "/api/sessions",
          {
            method: "POST",
            body: JSON.stringify({
              mode,
              exam: effectiveExam,
            }),
          }
        );

        await apiFetch<{ items?: unknown[] }>(
          `/api/sessions/${sessionRes.session_id}/items`,
          {
            method: "POST",
            body: JSON.stringify({
              count: effectiveCount,
              includedAreaSlugs: [],
              excludedAreaSlugs: userSettings.excludedAreaSlugs,
              difficultyDefault: userSettings.difficultyDefault,
              difficultyOrderMode: userSettings.difficultyOrderMode,
              areaOrderMode: userSettings.areaOrderMode,
            }),
          }
        );

        router.push(`/session/${sessionRes.session_id}`);
      } catch (error) {
        setErr(getErrorMessage(error, "Failed to start study session"));
      } finally {
        setLoading(false);
      }
    },
    [loading, router, userSettings]
  );

  const defaultModeCount = getRecommendedCount(
    userSettings.defaultMode,
    userSettings
  );

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

        <h1
          style={{
            margin: 0,
            fontSize: 30,
            lineHeight: 1.08,
            fontWeight: 900,
          }}
        >
          Study
        </h1>

        <div
          style={{
            color: "#4b5563",
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          Launch practice, timed blocks, or exam-style training using the newer USMLE block rhythm.
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
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 20 }}>Sign in to study</div>

          <div style={{ marginTop: 8, color: "#555", lineHeight: 1.6 }}>
            You need to be signed in to create or resume sessions.
          </div>
        </section>
      ) : (
        <>
          {err ? (
            <section
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#9f1239",
              }}
            >
              <div style={{ fontWeight: 900 }}>Error</div>
              <div style={{ marginTop: 6 }}>{err}</div>

              <button
                type="button"
                onClick={() => void loadSessions()}
                disabled={loadingSessions}
                style={{
                  ...buttonStyle(loadingSessions),
                  marginTop: 12,
                  background: "white",
                }}
              >
                {loadingSessions ? "Refreshing…" : "Refresh sessions"}
              </button>
            </section>
          ) : null}

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
                <div style={{ fontWeight: 900, fontSize: 22 }}>
                  Use my defaults
                </div>

                <div
                  style={{
                    marginTop: 6,
                    color: "#6b7280",
                    lineHeight: 1.5,
                  }}
                >
                  Start with your preferred setup from Settings. Timed and simulation modes now use a 20-question official-format block preset.
                </div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/settings")}
                style={buttonStyle()}
              >
                Open Settings
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              }}
            >
              <InfoCard
                label="Default exam"
                value={examLabel(userSettings.defaultExam)}
              />

              <InfoCard
                label="Default mode"
                value={modeLabel(userSettings.defaultMode)}
              />

              <InfoCard
                label="Default count"
                value={`${defaultModeCount} questions`}
              />

              <InfoCard
                label="Official 2026 format"
                value={officialFormatSummary(userSettings.defaultExam)}
              />

              <InfoCard
                label="Timed block preset"
                value="20 questions · 30 min"
              />

              <InfoCard
                label="Difficulty"
                value={difficultyDefaultLabel(userSettings.difficultyDefault)}
              />

              <InfoCard
                label="Difficulty order"
                value={difficultyOrderLabel(userSettings.difficultyOrderMode)}
              />

              <InfoCard
                label="Area order"
                value={areaOrderLabel(userSettings.areaOrderMode)}
              />

              <InfoCard
                label="Excluded areas"
                value={
                  userSettings.excludedAreaSlugs.length === 0
                    ? "None"
                    : `${userSettings.excludedAreaSlugs.length} excluded`
                }
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void createAndStartSession(
                  userSettings.defaultMode,
                  defaultModeCount
                )
              }
              disabled={loading}
              style={{
                width: "100%",
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 900,
                fontSize: 16,
                opacity: loading ? 0.65 : 1,
              }}
            >
              {loading
                ? "Starting…"
                : `Start ${modeLabel(userSettings.defaultMode)}`}
            </button>
          </section>

          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            <div
              style={{
                padding: 18,
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "white",
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20 }}>Continue</div>

              {loadingSessions ? (
                <div style={{ color: "#555" }}>Loading…</div>
              ) : activeSession ? (
                <>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: "#f8fbff",
                      border: "1px solid #dbeafe",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {modeLabel(activeSession.mode)}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        lineHeight: 1.5,
                      }}
                    >
                      Started: {formatDate(activeSession.started_at)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/session/${activeSession.session_id}`)
                    }
                    style={{
                      width: "100%",
                      padding: "14px 14px",
                      borderRadius: 14,
                      border: "1px solid #99c2ff",
                      background: "#f7fbff",
                      cursor: "pointer",
                      fontWeight: 900,
                    }}
                  >
                    Resume current session
                  </button>
                </>
              ) : (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "#f9fafb",
                    border: "1px solid #eef2f7",
                    color: "#6b7280",
                  }}
                >
                  No open session right now.
                </div>
              )}
            </div>

            <div
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
                Recent completed
              </div>

              {loadingSessions ? (
                <div style={{ color: "#555" }}>Loading…</div>
              ) : recentCompleted.length === 0 ? (
                <div
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    background: "#f9fafb",
                    border: "1px solid #eef2f7",
                    color: "#6b7280",
                  }}
                >
                  No completed sessions yet.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {recentCompleted.map((sessionItem) => (
                    <button
                      key={sessionItem.session_id}
                      type="button"
                      onClick={() =>
                        router.push(
                          `/session/${sessionItem.session_id}/review`
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        background: "#fcfcfd",
                        cursor: "pointer",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {modeLabel(sessionItem.mode)}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "#6b7280",
                        }}
                      >
                        {formatDate(
                          sessionItem.submitted_at ?? sessionItem.started_at
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
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
              <div style={{ fontWeight: 900, fontSize: 22 }}>
                Start a new session
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                Choose the format that best matches your study goal. Timed modes are now aligned around 20-question, 30-minute blocks.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              <StudyModeCard
                title="Practice"
                description="Untimed. Immediate feedback after each question. Best for building concepts before moving into timed work."
                detail={`Default: ${userSettings.practiceQuestionCount} questions`}
                isDefault={userSettings.defaultMode === "practice"}
                borderDefault="#86efac"
                borderNormal="#dbe7d8"
                background="#f8fff9"
                disabled={loading}
                onClick={() => void createAndStartSession("practice")}
              />

              <StudyModeCard
                title="Timed block"
                description="Official-format 20-question block with deferred review. Best for pacing, flag discipline, and test-day rhythm."
                detail="Official-format preset: 20 questions · 30 min"
                isDefault={userSettings.defaultMode === "timed_block"}
                borderDefault="#fde68a"
                borderNormal="#ece5c8"
                background="#fffdf6"
                disabled={loading}
                onClick={() => void createAndStartSession("timed_block")}
              />

              <StudyModeCard
                title="Exam simulation"
                description="Simulation-style flow with deferred review. This phase starts with one official-format block while full multi-block support is prepared."
                detail={examSimulationDetail(userSettings.defaultExam)}
                isDefault={userSettings.defaultMode === "exam_sim"}
                borderDefault="#fecaca"
                borderNormal="#f0dddd"
                background="#fff8f8"
                disabled={loading}
                onClick={() => void createAndStartSession("exam_sim")}
              />
            </div>
          </section>

          {loading ? (
            <section
              style={{
                padding: 14,
                borderRadius: 14,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#555",
              }}
            >
              Starting session…
            </section>
          ) : null}
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

      <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18 }}>
        {value}
      </div>
    </div>
  );
}

function StudyModeCard(props: {
  title: string;
  description: string;
  detail: string;
  isDefault: boolean;
  borderDefault: string;
  borderNormal: string;
  background: string;
  disabled: boolean;
  onClick: () => void;
}) {
  const {
    title,
    description,
    detail,
    isDefault,
    borderDefault,
    borderNormal,
    background,
    disabled,
    onClick,
  } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "18px",
        borderRadius: 22,
        border: isDefault
          ? `2px solid ${borderDefault}`
          : `1px solid ${borderNormal}`,
        background: `linear-gradient(135deg, ${background} 0%, #ffffff 100%)`,
        cursor: disabled ? "not-allowed" : "pointer",
        textAlign: "left",
        opacity: disabled ? 0.65 : 1,
        boxShadow: isDefault
          ? "0 12px 30px rgba(15, 23, 42, 0.08)"
          : "0 8px 22px rgba(15, 23, 42, 0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>

        {isDefault ? (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.75)",
              fontSize: 11,
              fontWeight: 800,
              color: "#374151",
            }}
          >
            Default
          </span>
        ) : null}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "#4b5563",
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
        {detail}
      </div>
    </button>
  );
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 800,
    opacity: disabled ? 0.55 : 1,
  };
}