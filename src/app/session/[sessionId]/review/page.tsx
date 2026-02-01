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
 *   - ✅ TODAS as alternativas com explicação por alternativa (why correct/why wrong)
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

    // ✅ Mantidos do seu backend atualizado
    question_version_id?: string;
    explanation_short?: string | null;
    explanation_long?: string | null;
    bibliography?: any | null; // jsonb
    prompt?: string | null;

    stem: string;
    result: "correct" | "wrong" | "skipped" | null;

    // ✅ IDs (para mapear seleção e correta)
    selected_choice_id?: string | null;
    correct_choice_id?: string | null;

    selected_label: string | null;
    selected_choice_text: string | null;

    correct_label: string | null;
    correct_choice_text: string | null;

    // ✅ choices completas + explicação por alternativa (question_choices.explanation)
    choices?: Array<{
      choice_id: string;
      label: string;
      choice_text: string;
      is_correct: boolean;
      explanation: string | null;
    }>;
  }>;
};

type Status = "neutral" | "correct" | "wrong";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ReviewPage({ params }: { params: { sessionId: string } }) {
  const router = useRouter();
  const sessionId = params.sessionId;

  const [data, setData] = useState<ReviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // UI state
  const [activePos, setActivePos] = useState<number>(1);
  const [fontScale, setFontScale] = useState<number>(1);

  // Persist font scale (optional, MVP-safe)
  useEffect(() => {
    const saved = localStorage.getItem("review_font_scale");
    if (saved) setFontScale(Number(saved) || 1);
  }, []);
  useEffect(() => {
    localStorage.setItem("review_font_scale", String(fontScale));
  }, [fontScale]);

  const itemsSorted = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => a.position - b.position);
  }, [data]);

  const activeItem = useMemo(() => {
    return itemsSorted.find((x) => x.position === activePos) ?? null;
  }, [itemsSorted, activePos]);

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

  function statusFor(item: ReviewResponse["items"][number]): Status {
    if (item.result === "correct") return "correct";
    if (item.result === "wrong") return "wrong";
    return "neutral";
  }

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await apiFetch<ReviewResponse>(`/api/sessions/${sessionId}/review`);
      setData(res);

      // Garantir activePos válido
      const sorted = [...res.items].sort((a, b) => a.position - b.position);
      setActivePos(sorted[0]?.position ?? 1);
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

  const canPrev = activePos > 1;
  const canNext = activePos < (itemsSorted[itemsSorted.length - 1]?.position ?? 1);

  function goPrev() {
    setActivePos((p) => clamp(p - 1, 1, itemsSorted.length || 1));
  }
  function goNext() {
    setActivePos((p) => clamp(p + 1, 1, itemsSorted.length || 1));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0d", color: "#f4f4f5", fontFamily: "system-ui" }}>
      {/* Sticky Header */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(11,11,13,0.92)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "12px 14px", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 750, fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Session Review
            </div>
            <div style={{ color: "rgba(244,244,245,0.65)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Session {sessionId}
              {data?.session?.submitted_at ? ` • Submitted ${new Date(data.session.submitted_at).toLocaleString()}` : ""}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
            <button
              onClick={() => setFontScale((s) => Math.max(0.85, Math.round((s - 0.05) * 100) / 100))}
              style={btnSmall()}
              title="Decrease font"
            >
              A-
            </button>
            <button
              onClick={() => setFontScale((s) => Math.min(1.25, Math.round((s + 0.05) * 100) / 100))}
              style={btnSmall()}
              title="Increase font"
            >
              A+
            </button>

            <button onClick={load} disabled={loading} style={btnSmall()} title="Refresh">
              {loading ? "…" : "⟳"}
            </button>
            <button onClick={() => router.push(`/session/${sessionId}`)} disabled={loading} style={btnSmall()} title="Back to session">
              Back
            </button>
          </div>
        </div>
      </div>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "14px 14px 110px" }}>
        {err && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 14, border: "1px solid rgba(255,255,255,0.10)", background: "rgba(220,38,38,0.10)" }}>
            <div style={{ fontWeight: 700, color: "#fecaca" }}>Error</div>
            <div style={{ marginTop: 6, color: "rgba(244,244,245,0.85)" }}>{err}</div>
          </div>
        )}

        {!data ? (
          <div style={{ marginTop: 16, color: "rgba(244,244,245,0.8)" }}>Loading…</div>
        ) : (
          <>
            {data.session.status !== "submitted" && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ fontWeight: 700 }}>Note</div>
                <div style={{ marginTop: 6, color: "rgba(244,244,245,0.75)", fontSize: 13 }}>
                  This session is currently <strong>{data.session.status}</strong>. Review may be incomplete unless the session is submitted.
                </div>
              </div>
            )}

            {summary && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
                  <div style={{ fontWeight: 800 }}>Summary</div>
                  <div style={{ color: "rgba(244,244,245,0.75)" }}>
                    Answered {summary.answered}/{summary.total}
                  </div>
                  <div style={{ color: "rgba(244,244,245,0.75)" }}>
                    Accuracy {(summary.accuracy * 100).toFixed(1)}%
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <span style={pill()}>correct: {summary.correct}</span>
                  <span style={pill()}>wrong: {summary.wrong}</span>
                  <span style={pill()}>skipped: {summary.skipped}</span>
                  <span style={pill()}>unanswered: {summary.unanswered}</span>
                </div>
              </div>
            )}

            {/* Question navigator */}
            <div style={{ marginTop: 14, display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6 }}>
              {itemsSorted.map((it) => {
                const st = statusFor(it);
                const isActive = it.position === activePos;
                const color = navColor(st);
                return (
                  <button
                    key={it.session_item_id}
                    onClick={() => setActivePos(it.position)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: `1px solid ${color.border}`,
                      background: color.bg,
                      color: color.text,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: isActive ? "0 0 0 2px rgba(244,244,245,0.20)" : "none",
                      flex: "0 0 auto",
                    }}
                    title={`Q${it.position} • ${it.result ?? "unanswered"}`}
                  >
                    {it.position}
                  </button>
                );
              })}
            </div>

            {/* Active card */}
            {activeItem && (
              <div
                style={{
                  marginTop: 10,
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.04)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: 14, borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontWeight: 800 }}>
                    Question {activeItem.position} of {itemsSorted.length}
                  </div>
                  <span style={{ ...pill(), borderColor: navColor(statusFor(activeItem)).border }}>
                    {activeItem.result ?? "unanswered"}
                  </span>
                </div>

                <div style={{ padding: 14 }}>
                  {/* Stem */}
                  <div style={{ fontSize: `${1 * fontScale}rem`, lineHeight: 1.55, color: "#f4f4f5" }}>
                    {activeItem.stem}
                  </div>

                  {/* ✅ FULL CHOICES + EXPLANATION PER CHOICE */}
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {Array.isArray(activeItem.choices) && activeItem.choices.length > 0 ? (
                      activeItem.choices.map((c) => {
                        const isSelected = (activeItem.selected_choice_id ?? null) === c.choice_id;
                        const isCorrect = c.is_correct === true;

                        // Tone:
                        // - correct => green
                        // - selected but wrong => red
                        // - others => neutral
                        const tone: "neutral" | "correct" | "wrong" =
                          isCorrect ? "correct" : isSelected ? "wrong" : "neutral";

                        // Title aligns with user expectation
                        const title =
                          isCorrect && isSelected
                            ? "✅ Your answer (correct)"
                            : isCorrect
                            ? "✅ Correct answer"
                            : isSelected
                            ? "❌ Your answer"
                            : "Choice";

                        // ✅ Agora mostramos explicação para TODAS as alternativas
                        // (resolve seu problema: incorretas também precisam ter review)
                        const showExplain = true;

                        return (
                          <ChoiceCardV2
                            key={c.choice_id}
                            title={title}
                            label={c.label}
                            text={c.choice_text}
                            tone={tone}
                            fontScale={fontScale}
                            explanation={c.explanation}
                            showExplanation={showExplain}
                          />
                        );
                      })
                    ) : (
                      <>
                        {/* Fallback: keep your old 2-card view if API hasn't been updated */}
                        <ChoiceCard
                          title="Your answer"
                          label={activeItem.selected_label}
                          text={activeItem.selected_choice_text}
                          tone={activeItem.result === "wrong" ? "wrong" : activeItem.result === "correct" ? "correct" : "neutral"}
                          fontScale={fontScale}
                        />
                        <ChoiceCard
                          title="Correct answer"
                          label={activeItem.correct_label}
                          text={activeItem.correct_choice_text}
                          tone="correct"
                          fontScale={fontScale}
                        />
                      </>
                    )}
                  </div>

                  {/* Blocks */}
                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    <InfoBlock
                      title="Educational Objective"
                      body={activeItem.explanation_short ? activeItem.explanation_short : "(Coming soon) Structured educational blocks will appear here."}
                      kind="amber"
                      fontScale={fontScale}
                    />
                    <InfoBlock
                      title="Key Concept / Bottom Line"
                      body={activeItem.explanation_long ? activeItem.explanation_long : "(Coming soon) Distilled takeaways will appear here."}
                      kind="green"
                      fontScale={fontScale}
                    />
                    <InfoBlock
                      title="References & Resources"
                      body={
                        activeItem.bibliography || activeItem.prompt
                          ? [
                              activeItem.prompt ? `Prompt: ${activeItem.prompt}` : null,
                              activeItem.bibliography ? `Bibliography: ${JSON.stringify(activeItem.bibliography)}` : null,
                            ]
                              .filter(Boolean)
                              .join("\n\n")
                          : "(Coming soon) Clickable references and external learning resources will appear here."
                      }
                      kind="neutral"
                      fontScale={fontScale}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Sticky footer nav */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(11,11,13,0.92)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto", padding: "12px 14px", display: "flex", gap: 10 }}>
          <button onClick={goPrev} disabled={!canPrev} style={btnWide(!canPrev)}>
            Prev
          </button>
          <button onClick={goNext} disabled={!canNext} style={btnWide(!canNext, true)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------- UI helpers (inline, MVP-safe) ----------------- */

function btnSmall(): React.CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#f4f4f5",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 650,
  };
}

