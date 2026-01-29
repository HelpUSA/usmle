/**
 * HomePage
 *
 * 📍 Localização:
 * src/app/page.tsx
 *
 * Objetivo (beta/MVP):
 * - Tela inicial amigável (boas-vindas) + orientação de uso
 * - Permitir que um médico comece a usar em < 10 segundos:
 *   1) escolher Exam + Mode
 *   2) criar sessão
 *   3) gerar itens (idempotente)
 *   4) entrar no player
 *
 * Contrato de API utilizado:
 * - POST /api/sessions
 *   Body obrigatório: { exam, mode }
 * - POST /api/sessions/:sessionId/items
 *   Gera itens (idempotente). (Algumas implementações aceitam { count }, mas o MVP não depende disso.)
 *
 * Observações:
 * - Mantemos defaults seguros (step1 + practice).
 * - Mantemos "count" como opcional e sem depender dele (se o backend ignorar, tudo bem).
 * - Em produção, autenticação via NextAuth.
 *   A Home mostra o usuário logado e oferece Sign out.
 *
 * Nota de produto:
 * - Este é o primeiro contato do usuário (médico) com o sistema.
 * - Inclui um bloco “Built by HelpUS” e instruções simples de como começar.
 */

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { signOut, useSession } from "next-auth/react";

type CreateSessionResponse = {
  session_id: string;
  user_id: string;
  mode: "practice" | "timed_block" | "exam_sim";
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: string;
  started_at?: string;
  submitted_at?: string | null;
};

export default function HomePage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [exam, setExam] = useState<"step1">("step1");
  const [mode, setMode] = useState<"practice" | "timed_block" | "exam_sim">("practice");
  const [count, setCount] = useState<number>(10);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canStart = useMemo(() => {
    if (loading) return false;
    if (!exam) return false;
    if (!mode) return false;
    if (!Number.isFinite(count) || count < 1 || count > 200) return false;
    return true;
  }, [loading, exam, mode, count]);

  async function start() {
    if (!canStart) return;

    setLoading(true);
    setErr(null);

    try {
      // Contract: mode + exam required
      const sessionRes = await apiFetch<CreateSessionResponse>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ mode, exam }),
      });

      // Contract: POST is idempotent generator.
      // We'll *optionally* pass {count}. If API ignores it, it's fine.
      await apiFetch<{ items?: any[] }>(`/api/sessions/${sessionRes.session_id}/items`, {
        method: "POST",
        body: JSON.stringify({ count }),
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

  async function handleSignOut() {
    await signOut({ callbackUrl: "/" });
  }

  const isSignedIn = !!session?.user?.email;

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "flex-start",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              aria-hidden
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                border: "1px solid #ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
              }}
              title="HelpUS"
            >
              H
            </div>

            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0 }}>USMLE Practice</h1>
              <div style={{ marginTop: 2, fontSize: 12, color: "#666" }}>
                Built by <strong>HelpUS</strong> · Beta
              </div>
            </div>
          </div>

          <p style={{ marginTop: 10, color: "#555", marginBottom: 0, maxWidth: 680 }}>
            Welcome! This is a lightweight practice tool to run short USMLE-style sessions. Start a session below,
            answer questions, then submit at the end to unlock your review.
          </p>
        </div>

        {/* Auth box */}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#666" }}>{userLabel}</div>
          {isSignedIn ? (
            <button
              onClick={handleSignOut}
              style={{
                marginTop: 8,
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "white",
                cursor: "pointer",
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
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #ccc",
                background: "white",
                color: "inherit",
                textDecoration: "none",
              }}
            >
              Sign in
            </a>
          )}
        </div>
      </div>

      {/* Getting started */}
      <div
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid #ddd",
          borderRadius: 14,
          background: "white",
        }}
      >
        <div style={{ fontWeight: 800 }}>Getting started</div>
        <ol style={{ margin: "8px 0 0 18px", color: "#555", lineHeight: 1.6 }}>
          <li>Select the exam and mode (Practice is recommended).</li>
          <li>Click <strong>Start Session</strong> and answer the questions.</li>
          <li>
            At the end, click <strong>Finish & Review</strong> to submit and see the correct answers.
          </li>
        </ol>
      </div>

      {/* Session form */}
      <div
        style={{
          marginTop: 16,
          padding: 14,
          border: "1px solid #ddd",
          borderRadius: 14,
          display: "grid",
          gap: 12,
          background: "white",
        }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#555" }}>Exam</label>
          <select
            value={exam}
            onChange={(e) => setExam(e.target.value as "step1")}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
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
            onChange={(e) => setMode(e.target.value as any)}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: "white",
            }}
          >
            <option value="practice">Practice</option>
            <option value="timed_block">Timed block</option>
            <option value="exam_sim">Exam simulation</option>
          </select>
          <div style={{ fontSize: 12, color: "#777" }}>Tip: Practice is best for first-time users.</div>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, color: "#555" }}>Question count</label>
          <input
            type="number"
            min={1}
            max={200}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={loading}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
            }}
          />
          <div style={{ fontSize: 12, color: "#777" }}>1–200 (default 10)</div>
        </div>

        <button
          onClick={start}
          disabled={!canStart}
          style={{
            marginTop: 4,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #ccc",
            cursor: !canStart ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {loading ? "Starting..." : "Start Session"}
        </button>

        {err && (
          <p style={{ marginTop: 4, color: "crimson", marginBottom: 0 }}>
            Error: {err}
          </p>
        )}
      </div>

      {/* Footer hint */}
      <div style={{ marginTop: 16, color: "#777", fontSize: 12, lineHeight: 1.5 }}>
        <div>
          Tip: If you close the tab mid-session, you can restart a new session anytime from this page.
        </div>
      </div>
    </main>
  );
}
