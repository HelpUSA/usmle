/**
 * SessionPage
 *
 * 📍 Localização:
 * src/app/session/[sessionId]/page.tsx
 *
 * Tela principal do player de sessão (MVP).
 *
 * Responsabilidades:
 * - Garantir que os itens da sessão existam (gera de forma idempotente)
 * - Exibir uma questão por vez
 * - Registrar exatamente 1 tentativa por session_item
 * - Controlar navegação entre questões
 * - Submeter a sessão ao final e redirecionar para o review
 *
 * Contrato de API utilizado:
 * - POST   /api/sessions/:sessionId/items          (gera itens – idempotente)
 * - GET    /api/session-items/:sessionItemId/question
 * - POST   /api/sessions/:sessionId/items/:sessionItemId/attempt
 * - POST   /api/sessions/:sessionId/submit
 *
 * Regras importantes:
 * - Nunca revela a resposta correta
 * - Máximo 1 attempt por session_item (garantido pela API)
 * - O submit da sessão deve ocorrer antes do review
 *
 * Observação:
 * - Este componente é client-side por depender de interação contínua do usuário
 * - Estilo propositalmente simples (sem UI lib) para focar no fluxo funcional
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

type SessionItem = {
  session_item_id: string;
  session_id: string;
  position: number;
  question_version_id: string;
  presented_at: string;
};

type QuestionResponse = {
  session_item: {
    session_item_id: string;
    session_id: string;
    position: number;
    question_version_id: string;
  };
  question: {
    stem: string;
  };
  choices: Array<{
    choice_id: string;
    label: string;
    choice_text: string;
  }>;
};

export default function SessionPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const sessionId = params.sessionId;

  const [items, setItems] = useState<SessionItem[]>([]);
  const [idx, setIdx] = useState(0);

  const [q, setQ] = useState<QuestionResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Timestamp de início da questão atual (para cálculo de time_spent_seconds)
  const questionStartedAtRef = useRef<number | null>(null);

  const current = useMemo(() => items[idx], [items, idx]);

  /**
   * Garante que os itens da sessão existam.
   * Usa POST (idempotente) como contrato principal.
   * Mantém fallback para GET caso a implementação atual ainda aceite apenas GET.
   */
  useEffect(() => {
    (async () => {
      setLoadingItems(true);
      setErr(null);

      try {
        let res: { items: SessionItem[] };

        try {
          res = await apiFetch<{ items: SessionItem[] }>(
            `/api/sessions/${sessionId}/items`,
            { method: "POST" }
          );
        } catch {
          // fallback defensivo
          res = await apiFetch<{ items: SessionItem[] }>(
            `/api/sessions/${sessionId}/items`
          );
        }

        setItems(res.items);
        setIdx(0);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load session items");
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [sessionId]);

  /**
   * Carrega a questão correspondente ao item atual
   */
  useEffect(() => {
    (async () => {
      if (!current) return;

      setErr(null);
      setSelected(null);
      setQ(null);
      questionStartedAtRef.current = Date.now();

      try {
        const res = await apiFetch<QuestionResponse>(
          `/api/session-items/${current.session_item_id}/question`
        );
        setQ(res);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load question");
      }
    })();
  }, [current?.session_item_id]);

  /**
   * Submete a sessão manualmente (botão Finish & Review)
   */
  async function finish() {
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(`/api/sessions/${sessionId}/submit`, { method: "POST" });
      router.push(`/session/${sessionId}/review`);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit session");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Envia a tentativa da questão atual e avança o fluxo
   */
  async function submitAnswer() {
    if (!current || !selected) return;

    setSaving(true);
    setErr(null);

    const startedAt = questionStartedAtRef.current;
    const timeSpentSeconds =
      startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 10;

    try {
      await apiFetch(
        `/api/sessions/${sessionId}/items/${current.session_item_id}/attempt`,
        {
          method: "POST",
          body: JSON.stringify({
            selected_choice_id: selected,
            time_spent_seconds: timeSpentSeconds,
            confidence: 3,
          }),
        }
      );

      if (idx < items.length - 1) {
        setIdx(idx + 1);
      } else {
        // última questão → garante submit antes do review
        await apiFetch(`/api/sessions/${sessionId}/submit`, { method: "POST" });
        router.push(`/session/${sessionId}/review`);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit answer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          Session {sessionId.slice(0, 8)}… — Q{" "}
          {items.length ? idx + 1 : "?"}/{items.length || "?"}
        </h1>

        <button
          onClick={finish}
          disabled={saving || loadingItems || items.length === 0}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor:
              saving || loadingItems || items.length === 0
                ? "not-allowed"
                : "pointer",
          }}
        >
          Finish & Review
        </button>
      </div>

      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}

      {loadingItems ? (
        <p style={{ marginTop: 16 }}>Loading session items…</p>
      ) : !current ? (
        <p style={{ marginTop: 16 }}>No session items found.</p>
      ) : !q ? (
        <p style={{ marginTop: 16 }}>Loading question…</p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 16, lineHeight: 1.5 }}>{q.question.stem}</p>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {q.choices.map((c) => (
              <label
                key={c.choice_id}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #ddd",
                  cursor: "pointer",
                  background:
                    selected === c.choice_id ? "#f3f3f3" : "white",
                }}
              >
                <input
                  type="radio"
                  name="choice"
                  checked={selected === c.choice_id}
                  onChange={() => setSelected(c.choice_id)}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{c.label}</div>
                  <div>{c.choice_text}</div>
                </div>
              </label>
            ))}
          </div>

          <button
            onClick={submitAnswer}
            disabled={!selected || saving}
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: !selected || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Saving…"
              : idx < items.length - 1
              ? "Submit & Next"
              : "Submit & Review"}
          </button>
        </div>
      )}
    </main>
  );
}