function btnWide(disabled: boolean, primary?: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "12px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: primary ? "rgba(59,130,246,0.18)" : "rgba(255,255,255,0.04)",
    color: "#f4f4f5",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontSize: 14,
    fontWeight: 750,
  };
}

function pill(): React.CSSProperties {
  return {
    padding: "2px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "rgba(244,244,245,0.85)",
    fontSize: 12,
    fontWeight: 650,
  };
}

function navColor(status: "neutral" | "correct" | "wrong") {
  if (status === "correct") {
    return { bg: "rgba(34,197,94,0.15)", border: "rgba(34,197,94,0.35)", text: "rgba(187,247,208,1)" };
  }
  if (status === "wrong") {
    return { bg: "rgba(239,68,68,0.14)", border: "rgba(239,68,68,0.35)", text: "rgba(254,202,202,1)" };
  }
  return { bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)", text: "rgba(244,244,245,0.85)" };
}

function ChoiceCard(props: {
  title: string;
  label: string | null;
  text: string | null;
  tone: "neutral" | "correct" | "wrong";
  fontScale: number;
}) {
  const { title, label, text, tone, fontScale } = props;

  const colors =
    tone === "correct"
      ? { border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.10)", badge: "rgba(34,197,94,0.22)" }
      : tone === "wrong"
      ? { border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.10)", badge: "rgba(239,68,68,0.20)" }
      : { border: "rgba(255,255,255,0.10)", bg: "rgba(255,255,255,0.03)", badge: "rgba(255,255,255,0.06)" };

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bg, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
        <span style={{ ...pill(), background: colors.badge }}>{label ?? "—"}</span>
      </div>
      <div style={{ marginTop: 8, fontSize: `${0.98 * fontScale}rem`, lineHeight: 1.5, color: "rgba(244,244,245,0.92)" }}>
        {text ?? "—"}
      </div>
    </div>
  );
}

