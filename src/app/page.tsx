/**
 * HomePage
 *
 * 📍 Localização:
 * src/app/page.tsx
 *
 * Objetivo (fase atual do produto):
 * - Ser a home autenticada principal do usuário
 * - Mostrar uma experiência mais amigável, mobile-first, e orientada a estudo
 * - Exibir um resumo básico da atividade do usuário com base no histórico de sessões
 * - Oferecer quick actions para:
 *   - retomar sessão em andamento
 *   - iniciar Practice
 *   - iniciar Timed block
 *   - iniciar Exam simulation
 * - Permitir configuração manual de uma nova sessão logo na home
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
 * - Mobile-first:
 *   - cards empilhados
 *   - botões grandes
 *   - conteúdo em uma coluna por padrão
 * - A home deixa de ser apenas um formulário de start session e passa a funcionar
 *   como dashboard inicial do usuário
 *
 * Regras de produto adotadas nesta fase:
 * - practice:
 *   - permite question count livre
 * - timed_block:
 *   - mantém question count configurável, com sugestão de 40
 * - exam_sim:
 *   - não expõe question count livre
 *   - usa presets de simulação para evitar expectativa errada do usuário
 *
 * Observações:
 * - Ainda não criamos páginas dedicadas de Results / Progress / Profile / Settings.
 *   Nesta fase, a home já funciona como um primeiro dashboard amigável.
 * - Para não quebrar o fluxo atual, toda navegação continua baseada nas rotas já existentes.
 *
 * ✅ Atualização (2026-03-17):
 * - Home redesenhada como dashboard autenticada
 * - Inclusão de resumo de sessões do usuário
 * - Inclusão de card para retomar sessão em andamento
 * - Inclusão de quick actions por modo
 * - UI ajustada para diferenciar exam_sim do count livre
 * - Layout mobile-first com cards, seções e touch targets maiores
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { signOut, useSession } from "next-auth/react";

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

type ExamSimPreset = "short" | "medium" | "full";

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

function getDefaultCountForMode(mode: SessionMode, preset: ExamSimPreset): number {
  if (mode === "practice") return 10;
  if (mode === "timed_block") return 40;

  switch (preset) {
    case "short":
      return 40;
    case "medium":
      return 80;
    case "full":
      return 280;
    default:
      return 40;
  }
}

function getExamSimPresetMeta(preset: ExamSimPreset) {
  switch (preset) {
    case "short":
      return {
        label: "Short simulation",
        description: "1 block · 40 questions",
        count: 40,
      };
    case "medium":
      return {
        label: "Medium simulation",
        description: "2 blocks · 80 questions",
        count: 80,
      };
    case "full":
      return {
        label: "Full simulation",
        description: "7 blocks · 280 questions",
        count: 280,
      };
    default:
      return {
        label: "Short simulation",
        description: "1 block · 40 questions",
        count: 40,
      };
  }
}

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [exam, setExam] = useState<ExamType>("step1");
  const [mode, setMode] = useState<SessionMode>("practice");
  const [count, setCount] = useState<number>(10);
  const [examSimPreset, setExamSimPreset] = useState<ExamSimPreset>("short");

  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  const isSignedIn = !!session?.user?.email;

  /**
   * Ajusta o count base quando o modo muda,
   * para evitar combinações incoerentes na home.
   */
  useEffect(() => {
    setCount(getDefaultCountForMode(mode, examSimPreset));
  }, [mode, examSimPreset]);

  /**
   * Busca sessões recentes para montar a dashboard.
   * Só roda quando o usuário estiver autenticado.
   */
  useEffect(() => {
    if (!isSignedIn) {
      setSessions([]);
      return;
    }

    (async () => {
      setLoadingSessions(true);
      try {
        const res = await apiFetch<{ sessions: SessionSummary[] }>("/api/sessions");
        setSessions(res.sessions ?? []);
      } catch (e: any) {
        setErr((prev) => prev ?? (e?.message ?? "Failed to load sessions"));
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
  const practiceSessions = sessions.filter((s) => s.mode === "practice").length;
  const timedBlockSessions = sessions.filter((s) => s.mode === "timed_block").length;
  const examSimSessions = sessions.filter((s) => s.mode === "exam_sim").length;

  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);

  const canStart = useMemo(() => {
    if (loading) return false;
    if (!exam) return false;
    if (!mode) return false;

    // practice e timed_block usam count configurável
    if (mode !== "exam_sim") {
      if (!Number.isFinite(count) || count < 1 || count > 200) return false;
    }

    return true;
  }, [loading, exam, mode, count]);

  const userLabel =
    sessionStatus === "loading"
      ? "Loading session…"
      : session?.user?.email
      ? `Signed in as ${session.user.email}`
      : "Not signed in";

  async function handleSignOut() {
    await signOut({ callbackUrl: "/" });
  }

  async function createAndStartSession(targetMode: SessionMode, customCount?: number) {
    setLoading(true);
    setErr(null);

    try {
      const sessionRes = await apiFetch<CreateSessionResponse>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ mode: targetMode, exam }),
      });

      const effectiveCount =
        typeof customCount === "number"
          ? customCount
          : getDefaultCountForMode(targetMode, examSimPreset);

      await apiFetch<{ items?: unknown[] }>(`/api/sessions/${sessionRes.session_id}/items`, {
        method: "POST",
        body: JSON.stringify({ count: effectiveCount }),
      });

      router.push(`/session/${sessionRes.session_id}`);
    } catch (e: any) {
      setErr(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function startConfiguredSession() {
    if (!canStart) return;

    const effectiveCount =
      mode === "exam_sim"
        ? getExamSimPresetMeta(examSimPreset).count
        : count;

    await createAndStartSession(mode, effectiveCount);
  }

  const examSimMeta = getExamSimPresetMeta(examSimPreset);

  return (
    <main
      style={{
        padding: 16,
        fontFamily: "system-ui",
        maxWidth: 980,
        margin: "0 auto",
      }}
    >
      {/* Header / welcome */}
      <section
        style={{
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 280px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                aria-hidden
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  background: "white",
                  flexShrink: 0,
                }}
                title="HelpUS"
              >
                H
              </div>

              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    margin: 0,
                    lineHeight: 1.1,
                  }}
                >
                  USMLE Practice
                </h1>
                <div style={{ marginTop: 2, fontSize: 12, color: "#666" }}>
                  Built by <strong>HelpUS</strong> · Beta
                </div>
              </div>
            </div>

            <p
              style={{
                marginTop: 12,
                color: "#555",
                marginBottom: 0,
                lineHeight: 1.5,
                maxWidth: 720,
              }}
            >
              {isSignedIn
                ? "Welcome back. This dashboard helps you resume study, start a new session, and track your recent activity."
                : "Welcome. Sign in to access your study dashboard, recent sessions, and personalized study flow."}
            </p>
          </div>

          <div
            style={{
              textAlign: "right",
              width: "100%",
              maxWidth: 260,
              flex: "0 1 260px",
            }}
          >
            <div style={{ fontSize: 12, color: "#666", wordBreak: "break-word" }}>
              {userLabel}
            </div>

            {isSignedIn ? (
              <button
                onClick={handleSignOut}
                style={{
                  marginTop: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ccc",
                  background: "white",
                  cursor: "pointer",
                  width: "100%",
                }}
              >
                Sign out
              </button>
            ) : (
              <a
                href="/api/auth/signin"
                style={{
                  display: "inline-block",
                  marginTop: 8,
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #ccc",
                  background: "white",
                  color: "inherit",
                  textDecoration: "none",
                  width: "100%",
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Signed-out info */}
      {!isSignedIn ? (
        <section
          style={{
            marginTop: 16,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 16,
            background: "white",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 18 }}>Get started</div>
          <p style={{ marginTop: 10, marginBottom: 0, color: "#555", lineHeight: 1.6 }}>
            After signing in, you will land on a personalized study home with your recent sessions,
            progress snapshot, and quick actions to start or resume practice.
          </p>
        </section>
      ) : (
        <>
          {/* Quick summary */}
          <section
            style={{
              marginTop: 16,
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {[
              { label: "Total sessions", value: String(totalSessions) },
              { label: "Completed", value: String(completedSessions) },
              { label: "In progress", value: String(inProgressSessions) },
              { label: "Practice", value: String(practiceSessions) },
              { label: "Timed blocks", value: String(timedBlockSessions) },
              { label: "Exam sims", value: String(examSimSessions) },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: 14,
                  border: "1px solid #ddd",
                  borderRadius: 16,
                  background: "white",
                }}
              >
                <div style={{ fontSize: 12, color: "#666" }}>{card.label}</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900 }}>{card.value}</div>
              </div>
            ))}
          </section>

          {/* Resume current session */}
          {activeSession ? (
            <section
              style={{
                marginTop: 16,
                padding: 16,
                border: "1px solid #cfe3ff",
                borderRadius: 16,
                background: "#f7fbff",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 18 }}>Resume current session</div>
              <div style={{ marginTop: 8, color: "#555", lineHeight: 1.5 }}>
                You have an unfinished <strong>{modeLabel(activeSession.mode)}</strong> session started on{" "}
                <strong>{formatDate(activeSession.started_at)}</strong>.
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                <button
                  onClick={() => router.push(`/session/${activeSession.session_id}`)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #99c2ff",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Resume session
                </button>

                <button
                  onClick={() => router.push(`/session/${activeSession.session_id}/review`)}
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  Open review
                </button>
              </div>
            </section>
          ) : null}

          {/* Quick actions */}
          <section
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 16,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>Quick actions</div>
            <div style={{ marginTop: 8, color: "#555", lineHeight: 1.5 }}>
              Start a new study session with one tap. These options use recommended defaults.
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <button
                onClick={() => createAndStartSession("practice", 10)}
                disabled={loading}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid #ddd",
                  background: "#f8fff9",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 900 }}>Start Practice</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                  Untimed · immediate review · 10 questions
                </div>
              </button>

              <button
                onClick={() => createAndStartSession("timed_block", 40)}
                disabled={loading}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid #ddd",
                  background: "#fffdf6",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 900 }}>Start Timed Block</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                  Timed · deferred review · 40 questions
                </div>
              </button>

              <button
                onClick={() => createAndStartSession("exam_sim", 40)}
                disabled={loading}
                style={{
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid #ddd",
                  background: "#fff8f8",
                  cursor: loading ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 900 }}>Start Exam Simulation</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                  Simulation preset · deferred review · short exam
                </div>
              </button>
            </div>
          </section>

          {/* Manual setup */}
          <section
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 16,
              background: "white",
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 18 }}>Custom session setup</div>
              <div style={{ marginTop: 6, color: "#555", lineHeight: 1.5 }}>
                Configure a new session manually. The options below adapt to the selected mode.
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#555" }}>Exam</label>
              <select
                value={exam}
                onChange={(e) => setExam(e.target.value as ExamType)}
                disabled={loading}
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #ccc",
                  background: "white",
                }}
              >
                <option value="step1">Step 1</option>
              </select>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={{ fontSize: 13, color: "#555" }}>Mode</label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as SessionMode)}
                disabled={loading}
                style={{
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #ccc",
                  background: "white",
                }}
              >
                <option value="practice">Practice</option>
                <option value="timed_block">Timed block</option>
                <option value="exam_sim">Exam simulation</option>
              </select>

              <div style={{ fontSize: 12, color: "#777", lineHeight: 1.5 }}>
                {mode === "practice"
                  ? "Best for daily learning: untimed and with immediate feedback."
                  : mode === "timed_block"
                  ? "Best for speed training: timed, no immediate feedback, and usually built around a block."
                  : "Best for realistic simulation: longer timed flow with deferred review and fixed presets."}
              </div>
            </div>

            {mode !== "exam_sim" ? (
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>
                  {mode === "practice" ? "Question count" : "Block question count"}
                </label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  disabled={loading}
                  style={{
                    padding: "12px 12px",
                    borderRadius: 12,
                    border: "1px solid #ccc",
                  }}
                />
                <div style={{ fontSize: 12, color: "#777", lineHeight: 1.5 }}>
                  {mode === "practice"
                    ? "Choose any number from 1 to 200."
                    : "For a realistic timed block, 40 questions is the recommended default."}
                </div>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ fontSize: 13, color: "#555" }}>Simulation preset</label>

                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  }}
                >
                  {(["short", "medium", "full"] as ExamSimPreset[]).map((preset) => {
                    const presetMeta = getExamSimPresetMeta(preset);
                    const selected = examSimPreset === preset;

                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setExamSimPreset(preset)}
                        disabled={loading}
                        style={{
                          padding: "14px 14px",
                          borderRadius: 14,
                          border: selected ? "2px solid #222" : "1px solid #ddd",
                          background: selected ? "#f7f7f7" : "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ fontWeight: 900 }}>{presetMeta.label}</div>
                        <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                          {presetMeta.description}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ fontSize: 12, color: "#777", lineHeight: 1.5 }}>
                  Current preset: <strong>{examSimMeta.label}</strong> · {examSimMeta.description}.
                  This avoids a misleading “free count” setup for exam simulation.
                </div>
              </div>
            )}

            <button
              onClick={startConfiguredSession}
              disabled={!canStart}
              style={{
                marginTop: 4,
                padding: "14px 14px",
                borderRadius: 14,
                border: "1px solid #ccc",
                cursor: !canStart ? "not-allowed" : "pointer",
                fontWeight: 900,
                width: "100%",
              }}
            >
              {loading ? "Starting..." : "Start Session"}
            </button>

            {err ? (
              <p style={{ marginTop: 0, color: "crimson", marginBottom: 0 }}>
                Error: {err}
              </p>
            ) : null}
          </section>

          {/* Recent sessions */}
          <section
            style={{
              marginTop: 16,
              padding: 16,
              border: "1px solid #ddd",
              borderRadius: 16,
              background: "white",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 18 }}>Recent sessions</div>
            <div style={{ marginTop: 6, color: "#555", lineHeight: 1.5 }}>
              Your most recent study activity appears here.
            </div>

            {loadingSessions ? (
              <p style={{ marginTop: 12, color: "#555" }}>Loading recent sessions…</p>
            ) : recentSessions.length === 0 ? (
              <p style={{ marginTop: 12, color: "#555" }}>No sessions yet. Start your first one above.</p>
            ) : (
              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {recentSessions.map((s) => (
                  <div
                    key={s.session_id}
                    style={{
                      padding: 14,
                      border: "1px solid #eee",
                      borderRadius: 14,
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
                        <div style={{ fontWeight: 800 }}>{modeLabel(s.mode)}</div>
                        <div style={{ marginTop: 4, fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                          Started: {formatDate(s.started_at)}
                        </div>
                        <div style={{ marginTop: 2, fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                          Status: <strong>{s.status ?? "unknown"}</strong>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: "1px solid #ddd",
                          background: s.status === "submitted" ? "#eefaf0" : "#fff8e1",
                        }}
                      >
                        {s.status === "submitted" ? "Completed" : "Open"}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gap: 10,
                        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      }}
                    >
                      {s.status === "in_progress" ? (
                        <button
                          onClick={() => router.push(`/session/${s.session_id}`)}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 12,
                            border: "1px solid #ccc",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          onClick={() => router.push(`/session/${s.session_id}/review`)}
                          style={{
                            padding: "12px 12px",
                            borderRadius: 12,
                            border: "1px solid #ccc",
                            background: "white",
                            cursor: "pointer",
                            fontWeight: 700,
                          }}
                        >
                          Open review
                        </button>
                      )}

                      <button
                        onClick={() => createAndStartSession(s.mode, s.mode === "exam_sim" ? 40 : 10)}
                        disabled={loading}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 12,
                          border: "1px solid #ccc",
                          background: "white",
                          cursor: loading ? "not-allowed" : "pointer",
                          fontWeight: 700,
                        }}
                      >
                        Start new {modeLabel(s.mode)}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Footer hint */}
          <section style={{ marginTop: 16, color: "#777", fontSize: 12, lineHeight: 1.6 }}>
            <div>
              Tip: In upcoming steps, this dashboard can grow into dedicated sections for results, progress,
              profile, and settings without breaking the current study flow.
            </div>
          </section>
        </>
      )}
    </main>
  );
}