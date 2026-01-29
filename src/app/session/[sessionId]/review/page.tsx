/**
 * ReviewPage
 *
 * 📍 Localização:
 * src/app/session/[sessionId]/review/page.tsx
 *
 * Tela de review da sessão (MVP).
 *
 * Responsabilidades:
 * - Buscar o review completo da sessão no backend
 * - Exibir, por item:
 *   - stem
 *   - resultado (correct/wrong/skipped/unanswered)
 *   - resposta marcada pelo usuário
 *   - resposta correta
 *
 * Contrato de API utilizado:
 * - GET /api/sessions/:sessionId/review
 *
 * Regras importantes:
 * - Esta tela é somente leitura (não altera estado)
 * - Depende do backend para calcular correctness e retornar a resposta correta
 *
 * Observação:
 * - Este componente é client-side por simplicidade do MVP (fetch + render)
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

type ReviewResponse = {
  session: {
    session_id: string;
    status: string;
    started_at: string;
    submitted_at: string | null;
  };
  items: Array<{
    session_item_id: string;
    position: number;
    stem: string;
    result: "correct" | "wrong" | "skipped" | null;
    selected_label: string | null;
    selected_choice_text: string | null;
    correct_label: string | null;
    correct_choice_text: string | null;
  }>;
};

export default function ReviewPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const sessionId = params.sessionId;

  const [data, setData] = useState<ReviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const itemsSorted = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => a.position - b.position);
  }, [data]);

  const summary = useMemo(() => {
    if (!data) return null;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let unanswered = 0;

    for (const it of data.items) {
      if (it.result === "correct") correct += 1;
      else if (it.result === "wrong") wrong += 1;
      else if (it.result === "skipped") skipped += 1;
      else unanswered += 1;
    }

    const answered = correct + wrong + skipped;
    const accuracy = answered > 0 ? correct / answered : 0;

    return { correct, wrong, skipped, unanswered, answered, total: data.items.length, accuracy };
  }, [data]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<ReviewResponse>(`/api/sessions/${sessionId}/review`);
      setData(res);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load review");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Review</h1>
          <p style={{ color: "#555", marginTop: 6, marginBottom: 0 }}>Session {sessionId}</p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => router.push(`/session/${sessionId}`)}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: loading ? "not-allowed" : "pointer",
              background: "white",
            }}
          >
            Back to Session
          </button>

          <button
            onClick={load}
            disabled={loading}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: loading ? "not-allowed" : "pointer",
              background: "white",
            }}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12 }}>
          <p style={{ color: "crimson", margin: 0 }}>Error: {err}</p>
        </div>
      )}

      {loading || !data ? (
        <p style={{ marginTop: 16 }}>Loading…</p>
      ) : (
        <>
          {data.session.status !== "submitted" && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 14,
                background: "white",
              }}
            >
              <strong>Note</strong>
              <div style={{ marginTop: 6, color: "#555", fontSize: 13 }}>
                This session is currently <strong>{data.session.status}</strong>. If you expected final results,
                make sure the session was submitted.
              </div>
            </div>
          )}

          {summary && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 14,
                background: "white",
              }}
            >
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                <strong>Summary</strong>
                <span style={{ color: "#555" }}>
                  Answered {summary.answered}/{summary.total}
                </span>
                <span style={{ color: "#555" }}>Accuracy {(summary.accuracy * 100).toFixed(1)}%</span>
              </div>

              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 8 }}>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid #ccc",
                    fontSize: 12,
                  }}
                >
                  correct: {summary.correct}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid #ccc",
                    fontSize: 12,
                  }}
                >
                  wrong: {summary.wrong}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid #ccc",
                    fontSize: 12,
                  }}
                >
                  skipped: {summary.skipped}
                </span>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 999,
                    border: "1px solid #ccc",
                    fontSize: 12,
                  }}
                >
                  unanswered: {summary.unanswered}
                </span>
              </div>

              <div style={{ marginTop: 8, color: "#555", fontSize: 13 }}>
                Status: <strong>{data.session.status}</strong>
                {data.session.submitted_at ? (
                  <>
                    {" "}
                    · Submitted at:{" "}
                    <strong>{new Date(data.session.submitted_at).toLocaleString()}</strong>
                  </>
                ) : null}
              </div>
            </div>
          )}

          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            {itemsSorted.map((it) => {
              const badgeText = it.result ?? "unanswered";
              const isCorrect = it.result === "correct";
              const isWrong = it.result === "wrong";

              return (
                <div
                  key={it.session_item_id}
                  style={{
                    border: "1px solid #ddd",
                    borderRadius: 14,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                    <strong>Q {it.position}</strong>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: "1px solid #ccc",
                        fontSize: 12,
                        background: isCorrect ? "#f3f3f3" : isWrong ? "#fff" : "white",
                      }}
                      title={badgeText}
                    >
                      {badgeText}
                    </span>
                  </div>

                  <p style={{ marginTop: 8 }}>{it.stem}</p>

                  <div style={{ marginTop: 10, fontSize: 14 }}>
                    <div>
                      <strong>Your answer:</strong>{" "}
                      {it.selected_label ? `${it.selected_label} — ${it.selected_choice_text}` : "—"}
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <strong>Correct:</strong>{" "}
                      {it.correct_label ? `${it.correct_label} — ${it.correct_choice_text}` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
