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
 * - Nunca revela a resposta correta (antes do submit)
 * - Máximo 1 attempt por session_item (garantido pela API)
 * - O submit da sessão deve ocorrer antes do review
 *
 * Observação:
 * - Este componente é client-side por depender de interação contínua do usuário
 * - Estilo propositalmente simples (sem UI lib) para focar no fluxo funcional
 *
 * ✅ Atualização (2026-01-30):
 * - Após o usuário clicar "Submit", mostramos feedback didático:
 *   - Correct/Incorrect
 *   - explanation_short + explanation_long
 *   - explicação por alternativa (choice.explanation)
 *   - bibliografia (references)
 * - Só avançamos com "Next" depois do submit (2-step flow)
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
    /**
     * prompt é opcional no GET do player:
     * - Pode vir vazio se seu endpoint atual retornar só `stem`.
     * - Se vier preenchido, exibimos abaixo do stem como "question line".
     */
    prompt?: string | null;
  };
  choices: Array<{
    choice_id: string;
    label: string;
    choice_text: string;
  }>;
};

/**
 * O endpoint de attempt (POST) deve retornar um payload com explicações.
 * - Antes do submit, nunca mostramos explicação para evitar "gabarito".
 * - Após submit, usamos este payload para montar a experiência didática.
 */
type BibliographyItem = {
  title?: string;
  source?: string;
  year?: number;
  url?: string;
  note?: string;
};

type AttemptChoice = {
  choice_id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
  explanation?: string | null;
};

