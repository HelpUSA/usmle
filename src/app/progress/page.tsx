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
 * API contract used:
 * - GET /api/sessions
 *
 * Current data limitation:
 * - This page still uses only session-level data.
 * - It does not calculate accuracy, average time per question, weak areas,
 *   or attempt-level performance because the current endpoint does not expose
 *   attempt-level aggregates.
 *
 * UX strategy:
 * - Mobile-first.
 * - Visual cards and SVG charts.
 * - No external charting dependency.
 * - Safe fallback when the user is not authenticated or has no sessions.
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
      return "Exam simulation";
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

function buildDailySeries(
  sessions: SessionSummary[],
  lastDays = 14
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
  padding = 20
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

      const y =
        padding + innerHeight - (point.count / maxValue) * innerHeight;

      return `${x},${y}`;
    })
    .join(" ");
}

function buildBars(
  series: DailyPoint[],
  width: number,
  height: number,
  padding = 20
): BarPoint[] {
  const maxValue = Math.max(...series.map((point) => point.count), 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;
  const barGap = 6;
  const barWidth = Math.max(
    8,
    (innerWidth - barGap * Math.max(series.length - 1, 0)) /
      Math.max(series.length, 1)
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
  padding = 20
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
  examSimSessions: number
): string {
  const entries = [
    { label: "Practice", value: practiceSessions },
    { label: "Timed block", value: timedBlockSessions },
    { label: "Exam simulation", value: examSimSessions },
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
      setLoading(false);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await apiFetch<SessionsResponse>("/api/sessions");
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load progress data"));
      setSessions([]);
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
        getComparableTime(a.submitted_at)
      );

      const bTime = Math.max(
        getComparableTime(b.started_at),
        getComparableTime(b.submitted_at)
      );

      return bTime - aTime;
    });
  }, [sessions]);

  const totalSessions = sortedSessions.length;
  const completedSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.status === "submitted"
  ).length;
  const inProgressSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.status === "in_progress"
  ).length;
  const abandonedSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.status === "abandoned"
  ).length;

  const practiceSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.mode === "practice"
  ).length;
  const timedBlockSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.mode === "timed_block"
  ).length;
  const examSimSessions = sortedSessions.filter(
    (sessionItem) => sessionItem.mode === "exam_sim"
  ).length;

  const dailySeries = useMemo(
    () => buildDailySeries(sortedSessions, 14),
    [sortedSessions]
  );

  const recentSessions = useMemo(
    () => sortedSessions.slice(0, 5),
    [sortedSessions]
  );

  const chartWidth = 640;
  const chartHeight = 220;
  const polylinePoints = buildPolylinePoints(
    dailySeries,
    chartWidth,
    chartHeight
  );
  const bars = buildBars(dailySeries, chartWidth, chartHeight);

  const activeDays = dailySeries.filter((day) => day.count > 0).length;

  const peakDay = dailySeries.reduce<DailyPoint>(
    (best, current) => (current.count > best.count ? current : best),
    {
      dateKey: "",
      label: "—",
      count: 0,
    }
  );

  const completionRate =
    totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

  const mostUsedMode = getMostUsedMode(
    practiceSessions,
    timedBlockSessions,
    examSimSessions
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
          Track study activity, completion patterns, and mode distribution.
          Accuracy, weak-area analysis, and attempt-level trends can be added
          after the API exposes response aggregates.
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
              { label: "Total sessions", value: String(totalSessions) },
              { label: "Completion rate", value: `${completionRate}%` },
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
                  Last 14 days
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
              <p style={{ margin: 0, color: "#555" }}>
                Loading progress data…
              </p>
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
                        chartHeight
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
                  label: "Exam simulation",
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
                        (timedBlockSessions / totalSessions) * 100
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
            <div style={{ fontWeight: 900, fontSize: 18 }}>
              Recent activity
            </div>

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
    </main>
  );
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

            const offset =
              circumference - (previous / 100) * circumference;

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