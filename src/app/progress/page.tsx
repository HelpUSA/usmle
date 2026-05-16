/*
 * File: src/app/progress/page.tsx
 *
 * Responsibility:
 * - Render the Progress page for the authenticated user.
 * - Display visual session-level analytics using the currently available API.
 * - Keep Progress distinct from Results:
 *   - Results = history/navigation by session.
 *   - Progress = visual patterns, activity, distribution, completion profile.
 *
 * API contracts used:
 * - GET /api/sessions
 * - GET /api/me/stats?range=365
 * - GET /api/me/engagement
 *
 * Analytics strategy:
 * - Session-level data drives activity and history visuals.
 * - Attempt-level aggregate data drives accuracy, timing, flags, and
 *   USMLE 2026 block analytics.
 *
 * UX strategy:
 * - Mobile-first.
 * - Visual cards and SVG charts.
 * - No external charting dependency.
 * - Safe fallback when the user is not authenticated, has no sessions,
 *   or the engagement API is unavailable.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiClient";

type SessionMode = "practice" | "timed_block" | "exam_sim";
type KnownSessionStatus = "in_progress" | "submitted" | "abandoned";

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

type BlockAggregate = StatsAggregate & {
  block_index: number;
};

type StatsResponse = {
  range_days: number;
  overall: StatsAggregate;
  by_exam: Array<StatsAggregate & { exam: string }>;
  by_mode: Array<StatsAggregate & { mode: string }>;
  by_block: BlockAggregate[];
};

type EngagementSummary = {
  current_streak_days: number;
  longest_streak_days: number;
  total_xp: number;
  level_number: number;
  level_progress_xp: number;
  next_level_xp: number;
  last_activity_date: string | null;
  last_event_at: string | null;
};

type EngagementDaily = {
  activity_date: string;
  sessions_started: number;
  sessions_submitted: number;
  questions_answered: number;
  questions_correct: number;
  questions_flagged: number;
  review_actions: number;
  xp_total: number;
  study_seconds: number;
};

type EngagementResponse = {
  summary: EngagementSummary;
  today: EngagementDaily;
  recent_days: EngagementDaily[];
  generated_at: string;
};

type DailyPoint = {
  dateKey: string;
  label: string;
  count: number;
};

type BarPoint = {
  x: number;
  y: number;
  barWidth: number;
  barHeight: number;
  point: DailyPoint;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
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

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function formatPercent(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0%";
  }

  return `${Math.round(value * 100)}%`;
}

function formatAverageSeconds(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "-";
  }

  if (value < 60) {
    return `${Math.round(value)}s`;
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);

  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}

function getBlockPaceLabel(avgSeconds?: number | null): string {
  if (
    typeof avgSeconds !== "number" ||
    !Number.isFinite(avgSeconds) ||
    avgSeconds <= 0
  ) {
    return "No timing";
  }

  if (avgSeconds <= 90) {
    return "On pace";
  }

  if (avgSeconds <= 110) {
    return "Borderline";
  }

  return "Slow";
}

function formatWholeNumber(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "0";
  }

  return String(Math.max(0, Math.trunc(value)));
}

function formatDayCount(value?: number | null): string {
  const days = Math.max(0, Math.trunc(value ?? 0));
  return `${days} day${days === 1 ? "" : "s"}`;
}

function getComparableTime(value?: string | null): number {
  if (!value) return 0;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function getDateKey(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function buildEngagementDailySeries(
  dailyActivity: EngagementDaily[],
  days = 30,
): DailyPoint[] {
  const normalizedDays = Math.max(1, Math.trunc(days));
  const countsByDate = new Map<string, number>();

  for (const item of dailyActivity) {
    if (!item.activity_date) continue;

    countsByDate.set(
      item.activity_date,
      Math.max(0, Math.trunc(item.questions_answered ?? 0)),
    );
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Array.from({ length: normalizedDays }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (normalizedDays - 1 - index));
    const dateKey = date.toISOString().slice(0, 10);

    return {
      dateKey,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      count: countsByDate.get(dateKey) ?? 0,
    };
  });
}

function buildDailySeries(
  sessions: SessionSummary[],
  lastDays = 14,
): DailyPoint[] {
  const today = new Date();
  const activityMap = new Map<string, number>();

  for (const sessionItem of sessions) {
    const key = getDateKey(sessionItem.started_at);

    if (!key) continue;

    activityMap.set(key, (activityMap.get(key) ?? 0) + 1);
  }

  const series: DailyPoint[] = [];

  for (let index = lastDays - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const key = `${year}-${month}-${day}`;

    series.push({
      dateKey: key,
      label: date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      count: activityMap.get(key) ?? 0,
    });
  }

  return series;
}

function buildPolylinePoints(
  series: DailyPoint[],
  width: number,
  height: number,
  padding = 20,
): string {
  if (series.length === 0) return "";

  const maxValue = Math.max(...series.map((point) => point.count), 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return series
    .map((point, index) => {
      const x =
        padding +
        (series.length === 1
          ? innerWidth / 2
          : (index / (series.length - 1)) * innerWidth);

      const y = padding + innerHeight - (point.count / maxValue) * innerHeight;

      return `${x},${y}`;
    })
    .join(" ");
}

function buildBars(
  series: DailyPoint[],
  width: number,
  height: number,
  padding = 20,
): BarPoint[] {
  const maxValue = Math.max(...series.map((point) => point.count), 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const barGap = 6;
  const barWidth = Math.max(
    8,
    (innerWidth - barGap * Math.max(series.length - 1, 0)) /
      Math.max(series.length, 1),
  );

  return series.map((point, index) => {
    const x = padding + index * (barWidth + barGap);
    const barHeight = (point.count / maxValue) * innerHeight;
    const y = padding + innerHeight - barHeight;

    return {
      x,
      y,
      barWidth,
      barHeight,
      point,
    };
  });
}

function getPointCoordinates(
  series: DailyPoint[],
  point: DailyPoint,
  index: number,
  width: number,
  height: number,
  padding = 20,
): { x: number; y: number } {
  const maxValue = Math.max(...series.map((item) => item.count), 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const x =
    padding +
    (series.length === 1
      ? innerWidth / 2
      : (index / (series.length - 1)) * innerWidth);

  const y = padding + innerHeight - (point.count / maxValue) * innerHeight;

  return { x, y };
}

function buildDonutSegments(values: number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    return values.map(() => 0);
  }

  return values.map((value) => (value / total) * 100);
}

function getStrokeDasharray(percent: number, circumference: number): string {
  const filled = (percent / 100) * circumference;
  return `${filled} ${circumference - filled}`;
}

function getMostUsedMode(
  practiceSessions: number,
  timedBlockSessions: number,
  examSimSessions: number,
): string {
  const entries = [
    { label: "Practice", value: practiceSessions },
    { label: "Timed block", value: timedBlockSessions },
    { label: "Partial simulation", value: examSimSessions },
  ];

  entries.sort((a, b) => b.value - a.value);

  if (entries[0].value === 0) {
    return "—";
  }

  return entries[0].label;
}

function getStatusLabel(status?: string | null): string {
  if (status === "submitted") return "Completed";
  if (status === "in_progress") return "Open";
  if (status === "abandoned") return "Abandoned";
  return "Unknown";
}

function getStatusBadgeStyle(status?: string | null): CSSProperties {
  if (status === "submitted") {
    return {
      border: "1px solid #d7f0dc",
      background: "#eefaf0",
      color: "#166534",
    };
  }

  if (status === "abandoned") {
    return {
      border: "1px solid #f5caca",
      background: "#fef2f2",
      color: "#991b1b",
    };
  }

  return {
    border: "1px solid #f0dfab",
    background: "#fff8e1",
    color: "#92400e",
  };
}

export default function ProgressPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [engagement, setEngagement] = useState<EngagementResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isAuthLoading = sessionStatus === "loading";
  const isSignedIn =
    sessionStatus === "authenticated" && Boolean(session?.user?.email);

  const loadProgress = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!isSignedIn) {
      setSessions([]);
      setStats(null);
      setEngagement(null);
      setLoading(false);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const [sessionsRes, statsRes] = await Promise.all([
        apiFetch<SessionsResponse>("/api/sessions"),
        apiFetch<StatsResponse>("/api/me/stats?range=365"),
      ]);

      let engagementRes: EngagementResponse | null = null;

      try {
        engagementRes =
          await apiFetch<EngagementResponse>("/api/me/engagement");
      } catch {
        engagementRes = null;
      }

      setSessions(
        Array.isArray(sessionsRes.sessions) ? sessionsRes.sessions : [],
      );
      setStats(statsRes);
      setEngagement(engagementRes);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load progress data"));
      setSessions([]);
      setStats(null);
      setEngagement(null);
    } finally {
      setLoading(false);
    }
  }, [isAuthLoading, isSignedIn]);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

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

  const totalSessions = sortedSessions.length;
  const completedSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.status === "submitted",
  ).length;
  const inProgressSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.status === "in_progress",
  ).length;
  const abandonedSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.status === "abandoned",
  ).length;

  const practiceSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.mode === "practice",
  ).length;
  const timedBlockSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.mode === "timed_block",
  ).length;
  const examSimSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.mode === "exam_sim",
  ).length;

  const dailySeries = useMemo(
    () => buildDailySeries(sortedSessions, 14),
    [sortedSessions],
  );

  const recentSessions = useMemo(
    () => sortedSessions.slice(0, 5),
    [sortedSessions],
  );

  const blockAnalytics = useMemo(() => {
    if (!stats || !Array.isArray(stats.by_block)) return [];

    return [...stats.by_block]
      .filter((block) => block.answered > 0)
      .sort((a, b) => a.block_index - b.block_index);
  }, [stats]);

  const weakestBlock = useMemo(() => {
    if (blockAnalytics.length === 0) return null;

    return blockAnalytics.reduce<BlockAggregate | null>((weakest, current) => {
      if (!weakest) return current;
      if (current.accuracy < weakest.accuracy) return current;

      if (
        current.accuracy === weakest.accuracy &&
        current.answered > weakest.answered
      ) {
        return current;
      }

      return weakest;
    }, null);
  }, [blockAnalytics]);

  const mostFlaggedBlock = useMemo(() => {
    if (blockAnalytics.length === 0) return null;

    return blockAnalytics.reduce<BlockAggregate | null>((highest, current) => {
      if (!highest) return current;
      if (current.flagged > highest.flagged) return current;
      return highest;
    }, null);
  }, [blockAnalytics]);

  const engagementSummary = engagement?.summary ?? null;
  const engagementToday = engagement?.today ?? null;
  const engagementRecentDays = Array.isArray(engagement?.recent_days)
    ? engagement.recent_days
    : [];
  const engagementDailySeries = buildEngagementDailySeries(
    engagementRecentDays,
    30,
  );
  const chartDailySeries = engagementSummary
    ? engagementDailySeries
    : dailySeries;
  const chartPeriodLabel = engagementSummary ? "Last 30 days" : "Last 14 days";

  const chartWidth = 640;
  const chartHeight = 220;
  const polylinePoints = buildPolylinePoints(
    chartDailySeries,
    chartWidth,
    chartHeight,
  );
  const bars = buildBars(chartDailySeries, chartWidth, chartHeight);

  const activeDays = chartDailySeries.filter((day) => day.count > 0).length;

  const peakDay = chartDailySeries.reduce<DailyPoint>(
    (best, current) => (current.count > best.count ? current : best),
    {
      dateKey: "",
      label: "—",
      count: 0,
    },
  );

  const completionRate =
    totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

  const mostUsedMode = getMostUsedMode(
    practiceSessions,
    timedBlockSessions,
    examSimSessions,
  );

  const modePercents = buildDonutSegments([
    practiceSessions,
    timedBlockSessions,
    examSimSessions,
  ]);

  const statusPercents = buildDonutSegments([
    completedSessions,
    inProgressSessions,
    abandonedSessions,
  ]);

  const donutSize = 132;
  const donutStroke = 12;
  const radius = (donutSize - donutStroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const modeColors = ["#2563eb", "#14b8a6", "#f59e0b"];
  const statusColors = ["#22c55e", "#f59e0b", "#ef4444"];

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
          gap: 8,
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
          Progress
        </h1>

        <p
          style={{
            margin: 0,
            color: "#555",
            lineHeight: 1.65,
            maxWidth: 760,
          }}
        >
          Track study activity, completion patterns, mode distribution, and
          persisted engagement signals from completed study actions. Accuracy
          and block analytics remain descriptive and do not predict exam
          readiness.
        </p>
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
          <div style={{ fontWeight: 900, fontSize: 20 }}>
            Sign in to view progress
          </div>

          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              color: "#555",
              lineHeight: 1.65,
            }}
          >
            Progress is personal. Once signed in, this page can show your
            session activity and completion profile.
          </p>
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
                onClick={() => void loadProgress()}
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Try again
              </button>
            </section>
          ) : null}

          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            }}
          >
            {[
              ...(engagementSummary
                ? [
                    {
                      label: "Current level",
                      value: `Level ${formatWholeNumber(
                        engagementSummary.level_number,
                      )}`,
                    },
                    {
                      label: "Total XP",
                      value: formatWholeNumber(engagementSummary.total_xp),
                    },
                    {
                      label: "Current streak",
                      value: formatDayCount(
                        engagementSummary.current_streak_days,
                      ),
                    },
                    {
                      label: "Today",
                      value: `${formatWholeNumber(
                        engagementToday?.questions_answered,
                      )} Q`,
                    },
                  ]
                : []),
              { label: "Total sessions", value: String(totalSessions) },
              { label: "Completion rate", value: `${completionRate}%` },
              {
                label: "Overall accuracy",
                value: stats ? formatPercent(stats.overall.accuracy) : "-",
              },
              {
                label: "Avg/question",
                value: stats
                  ? formatAverageSeconds(stats.overall.avg_time_seconds)
                  : "-",
              },
              {
                label: "Flagged answers",
                value: stats ? String(stats.overall.flagged) : "-",
              },
              { label: "Active days", value: String(activeDays) },
              { label: "Most used mode", value: mostUsedMode },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid #e5e7eb",
                  background: "white",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {card.label}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 24,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  {card.value}
                </div>
              </div>
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>Activity</div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  {chartPeriodLabel}
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #dbeafe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 800,
                }}
              >
                Peak day: {peakDay.label} ({peakDay.count})
              </div>
            </div>

            {loading ? (
              <p style={{ margin: 0, color: "#555" }}>Loading progress data…</p>
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                <div style={{ minWidth: chartWidth }}>
                  <svg
                    width={chartWidth}
                    height={chartHeight}
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    role="img"
                    aria-label="Study activity chart"
                    style={{
                      display: "block",
                      width: "100%",
                      height: "auto",
                      borderRadius: 16,
                      background: "#fbfdff",
                      border: "1px solid #eef2f7",
                    }}
                  >
                    <line
                      x1="20"
                      y1={chartHeight - 20}
                      x2={chartWidth - 20}
                      y2={chartHeight - 20}
                      stroke="#d1d5db"
                      strokeWidth="1"
                    />

                    {bars.map((bar) => (
                      <g key={bar.point.dateKey}>
                        <rect
                          x={bar.x}
                          y={bar.y}
                          width={bar.barWidth}
                          height={Math.max(bar.barHeight, 2)}
                          rx="6"
                          fill="#bfdbfe"
                        />
                      </g>
                    ))}

                    <polyline
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="3"
                      points={polylinePoints}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />

                    {dailySeries.map((point, index) => {
                      const coordinates = getPointCoordinates(
                        dailySeries,
                        point,
                        index,
                        chartWidth,
                        chartHeight,
                      );

                      return (
                        <g key={point.dateKey}>
                          <circle
                            cx={coordinates.x}
                            cy={coordinates.y}
                            r="4"
                            fill="#1d4ed8"
                          />

                          <text
                            x={coordinates.x}
                            y={chartHeight - 6}
                            textAnchor="middle"
                            fontSize="10"
                            fill="#6b7280"
                          >
                            {point.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>
            )}
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>
                  USMLE 2026 block analytics
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontSize: 13,
                    color: "#6b7280",
                  }}
                >
                  Accuracy, timing, and flags grouped by 30-minute block.
                </div>
              </div>

              <div
                style={{
                  fontSize: 12,
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid #dbeafe",
                  background: "#eff6ff",
                  color: "#1d4ed8",
                  fontWeight: 800,
                }}
              >
                Range: {stats?.range_days ?? 365} days
              </div>
            </div>

            {!stats ? (
              <p style={{ margin: 0, color: "#555" }}>
                Loading block analytics...
              </p>
            ) : blockAnalytics.length === 0 ? (
              <p style={{ margin: 0, color: "#555" }}>
                Complete submitted sessions to populate block-level analytics.
              </p>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  }}
                >
                  <div style={analyticsCardStyle()}>
                    <div style={analyticsLabelStyle()}>Tracked blocks</div>
                    <div style={analyticsValueStyle()}>
                      {blockAnalytics.length}
                    </div>
                  </div>

                  <div style={analyticsCardStyle()}>
                    <div style={analyticsLabelStyle()}>Weakest block</div>
                    <div style={analyticsValueStyle()}>
                      {weakestBlock ? `Block ${weakestBlock.block_index}` : "-"}
                    </div>
                    <div style={analyticsHintStyle()}>
                      {weakestBlock
                        ? formatPercent(weakestBlock.accuracy)
                        : "-"}
                    </div>
                  </div>

                  <div style={analyticsCardStyle()}>
                    <div style={analyticsLabelStyle()}>Most flagged</div>
                    <div style={analyticsValueStyle()}>
                      {mostFlaggedBlock
                        ? `Block ${mostFlaggedBlock.block_index}`
                        : "-"}
                    </div>
                    <div style={analyticsHintStyle()}>
                      {mostFlaggedBlock
                        ? `${mostFlaggedBlock.flagged} flagged`
                        : "-"}
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  {blockAnalytics.map((block) => (
                    <div
                      key={block.block_index}
                      style={{
                        padding: 14,
                        borderRadius: 16,
                        border: "1px solid #eef2f7",
                        background: "#fbfdff",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>
                          Block {block.block_index}
                        </div>

                        <div
                          style={{
                            fontSize: 12,
                            padding: "5px 8px",
                            borderRadius: 999,
                            border: "1px solid #e0e7ff",
                            background: "#eef2ff",
                            color: "#3730a3",
                            fontWeight: 800,
                          }}
                        >
                          {getBlockPaceLabel(block.avg_time_seconds)}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gap: 10,
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(120px, 1fr))",
                        }}
                      >
                        <MetricMini
                          label="Answered"
                          value={String(block.answered)}
                        />
                        <MetricMini
                          label="Accuracy"
                          value={formatPercent(block.accuracy)}
                        />
                        <MetricMini
                          label="Avg/question"
                          value={formatAverageSeconds(block.avg_time_seconds)}
                        />
                        <MetricMini
                          label="Flagged"
                          value={String(block.flagged)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            <DonutPanel
              title="Mode mix"
              subtitle="How you study"
              centerValue={String(totalSessions)}
              centerLabel="sessions"
              percents={modePercents}
              colors={modeColors}
              circumference={circumference}
              donutSize={donutSize}
              radius={radius}
              donutStroke={donutStroke}
              legend={[
                {
                  label: "Practice",
                  value: practiceSessions,
                  color: modeColors[0],
                },
                {
                  label: "Timed block",
                  value: timedBlockSessions,
                  color: modeColors[1],
                },
                {
                  label: "Partial simulation",
                  value: examSimSessions,
                  color: modeColors[2],
                },
              ]}
            />

            <DonutPanel
              title="Status mix"
              subtitle="Completion profile"
              centerValue={`${completionRate}%`}
              centerLabel="complete"
              percents={statusPercents}
              colors={statusColors}
              circumference={circumference}
              donutSize={donutSize}
              radius={radius}
              donutStroke={donutStroke}
              legend={[
                {
                  label: "Completed",
                  value: completedSessions,
                  color: statusColors[0],
                },
                {
                  label: "In progress",
                  value: inProgressSessions,
                  color: statusColors[1],
                },
                {
                  label: "Abandoned",
                  value: abandonedSessions,
                  color: statusColors[2],
                },
              ]}
            />
          </section>

          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            {[
              {
                label: "Practice share",
                value:
                  totalSessions > 0
                    ? `${Math.round((practiceSessions / totalSessions) * 100)}%`
                    : "0%",
              },
              {
                label: "Timed share",
                value:
                  totalSessions > 0
                    ? `${Math.round(
                        (timedBlockSessions / totalSessions) * 100,
                      )}%`
                    : "0%",
              },
              {
                label: "Exam sim share",
                value:
                  totalSessions > 0
                    ? `${Math.round((examSimSessions / totalSessions) * 100)}%`
                    : "0%",
              },
              {
                label: "Open sessions",
                value: String(inProgressSessions),
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid #e5e7eb",
                  background: "white",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {card.label}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 24,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </section>

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
            <div style={{ fontWeight: 900, fontSize: 18 }}>Recent activity</div>

            {loading ? (
              <p style={{ margin: 0, color: "#555" }}>Loading…</p>
            ) : recentSessions.length === 0 ? (
              <p style={{ margin: 0, color: "#555" }}>No sessions yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {recentSessions.map((sessionItem) => (
                  <div
                    key={sessionItem.session_id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid #f0f0f0",
                      background: "#fcfcfc",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>
                          {modeLabel(sessionItem.mode)}
                        </div>

                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: "#666",
                            lineHeight: 1.5,
                          }}
                        >
                          {formatDateTime(sessionItem.started_at)}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          padding: "5px 8px",
                          borderRadius: 999,
                          ...getStatusBadgeStyle(sessionItem.status),
                        }}
                      >
                        {getStatusLabel(sessionItem.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <section
        style={{
          marginTop: 24,
          borderRadius: 28,
          border: "1px solid rgba(37, 99, 235, 0.18)",
          background:
            "linear-gradient(135deg, rgba(239,246,255,0.96), rgba(250,245,255,0.94))",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
          padding: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ minWidth: 240, flex: "1 1 320px" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                borderRadius: 999,
                background: "rgba(37, 99, 235, 0.1)",
                color: "#1d4ed8",
                fontSize: 12,
                fontWeight: 950,
                padding: "6px 10px",
                marginBottom: 10,
              }}
            >
              365-day real stats
            </div>

            <h2
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: 26,
                lineHeight: 1.1,
                fontWeight: 950,
              }}
            >
              Dashboard engagement cockpit
            </h2>

            <p
              style={{
                margin: "10px 0 0",
                color: "#475569",
                lineHeight: 1.55,
                maxWidth: 720,
              }}
            >
              Use your submitted-session history to decide what to do next:
              continue studying, review flagged questions, or rebalance by mode.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
            }}
          >
            <a
              href="/study"
              style={{
                borderRadius: 999,
                padding: "11px 16px",
                color: "white",
                background:
                  "linear-gradient(135deg, #0f172a 0%, #2563eb 55%, #7c3aed 100%)",
                fontWeight: 950,
                textDecoration: "none",
                boxShadow: "0 14px 30px rgba(37,99,235,0.26)",
              }}
            >
              Continue studying
            </a>

            <a
              href="/results"
              style={{
                borderRadius: 999,
                padding: "11px 16px",
                color: "#1d4ed8",
                background: "rgba(255,255,255,0.86)",
                border: "1px solid rgba(37, 99, 235, 0.22)",
                fontWeight: 950,
                textDecoration: "none",
              }}
            >
              Review results
            </a>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          <div
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              padding: 16,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>
              Answered
            </div>
            <div
              style={{
                marginTop: 6,
                color: "#0f172a",
                fontSize: 24,
                fontWeight: 950,
              }}
            >
              {stats ? String(stats.overall.answered) : "-"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              padding: 16,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>
              Accuracy
            </div>
            <div
              style={{
                marginTop: 6,
                color: "#0f172a",
                fontSize: 24,
                fontWeight: 950,
              }}
            >
              {stats ? formatPercent(stats.overall.accuracy) : "-"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              padding: 16,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>
              Avg time
            </div>
            <div
              style={{
                marginTop: 6,
                color: "#0f172a",
                fontSize: 24,
                fontWeight: 950,
              }}
            >
              {stats
                ? formatAverageSeconds(stats.overall.avg_time_seconds)
                : "-"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              padding: 16,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>
              Review queue
            </div>
            <div
              style={{
                marginTop: 6,
                color: "#0f172a",
                fontSize: 24,
                fontWeight: 950,
              }}
            >
              {stats ? `${stats.overall.flagged} flags` : "-"}
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              padding: 16,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>
              Completion
            </div>
            <div
              style={{
                marginTop: 6,
                color: "#0f172a",
                fontSize: 24,
                fontWeight: 950,
              }}
            >
              {completedSessions}/{totalSessions}
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              background: "rgba(255,255,255,0.88)",
              border: "1px solid rgba(148, 163, 184, 0.22)",
              padding: 16,
            }}
          >
            <div style={{ color: "#64748b", fontSize: 12, fontWeight: 900 }}>
              Next focus
            </div>
            <div
              style={{
                marginTop: 6,
                color: "#0f172a",
                fontSize: 18,
                lineHeight: 1.25,
                fontWeight: 950,
              }}
            >
              {stats && stats.overall.flagged > 0
                ? "Review flags"
                : completedSessions > 0
                  ? "Keep momentum"
                  : "Start first block"}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricMini(props: { label: string; value: string }) {
  const { label, value } = props;

  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280" }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function analyticsCardStyle(): CSSProperties {
  return {
    padding: 14,
    borderRadius: 16,
    border: "1px solid #eef2f7",
    background: "#fbfdff",
  };
}

function analyticsLabelStyle(): CSSProperties {
  return {
    fontSize: 12,
    color: "#6b7280",
  };
}

function analyticsValueStyle(): CSSProperties {
  return {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 1.1,
    fontWeight: 900,
  };
}

function analyticsHintStyle(): CSSProperties {
  return {
    marginTop: 5,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: 700,
  };
}

function DonutPanel(props: {
  title: string;
  subtitle: string;
  centerValue: string;
  centerLabel: string;
  percents: number[];
  colors: string[];
  circumference: number;
  donutSize: number;
  radius: number;
  donutStroke: number;
  legend: Array<{
    label: string;
    value: number;
    color: string;
  }>;
}) {
  const {
    title,
    subtitle,
    centerValue,
    centerLabel,
    percents,
    colors,
    circumference,
    donutSize,
    radius,
    donutStroke,
    legend,
  } = props;

  return (
    <div
      style={{
        padding: 18,
        borderRadius: 20,
        border: "1px solid #e5e7eb",
        background: "white",
        display: "grid",
        gap: 16,
      }}
    >
      <div>
        <div style={{ fontWeight: 900, fontSize: 20 }}>{title}</div>

        <div
          style={{
            marginTop: 4,
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <svg
          width={donutSize}
          height={donutSize}
          viewBox={`0 0 ${donutSize} ${donutSize}`}
          role="img"
          aria-label={`${title} chart`}
        >
          <circle
            cx={donutSize / 2}
            cy={donutSize / 2}
            r={radius}
            fill="none"
            stroke="#eef2f7"
            strokeWidth={donutStroke}
          />

          {percents.map((percent, index) => {
            const previous = percents
              .slice(0, index)
              .reduce((sum, value) => sum + value, 0);

            const offset = circumference - (previous / 100) * circumference;

            return (
              <circle
                key={`${title}-${index}`}
                cx={donutSize / 2}
                cy={donutSize / 2}
                r={radius}
                fill="none"
                stroke={colors[index]}
                strokeWidth={donutStroke}
                strokeDasharray={getStrokeDasharray(percent, circumference)}
                strokeDashoffset={offset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${donutSize / 2} ${donutSize / 2})`}
              />
            );
          })}

          <text
            x="50%"
            y="48%"
            textAnchor="middle"
            fontSize="20"
            fontWeight="900"
            fill="#111827"
          >
            {centerValue}
          </text>

          <text
            x="50%"
            y="63%"
            textAnchor="middle"
            fontSize="11"
            fill="#6b7280"
          >
            {centerLabel}
          </text>
        </svg>

        <div style={{ display: "grid", gap: 10, minWidth: 170 }}>
          {legend.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: item.color,
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />

                <span style={{ fontSize: 14, color: "#374151" }}>
                  {item.label}
                </span>
              </div>

              <strong style={{ fontSize: 14 }}>{item.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