/**
 * ✅ V2: Choice card com explicação ("Why correct/Why wrong").
 * Mantém o estilo do seu componente, só adiciona a seção de explanation.
 */
function ChoiceCardV2(props: {
  title: string;
  label: string | null;
  text: string | null;
  tone: "neutral" | "correct" | "wrong";
  fontScale: number;
  explanation: string | null | undefined;
  showExplanation: boolean;
}) {
  const { title, label, text, tone, fontScale, explanation, showExplanation } = props;

  const colors =
    tone === "correct"
      ? { border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.10)", badge: "rgba(34,197,94,0.22)" }
      : tone === "wrong"
      ? { border: "rgba(239,68,68,0.35)", bg: "rgba(239,68,68,0.10)", badge: "rgba(239,68,68,0.20)" }
      : { border: "rgba(255,255,255,0.10)", bg: "rgba(255,255,255,0.03)", badge: "rgba(255,255,255,0.06)" };

  const explainTitle = tone === "correct" ? "Why correct" : "Why wrong";

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bg, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
        <span style={{ ...pill(), background: colors.badge }}>{label ?? "—"}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: `${0.98 * fontScale}rem`, lineHeight: 1.5, color: "rgba(244,244,245,0.92)" }}>
        {text ?? "—"}
      </div>

      {showExplanation && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.10)" }}>
          <div style={{ fontWeight: 850, fontSize: 12, color: "rgba(244,244,245,0.90)" }}>{explainTitle}</div>
          <div style={{ marginTop: 6, fontSize: `${0.94 * fontScale}rem`, lineHeight: 1.5, color: "rgba(244,244,245,0.78)", whiteSpace: "pre-wrap" }}>
            {explanation && String(explanation).trim().length > 0 ? explanation : "(No explanation provided yet.)"}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoBlock(props: { title: string; body: string; kind: "neutral" | "amber" | "green"; fontScale: number }) {
  const { title, body, kind, fontScale } = props;

  const colors =
    kind === "amber"
      ? { border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.10)" }
      : kind === "green"
      ? { border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.10)" }
      : { border: "rgba(255,255,255,0.10)", bg: "rgba(255,255,255,0.03)" };

  return (
    <div style={{ borderRadius: 16, border: `1px solid ${colors.border}`, background: colors.bg, padding: 12 }}>
      <div style={{ fontWeight: 850, fontSize: 13 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: `${0.95 * fontScale}rem`, lineHeight: 1.5, color: "rgba(244,244,245,0.80)", whiteSpace: "pre-wrap" }}>
        {body}
      </div>
    </div>
  );
}
