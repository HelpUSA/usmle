/**
 * SessionPage
 *
 * 📍 Localização:
 * src/app/session/[sessionId]/page.tsx
 *
 * Tela principal do player de sessão.
 *
 * Responsabilidades:
 * - Garantir que os itens da sessão existam (gera de forma idempotente)
 * - Exibir uma questão por vez
 * - Registrar tentativa por session_item
 * - Controlar navegação entre questões
 * - Respeitar o modo da sessão (practice vs timed modes)
 * - Submeter a sessão ao final e redirecionar conforme preferências do usuário
 *
 * Contrato de API utilizado:
 * - GET    /api/sessions
 *   Usado para obter os metadados da sessão atual (mode, timed, time_limit_seconds, started_at)
 * - POST   /api/sessions/:sessionId/items
 *   Gera itens da sessão (idempotente)
 * - GET    /api/session-items/:sessionItemId/question
 *   Carrega a questão atual sem revelar o gabarito
 * - POST   /api/sessions/:sessionId/items/:sessionItemId/attempt
 *   Registra a tentativa e, no modo practice, devolve payload didático para feedback imediato
 * - POST   /api/sessions/:sessionId/submit
 *   Finaliza a sessão antes do review
 *
 * Regras importantes:
 * - Nunca revela a resposta correta antes do submit da questão
 * - O modo da sessão é autoritativo:
 *   - practice: feedback imediato após submit
 *   - timed_block / exam_sim: sem feedback imediato; revisão apenas ao final
 * - O submit da sessão deve ocorrer antes do review
 *
 * Preferências vindas de Settings:
 * - confirmBeforeLeavingSession:
 *   - avisa antes de fechar/sair com sessão ativa
 * - emphasizeTimer:
 *   - aumenta o destaque visual do timer em sessões cronometradas
 * - autoOpenReviewAfterSubmit:
 *   - true  -> vai direto para /session/[sessionId]/review
 *   - false -> vai para /results
 *
 * Observações:
 * - Este componente é client-side por depender de interação contínua do usuário
 * - Estilo propositalmente simples (sem UI lib) para focar no fluxo funcional
 *
 * ✅ Atualização (2026-01-30):
 * - Fluxo de 2 passos para practice:
 *   - Submit → mostra feedback
 *   - Next → avança
 *
 * ✅ Atualização (2026-03-17):
 * - Leitura dos metadados reais da sessão
 * - Diferenciação visível entre practice, timed_block e exam_sim
 * - Timer regressivo para modos cronometrados
 * - Timed modes com review diferido (sem feedback imediato por questão)
 * - Expiração automática do tempo com submit + redirecionamento
 * - Integração com Settings via localStorage
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

type SessionSummary = {
  session_id: string;
  user_id: string;
  mode: "practice" | "timed_block" | "exam_sim";
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: string;
  settings_json?: {
    review_strategy?: "immediate" | "deferred";
    timer_visible?: boolean;
    mode_semantics?: string;
  } | null;
  started_at?: string;
  submitted_at?: string | null;
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
    prompt?: string | null;
  };
  choices: Array<{
    choice_id: string;
    label: string;
    choice_text: string;
  }>;
};

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
  is_correct?: boolean;
  result?: "correct" | "wrong" | "skipped";
  explanation_short?: string | null;
  explanation_long?: string | null;
  bibliography?: BibliographyItem[] | null;
  choices?: AttemptChoice[] | null;
};

type UserSettings = {
  defaultExam: "step1";
  defaultMode: "practice" | "timed_block" | "exam_sim";
  practiceQuestionCount: number;
  autoOpenReviewAfterSubmit: boolean;
  confirmBeforeLeavingSession: boolean;
  emphasizeTimer: boolean;
};

const SETTINGS_STORAGE_KEY = "usmle_user_settings_v1";

const defaultSettings: UserSettings = {
  defaultExam: "step1",
  defaultMode: "practice",
  practiceQuestionCount: 10,
  autoOpenReviewAfterSubmit: true,
  confirmBeforeLeavingSession: true,
  emphasizeTimer: true,
};

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      defaultExam: "step1",
      defaultMode:
        parsed.defaultMode === "practice" ||
        parsed.defaultMode === "timed_block" ||
        parsed.defaultMode === "exam_sim"
          ? parsed.defaultMode
          : defaultSettings.defaultMode,
      practiceQuestionCount:
        typeof parsed.practiceQuestionCount === "number" &&
        parsed.practiceQuestionCount >= 1 &&
        parsed.practiceQuestionCount <= 200
          ? parsed.practiceQuestionCount
          : defaultSettings.practiceQuestionCount,
      autoOpenReviewAfterSubmit:
        typeof parsed.autoOpenReviewAfterSubmit === "boolean"
          ? parsed.autoOpenReviewAfterSubmit
          : defaultSettings.autoOpenReviewAfterSubmit,
      confirmBeforeLeavingSession:
        typeof parsed.confirmBeforeLeavingSession === "boolean"
          ? parsed.confirmBeforeLeavingSession
          : defaultSettings.confirmBeforeLeavingSession,
      emphasizeTimer:
        typeof parsed.emphasizeTimer === "boolean"
          ? parsed.emphasizeTimer
          : defaultSettings.emphasizeTimer,
    };
  } catch {
    return defaultSettings;
  }
}

function formatRemainingTime(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

export default function SessionPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const sessionId = params.sessionId;

  const [sessionMeta, setSessionMeta] = useState<SessionSummary | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultSettings);

  const [items, setItems] = useState<SessionItem[]>([]);
  const [idx, setIdx] = useState(0);

  const [q, setQ] = useState<QuestionResponse | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [loadingSessionMeta, setLoadingSessionMeta] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [submitted, setSubmitted] = useState(false);
  const [feedback, setFeedback] = useState<AttemptResponse | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [autoSubmitting, setAutoSubmitting] = useState(false);

  const autoSubmitTriggeredRef = useRef(false);
  const questionStartedAtRef = useRef<number | null>(null);

  const current = useMemo(() => items[idx], [items, idx]);

  const isTimedMode = Boolean(sessionMeta?.timed);
  const reviewStrategy =
    sessionMeta?.settings_json?.review_strategy ??
    (isTimedMode ? "deferred" : "immediate");
  const showImmediateFeedback = reviewStrategy === "immediate";

  useEffect(() => {
    setUserSettings(loadSettings());

    function syncSettings() {
      setUserSettings(loadSettings());
    }

    window.addEventListener("focus", syncSettings);
    window.addEventListener("storage", syncSettings);

    return () => {
      window.removeEventListener("focus", syncSettings);
      window.removeEventListener("storage", syncSettings);
    };
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingSessionMeta(true);
      setErr(null);

      try {
        const res = await apiFetch<{ sessions: SessionSummary[] }>("/api/sessions");
        const found = (res.sessions ?? []).find((s) => s.session_id === sessionId) ?? null;

        if (!found) {
          setErr("Session metadata not found");
          return;
        }

        setSessionMeta(found);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load session metadata");
      } finally {
        setLoadingSessionMeta(false);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    if (!userSettings.confirmBeforeLeavingSession) return;
    if (!sessionMeta) return;
    if (sessionMeta.status !== "in_progress") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [userSettings.confirmBeforeLeavingSession, sessionMeta]);

  useEffect(() => {
    if (!sessionMeta?.timed) {
      setRemainingSeconds(null);
      return;
    }

    if (!sessionMeta.started_at || !sessionMeta.time_limit_seconds) {
      setRemainingSeconds(null);
      return;
    }

    const startedAtMs = new Date(sessionMeta.started_at).getTime();
    const deadlineMs = startedAtMs + sessionMeta.time_limit_seconds * 1000;

    function tick() {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));
      setRemainingSeconds(remaining);

      if (remaining <= 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        void submitSessionAndRedirect(true);
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionMeta]);

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
          res = await apiFetch<{ items: SessionItem[] }>(`/api/sessions/${sessionId}/items`);
        }

        setItems(res.items ?? []);
        setIdx(0);
      } catch (e: any) {
        setErr(e?.message ?? "Failed to load session items");
      } finally {
        setLoadingItems(false);
      }
    })();
  }, [sessionId]);

  useEffect(() => {
    (async () => {
      if (!current) return;

      setErr(null);
      setSelected(null);
      setQ(null);
      setSubmitted(false);
      setFeedback(null);

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

  function getPostSubmitDestination() {
    return userSettings.autoOpenReviewAfterSubmit
      ? `/session/${sessionId}/review`
      : `/results`;
  }

  async function submitSessionAndRedirect(fromTimer = false) {
    if (saving || autoSubmitting) return;

    if (fromTimer) {
      setAutoSubmitting(true);
    } else {
      setSaving(true);
    }

    setErr(null);

    try {
      await apiFetch(`/api/sessions/${sessionId}/submit`, { method: "POST" });
      router.push(getPostSubmitDestination());
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit session");
      autoSubmitTriggeredRef.current = false;
    } finally {
      if (fromTimer) {
        setAutoSubmitting(false);
      } else {
        setSaving(false);
      }
    }
  }

  async function finish() {
    await submitSessionAndRedirect(false);
  }

  function normalizeIsCorrect(fb: AttemptResponse | null): boolean | null {
    if (!fb) return null;
    if (typeof fb.is_correct === "boolean") return fb.is_correct;
    if (fb.result === "correct") return true;
    if (fb.result === "wrong") return false;
    return null;
  }

  async function submitOrNext() {
    if (!current) return;

    if (showImmediateFeedback && submitted) {
      if (idx < items.length - 1) {
        setIdx(idx + 1);
      } else {
        await submitSessionAndRedirect(false);
      }
      return;
    }

    if (!selected) return;

    setSaving(true);
    setErr(null);

    const startedAt = questionStartedAtRef.current;
    const timeSpentSeconds = startedAt
      ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
      : 10;

    try {
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

      if (showImmediateFeedback) {
        setFeedback(fb ?? null);
        setSubmitted(true);
      } else {
        if (idx < items.length - 1) {
          setIdx(idx + 1);
        } else {
          await submitSessionAndRedirect(false);
        }
      }
    } catch (e: any) {
      setErr(e?.message ?? "Failed to submit answer");
    } finally {
      setSaving(false);
    }
  }

  const isCorrect = normalizeIsCorrect(feedback);

  const visibleChoices = useMemo(() => {
    if (!q) return [];
    if (!showImmediateFeedback) return q.choices;
    if (!submitted) return q.choices;
    if (feedback?.choices && feedback.choices.length > 0) return feedback.choices;
    return q.choices;
  }, [q, showImmediateFeedback, submitted, feedback?.choices]);

  const correctChoiceId = useMemo(() => {
    if (!showImmediateFeedback || !submitted) return null;
    const fbChoices = feedback?.choices ?? [];
    const correct = fbChoices.find((c) => c.is_correct);
    return correct?.choice_id ?? null;
  }, [showImmediateFeedback, submitted, feedback?.choices]);

  const modeLabel = useMemo(() => {
    switch (sessionMeta?.mode) {
      case "practice":
        return "Practice";
      case "timed_block":
        return "Timed block";
      case "exam_sim":
        return "Exam simulation";
      default:
        return "Session";
    }
  }, [sessionMeta?.mode]);

  const timerStyle: React.CSSProperties =
    isTimedMode && userSettings.emphasizeTimer
      ? {
          width: "100%",
          maxWidth: 260,
          padding: "14px 16px",
          borderRadius: 16,
          border: "2px solid #e7c77a",
          background:
            remainingSeconds !== null && remainingSeconds <= 300 ? "#fdecea" : "#fff8e1",
          fontWeight: 900,
          fontSize: 18,
          textAlign: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }
      : {
          width: "100%",
          maxWidth: 240,
          padding: "10px 12px",
          borderRadius: 12,
          border: "1px solid #e7c77a",
          background:
            remainingSeconds !== null && remainingSeconds <= 300 ? "#fdecea" : "#fff8e1",
          fontWeight: 800,
          textAlign: "center",
        };

  return (
    <main
      style={{
        padding: "16px 14px",
        fontFamily: "system-ui",
        maxWidth: 980,
        margin: "0 auto",
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
        <div style={{ flex: "1 1 320px" }}>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Session {sessionId.slice(0, 8)}… — Q {items.length ? idx + 1 : "?"}/{items.length || "?"}
          </h1>

          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "#fafafa",
              }}
            >
              Mode: {loadingSessionMeta ? "Loading…" : modeLabel}
            </span>

            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: isTimedMode ? "#fff7e6" : "#eef7ff",
              }}
            >
              {isTimedMode ? "Timed" : "Untimed"}
            </span>

            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: showImmediateFeedback ? "#eefaf0" : "#fff4f4",
              }}
            >
              Review: {showImmediateFeedback ? "Immediate" : "Deferred"}
            </span>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 8,
            justifyItems: "end",
            flex: "0 1 260px",
            width: "100%",
          }}
        >
          {isTimedMode && remainingSeconds !== null ? (
            <div style={timerStyle}>
              Time left: {formatRemainingTime(remainingSeconds)}
            </div>
          ) : null}

          <button
            onClick={finish}
            disabled={saving || autoSubmitting || loadingItems || items.length === 0}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ccc",
              cursor:
                saving || autoSubmitting || loadingItems || items.length === 0
                  ? "not-allowed"
                  : "pointer",
              width: "100%",
              maxWidth: 240,
              flex: "0 1 240px",
            }}
          >
            {autoSubmitting ? "Submitting…" : isTimedMode ? "End Session & Review" : "Finish & Review"}
          </button>
        </div>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 12 }}>Error: {err}</p>}

      {loadingItems || loadingSessionMeta ? (
        <p style={{ marginTop: 16 }}>
          {loadingSessionMeta ? "Loading session…" : "Loading session items…"}
        </p>
      ) : !current ? (
        <p style={{ marginTop: 16 }}>No session items found.</p>
      ) : !q ? (
        <p style={{ marginTop: 16 }}>Loading question…</p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
              margin: 0,
            }}
          >
            {q.question.stem}
          </p>

          {q.question.prompt ? (
            <p
              style={{
                marginTop: 12,
                fontSize: 16,
                fontWeight: 800,
                whiteSpace: "pre-wrap",
              }}
            >
              {q.question.prompt}
            </p>
          ) : null}

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {visibleChoices.map((c: any) => {
              const isSelected = selected === c.choice_id;

              const showAfter = showImmediateFeedback && submitted;
              const isCorrectChoice =
                showAfter && (c.is_correct === true || c.choice_id === correctChoiceId);
              const isWrongSelected = showAfter && isSelected && !isCorrectChoice;

              return (
                <label
                  key={c.choice_id}
                  style={{
                    display: "flex",
                    gap: 10,
                    padding: 14,
                    borderRadius: 14,
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
                    disabled={submitted}
                    onChange={() => setSelected(c.choice_id)}
                    style={{
                      marginTop: 2,
                      transform: "scale(1.1)",
                    }}
                  />

                  <div style={{ width: "100%", minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ fontWeight: 800 }}>
                        {c.label}
                        {showAfter && isCorrectChoice ? " ✅" : null}
                        {showAfter && isWrongSelected ? " ❌" : null}
                      </div>

                      {showAfter ? (
                        <div style={{ fontSize: 12, opacity: 0.8, whiteSpace: "nowrap" }}>
                          {isCorrectChoice ? "Correct" : "Incorrect"}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 4, lineHeight: 1.45 }}>{c.choice_text}</div>

                    {showAfter && c.explanation ? (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 13,
                          opacity: 0.95,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.45,
                        }}
                      >
                        {c.explanation}
                      </div>
                    ) : null}
                  </div>
                </label>
              );
            })}
          </div>

          {showImmediateFeedback && submitted ? (
            <div
              style={{
                marginTop: 14,
                padding: 14,
                borderRadius: 14,
                border: "1px solid #ddd",
                background:
                  isCorrect === true ? "#e9f7ef" : isCorrect === false ? "#fdecea" : "#f7f7f7",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                {isCorrect === true ? "✅ Correct" : isCorrect === false ? "❌ Incorrect" : "Submitted"}
              </div>

              {feedback?.explanation_short ? (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {feedback.explanation_short}
                </div>
              ) : null}

              {feedback?.explanation_long ? (
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.5,
                  }}
                >
                  {feedback.explanation_long}
                </div>
              ) : null}

              {Array.isArray(feedback?.bibliography) && feedback.bibliography.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>References</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {feedback.bibliography.map((b, i) => (
                      <li key={i} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 800 }}>{b.title ?? "Reference"}</span>
                          {b.source ? ` — ${b.source}` : ""}
                          {typeof b.year === "number" ? ` (${b.year})` : ""}
                        </div>

                        {b.url ? (
                          <div style={{ fontSize: 13, marginTop: 4, wordBreak: "break-word" }}>
                            <a href={b.url} target="_blank" rel="noreferrer">
                              {b.url}
                            </a>
                          </div>
                        ) : null}

                        {b.note ? (
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.85,
                              marginTop: 4,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {b.note}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <button
            onClick={submitOrNext}
            disabled={(!selected && !(showImmediateFeedback && submitted)) || saving || autoSubmitting}
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ccc",
              cursor:
                (!selected && !(showImmediateFeedback && submitted)) || saving || autoSubmitting
                  ? "not-allowed"
                  : "pointer",
              width: "100%",
              maxWidth: 340,
            }}
          >
            {saving || autoSubmitting
              ? "Saving…"
              : showImmediateFeedback && submitted
              ? idx < items.length - 1
                ? "Next"
                : userSettings.autoOpenReviewAfterSubmit
                ? "Go to Review"
                : "Finish Session"
              : idx < items.length - 1
              ? "Submit"
              : isTimedMode
              ? "Submit & Finish"
              : "Submit"}
          </button>
        </div>
      )}
    </main>
  );
}