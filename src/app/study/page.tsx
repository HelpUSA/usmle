/**
 * StudyPage
 *
 * 📍 Localização:
 * src/app/study/page.tsx
 *
 * Objetivo:
 * - Criar uma área dedicada de estudo separada do dashboard
 * - Concentrar as ações de:
 *   - retomar sessão em andamento
 *   - iniciar Practice
 *   - iniciar Timed block
 *   - iniciar Exam simulation
 * - Explicar de forma curta as diferenças entre os modos
 * - Reduzir a duplicação entre Dashboard e Study
 *
 * Contrato de API utilizado:
 * - GET  /api/sessions
 *   Lista sessões recentes do usuário autenticado
 * - POST /api/sessions
 *   Body obrigatório: { exam, mode }
 * - POST /api/sessions/:sessionId/items
 *   Gera os itens da sessão de forma idempotente
 *
 * Estratégia de UX:
 * - Mobile-first
 * - Cards grandes e clicáveis
 * - Texto curto, orientação direta
 * - Visual consistente com Dashboard / Progress / Results
 *
 * Regras de produto nesta fase:
 * - Practice:
 *   - 10 questões por padrão
 *   - untimed
 *   - review imediato
 *
 * - Timed block:
 *   - 40 questões por padrão
 *   - timed
 *   - review diferido
 *
 * - Exam simulation:
 *   - 40 questões por padrão nesta fase
 *   - timed
 *   - review diferido
 *
 * Observações:
 * - Esta página não substitui Results nem Progress
 * - Ela é a porta de entrada operacional para estudar
 *
 * ✅ Atualização (2026-03-17):
 * - Nova página /study criada
 * - Separação clara entre Dashboard e fluxo de estudo
 * - Retomada de sessão + quick start por modo
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { useSession } from "next-auth/react";

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

export default function StudyPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [exam] = useState<ExamType>("step1");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const isSignedIn = !!session?.user?.email;

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
        setErr(e?.message ?? "Failed to load study sessions");
      } finally {
        setLoadingSessions(false);
      }
    })();
  }, [isSignedIn]);

  const activeSession = useMemo(
    () => sessions.find((s) => s.status === "in_progress") ?? null,
    [sessions]
  );

  const recentCompleted = useMemo(
    () => sessions.filter((s) => s.status === "submitted").slice(0, 3),
    [sessions]
  );

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
          Study
        </h1>

        <div
          style={{
            color: "#4b5563",
            lineHeight: 1.55,
            maxWidth: 760,
          }}
        >
          Start a new study session or continue where you left off.
        </div>
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
              Error: {err}
            </section>
          ) : null}

          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            }}
          >
            {/* Resume */}
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
                    <div style={{ fontWeight: 800 }}>{modeLabel(activeSession.mode)}</div>
                    <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                      Started: {formatDate(activeSession.started_at)}
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

            {/* Recent completed */}
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Recent completed</div>

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
                  {recentCompleted.map((s) => (
                    <button
                      key={s.session_id}
                      onClick={() => router.push(`/session/${s.session_id}/review`)}
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
                      <div style={{ fontWeight: 800 }}>{modeLabel(s.mode)}</div>
                      <div style={{ marginTop: 4, fontSize: 13, color: "#6b7280" }}>
                        {formatDate(s.submitted_at ?? s.started_at)}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Start modes */}
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
              <div style={{ fontWeight: 900, fontSize: 22 }}>Start a new session</div>
              <div style={{ marginTop: 6, color: "#6b7280", lineHeight: 1.5 }}>
                Choose the format that best matches your study goal.
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              }}
            >
              <button
                onClick={() => createAndStartSession("practice")}
                disabled={loading}
                style={{
                  padding: "16px",
                  borderRadius: 18,
                  border: "1px solid #dbe7d8",
                  background: "#f8fff9",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 18 }}>Practice</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                  Untimed. Immediate feedback after each question. Best for daily learning.
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  Default: 10 questions
                </div>
              </button>

              <button
                onClick={() => createAndStartSession("timed_block")}
                disabled={loading}
                style={{
                  padding: "16px",
                  borderRadius: 18,
                  border: "1px solid #ece5c8",
                  background: "#fffdf6",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 18 }}>Timed block</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                  Timed session with deferred review. Best for pacing and block training.
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  Default: 40 questions
                </div>
              </button>

              <button
                onClick={() => createAndStartSession("exam_sim")}
                disabled={loading}
                style={{
                  padding: "16px",
                  borderRadius: 18,
                  border: "1px solid #f0dddd",
                  background: "#fff8f8",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 18 }}>Exam simulation</div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                  Simulation-style flow with deferred review. Best for realistic exam practice.
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: "#6b7280" }}>
                  Current preset: 40 questions
                </div>
              </button>
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