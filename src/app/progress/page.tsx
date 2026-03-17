/**
 * ProgressPage
 *
 * 📍 Localização:
 * src/app/progress/page.tsx
 *
 * Objetivo:
 * - Exibir progresso do usuário de forma mais visual e menos textual
 * - Diferenciar claramente Progress de Results
 * - Priorizar analytics, padrões de uso e leitura rápida
 *
 * Fonte de dados utilizada nesta versão:
 * - GET /api/sessions
 *
 * O que esta versão mostra:
 * - cards-resumo
 * - gráfico de atividade (últimos 14 dias)
 * - distribuição por modo
 * - distribuição por status
 * - insights rápidos
 * - lista recente reduzida
 *
 * Limitações conhecidas desta fase:
 * - Ainda não calcula accuracy (% correto), tempo médio por questão
 *   ou métricas por attempts, porque o endpoint atual usado aqui
 *   não fornece agregados de respostas.
 *
 * Estratégia de UX:
 * - Mobile-first
 * - Mais gráficos, menos texto
 * - SVG nativo, sem biblioteca externa
 * - Leitura rápida em cards
 *
 * ✅ Atualização (2026-03-17):
 * - Progress redesenhado para ficar mais analítico
 * - Mais visualizações e menos texto corrido
 * - Results e Progress agora ficam mais distintos em propósito
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/apiClient";
import { useSession } from "next-auth/react";

type SessionMode = "practice" | "timed_block" | "exam_sim";

type SessionSummary = {
  session_id: string;
  user_id: string;
  mode: SessionMode;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: "in_progress" | "submitted" | "abandoned" | string;
  settings_json?: Record<string, unknown> | null;
  started_at?: string;
  submitted_at?: string | null;
};

type DailyPoint = {
  dateKey: string;
  label: string;
  count: number;
};

function modeLabel(mode: SessionMode) {
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

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getDateKey(value?: string | null) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildDailySeries(sessions: SessionSummary[], lastDays = 14): DailyPoint[] {
  const today = new Date();
  const map = new Map<string, number>();

  for (const s of sessions) {
    const key = getDateKey(s.started_at);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  const series: DailyPoint[] = [];

  for (let i = lastDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${day}`;

    series.push({
      dateKey: key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      count: map.get(key) ?? 0,
    });
  }

  return series;
}

function buildPolylinePoints(series: DailyPoint[], width: number, height: number, padding = 20) {
  if (series.length === 0) return "";
  const maxValue = Math.max(...series.map((p) => p.count), 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  return series
    .map((point, index) => {
      const x =
        padding + (series.length === 1 ? innerW / 2 : (index / (series.length - 1)) * innerW);
      const y = padding + innerH - (point.count / maxValue) * innerH;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildBars(series: DailyPoint[], width: number, height: number, padding = 20) {
  const maxValue = Math.max(...series.map((p) => p.count), 1);
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const barGap = 6;
  const barWidth = Math.max(8, (innerW - barGap * (series.length - 1)) / series.length);

  return series.map((point, index) => {
    const x = padding + index * (barWidth + barGap);
    const barHeight = (point.count / maxValue) * innerH;
    const y = padding + innerH - barHeight;
    return { x, y, barWidth, barHeight, point };
  });
}

function buildDonutSegments(values: number[]) {
  const total = values.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map(() => 0);
  return values.map((v) => (v / total) * 100);
}

function getStrokeDasharray(percent: number, circumference: number) {
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
  if (entries[0].value === 0) return "—";
  return entries[0].label;
}

export default function ProgressPage() {
  const { data: session, status: sessionStatus } = useSession();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isSignedIn = !!session?.user?.email;

  useEffect(() => {
    if (!isSignedIn) {
      setSessions([]);
      return;
    }

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        const res = await apiFetch<{ sessions: SessionSummary[] }>("/api/sessions");
        setSessions(res.sessions ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load progress data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "submitted").length;
  const inProgressSessions = sessions.filter((s) => s.status === "in_progress").length;
  const abandonedSessions = sessions.filter((s) => s.status === "abandoned").length;

  const practiceSessions = sessions.filter((s) => s.mode === "practice").length;
  const timedBlockSessions = sessions.filter((s) => s.mode === "timed_block").length;
  const examSimSessions = sessions.filter((s) => s.mode === "exam_sim").length;

  const dailySeries = useMemo(() => buildDailySeries(sessions, 14), [sessions]);
  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  const chartWidth = 640;
  const chartHeight = 220;
  const polylinePoints = buildPolylinePoints(dailySeries, chartWidth, chartHeight);
  const bars = buildBars(dailySeries, chartWidth, chartHeight);

  const activeDays = dailySeries.filter((d) => d.count > 0).length;
  const peakDay = dailySeries.reduce(
    (best, current) => (current.count > best.count ? current : best),
    { dateKey: "", label: "—", count: 0 }
  );

  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

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
      {/* Header */}
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
          {sessionStatus === "loading"
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
          <div style={{ fontWeight: 900, fontSize: 20 }}>Sign in to view progress</div>
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
              Error: {err}
            </section>
          ) : null}

          {/* Top summary cards */}
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
                <div style={{ fontSize: 12, color: "#6b7280" }}>{card.label}</div>
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

          {/* Main activity chart */}
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
                <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
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
                    const maxValue = Math.max(...dailySeries.map((p) => p.count), 1);
                    const padding = 20;
                    const innerW = chartWidth - padding * 2;
                    const innerH = chartHeight - padding * 2;

                    const x =
                      padding +
                      (dailySeries.length === 1
                        ? innerW / 2
                        : (index / (dailySeries.length - 1)) * innerW);
                    const y = padding + innerH - (point.count / maxValue) * innerH;

                    return (
                      <g key={point.dateKey}>
                        <circle cx={x} cy={y} r="4" fill="#1d4ed8" />
                        <text
                          x={x}
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
          </section>

          {/* Donut charts */}
          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {/* Mode distribution */}
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>Mode mix</div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
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
                  aria-label="Mode distribution chart"
                >
                  <circle
                    cx={donutSize / 2}
                    cy={donutSize / 2}
                    r={radius}
                    fill="none"
                    stroke="#eef2f7"
                    strokeWidth={donutStroke}
                  />

                  {modePercents.map((percent, idx) => {
                    const previous = modePercents
                      .slice(0, idx)
                      .reduce((sum, value) => sum + value, 0);
                    const offset = circumference - (previous / 100) * circumference;

                    return (
                      <circle
                        key={idx}
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={radius}
                        fill="none"
                        stroke={modeColors[idx]}
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
                    { label: "Practice", value: practiceSessions, color: modeColors[0] },
                    { label: "Timed block", value: timedBlockSessions, color: modeColors[1] },
                    { label: "Exam simulation", value: examSimSessions, color: modeColors[2] },
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                        <span style={{ fontSize: 14, color: "#374151" }}>{item.label}</span>
                      </div>
                      <strong style={{ fontSize: 14 }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Status distribution */}
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
                <div style={{ fontWeight: 900, fontSize: 20 }}>Status mix</div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
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
                  aria-label="Status distribution chart"
                >
                  <circle
                    cx={donutSize / 2}
                    cy={donutSize / 2}
                    r={radius}
                    fill="none"
                    stroke="#eef2f7"
                    strokeWidth={donutStroke}
                  />

                  {statusPercents.map((percent, idx) => {
                    const previous = statusPercents
                      .slice(0, idx)
                      .reduce((sum, value) => sum + value, 0);
                    const offset = circumference - (previous / 100) * circumference;

                    return (
                      <circle
                        key={idx}
                        cx={donutSize / 2}
                        cy={donutSize / 2}
                        r={radius}
                        fill="none"
                        stroke={statusColors[idx]}
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
                    {completionRate}%
                  </text>
                  <text
                    x="50%"
                    y="63%"
                    textAnchor="middle"
                    fontSize="11"
                    fill="#6b7280"
                  >
                    complete
                  </text>
                </svg>

                <div style={{ display: "grid", gap: 10, minWidth: 170 }}>
                  {[
                    { label: "Completed", value: completedSessions, color: statusColors[0] },
                    { label: "In progress", value: inProgressSessions, color: statusColors[1] },
                    { label: "Abandoned", value: abandonedSessions, color: statusColors[2] },
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
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                        <span style={{ fontSize: 14, color: "#374151" }}>{item.label}</span>
                      </div>
                      <strong style={{ fontSize: 14 }}>{item.value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Insight cards */}
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
                    ? `${Math.round((timedBlockSessions / totalSessions) * 100)}%`
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
                <div style={{ fontSize: 12, color: "#6b7280" }}>{card.label}</div>
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

          {/* Recent sessions - reduced prominence */}
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
                {recentSessions.map((s) => (
                  <div
                    key={s.session_id}
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
                        <div style={{ fontWeight: 800 }}>{modeLabel(s.mode)}</div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: "#666",
                            lineHeight: 1.5,
                          }}
                        >
                          {formatDateTime(s.started_at)}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          padding: "5px 8px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: s.status === "submitted" ? "#eefaf0" : "#fff8e1",
                        }}
                      >
                        {s.status === "submitted" ? "Completed" : "Open"}
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