/*
 * File: src/app/study/page.tsx
 *
 * Responsibility:
 * - Render the main study entry page.
 * - Let the authenticated user:
 *   - resume the latest open session;
 *   - start Practice;
 *   - start Timed block;
 *   - start partial simulation;
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
 * - Clear distinction between Practice, Timed block, and Partial simulation.
 * - Local Settings are read from localStorage and used as UI/session generation defaults.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiClient";
import { StudyEngagementHero } from "@/components/study/StudyEngagementHero";

import { StudyQuickActions } from "@/components/study/StudyQuickActions";

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

type StatsAggregate = {
  answered: number;
  correct: number;
  wrong: number;
  skipped: number;
  flagged: number;
  accuracy: number;
  avg_time_seconds: number;
};

type StatsResponse = {
  range_days: number;
  overall: StatsAggregate;
  by_exam: Array<StatsAggregate & { exam: string }>;
  by_mode: Array<StatsAggregate & { mode: string }>;
  by_block: Array<StatsAggregate & { block_index: number }>;
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
  return (
    value === "practice" || value === "timed_block" || value === "exam_sim"
  );
}

function isExamType(value: unknown): value is ExamType {
  return value === "step1" || value === "step2ck" || value === "step3";
}

function isDifficultyDefault(value: unknown): value is DifficultyDefault {
  return (
    value === "easy" ||
    value === "medium" ||
    value === "hard" ||
    value === "all"
  );
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
        .filter(isValidSlug),
    ),
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
      return "Partial simulation";
    default:
      return mode ?? "Unknown mode";
  }
}

function formatDate(value?: string | null): string {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
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

function getRecommendedCount(
  mode: SessionMode,
  settings: UserSettings,
): number {
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
      return "Current: 1 x 20-question block / 30 min. Full Step 1 target: 14 x 20, locked until the pool expands.";
    case "step2ck":
      return "Current: 1 x 20-question block / 30 min. Full Step 2 CK target: 16 timed blocks, locked until the pool expands.";
    case "step3":
      return "Current: 1 x 20-question block / 30 min. Full Step 3 Day 1/Day 2 plus CCS remains planned.";
    default: {
      const exhaustiveCheck: never = exam;
      return exhaustiveCheck;
    }
  }
}

function simulationReadinessLabel(exam: ExamType): string {
  switch (exam) {
    case "step1":
      return "Partial only; full-length Step 1 locked";
    case "step2ck":
      return "Partial only; full-length Step 2 CK locked";
    case "step3":
      return "Partial only; Step 3 CCS planned";
    default: {
      const exhaustiveCheck: never = exam;
      return exhaustiveCheck;
    }
  }
}

function formatStudyPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "-";
  }

  return `${Math.round(value * 100)}%`;
}

function formatStudyDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return "0m";
  }

  const minutes = Math.round(totalSeconds / 60);

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = minutes / 60;

  return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 18;
  }

  return Math.max(18, Math.min(100, Math.round(value)));
}

export default function StudyPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
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
      setStats(null);
      setLoadingSessions(false);
      setErr(null);
      return;
    }

    setLoadingSessions(true);
    setErr(null);

    try {
      const res = await apiFetch<SessionsResponse>("/api/sessions");
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);

      try {
        const statsRes = await apiFetch<StatsResponse>("/api/me/stats?range=7");
        setStats(statsRes);
      } catch {
        setStats(null);
      }
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load study sessions"));
      setSessions([]);
      setStats(null);
      setStats(null);
      setStats(null);
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
        getComparableTime(a.submitted_at),
      );

      const bTime = Math.max(
        getComparableTime(b.started_at),
        getComparableTime(b.submitted_at),
      );

      return bTime - aTime;
    });
  }, [sessions]);

  const activeSession = useMemo(
    () =>
      sortedSessions.find(
        (sessionItem) => sessionItem.status === "in_progress",
      ) ?? null,
    [sortedSessions],
  );

  const recentCompleted = useMemo(
    () =>
      sortedSessions
        .filter((sessionItem) => sessionItem.status === "submitted")
        .slice(0, 3),
    [sortedSessions],
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
          },
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
          },
        );

        router.push(`/session/${sessionRes.session_id}`);
      } catch (error) {
        setErr(getErrorMessage(error, "Failed to start study session"));
      } finally {
        setLoading(false);
      }
    },
    [loading, router, userSettings],
  );

  const defaultModeCount = getRecommendedCount(
    userSettings.defaultMode,
    userSettings,
  );

  const weeklyAnswered = Math.max(0, Math.trunc(stats?.overall.answered ?? 0));
  const weeklyAccuracyLabel = stats
    ? formatStudyPercent(stats.overall.accuracy)
    : "-";
  const weeklyStudyTimeLabel = stats
    ? formatStudyDuration(stats.overall.avg_time_seconds * weeklyAnswered)
    : "-";
  const weeklyFlaggedLabel = stats ? String(stats.overall.flagged) : "-";
  const weeklyLevelLabel = `Level ${Math.max(
    1,
    Math.floor(weeklyAnswered / Math.max(defaultModeCount, 1)) + 1,
  )}`;
  const weeklyLevelProgressCurrent =
    weeklyAnswered % Math.max(defaultModeCount, 1);
  const weeklyLevelProgressLabel =
    weeklyAnswered > 0 && weeklyLevelProgressCurrent === 0
      ? `${defaultModeCount} / ${defaultModeCount} block complete`
      : `${weeklyLevelProgressCurrent} / ${defaultModeCount} to next level`;
  const weeklyActivityLabel = activeSession
    ? "Active now"
    : weeklyAnswered > 0
      ? "Active week"
      : "Start today";
  const missionProgressPercent = activeSession
    ? 72
    : clampPercent((weeklyAnswered / Math.max(defaultModeCount, 1)) * 100);
  const missionProgressLabel = activeSession
    ? "Resume"
    : `${Math.min(weeklyAnswered, defaultModeCount)} / ${defaultModeCount}`;
  const nextLevelRemaining =
    weeklyAnswered > 0 && weeklyLevelProgressCurrent === 0
      ? 0
      : Math.max(defaultModeCount - weeklyLevelProgressCurrent, 0);
  const momentumHeadline = activeSession
    ? "Resume your active block to keep momentum."
    : weeklyAnswered === 0
      ? "Start one focused block to open your weekly momentum."
      : nextLevelRemaining === 0
        ? "Block complete. Start another block to extend momentum."
        : `${nextLevelRemaining} questions to next level.`;
  const momentumActionLabel = activeSession
    ? `Resume ${modeLabel(activeSession.mode)}`
    : weeklyAnswered === 0
      ? "Start now"
      : nextLevelRemaining === 0
        ? "Next block"
        : "Continue";
  const reviewQueueLabel =
    stats && stats.overall.flagged > 0
      ? `${stats.overall.flagged} flagged`
      : "Clear";

  return (
    <main
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <StudyEngagementHero
        signedInLabel={
          isAuthLoading
            ? "Loading your account."
            : isSignedIn
              ? `Signed in as ${session?.user?.email}.`
              : "Sign in to save progress."
        }
        defaultExamLabel={examLabel(userSettings.defaultExam)}
        defaultModeLabel={modeLabel(userSettings.defaultMode)}
        defaultCount={defaultModeCount}
        levelLabel={weeklyLevelLabel}
        levelProgressLabel={weeklyLevelProgressLabel}
        activityLabel={weeklyActivityLabel}
        weeklyValue={`${weeklyAnswered} Q`}
        missionProgressPercent={missionProgressPercent}
        missionProgressLabel={missionProgressLabel}
        activeSessionLabel={
          activeSession ? modeLabel(activeSession.mode) : null
        }
        loading={loading}
        onPrimaryAction={() =>
          activeSession
            ? router.push(`/session/${activeSession.session_id}`)
            : void createAndStartSession(
                userSettings.defaultMode,
                defaultModeCount,
              )
        }
      />

      {isAuthLoading ? (
        <section
          style={{
            padding: 18,
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          Loading your account...
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
                {loadingSessions ? "Refreshing..." : "Refresh sessions"}
              </button>
            </section>
          ) : null}

          <StudyQuickActions
            defaultExamLabel={examLabel(userSettings.defaultExam)}
            defaultCount={defaultModeCount}
            loading={loading}
            onPractice={() => void createAndStartSession("practice")}
            onTimedBlock={() => void createAndStartSession("timed_block")}
            onPartialSimulation={() => void createAndStartSession("exam_sim")}
            onSettings={() => router.push("/settings")}
          />

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
                <div style={{ color: "#555" }}>Loading...</div>
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
                <div style={{ color: "#555" }}>Loading...</div>
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
                        router.push(`/session/${sessionItem.session_id}/review`)
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
                          sessionItem.submitted_at ?? sessionItem.started_at,
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
              padding: 20,
              borderRadius: 24,
              border: "1px solid #dbeafe",
              background: "linear-gradient(135deg,#eff6ff,#ffffff)",
              display: "grid",
              gap: 14,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 22 }}>Weekly growth</div>

            <div style={{ marginTop: -6, color: "#475569", lineHeight: 1.5 }}>
              {momentumHeadline}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                gap: 12,
              }}
            >
              <InfoCard label="Questions" value={String(weeklyAnswered)} />
              <InfoCard label="Accuracy" value={weeklyAccuracyLabel} />
              <InfoCard label="Study time" value={weeklyStudyTimeLabel} />
              <InfoCard label="Flags" value={weeklyFlaggedLabel} />
              <InfoCard label="Next action" value={momentumActionLabel} />
              <InfoCard label="Review queue" value={reviewQueueLabel} />
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
              Starting session...
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

      <div style={{ marginTop: 6, fontWeight: 900, fontSize: 18 }}>{value}</div>
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
