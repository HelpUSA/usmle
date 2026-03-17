/**
 * HomePage
 *
 * 📍 Localização:
 * src/app/page.tsx
 *
 * Objetivo (nova fase do produto):
 * - Separar claramente a experiência antes e depois do login
 * - Antes do login:
 *   - funcionar como landing page pública
 *   - apresentar a proposta do produto
 *   - exibir branding HelpUS
 *   - oferecer CTA de login de forma mais amigável
 * - Depois do login:
 *   - funcionar como dashboard principal do usuário
 *   - mostrar um resumo simples da atividade
 *   - destacar continuação de sessão em andamento
 *   - oferecer as principais entradas do sistema sem sobrecarregar a tela
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
 *   - uma coluna por padrão
 *   - cards grandes e bem espaçados
 *   - botões full-width
 *   - redução de densidade cognitiva na home
 * - A home deixa de acumular tudo em uma tela só:
 *   - a landing pública apresenta o produto
 *   - o dashboard autenticado concentra apenas ações e contexto essenciais
 *
 * Regras de produto adotadas nesta fase:
 * - practice:
 *   - quick start com 10 questões
 * - timed_block:
 *   - quick start com 40 questões
 * - exam_sim:
 *   - quick start usando preset curto (40 questões)
 * - configurações mais detalhadas de sessão ficam para uma etapa/rota dedicada futura
 *
 * Observações:
 * - Ainda não criamos páginas dedicadas de Results / Progress / Profile / Settings.
 *   Nesta fase, a home autenticada já funciona como uma entrada limpa do sistema.
 * - Os links para áreas futuras aparecem como elementos visuais de navegação/planejamento,
 *   mas sem depender de rotas ainda inexistentes.
 *
 * ✅ Atualização (2026-03-17):
 * - Home dividida entre landing pública e dashboard autenticado
 * - Login integrado a uma tela mais amigável
 * - Redução de informação simultânea na home
 * - Inclusão de branding, suporte e CTA
 * - Dashboard pós-login mais limpo, com foco em:
 *   - resumo
 *   - continuar sessão
 *   - iniciar estudo
 *   - sessões recentes
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

  /**
   * Busca sessões recentes para montar o dashboard do usuário.
   * Só roda quando o usuário estiver autenticado.
   */
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

  const recentSessions = useMemo(() => sessions.slice(0, 4), [sessions]);

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter((s) => s.status === "submitted").length;
  const inProgressSessions = sessions.filter((s) => s.status === "in_progress").length;
  const mostRecentSubmitted = sessions.find((s) => s.status === "submitted") ?? null;

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
        gap: 20,
      }}
    >
      {!isSignedIn ? (
        <>
          {/* Public landing / hero */}
          <section
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 24,
              padding: 20,
              background:
                "linear-gradient(135deg, #111827 0%, #1d4ed8 45%, #06b6d4 100%)",
              color: "white",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: -50,
                right: -30,
                width: 180,
                height: 180,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: -40,
                left: -20,
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
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
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 16,
                    background: "rgba(255,255,255,0.14)",
                    border: "1px solid rgba(255,255,255,0.22)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                    fontSize: 20,
                    flexShrink: 0,
                  }}
                >
                  H
                </div>

                <div>
                  <div style={{ fontSize: 14, opacity: 0.88 }}>
                    Built by <strong>HelpUS</strong>
                  </div>
                  <h1
                    style={{
                      margin: "4px 0 0 0",
                      fontSize: 30,
                      lineHeight: 1.05,
                      fontWeight: 900,
                    }}
                  >
                    USMLE study,
                    <br />
                    organized like a real platform
                  </h1>
                </div>
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.65,
                  maxWidth: 760,
                  color: "rgba(255,255,255,0.92)",
                }}
              >
                Practice questions, timed blocks, and exam-style simulations in a
                cleaner, more guided experience. Start fast, keep your sessions,
                and grow into a personalized study workflow over time.
              </p>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                }}
              >
                {[
                  {
                    title: "Practice mode",
                    text: "Untimed study with immediate feedback and lower friction.",
                  },
                  {
                    title: "Timed blocks",
                    text: "Train pacing and focus without revealing answers mid-session.",
                  },
                  {
                    title: "Exam simulation",
                    text: "Move toward realistic exam behavior with larger timed flows.",
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    style={{
                      padding: 14,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.10)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <div style={{ fontWeight: 900, fontSize: 15 }}>{item.title}</div>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "rgba(255,255,255,0.88)",
                      }}
                    >
                      {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Sign-in card */}
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Continue with your account</div>
              <p
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  color: "#555",
                  lineHeight: 1.65,
                }}
              >
                Sign in to open your personal study home, resume unfinished sessions,
                and access your recent activity.
              </p>

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

              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  color: "#6b7280",
                  lineHeight: 1.5,
                }}
              >
                Quick sign-in with your Google account. More authentication options can be
                added later without changing the main experience.
              </div>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20 }}>What you’ll get after login</div>

              <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                {[
                  "A cleaner dashboard focused on your next action",
                  "Quick start for Practice, Timed Block, and Exam Simulation",
                  "Recent sessions and session continuity",
                  "A base for future pages: results, progress, profile, and settings",
                ].map((text) => (
                  <div
                    key={text}
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        background: "#eff6ff",
                        color: "#2563eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: 900,
                        flexShrink: 0,
                        marginTop: 1,
                      }}
                    >
                      ✓
                    </div>
                    <div style={{ color: "#555", lineHeight: 1.55 }}>{text}</div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 14,
                  background: "#f9fafb",
                  border: "1px solid #f0f0f0",
                }}
              >
                <div style={{ fontWeight: 800 }}>Need help or want to talk to HelpUS?</div>
                <div
                  style={{
                    marginTop: 6,
                    color: "#555",
                    lineHeight: 1.55,
                    fontSize: 14,
                  }}
                >
                  For support, partnerships, or product questions, contact the HelpUS team.
                </div>
                <a
                  href="mailto:helpus.ecommerce@gmail.com"
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    color: "#1d4ed8",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Contact HelpUS
                </a>
              </div>
            </div>
          </section>

          {/* Public product notes */}
          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Why this flow is changing</div>
            <p
              style={{
                marginTop: 10,
                marginBottom: 0,
                color: "#555",
                lineHeight: 1.7,
              }}
            >
              Instead of putting all controls, history, and setup on a single page, the product
              is moving toward a clearer structure: presentation first, guided login next,
              and a cleaner study dashboard after authentication. This is especially important
              for mobile use.
            </p>
          </section>
        </>
      ) : (
        <>
          {/* Signed-in top welcome */}
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
              <div style={{ minWidth: 0, flex: "1 1 260px" }}>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{userLabel}</div>
                <h1
                  style={{
                    margin: "6px 0 0 0",
                    fontSize: 28,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  Welcome back, {userName}
                </h1>
                <p
                  style={{
                    marginTop: 10,
                    marginBottom: 0,
                    color: "#555",
                    lineHeight: 1.6,
                    maxWidth: 700,
                  }}
                >
                  Your study home is now cleaner: continue where you stopped, start a new
                  session quickly, and keep recent activity visible without crowding the screen.
                </p>
              </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: 240,
                  flex: "0 1 240px",
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

            {/* High-level navigation cards (conceptual entry points) */}
            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              {[
                {
                  title: "Study",
                  subtitle: "Start or resume a session",
                  accent: "#eef6ff",
                },
                {
                  title: "Results",
                  subtitle: "Session history will live here",
                  accent: "#f7f7ff",
                },
                {
                  title: "Progress",
                  subtitle: "Charts and study trends",
                  accent: "#f5fbf5",
                },
                {
                  title: "Settings",
                  subtitle: "Preferences and account options",
                  accent: "#fff8f1",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  style={{
                    padding: 14,
                    borderRadius: 16,
                    border: "1px solid #e5e7eb",
                    background: item.accent,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{item.title}</div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 13,
                      color: "#555",
                      lineHeight: 1.5,
                    }}
                  >
                    {item.subtitle}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Compact dashboard summary */}
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
              {
                label: "Last completed",
                value: mostRecentSubmitted?.started_at
                  ? new Date(mostRecentSubmitted.started_at).toLocaleDateString()
                  : "—",
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: 16,
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  background: "white",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>{card.label}</div>
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 24,
                    fontWeight: 900,
                    lineHeight: 1.15,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </section>

          {/* Continue or start */}
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Continue studying</div>

              {loadingSessions ? (
                <p style={{ marginTop: 12, color: "#555" }}>Loading your sessions…</p>
              ) : activeSession ? (
                <>
                  <p
                    style={{
                      marginTop: 10,
                      marginBottom: 0,
                      color: "#555",
                      lineHeight: 1.65,
                    }}
                  >
                    You have an unfinished <strong>{modeLabel(activeSession.mode)}</strong> session
                    started on <strong>{formatDate(activeSession.started_at)}</strong>.
                  </p>

                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
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
                  </div>
                </>
              ) : (
                <p
                  style={{
                    marginTop: 10,
                    marginBottom: 0,
                    color: "#555",
                    lineHeight: 1.65,
                  }}
                >
                  You do not have an unfinished session right now. Start a new one below.
                </p>
              )}
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20 }}>Start studying</div>
              <div
                style={{
                  marginTop: 10,
                  color: "#555",
                  lineHeight: 1.65,
                }}
              >
                Pick one of the main study modes. Advanced configuration can be moved to a
                dedicated page later.
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <button
                  onClick={() => createAndStartSession("practice")}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "14px 14px",
                    borderRadius: 14,
                    border: "1px solid #d1d5db",
                    background: "#f8fff9",
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Practice</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                    Untimed · immediate review · recommended quick start
                  </div>
                </button>

                <button
                  onClick={() => createAndStartSession("timed_block")}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "14px 14px",
                    borderRadius: 14,
                    border: "1px solid #d1d5db",
                    background: "#fffdf6",
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Timed block</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                    Timed · deferred review · block-oriented training
                  </div>
                </button>

                <button
                  onClick={() => createAndStartSession("exam_sim")}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "14px 14px",
                    borderRadius: 14,
                    border: "1px solid #d1d5db",
                    background: "#fff8f8",
                    cursor: loading ? "not-allowed" : "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 900 }}>Exam simulation</div>
                  <div style={{ marginTop: 6, fontSize: 13, color: "#666", lineHeight: 1.45 }}>
                    Simulation-style flow · deferred review · short preset
                  </div>
                </button>
              </div>
            </div>
          </section>

          {/* Recent sessions */}
          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Recent sessions</div>
            <div
              style={{
                marginTop: 8,
                color: "#555",
                lineHeight: 1.6,
              }}
            >
              A compact view of your most recent study activity.
            </div>

            {loadingSessions ? (
              <p style={{ marginTop: 12, color: "#555" }}>Loading recent sessions…</p>
            ) : recentSessions.length === 0 ? (
              <p style={{ marginTop: 12, color: "#555" }}>No sessions yet. Start your first one above.</p>
            ) : (
              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                {recentSessions.map((s) => (
                  <div
                    key={s.session_id}
                    style={{
                      padding: 14,
                      border: "1px solid #f0f0f0",
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
                          padding: "5px 8px",
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
                            border: "1px solid #d1d5db",
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
                        onClick={() => createAndStartSession(s.mode)}
                        disabled={loading}
                        style={{
                          padding: "12px 12px",
                          borderRadius: 12,
                          border: "1px solid #d1d5db",
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

          {/* Support / next areas */}
          <section
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
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
              <div style={{ fontWeight: 900, fontSize: 20 }}>Need help?</div>
              <p
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  color: "#555",
                  lineHeight: 1.65,
                }}
              >
                HelpUS can be reached for support, product questions, partnerships,
                or feedback about the study experience.
              </p>

              <a
                href="mailto:helpus.ecommerce@gmail.com"
                style={{
                  display: "inline-block",
                  marginTop: 12,
                  color: "#1d4ed8",
                  textDecoration: "none",
                  fontWeight: 800,
                }}
              >
                Contact HelpUS
              </a>
            </div>

            <div
              style={{
                padding: 18,
                borderRadius: 20,
                border: "1px solid #e5e7eb",
                background: "white",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20 }}>What comes next</div>
              <p
                style={{
                  marginTop: 10,
                  marginBottom: 0,
                  color: "#555",
                  lineHeight: 1.65,
                }}
              >
                The next evolution is to break the system into clear areas such as Results,
                Progress, Profile, and Settings, plus a dedicated study setup screen and
                responsive menu navigation for desktop and mobile.
              </p>
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