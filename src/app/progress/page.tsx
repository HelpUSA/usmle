/**
 * ProgressPage
 *
 * 📍 Localização:
 * src/app/progress/page.tsx
 *
 * Objetivo:
 * - Criar a primeira página real de progresso do usuário
 * - Exibir estatísticas visuais e histórico recente de estudo
 * - Funcionar bem em celular e computador, com foco mobile-first
 *
 * Fonte de dados utilizada nesta versão:
 * - GET /api/sessions
 *
 * O que esta primeira versão mostra:
 * - total de sessões
 * - sessões concluídas
 * - sessões em andamento
 * - distribuição por modo (practice / timed_block / exam_sim)
 * - atividade por dia (baseada em started_at)
 * - sessões recentes
 *
 * Limitações conhecidas desta fase:
 * - Ainda não calcula accuracy (% correto), tempo médio por questão
 *   ou métricas por attempts, porque o endpoint atual usado aqui
 *   não fornece agregados de respostas.
 * - Esta página já entrega valor visual e histórico, mas será enriquecida
 *   depois com dados mais profundos.
 *
 * Estratégia de UX:
 * - Mobile-first
 * - Cards empilhados
 * - Gráfico SVG simples e leve
 * - Sem dependência de biblioteca externa de gráficos nesta etapa
 *
 * ✅ Atualização (2026-03-17):
 * - Primeira página Progress criada
 * - Resumo, gráfico de atividade e sessões recentes
 * - Preparada para futura expansão com accuracy e analytics avançado
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

function formatDateShort(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
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

  const practiceSessions = sessions.filter((s) => s.mode === "practice").length;
  const timedBlockSessions = sessions.filter((s) => s.mode === "timed_block").length;
  const examSimSessions = sessions.filter((s) => s.mode === "exam_sim").length;

  const dailySeries = useMemo(() => buildDailySeries(sessions, 14), [sessions]);
  const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions]);

  const chartWidth = 640;
  const chartHeight = 220;
  const polylinePoints = buildPolylinePoints(dailySeries, chartWidth, chartHeight);
  const bars = buildBars(dailySeries, chartWidth, chartHeight);

  const topSummaryCards = [
    { label: "Total sessions", value: String(totalSessions) },
    { label: "Completed", value: String(completedSessions) },
    { label: "In progress", value: String(inProgressSessions) },
    {
      label: "Completion rate",
      value: totalSessions > 0 ? `${Math.round((completedSessions / totalSessions) * 100)}%` : "0%",
    },
  ];

  const modeCards = [
    { label: "Practice", value: String(practiceSessions) },
    { label: "Timed block", value: String(timedBlockSessions) },
    { label: "Exam simulation", value: String(examSimSessions) },
  ];

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
          gap: 10,
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

        <p
          style={{
            margin: 0,
            color: "#555",
            lineHeight: 1.65,
            maxWidth: 760,
          }}
        >
          This page shows your study activity over time. In this first version, the focus is
          on session history, mode distribution, and recent momentum. Accuracy and deeper
          analytics can be added next as the API expands.
        </p>
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
          <div style={{ fontWeight: 900, fontSize: 20 }}>Sign in to view your progress</div>
          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              color: "#555",
              lineHeight: 1.65,
            }}
          >
            Progress is personalized. Once signed in, this page can show your session history,
            mode usage, and study trends.
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
              Error: {err}
            </section>
          ) : null}

          {/* Summary cards */}
          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {topSummaryCards.map((card) => (
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
                    fontSize: 26,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </section>

          {/* Activity chart */}
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Study activity (last 14 days)</div>
              <div
                style={{
                  marginTop: 6,
                  color: "#555",
                  lineHeight: 1.6,
                }}
              >
                Each bar represents the number of sessions started on that day.
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
                  {/* baseline */}
                  <line
                    x1="20"
                    y1={chartHeight - 20}
                    x2={chartWidth - 20}
                    y2={chartHeight - 20}
                    stroke="#d1d5db"
                    strokeWidth="1"
                  />

                  {/* bars */}
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

                  {/* line */}
                  <polyline
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    points={polylinePoints}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />

                  {/* dots */}
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

          {/* Mode distribution */}
          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {modeCards.map((card) => (
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
                    fontSize: 26,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </section>

          {/* Recent sessions */}
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
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>Recent sessions</div>
              <div
                style={{
                  marginTop: 6,
                  color: "#555",
                  lineHeight: 1.6,
                }}
              >
                A compact log of your latest study sessions.
              </div>
            </div>

            {loading ? (
              <p style={{ margin: 0, color: "#555" }}>Loading progress data…</p>
            ) : recentSessions.length === 0 ? (
              <p style={{ margin: 0, color: "#555" }}>
                No sessions yet. Start studying to begin building your progress history.
              </p>
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
                          Started: {formatDateTime(s.started_at)}
                        </div>
                        <div
                          style={{
                            marginTop: 2,
                            fontSize: 13,
                            color: "#666",
                            lineHeight: 1.5,
                          }}
                        >
                          Submitted: {formatDateShort(s.submitted_at)}
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