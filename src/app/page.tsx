/*
 * File: src/app/page.tsx
 *
 * Responsibility:
 * - Render the main Home/Dashboard page.
 * - Before login:
 *   - act as a public landing page;
 *   - present HelpUS branding;
 *   - offer Google sign-in.
 * - After login:
 *   - act as a visual dashboard;
 *   - show session-level summary cards and charts;
 *   - route users to Study, Results, Progress, and Settings.
 *
 * API contract used:
 * - GET /api/sessions
 *
 * Important behavior:
 * - Study has its own operational page at /study.
 * - Results and Progress have their own dedicated pages.
 * - This Dashboard focuses on overview and navigation.
 *
 * Build/lint notes:
 * - Uses next/image instead of raw <img> for the HelpUS logo.
 * - Avoids catch (e: any).
 */

"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { signIn, signOut, useSession } from "next-auth/react";

type SessionMode = "practice" | "timed_block" | "exam_sim";

type SessionSummary = {
  session_id: string;
  user_id: string;
  mode: SessionMode | string;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: "in_progress" | "submitted" | "abandoned" | string;
  settings_json?: Record<string, unknown> | null;
  started_at?: string | null;
  submitted_at?: string | null;
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

  for (let index = 0; index < lastDays; index += 1) {
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

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [loadingSessions, setLoadingSessions] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const isAuthLoading = sessionStatus === "loading";
  const isSignedIn =
    sessionStatus === "authenticated" && Boolean(session?.user?.email);

  const userName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "there";

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
      const res = await apiFetch<{ sessions: SessionSummary[] }>(
        "/api/sessions"
      );

      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Failed to load sessions"));
      setSessions([]);
    } finally {
      setLoadingSessions(false);
    }
  }, [isAuthLoading, isSignedIn]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const activeSession = useMemo(
    () =>
      sessions.find((sessionItem) => sessionItem.status === "in_progress") ??
      null,
    [sessions]
  );

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(
    (sessionItem) => sessionItem.status === "submitted"
  ).length;
  const inProgressSessions = sessions.filter(
    (sessionItem) => sessionItem.status === "in_progress"
  ).length;
  const abandonedSessions = sessions.filter(
    (sessionItem) => sessionItem.status === "abandoned"
  ).length;

  const practiceSessions = sessions.filter(
    (sessionItem) => sessionItem.mode === "practice"
  ).length;
  const timedBlockSessions = sessions.filter(
    (sessionItem) => sessionItem.mode === "timed_block"
  ).length;
  const examSimSessions = sessions.filter(
    (sessionItem) => sessionItem.mode === "exam_sim"
  ).length;

  const completionRate =
    totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : 0;

  const mostUsedMode = getMostUsedMode(
    practiceSessions,
    timedBlockSessions,
    examSimSessions
  );

  const dailySeries = useMemo(
    () => buildDailySeries(sessions, 14),
    [sessions]
  );

  const peakDay = dailySeries.reduce<DailyPoint>(
    (best, current) => (current.count > best.count ? current : best),
    {
      dateKey: "",
      label: "—",
      count: 0,
    }
  );

  const chartWidth = 640;
  const chartHeight = 220;
  const polylinePoints = buildPolylinePoints(
    dailySeries,
    chartWidth,
    chartHeight
  );
  const bars = buildBars(dailySeries, chartWidth, chartHeight);

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

  async function handleGoogleSignIn() {
    await signIn("google", { callbackUrl: "/" });
  }

  async function handleSignOut() {
    await signOut({ callbackUrl: "/" });
  }

  const userLabel = isAuthLoading
    ? "Loading session…"
    : session?.user?.email
    ? `Signed in as ${session.user.email}`
    : "Not signed in";

  return (
    <main
      style={{
        display: "grid",
        gap: 16,
      }}
    >
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
        <>
          <section
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 24,
              padding: 20,
              background:
                "linear-gradient(135deg, #0f172a 0%, #1d4ed8 45%, #06b6d4 100%)",
              color: "white",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -40,
                right: -30,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
              }}
            />

            <div
              style={{
                position: "relative",
                zIndex: 1,
                display: "grid",
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                }}
              >
                <Image
                  src="/img/helpus-logo.png"
                  alt="HelpUS logo"
                  width={64}
                  height={64}
                  priority
                  style={{
                    width: 64,
                    height: 64,
                    objectFit: "contain",
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.12)",
                    padding: 6,
                  }}
                />

                <div>
                  <div style={{ fontSize: 13, opacity: 0.9 }}>
                    Built by HelpUS
                  </div>

                  <h1
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: 32,
                      lineHeight: 1.05,
                      fontWeight: 900,
                    }}
                  >
                    USMLE study,
                    <br />
                    with a cleaner flow
                  </h1>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                {[
                  {
                    title: "Practice",
                    text: "Untimed learning with immediate feedback.",
                  },
                  {
                    title: "Timed blocks",
                    text: "Pacing-focused study without mid-session answers.",
                  },
                  {
                    title: "Simulation",
                    text: "Longer exam-style flows with deferred review.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.10)",
                      border: "1px solid rgba(255,255,255,0.14)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{item.title}</div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.5,
                      }}
                    >
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 22 }}>
                Continue with your account
              </div>

              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid #d1d5db",
                  background: "#111827",
                  color: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 15,
                }}
              >
                Continue with Google
              </button>
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
              <div style={{ fontWeight: 900, fontSize: 22 }}>
                What happens after login
              </div>

              {[
                "Visual dashboard with study momentum",
                "Dedicated Study hub for starting and resuming sessions",
                "Results and Progress as separate views",
                "Session continuity across visits",
              ].map((text) => (
                <div
                  key={text}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 999,
                      background: "#eff6ff",
                      color: "#2563eb",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 900,
                      fontSize: 12,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>

                  <span style={{ color: "#555", lineHeight: 1.5 }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          <section
            style={{
              padding: 18,
              borderRadius: 22,
              background: "linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)",
              border: "1px solid #e5e7eb",
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
              <div
                style={{
                  minWidth: 0,
                  flex: "1 1 260px",
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                }}
              >
                <Image
                  src="/img/helpus-logo.png"
                  alt="HelpUS logo"
                  width={58}
                  height={58}
                  priority
                  style={{
                    width: 58,
                    height: 58,
                    objectFit: "contain",
                    borderRadius: 16,
                    background: "#f8fafc",
                    padding: 6,
                    border: "1px solid #e5e7eb",
                    flexShrink: 0,
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {userLabel}
                  </div>

                  <h1
                    style={{
                      margin: "6px 0 0 0",
                      fontSize: 30,
                      lineHeight: 1.08,
                      fontWeight: 900,
                    }}
                  >
                    Welcome back, {userName}
                  </h1>
                </div>
              </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: 220,
                  flex: "0 1 220px",
                }}
              >
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={{
                    width: "100%",
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
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
              }}
            >
              {[
                { label: "Total sessions", value: String(totalSessions) },
                { label: "Completion rate", value: `${completionRate}%` },
                { label: "Most used mode", value: mostUsedMode },
                { label: "Open sessions", value: String(inProgressSessions) },
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
            </div>
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
                  Peak: {peakDay.label} ({peakDay.count})
                </div>
              </div>

              <div
                style={{
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  direction: "rtl",
                }}
              >
                <div
                  style={{
                    minWidth: chartWidth,
                    direction: "ltr",
                  }}
                >
                  <svg
                    width={chartWidth}
                    height={chartHeight}
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    role="img"
                    aria-label="Dashboard activity chart"
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
            </div>

            <div
              style={{
                display: "grid",
                gap: 16,
              }}
            >
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
                  <div style={{ fontWeight: 900, fontSize: 20 }}>
                    Mode mix
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    How you study
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
                    aria-label="Mode mix chart"
                  >
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={radius}
                      fill="none"
                      stroke="#eef2f7"
                      strokeWidth={donutStroke}
                    />

                    {modePercents.map((percent, index) => {
                      const previous = modePercents
                        .slice(0, index)
                        .reduce((sum, value) => sum + value, 0);

                      const offset =
                        circumference - (previous / 100) * circumference;

                      return (
                        <circle
                          key={`mode-${index}`}
                          cx={donutSize / 2}
                          cy={donutSize / 2}
                          r={radius}
                          fill="none"
                          stroke={modeColors[index]}
                          strokeWidth={donutStroke}
                          strokeDasharray={getStrokeDasharray(
                            percent,
                            circumference
                          )}
                          strokeDashoffset={offset}
                          transform={`rotate(-90 ${donutSize / 2} ${
                            donutSize / 2
                          })`}
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
                      {totalSessions}
                    </text>

                    <text
                      x="50%"
                      y="63%"
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6b7280"
                    >
                      sessions
                    </text>
                  </svg>

                  <div style={{ display: "grid", gap: 10, minWidth: 170 }}>
                    {[
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
                        label: "Exam sim",
                        value: examSimSessions,
                        color: modeColors[2],
                      },
                    ].map((item) => (
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
                  <div style={{ fontWeight: 900, fontSize: 20 }}>
                    Status mix
                  </div>

                  <div
                    style={{
                      marginTop: 4,
                      fontSize: 13,
                      color: "#6b7280",
                    }}
                  >
                    Completion profile
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
                    aria-label="Status mix chart"
                  >
                    <circle
                      cx={donutSize / 2}
                      cy={donutSize / 2}
                      r={radius}
                      fill="none"
                      stroke="#eef2f7"
                      strokeWidth={donutStroke}
                    />

                    {statusPercents.map((percent, index) => {
                      const previous = statusPercents
                        .slice(0, index)
                        .reduce((sum, value) => sum + value, 0);

                      const offset =
                        circumference - (previous / 100) * circumference;

                      return (
                        <circle
                          key={`status-${index}`}
                          cx={donutSize / 2}
                          cy={donutSize / 2}
                          r={radius}
                          fill="none"
                          stroke={statusColors[index]}
                          strokeWidth={donutStroke}
                          strokeDasharray={getStrokeDasharray(
                            percent,
                            circumference
                          )}
                          strokeDashoffset={offset}
                          transform={`rotate(-90 ${donutSize / 2} ${
                            donutSize / 2
                          })`}
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
                      {completionRate}%
                    </text>

                    <text
                      x="50%"
                      y="63%"
                      textAnchor="middle"
                      fontSize="11"
                      fill="#6b7280"
                    >
                      done
                    </text>
                  </svg>

                  <div style={{ display: "grid", gap: 10, minWidth: 170 }}>
                    {[
                      {
                        label: "Completed",
                        value: completedSessions,
                        color: statusColors[0],
                      },
                      {
                        label: "Open",
                        value: inProgressSessions,
                        color: statusColors[1],
                      },
                      {
                        label: "Abandoned",
                        value: abandonedSessions,
                        color: statusColors[2],
                      },
                    ].map((item) => (
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
            </div>
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Study hub</div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 16,
                  background: activeSession ? "#f8fbff" : "#f9fafb",
                  border: activeSession
                    ? "1px solid #dbeafe"
                    : "1px solid #eef2f7",
                  color: "#4b5563",
                  lineHeight: 1.55,
                }}
              >
                {loadingSessions
                  ? "Loading your current study status…"
                  : activeSession
                  ? "You have an open session waiting for you. Go to Study to resume it or start a new one."
                  : "Go to Study to start Practice, Timed block, or Exam simulation."}
              </div>

              <button
                type="button"
                onClick={() => router.push("/study")}
                style={{
                  width: "100%",
                  padding: "14px 14px",
                  borderRadius: 14,
                  border: "1px solid #d1d5db",
                  background: "#ffffff",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
              >
                Open Study
              </button>
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
                Quick navigation
              </div>

              {[
                { label: "Study", href: "/study" },
                { label: "Results", href: "/results" },
                { label: "Progress", href: "/progress" },
                { label: "Settings", href: "/settings" },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => router.push(item.href)}
                  style={{
                    width: "100%",
                    padding: "14px 14px",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: "#fcfcfd",
                    cursor: "pointer",
                    textAlign: "left",
                    fontWeight: 800,
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>

          {err ? (
            <p style={{ margin: 0, color: "crimson" }}>Error: {err}</p>
          ) : null}
        </>
      )}
    </main>
  );
}