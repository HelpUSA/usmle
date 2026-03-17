/**
 * HomePage
 *
 * 📍 Localização:
 * src/app/page.tsx
 *
 * Objetivo (dashboard principal):
 * - Ser a home principal do produto
 * - Antes do login:
 *   - funcionar como landing page pública
 *   - apresentar a proposta do produto com visual mais forte
 *   - usar branding HelpUS
 *   - oferecer CTA de login de forma amigável
 * - Depois do login:
 *   - funcionar como dashboard visual e de impacto
 *   - mostrar resumo rápido com gráficos
 *   - destacar sessão em andamento
 *   - oferecer ações principais de estudo
 *   - evitar duplicação com páginas mais específicas como Results e Progress
 *
 * Contrato de API utilizado:
 * - GET  /api/sessions
 *   Lista as sessões recentes do usuário autenticado
 * - POST /api/sessions
 *   Body obrigatório: { exam, mode }
 * - POST /api/sessions/:sessionId/items
 *   Gera itens da sessão (idempotente)
 *
 * Estratégia de UX:
 * - Mobile-first
 * - Menos blocos textuais longos
 * - Mais leitura visual via cards e gráficos simples
 * - Home focada em visão geral e ações, não em histórico detalhado
 *
 * Regras de produto nesta fase:
 * - Practice:
 *   - quick start com 10 questões
 * - Timed block:
 *   - quick start com 40 questões
 * - Exam simulation:
 *   - quick start usando preset curto (40 questões)
 *
 * Observações:
 * - Results e Progress já existem como áreas mais específicas
 * - Por isso, o dashboard evita repetir listas longas e detalhes excessivos
 * - O objetivo aqui é orientar o usuário e dar contexto visual rápido
 *
 * ✅ Atualização (2026-03-17):
 * - Dashboard redesenhado para maior impacto visual
 * - Inclusão de gráficos na home autenticada
 * - Redução de texto e remoção de áreas duplicadas
 * - Uso da logo HelpUS em /public/img/helpus-logo.png
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { signIn, signOut, useSession } from "next-auth/react";

type SessionMode = "practice" | "timed_block" | "exam_sim";
type ExamType = "step1";

type CreateSessionResponse = {
  session_id: string;
  user_id: string;
  mode: SessionMode;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: "in_progress" | "submitted" | "abandoned" | string;
  started_at?: string;
  submitted_at?: string | null;
};

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

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function getRecommendedCount(mode: SessionMode): number {
  switch (mode) {
    case "practice":
      return 10;
    case "timed_block":
      return 40;
    case "exam_sim":
      return 40;
    default:
      return 10;
  }
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

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [exam] = useState<ExamType>("step1");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const isSignedIn = !!session?.user?.email;
  const userName =
    session?.user?.name?.trim() ||
    session?.user?.email?.split("@")[0] ||
    "there";

  useEffect(() => {
    if (!isSignedIn) {
      setSessions([]);
      return;
    }

    (async () => {
      setLoadingSessions(true);
      setErr(null);

      try {
        const res = await apiFetch<{ sessions: SessionSummary[] }>("/api/sessions");
        setSessions(res.sessions ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load sessions");
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [isSignedIn]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "in_progress") ?? null,
    [sessions]
  );

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "submitted").length;
  const inProgressSessions = sessions.filter((s) => s.status === "in_progress").length;
  const abandonedSessions = sessions.filter((s) => s.status === "abandoned").length;

  const practiceSessions = sessions.filter((s) => s.mode === "practice").length;
  const timedBlockSessions = sessions.filter((s) => s.mode === "timed_block").length;
  const examSimSessions = sessions.filter((s) => s.mode === "exam_sim").length;

  const completionRate =
    totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  const mostUsedMode = getMostUsedMode(
    practiceSessions,
    timedBlockSessions,
    examSimSessions
  );

  const dailySeries = useMemo(() => buildDailySeries(sessions, 14), [sessions]);
  const peakDay = dailySeries.reduce(
    (best, current) => (current.count > best.count ? current : best),
    { dateKey: "", label: "—", count: 0 }
  );

  const chartWidth = 640;
  const chartHeight = 220;
  const polylinePoints = buildPolylinePoints(dailySeries, chartWidth, chartHeight);
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

  async function createAndStartSession(mode: SessionMode) {
    setLoading(true);
    setErr(null);

    try {
      const sessionRes = await apiFetch<CreateSessionResponse>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ mode, exam }),
      });

      await apiFetch<{ items?: unknown[] }>(`/api/sessions/${sessionRes.session_id}/items`, {
        method: "POST",
        body: JSON.stringify({ count: getRecommendedCount(mode) }),
      });

      router.push(`/session/${sessionRes.session_id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  const userLabel =
    sessionStatus === "loading"
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
      {!isSignedIn ? (
        <>
          {/* Public landing */}
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
                <img
                  src="/public/img/helpus-logo.png"
                  alt="HelpUS logo"
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
                  <div style={{ fontSize: 13, opacity: 0.9 }}>Built by HelpUS</div>
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
                  { title: "Practice", text: "Untimed learning with immediate feedback." },
                  { title: "Timed blocks", text: "Pacing-focused study without mid-session answers." },
                  { title: "Simulation", text: "Longer exam-style flows with deferred review." },
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
                    <div style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5 }}>
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Sign-in panel */}
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
              <div style={{ fontWeight: 900, fontSize: 22 }}>Continue with your account</div>
              <button
                onClick={handleGoogleSignIn}
                disabled={sessionStatus === "loading"}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid #d1d5db",
                  background: "#111827",
                  color: "white",
                  cursor: sessionStatus === "loading" ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  fontSize: 15,
                }}
              >
                {sessionStatus === "loading" ? "Loading…" : "Continue with Google"}
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
              <div style={{ fontWeight: 900, fontSize: 22 }}>What happens after login</div>

              {[
                "Visual dashboard with study momentum",
                "Quick start for the 3 main study modes",
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
                  <span style={{ color: "#555", lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          {/* Signed-in hero */}
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
                <img
                  src="/public/img/helpus-logo.png"
                  alt="HelpUS logo"
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
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{userLabel}</div>
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
                  onClick={handleSignOut}
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

            {/* Visual KPI row */}
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
            </div>
          </section>

          {/* Dashboard charts */}
          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {/* Activity chart */}
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
                  Peak: {peakDay.label} ({peakDay.count})
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
            </div>

            {/* Donut charts */}
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
                      { label: "Exam sim", value: examSimSessions, color: modeColors[2] },
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
                      done
                    </text>
                  </svg>

                  <div style={{ display: "grid", gap: 10, minWidth: 170 }}>
                    {[
                      { label: "Completed", value: completedSessions, color: statusColors[0] },
                      { label: "Open", value: inProgressSessions, color: statusColors[1] },
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
            </div>
          </section>

          {/* Main actions */}
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Continue studying</div>

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
                    <div style={{ fontWeight: 800 }}>{modeLabel(activeSession.mode)}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                      {formatDate(activeSession.started_at)}
                    </div>
                  </div>

                  <button
                    onClick={() => router.push(`/session/${activeSession.session_id}`)}
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

                  <button
                    onClick={() => router.push(`/session/${activeSession.session_id}/review`)}
                    style={{
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #d1d5db",
                      background: "white",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Open review
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
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20 }}>Start studying</div>

              {[
                {
                  title: "Practice",
                  subtitle: "Untimed · immediate review",
                  action: () => createAndStartSession("practice"),
                  bg: "#f8fff9",
                },
                {
                  title: "Timed block",
                  subtitle: "Timed · deferred review",
                  action: () => createAndStartSession("timed_block"),
                  bg: "#fffdf6",
                },
                {
                  title: "Exam simulation",
                  subtitle: "Simulation-style · short preset",
                  action: () => createAndStartSession("exam_sim"),
                  bg: "#fff8f8",
                },
              ].map((item) => (
                <button
                  key={item.title}
                  onClick={item.action}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "14px 14px",
                    borderRadius: 14,
                    border: "1px solid #d1d5db",
                    background: item.bg,
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{item.title}</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                    {item.subtitle}
                  </div>
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