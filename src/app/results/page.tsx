/**
 * ResultsPage
 *
 * 📍 Localização:
 * src/app/results/page.tsx
 *
 * Objetivo:
 * - Criar a primeira página real de Results / History
 * - Exibir o histórico de sessões do usuário de forma clara e mobile-first
 * - Permitir filtrar sessões por modo e status
 * - Permitir abrir review de sessões concluídas e retomar sessões em andamento
 *
 * Fonte de dados utilizada nesta versão:
 * - GET /api/sessions
 *
 * O que esta primeira versão mostra:
 * - total de sessões
 * - sessões concluídas
 * - sessões em andamento
 * - filtros por modo
 * - filtros por status
 * - histórico recente em cards
 * - ações rápidas:
 *   - resume
 *   - open review
 *
 * Limitações conhecidas desta fase:
 * - Ainda não mostra score, accuracy ou tempo total por sessão
 *   porque o endpoint atual usado aqui não devolve agregados de attempts
 * - Esses dados poderão ser adicionados depois via endpoint enriquecido
 *
 * Estratégia de UX:
 * - Mobile-first
 * - Cards verticais
 * - Filtros simples e visíveis
 * - Navegação direta para session ou review
 *
 * ✅ Atualização (2026-03-17):
 * - Primeira página Results criada
 * - Histórico com filtros e ações
 * - Preparada para futura expansão com score e métricas por sessão
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { useSession } from "next-auth/react";

type SessionMode = "practice" | "timed_block" | "exam_sim";
type SessionStatus = "all" | "in_progress" | "submitted" | "abandoned";

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

function formatStatus(status?: string | null) {
  if (!status) return "Unknown";
  if (status === "in_progress") return "In progress";
  if (status === "submitted") return "Completed";
  if (status === "abandoned") return "Abandoned";
  return status;
}

function statusBadgeBackground(status?: string | null) {
  if (status === "submitted") return "#eefaf0";
  if (status === "in_progress") return "#fff8e1";
  if (status === "abandoned") return "#fef2f2";
  return "#f3f4f6";
}

export default function ResultsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modeFilter, setModeFilter] = useState<"all" | SessionMode>("all");
  const [statusFilter, setStatusFilter] = useState<SessionStatus>("all");

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
        setErr(e?.message ?? "Failed to load results");
      } finally {
        setLoading(false);
      }
    })();
  }, [isSignedIn]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchesMode = modeFilter === "all" ? true : s.mode === modeFilter;
      const matchesStatus = statusFilter === "all" ? true : s.status === statusFilter;
      return matchesMode && matchesStatus;
    });
  }, [sessions, modeFilter, statusFilter]);

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "submitted").length;
  const inProgressSessions = sessions.filter((s) => s.status === "in_progress").length;
  const abandonedSessions = sessions.filter((s) => s.status === "abandoned").length;

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
          background: "linear-gradient(135deg, #ffffff 0%, #fbfcff 100%)",
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
          Results
        </h1>

        <p
          style={{
            margin: 0,
            color: "#555",
            lineHeight: 1.65,
            maxWidth: 760,
          }}
        >
          Browse your study history, revisit completed sessions, and resume unfinished ones.
          This first version focuses on session history and navigation. Score and deeper session
          analytics can be added in the next iteration.
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
          <div style={{ fontWeight: 900, fontSize: 20 }}>Sign in to view your results</div>
          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              color: "#555",
              lineHeight: 1.65,
            }}
          >
            Your history is personal. Once signed in, this page can show past sessions,
            completion status, and future session-level performance data.
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

          {/* Summary */}
          <section
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {[
              { label: "Total sessions", value: String(totalSessions) },
              { label: "Completed", value: String(completedSessions) },
              { label: "In progress", value: String(inProgressSessions) },
              { label: "Abandoned", value: String(abandonedSessions) },
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

          {/* Filters */}
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
            <div style={{ fontWeight: 900, fontSize: 20 }}>Filters</div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>Mode</label>
                <select
                  value={modeFilter}
                  onChange={(e) => setModeFilter(e.target.value as "all" | SessionMode)}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    background: "white",
                  }}
                >
                  <option value="all">All modes</option>
                  <option value="practice">Practice</option>
                  <option value="timed_block">Timed block</option>
                  <option value="exam_sim">Exam simulation</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as SessionStatus)}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid #d1d5db",
                    background: "white",
                  }}
                >
                  <option value="all">All statuses</option>
                  <option value="submitted">Completed</option>
                  <option value="in_progress">In progress</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
            </div>
          </section>

          {/* Results list */}
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Session history</div>
              <div
                style={{
                  marginTop: 6,
                  color: "#555",
                  lineHeight: 1.6,
                }}
              >
                {loading
                  ? "Loading your history…"
                  : `${filteredSessions.length} session(s) match the current filters.`}
              </div>
            </div>

            {loading ? (
              <p style={{ margin: 0, color: "#555" }}>Loading results…</p>
            ) : filteredSessions.length === 0 ? (
              <p style={{ margin: 0, color: "#555" }}>
                No sessions match the selected filters.
              </p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filteredSessions.map((s) => (
                  <div
                    key={s.session_id}
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid #f0f0f0",
                      background: "#fcfcfc",
                      display: "grid",
                      gap: 10,
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
                        <div style={{ fontWeight: 800, fontSize: 16 }}>
                          {modeLabel(s.mode)}
                        </div>
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
                          Submitted: {formatDateTime(s.submitted_at)}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          padding: "5px 8px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: statusBadgeBackground(s.status),
                        }}
                      >
                        {formatStatus(s.status)}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                      }}
                    >
                      {s.status === "in_progress" ? (
                        <button
                          onClick={() => router.push(`/session/${s.session_id}`)}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 12,
                            border: "1px solid #d1d5db",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Resume session
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/session/${s.session_id}/review`)}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 12,
                            border: "1px solid #d1d5db",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Open review
                        </button>
                      )}

                      <button
                        onClick={() => router.push("/")}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 12,
                          border: "1px solid #d1d5db",
                          background: "white",
                          cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Go to dashboard
                      </button>
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