type AttemptResponse = {
  // Alguns backends retornam `is_correct`, outros retornam `result`.
  is_correct?: boolean;
  result?: "correct" | "wrong" | "skipped";

  // Explicações por questão (curta e longa)
  explanation_short?: string | null;
  explanation_long?: string | null;

  // Referências (JSONB -> array)
  bibliography?: BibliographyItem[] | null;

  // Alternativas com gabarito + explicação por alternativa
  choices?: AttemptChoice[] | null;
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

  /**
   * ✅ Novo estado para o fluxo de 2 passos:
   * - submitted: usuário já clicou submit nessa questão?
   * - feedback: payload retornado pelo POST attempt com explicações
   */
  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<AttemptResponse | null>(null);

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
          res = await apiFetch<{ items: SessionItem[] }>(`/api/sessions/${sessionId}/items`, {
            method: "POST",
          });
        } catch {
          // fallback defensivo
          res = await apiFetch<{ items: SessionItem[] }>(`/api/sessions/${sessionId}/items`);
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
   *
   * Importante:
   * - Resetamos seleção e feedback ao trocar de questão
   * - Reiniciamos o timer de tempo gasto
   */
  useEffect(() => {
    (async () => {
      if (!current) return;

      setErr(null);
      setSelected(null);
      setQ(null);

      // ✅ Reset do fluxo didático ao trocar de questão
      setSubmitted(false);
      setFeedback(null);

      questionStartedAtRef.current = Date.now();

      try {
        const res = await apiFetch<QuestionResponse>(`/api/session-items/${current.session_item_id}/question`);
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
   * Normaliza "is_correct" a partir de formatos diferentes do backend.
   * - Preferimos is_correct boolean se existir
   * - Caso contrário, usamos result (correct/wrong)
   */
  function normalizeIsCorrect(fb: AttemptResponse | null): boolean | null {
    if (!fb) return null;
    if (typeof fb.is_correct === "boolean") return fb.is_correct;
    if (fb.result === "correct") return true;
    if (fb.result === "wrong") return false;
    return null;
  }

  /**
   * Envia a tentativa OU avança, dependendo do estado:
   *
   * Fluxo de 2 passos:
   * 1) Submit: envia attempt, recebe feedback, NÃO avança
   * 2) Next: avança para próxima questão (ou Review se for a última)
   */
  async function submitOrNext() {
    if (!current) return;

    // Passo 2: se já submeteu, agora é "Next/Review"
    if (submitted) {
      if (idx < items.length - 1) {
        setIdx(idx + 1);
      } else {
        // última questão → garante submit antes do review
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
      return;
    }

    // Passo 1: se ainda não submeteu, precisamos de uma alternativa selecionada
    if (!selected) return;

    setSaving(true);
    setErr(null);

    const startedAt = questionStartedAtRef.current;
    const timeSpentSeconds = startedAt ? Math.max(1, Math.round((Date.now() - startedAt) / 1000)) : 10;

    try {
      /**
       * Esperamos que o backend retorne:
       * - is_correct/result
       * - explanation_short / explanation_long
       * - bibliography
       * - choices[] com is_correct + explanation
       */
      const fb = await apiFetch<AttemptResponse>(
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

      setFeedback(fb ?? null);
      setSubmitted(true);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit answer");
    } finally {
      setSaving(false);
    }
  }

  // ✅ isCorrect serve para pintar o painel de feedback (verde/vermelho)
  const isCorrect = normalizeIsCorrect(feedback);

  /**
   * ✅ Depois do submit, preferimos renderizar choices do FEEDBACK,
   * porque elas incluem:
   * - is_correct
   * - explanation
   *
   * Antes do submit, usamos as choices do GET (sem gabarito).
   */
  const visibleChoices = useMemo(() => {
    if (!q) return [];
    if (!submitted) return q.choices;

    // Se o backend retornou choices no feedback, usamos elas (mais ricas)
    if (feedback?.choices && feedback.choices.length > 0) return feedback.choices;

    // Fallback: se por algum motivo não veio, voltamos ao GET (sem explicações)
    return q.choices;
  }, [q, submitted, feedback?.choices]);

  // Identifica a alternativa correta após submit (se veio no feedback)
  const correctChoiceId = useMemo(() => {
    if (!submitted) return null;
    const fbChoices = feedback?.choices ?? [];
    const correct = fbChoices.find((c) => c.is_correct);
    return correct?.choice_id ?? null;
  }, [submitted, feedback?.choices]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>
          Session {sessionId.slice(0, 8)}… — Q {items.length ? idx + 1 : "?"}/{items.length || "?"}
        </h1>

        <button
          onClick={finish}
          disabled={saving || loadingItems || items.length === 0}
          style={{
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid #ccc",
            cursor: saving || loadingItems || items.length === 0 ? "not-allowed" : "pointer",
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
          {/* ✅ Preserva quebras de linha do stem */}
          <p style={{ fontSize: 16, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{q.question.stem}</p>

          {/* ✅ Prompt (se existir no GET; senão fica invisível) */}
          {q.question.prompt ? (
            <p style={{ marginTop: 12, fontSize: 16, fontWeight: 700, whiteSpace: "pre-wrap" }}>
              {q.question.prompt}
            </p>
          ) : null}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {visibleChoices.map((c: any) => {
              const isSelected = selected === c.choice_id;

              // ✅ Só colorimos e mostramos explicações após submit
              const showAfter = submitted;

              const isCorrectChoice = showAfter && (c.is_correct === true || c.choice_id === correctChoiceId);
              const isWrongSelected = showAfter && isSelected && !isCorrectChoice;

              return (
                <label
                  key={c.choice_id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    cursor: submitted ? "default" : "pointer",
                    background: isCorrectChoice
                      ? "#e9f7ef"
                      : isWrongSelected
                      ? "#fdecea"
                      : isSelected
                      ? "#f3f3f3"
                      : "white",
                  }}
                >
                  <input
                    type="radio"
                    name="choice"
                    checked={isSelected}
                    disabled={submitted} // ✅ trava mudança após submit (evita confusão)
                    onChange={() => setSelected(c.choice_id)}
                  />

                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>
                        {c.label}
                        {showAfter && isCorrectChoice ? " ✅" : null}
                        {showAfter && isWrongSelected ? " ❌" : null}
                      </div>

                      {showAfter ? (
                        <div style={{ fontSize: 12, opacity: 0.8 }}>{isCorrectChoice ? "Correct" : "Incorrect"}</div>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 2 }}>{c.choice_text}</div>

                    {/* ✅ Explicação por alternativa (o que você pediu) */}
                    {showAfter && c.explanation ? (
                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.95, whiteSpace: "pre-wrap" }}>
                        {c.explanation}
                      </div>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          {/* ✅ Painel de feedback didático após submit */}
          {submitted ? (
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #ddd",
                background: isCorrect === true ? "#e9f7ef" : isCorrect === false ? "#fdecea" : "#f7f7f7",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 6 }}>
                {isCorrect === true ? "✅ Correct" : isCorrect === false ? "❌ Incorrect" : "Submitted"}
              </div>

              {/* ✅ Explicação curta: ideal para “alerta” rápido no submit */}
              {feedback?.explanation_short ? (
                <div style={{ marginTop: 6, fontSize: 14, whiteSpace: "pre-wrap" }}>{feedback.explanation_short}</div>
              ) : null}

              {/* ✅ Explicação longa: inclui “why correct / why wrong” em alto nível */}
              {feedback?.explanation_long ? (
                <div style={{ marginTop: 10, fontSize: 14, whiteSpace: "pre-wrap" }}>{feedback.explanation_long}</div>
              ) : null}

              {/* ✅ Referências bibliográficas abertas */}
              {Array.isArray(feedback?.bibliography) && feedback!.bibliography!.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>References</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {feedback!.bibliography!.map((b, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 13 }}>
                          <span style={{ fontWeight: 700 }}>{b.title ?? "Reference"}</span>
                          {b.source ? ` — ${b.source}` : ""}
                          {typeof b.year === "number" ? ` (${b.year})` : ""}
                        </div>

                        {b.url ? (
                          <div style={{ fontSize: 13 }}>
                            <a href={b.url} target="_blank" rel="noreferrer">
                              {b.url}
                            </a>
                          </div>
                        ) : null}

                        {b.note ? (
                          <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "pre-wrap" }}>{b.note}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* ✅ Botão principal com 2-step flow */}
          <button
            onClick={submitOrNext}
            disabled={(!selected && !submitted) || saving}
            style={{
              marginTop: 14,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #ccc",
              cursor: (!selected && !submitted) || saving ? "not-allowed" : "pointer",
            }}
          >
            {saving
              ? "Saving…"
              : submitted
              ? idx < items.length - 1
                ? "Next"
                : "Go to Review"
              : "Submit"}
          </button>
        </div>
      )}
    </main>
  );
}
