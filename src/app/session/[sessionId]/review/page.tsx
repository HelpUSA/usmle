/*
 * File: src/app/session/[sessionId]/review/page.tsx
 *
 * Responsibility:
 * - Render the read-only review screen for a completed or in-progress study session.
 * - Fetch the full session review payload from the backend.
 * - Display each reviewed item with:
 *   - question stem;
 *   - correctness status;
 *   - selected answer;
 *   - correct answer;
 *   - all choices when provided by the API;
 *   - per-choice explanations when available.
 *
 * API contract used:
 * - GET /api/sessions/:sessionId/review
 *
 * Important behavior:
 * - This page does not mutate backend state.
 * - Correctness and answer mapping are computed by the backend.
 * - The page route is singular: /session/[sessionId]/review.
 * - The Back button navigates to /results instead of reopening the submitted player.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

type ReviewChoice = {
  choice_id: string;
  label: string;
  choice_text: string;
  is_correct: boolean;
  explanation: string | null;
};

type MedicalArea = {
  slug: string;
  name: string;
  is_primary: boolean;
};

type ReviewItem = {
  session_item_id: string;
  position: number;
  block_index?: number | null;
  position_in_block?: number | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  flagged_for_review?: boolean;
  attempt_flagged_for_review?: boolean;
  item_flagged_for_review?: boolean;
  time_spent_seconds?: number | null;
  confidence?: number | null;
  answered_at?: string | null;

  question_version_id?: string;
  explanation_short?: string | null;
  explanation_long?: string | null;
  bibliography?: JsonValue | null;
  prompt?: string | null;
  areas?: MedicalArea[];

  stem: string;
  result: "correct" | "wrong" | "skipped" | null;

  selected_choice_id?: string | null;
  correct_choice_id?: string | null;

  selected_label: string | null;
  selected_choice_text: string | null;

  correct_label: string | null;
  correct_choice_text: string | null;

  choices?: ReviewChoice[];
};

type ReviewResponse = {
  session: {
    session_id: string;
    status: string;
    started_at: string;
    submitted_at: string | null;
  };
  items: ReviewItem[];
};

type Status = "neutral" | "correct" | "wrong";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

function formatReferenceBlock(item: ReviewItem): string {
  const parts: string[] = [];

  if (item.prompt && item.prompt.trim().length > 0) {
    parts.push(`Prompt: ${item.prompt}`);
  }

  if (item.bibliography !== undefined && item.bibliography !== null) {
    parts.push(`Bibliography: ${JSON.stringify(item.bibliography, null, 2)}`);
  }

  if (parts.length === 0) {
    return "(Coming soon) Clickable references and external learning resources will appear here.";
  }

  return parts.join("\n\n");
}

function isReviewItemFlagged(item: ReviewItem): boolean {
  return Boolean(
    item.flagged_for_review ||
      item.item_flagged_for_review ||
      item.attempt_flagged_for_review
  );
}

function formatDateTime(value?: string | null): string | null {
  if (!value) return null;

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toLocaleString();
}

function formatDurationSeconds(seconds?: number | null): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds < 0) {
    return null;
  }

  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);

  return `${minutes}m ${String(remainder).padStart(2, "0")}s`;
}

function getQuestionLocationLabel(item: ReviewItem): string {
  if (
    typeof item.block_index === "number" &&
    item.block_index > 0 &&
    typeof item.position_in_block === "number" &&
    item.position_in_block > 0
  ) {
    return `Block ${item.block_index} - Q${item.position_in_block}`;
  }

  return `Q${item.position}`;
}

export default function ReviewPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const sessionId = params.sessionId;

  const [data, setData] = useState<ReviewResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [completionState, setCompletionState] = useState<
    "idle" | "saving" | "done" | "error"
  >("idle");
  const [completionErr, setCompletionErr] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);

  const [activePos, setActivePos] = useState<number>(1);
  const [fontScale, setFontScale] = useState<number>(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("review_font_scale");
      if (!saved) return;

      const parsed = Number(saved);
      if (Number.isFinite(parsed)) {
        setFontScale(clamp(parsed, 0.85, 1.25));
      }
    } catch {
      // Ignore localStorage failures. Font scale persistence is optional.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("review_font_scale", String(fontScale));
    } catch {
      // Ignore localStorage failures. Font scale persistence is optional.
    }
  }, [fontScale]);

  const itemsSorted = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => a.position - b.position);
  }, [data]);

  const activeIndex = useMemo(() => {
    return itemsSorted.findIndex((x) => x.position === activePos);
  }, [itemsSorted, activePos]);

  const activeItem = activeIndex >= 0 ? itemsSorted[activeIndex] : null;

  const summary = useMemo(() => {
    if (!data) return null;

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let unanswered = 0;
    let flagged = 0;
    const blockIndexes = new Set<number>();

    for (const item of data.items) {
      if (typeof item.block_index === "number" && item.block_index > 0) {
        blockIndexes.add(item.block_index);
      }

      if (isReviewItemFlagged(item)) {
        flagged += 1;
      }

      if (item.result === "correct") correct += 1;
      else if (item.result === "wrong") wrong += 1;
      else if (item.result === "skipped") skipped += 1;
      else unanswered += 1;
    }

    const answered = correct + wrong + skipped;
    const accuracy = answered > 0 ? correct / answered : 0;

    return {
      correct,
      wrong,
      skipped,
      unanswered,
      answered,
      total: data.items.length,
      accuracy,
      flagged,
      blocks: blockIndexes.size || (data.items.length > 0 ? 1 : 0),
    };
  }, [data]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    setCompletionState("idle");
    setCompletionErr(null);

    try {
      const res = await apiFetch<ReviewResponse>(
        `/api/sessions/${sessionId}/review`
      );

      setData(res);

      const sorted = [...res.items].sort((a, b) => a.position - b.position);
      setActivePos(sorted[0]?.position ?? 1);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load review"));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canPrev = activeIndex > 0;
  const canNext = activeIndex >= 0 && activeIndex < itemsSorted.length - 1;

  function goPrev() {
    if (!canPrev) return;
    const previous = itemsSorted[activeIndex - 1];
    if (previous) setActivePos(previous.position);
  }

  function goNext() {
    if (!canNext) return;
    const next = itemsSorted[activeIndex + 1];
    if (next) setActivePos(next.position);
  }

  function goBackToResults() {
    router.push("/results");
  }

  async function markReviewComplete() {
    if (!data || completionState === "saving" || completionState === "done") {
      return;
    }

    setCompletionState("saving");
    setCompletionErr(null);

    try {
      await apiFetch<{ ok: boolean; event_type: "review_completed" }>(
        `/api/sessions/${sessionId}/review`,
        {
          method: "POST",
        }
      );
      setCompletionState("done");
    } catch (error) {
      setCompletionState("error");
      setCompletionErr(
        getErrorMessage(error, "Failed to mark review complete")
      );
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0d",
        color: "#f4f4f5",
        fontFamily: "system-ui",
      }}
    >
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
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "12px 14px",
            display: "flex",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 750,
                fontSize: 16,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Session Review
            </div>

            <div
              style={{
                color: "rgba(244,244,245,0.65)",
                fontSize: 12,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Session {sessionId}
              {data?.session?.submitted_at
                ? ` • Submitted ${new Date(
                    data.session.submitted_at
                  ).toLocaleString()}`
                : ""}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() =>
                setFontScale((s) =>
                  Math.max(0.85, Math.round((s - 0.05) * 100) / 100)
                )
              }
              style={btnSmall()}
              title="Decrease font"
            >
              A-
            </button>

            <button
              onClick={() =>
                setFontScale((s) =>
                  Math.min(1.25, Math.round((s + 0.05) * 100) / 100)
                )
              }
              style={btnSmall()}
              title="Increase font"
            >
              A+
            </button>

            <button
              onClick={() => void load()}
              disabled={loading}
              style={btnSmall(loading)}
              title="Refresh"
            >
              {loading ? "…" : "⟳"}
            </button>

            <button
              onClick={goBackToResults}
              disabled={loading}
              style={btnSmall(loading)}
              title="Back to results"
            >
              Back
            </button>
          </div>
        </div>
      </div>

      <main
        style={{
          maxWidth: 980,
          margin: "0 auto",
          padding: "14px 14px 110px",
        }}
      >
        {err && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(220,38,38,0.10)",
            }}
          >
            <div style={{ fontWeight: 700, color: "#fecaca" }}>Error</div>
            <div style={{ marginTop: 6, color: "rgba(244,244,245,0.85)" }}>
              {err}
            </div>
          </div>
        )}

        {!data ? (
          <div style={{ marginTop: 16, color: "rgba(244,244,245,0.8)" }}>
            Loading…
          </div>
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
                <div
                  style={{
                    marginTop: 6,
                    color: "rgba(244,244,245,0.75)",
                    fontSize: 13,
                  }}
                >
                  This session is currently{" "}
                  <strong>{data.session.status}</strong>. Review may be
                  incomplete unless the session is submitted.
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
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>Summary</div>
                  <div style={{ color: "rgba(244,244,245,0.75)" }}>
                    Answered {summary.answered}/{summary.total}
                  </div>
                  <div style={{ color: "rgba(244,244,245,0.75)" }}>
                    Accuracy {(summary.accuracy * 100).toFixed(1)}%
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <span style={pill()}>correct: {summary.correct}</span>
                  <span style={pill()}>wrong: {summary.wrong}</span>
                  <span style={pill()}>skipped: {summary.skipped}</span>
                  <span style={pill()}>unanswered: {summary.unanswered}</span>
                  <span style={pill()}>flagged: {summary.flagged}</span>
                  <span style={pill()}>blocks: {summary.blocks}</span>
                </div>
              </div>
            )}

            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 6,
              }}
            >
              {itemsSorted.map((item) => {
                const status = statusFor(item);
                const isActive = item.position === activePos;
                const color = navColor(status);
                const flagged = isReviewItemFlagged(item);

                return (
                  <button
                    key={item.session_item_id}
                    onClick={() => setActivePos(item.position)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: flagged
                        ? "1px solid rgba(245,158,11,0.75)"
                        : `1px solid ${color.border}`,
                      background: flagged ? "rgba(245,158,11,0.18)" : color.bg,
                      color: flagged ? "rgba(253,230,138,1)" : color.text,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: isActive
                        ? "0 0 0 2px rgba(244,244,245,0.20)"
                        : "none",
                      flex: "0 0 auto",
                    }}
                    title={`Q${item.position} • ${
                      item.result ?? "unanswered"
                    }`}
                  >
                    {item.position}
                    {flagged ? "*" : ""}
                  </button>
                );
              })}
            </div>

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
                <div
                  style={{
                    padding: 14,
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800 }}>
                      Question {activeItem.position} of {itemsSorted.length}
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: "rgba(244,244,245,0.62)",
                      }}
                    >
                      {getQuestionLocationLabel(activeItem)}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {isReviewItemFlagged(activeItem) ? (
                      <span
                        style={{
                          ...pill(),
                          borderColor: "rgba(245,158,11,0.55)",
                          background: "rgba(245,158,11,0.14)",
                          color: "rgba(253,230,138,1)",
                        }}
                      >
                        flagged
                      </span>
                    ) : null}

                    <span
                      style={{
                        ...pill(),
                        borderColor: navColor(statusFor(activeItem)).border,
                      }}
                    >
                      {activeItem.result ?? "unanswered"}
                    </span>
                  </div>
                </div>

                <div style={{ padding: 14 }}>
                  <AreaBadges areas={activeItem.areas ?? []} />

                  <ReviewMetadata item={activeItem} />

                  <div
                    style={{
                      fontSize: `${1 * fontScale}rem`,
                      lineHeight: 1.55,
                      color: "#f4f4f5",
                    }}
                  >
                    {activeItem.stem}
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    {Array.isArray(activeItem.choices) &&
                    activeItem.choices.length > 0 ? (
                      activeItem.choices.map((choice) => {
                        const isSelected =
                          (activeItem.selected_choice_id ?? null) ===
                          choice.choice_id;
                        const isCorrect = choice.is_correct === true;

                        const tone: "neutral" | "correct" | "wrong" =
                          isCorrect
                            ? "correct"
                            : isSelected
                            ? "wrong"
                            : "neutral";

                        const title =
                          isCorrect && isSelected
                            ? "Your answer (correct)"
                            : isCorrect
                            ? "Correct answer"
                            : isSelected
                            ? "Your answer"
                            : "Choice";

                        return (
                          <ChoiceCardV2
                            key={choice.choice_id}
                            title={title}
                            label={choice.label}
                            text={choice.choice_text}
                            tone={tone}
                            fontScale={fontScale}
                            explanation={choice.explanation}
                            showExplanation
                          />
                        );
                      })
                    ) : (
                      <>
                        <ChoiceCard
                          title="Your answer"
                          label={activeItem.selected_label}
                          text={activeItem.selected_choice_text}
                          tone={
                            activeItem.result === "wrong"
                              ? "wrong"
                              : activeItem.result === "correct"
                              ? "correct"
                              : "neutral"
                          }
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

                  <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                    <InfoBlock
                      title="Educational Objective"
                      body={
                        activeItem.explanation_short
                          ? activeItem.explanation_short
                          : "(Coming soon) Structured educational blocks will appear here."
                      }
                      kind="amber"
                      fontScale={fontScale}
                    />

                    <InfoBlock
                      title="Key Concept / Bottom Line"
                      body={
                        activeItem.explanation_long
                          ? activeItem.explanation_long
                          : "(Coming soon) Distilled takeaways will appear here."
                      }
                      kind="green"
                      fontScale={fontScale}
                    />

                    <InfoBlock
                      title="References & Resources"
                      body={formatReferenceBlock(activeItem)}
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
        <div
          style={{
            maxWidth: 980,
            margin: "0 auto",
            padding: "12px 14px",
            display: "flex",
            gap: 10,
          }}
        >
          <button onClick={goPrev} disabled={!canPrev} style={btnWide(!canPrev)}>
            Prev
          </button>

          <button
            onClick={goNext}
            disabled={!canNext}
            style={btnWide(!canNext, true)}
          >
            Next
          </button>

          <button
            onClick={markReviewComplete}
            disabled={
              !data || completionState === "saving" || completionState === "done"
            }
            style={btnWide(
              !data || completionState === "saving" || completionState === "done",
              completionState !== "done"
            )}
          >
            {completionState === "saving"
              ? "Saving completion..."
              : completionState === "done"
                ? "Review marked complete"
                : "Mark review complete"}
          </button>

          {completionState === "done" ? (
            <div
              style={{
                alignSelf: "center",
                color: "#86efac",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              Review completion saved.
            </div>
          ) : null}

          {completionState === "error" && completionErr ? (
            <div
              style={{
                alignSelf: "center",
                color: "#fca5a5",
                fontSize: 12,
                fontWeight: 650,
              }}
            >
              {completionErr}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AreaBadges({ areas }: { areas: MedicalArea[] }) {
  if (!areas.length) return null;

  return (
    <div
      style={{
        marginBottom: 12,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 850,
          color: "rgba(244,244,245,0.72)",
        }}
      >
        Areas:
      </span>

      {areas.map((area) => (
        <span
          key={`${area.slug}-${area.is_primary ? "primary" : "secondary"}`}
          style={{
            ...pill(),
            borderColor: area.is_primary
              ? "rgba(96,165,250,0.45)"
              : "rgba(255,255,255,0.14)",
            background: area.is_primary
              ? "rgba(59,130,246,0.18)"
              : "rgba(255,255,255,0.04)",
            color: area.is_primary
              ? "rgba(191,219,254,1)"
              : "rgba(244,244,245,0.85)",
            fontWeight: area.is_primary ? 800 : 650,
          }}
          title={area.is_primary ? "Primary area" : "Secondary area"}
        >
          {area.name}
        </span>
      ))}
    </div>
  );
}

function ReviewMetadata({ item }: { item: ReviewItem }) {
  const firstSeen = formatDateTime(item.first_seen_at);
  const lastSeen = formatDateTime(item.last_seen_at);
  const answeredAt = formatDateTime(item.answered_at);
  const timeSpent = formatDurationSeconds(item.time_spent_seconds);
  const flagged = isReviewItemFlagged(item);

  const metadataItems = [
    getQuestionLocationLabel(item),
    flagged ? "Flagged for review" : "Not flagged",
    firstSeen ? `First seen: ${firstSeen}` : null,
    lastSeen ? `Last seen: ${lastSeen}` : null,
    answeredAt ? `Answered: ${answeredAt}` : null,
    timeSpent ? `Time spent: ${timeSpent}` : null,
    typeof item.confidence === "number" ? `Confidence: ${item.confidence}/5` : null,
  ].filter((value): value is string => Boolean(value));

  if (metadataItems.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        marginBottom: 14,
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {metadataItems.map((value) => (
        <span
          key={value}
          style={{
            ...pill(),
            borderColor:
              value === "Flagged for review"
                ? "rgba(245,158,11,0.55)"
                : "rgba(255,255,255,0.14)",
            background:
              value === "Flagged for review"
                ? "rgba(245,158,11,0.14)"
                : "rgba(255,255,255,0.04)",
            color:
              value === "Flagged for review"
                ? "rgba(253,230,138,1)"
                : "rgba(244,244,245,0.80)",
          }}
        >
          {value}
        </span>
      ))}
    </div>
  );
}

function statusFor(item: ReviewItem): Status {
  if (item.result === "correct") return "correct";
  if (item.result === "wrong") return "wrong";
  return "neutral";
}

function btnSmall(disabled = false): CSSProperties {
  return {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.04)",
    color: "#f4f4f5",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    fontSize: 13,
    fontWeight: 650,
  };
}

function btnWide(disabled: boolean, primary?: boolean): CSSProperties {
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

function pill(): CSSProperties {
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

function navColor(status: Status) {
  if (status === "correct") {
    return {
      bg: "rgba(34,197,94,0.15)",
      border: "rgba(34,197,94,0.35)",
      text: "rgba(187,247,208,1)",
    };
  }

  if (status === "wrong") {
    return {
      bg: "rgba(239,68,68,0.14)",
      border: "rgba(239,68,68,0.35)",
      text: "rgba(254,202,202,1)",
    };
  }

  return {
    bg: "rgba(255,255,255,0.04)",
    border: "rgba(255,255,255,0.10)",
    text: "rgba(244,244,245,0.85)",
  };
}

function ChoiceCard(props: {
  title: string;
  label: string | null;
  text: string | null;
  tone: "neutral" | "correct" | "wrong";
  fontScale: number;
}) {
  const { title, label, text, tone, fontScale } = props;
  const colors = choiceColors(tone);

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
        <span style={{ ...pill(), background: colors.badge }}>
          {label ?? "—"}
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: `${0.98 * fontScale}rem`,
          lineHeight: 1.5,
          color: "rgba(244,244,245,0.92)",
        }}
      >
        {text ?? "—"}
      </div>
    </div>
  );
}

function ChoiceCardV2(props: {
  title: string;
  label: string | null;
  text: string | null;
  tone: "neutral" | "correct" | "wrong";
  fontScale: number;
  explanation: string | null | undefined;
  showExplanation: boolean;
}) {
  const {
    title,
    label,
    text,
    tone,
    fontScale,
    explanation,
    showExplanation,
  } = props;

  const colors = choiceColors(tone);
  const explainTitle = tone === "correct" ? "Why correct" : "Why wrong";

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        padding: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: 13 }}>{title}</div>
        <span style={{ ...pill(), background: colors.badge }}>
          {label ?? "—"}
        </span>
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: `${0.98 * fontScale}rem`,
          lineHeight: 1.5,
          color: "rgba(244,244,245,0.92)",
        }}
      >
        {text ?? "—"}
      </div>

      {showExplanation && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          <div
            style={{
              fontWeight: 850,
              fontSize: 12,
              color: "rgba(244,244,245,0.90)",
            }}
          >
            {explainTitle}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: `${0.94 * fontScale}rem`,
              lineHeight: 1.5,
              color: "rgba(244,244,245,0.78)",
              whiteSpace: "pre-wrap",
            }}
          >
            {explanation && String(explanation).trim().length > 0
              ? explanation
              : "(No explanation provided yet.)"}
          </div>
        </div>
      )}
    </div>
  );
}

function choiceColors(tone: "neutral" | "correct" | "wrong") {
  if (tone === "correct") {
    return {
      border: "rgba(34,197,94,0.35)",
      bg: "rgba(34,197,94,0.10)",
      badge: "rgba(34,197,94,0.22)",
    };
  }

  if (tone === "wrong") {
    return {
      border: "rgba(239,68,68,0.35)",
      bg: "rgba(239,68,68,0.10)",
      badge: "rgba(239,68,68,0.20)",
    };
  }

  return {
    border: "rgba(255,255,255,0.10)",
    bg: "rgba(255,255,255,0.03)",
    badge: "rgba(255,255,255,0.06)",
  };
}

function InfoBlock(props: {
  title: string;
  body: string;
  kind: "neutral" | "amber" | "green";
  fontScale: number;
}) {
  const { title, body, kind, fontScale } = props;

  const colors =
    kind === "amber"
      ? { border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.10)" }
      : kind === "green"
      ? { border: "rgba(34,197,94,0.35)", bg: "rgba(34,197,94,0.10)" }
      : { border: "rgba(255,255,255,0.10)", bg: "rgba(255,255,255,0.03)" };

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        padding: 12,
      }}
    >
      <div style={{ fontWeight: 850, fontSize: 13 }}>{title}</div>
      <div
        style={{
          marginTop: 8,
          fontSize: `${0.95 * fontScale}rem`,
          lineHeight: 1.5,
          color: "rgba(244,244,245,0.80)",
          whiteSpace: "pre-wrap",
        }}
      >
        {body}
      </div>
    </div>
  );
}