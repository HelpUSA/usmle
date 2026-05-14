/*
 * File: src/app/session/[sessionId]/page.tsx
 *
 * Responsibility:
 * - Main study-session player screen.
 * - Ensures session items exist through the idempotent session-items endpoint.
 * - Loads and displays one question at a time.
 * - Records attempts per session_item.
 * - Controls navigation between questions.
 * - Respects session mode semantics:
 *   - practice: immediate feedback after submit;
 *   - timed_block / exam_sim: deferred review after final submit.
 * - Handles timed sessions with countdown and automatic final submission.
 *
 * API contract used:
 * - GET    /api/sessions
 *   Used to obtain session metadata: mode, timed, time_limit_seconds, started_at.
 * - POST   /api/sessions/:sessionId/items
 *   Generates session items idempotently, only while the session is in_progress.
 * - GET    /api/sessions/:sessionId/items
 *   Fallback read for already-generated session items.
 * - GET    /api/session-items/:sessionItemId/question
 *   Loads the current question without revealing the answer key.
 * - POST   /api/sessions/:sessionId/items/:sessionItemId/attempt
 *   Records the attempt and, in immediate-review mode, returns didactic feedback.
 * - POST   /api/sessions/:sessionId/submit
 *   Finalizes the session before review/results navigation.
 *
 * Important behavior:
 * - Never reveals the correct answer before the question is submitted.
 * - Session mode is authoritative.
 * - The final session submit must happen before opening review.
 * - If a submitted session is opened through browser back/history, redirect to review.
 * - Do not load items/questions for sessions that are not in_progress.
 * - The route is singular: /session/[sessionId].
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";

type SessionItem = {
  session_item_id: string;
  session_id: string;
  position: number;
  question_version_id: string;
  presented_at: string;
};

type SessionMode = "practice" | "timed_block" | "exam_sim";
type SessionStatus = "in_progress" | "submitted" | "abandoned" | string;

type SessionSummary = {
  session_id: string;
  user_id: string;
  mode: SessionMode;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: SessionStatus;
  settings_json?: {
    review_strategy?: "immediate" | "deferred";
    timer_visible?: boolean;
    mode_semantics?: string;
    exam_format_version?: "legacy" | "usmle_2026_new_software";
    block_size?: number | null;
    block_minutes?: number | null;
    pacing_target_seconds_per_item?: number | null;
    flag_warning_threshold?: number | null;
    implementation_phase?: "current" | "planned";
  } | null;
  started_at?: string;
  submitted_at?: string | null;
};

type MedicalArea = {
  slug: string;
  name: string;
  is_primary: boolean;
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
    areas?: MedicalArea[];
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
  defaultMode: SessionMode;
  practiceQuestionCount: number;
  autoOpenReviewAfterSubmit: boolean;
  confirmBeforeLeavingSession: boolean;
  emphasizeTimer: boolean;
};

type VisibleChoice = {
  choice_id: string;
  label: string;
  choice_text: string;
  is_correct?: boolean;
  explanation?: string | null;
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

function isSessionMode(value: unknown): value is SessionMode {
  return value === "practice" || value === "timed_block" || value === "exam_sim";
}

function loadSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      defaultExam: "step1",
      defaultMode: isSessionMode(parsed.defaultMode)
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
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

function normalizeIsCorrect(feedback: AttemptResponse | null): boolean | null {
  if (!feedback) return null;
  if (typeof feedback.is_correct === "boolean") return feedback.is_correct;
  if (feedback.result === "correct") return true;
  if (feedback.result === "wrong") return false;
  return null;
}

function isPlayableStatus(status?: SessionStatus | null): boolean {
  return status === "in_progress";
}

function examLabel(exam?: string | null): string {
  switch (exam) {
    case "step1":
      return "Step 1";
    case "step2ck":
      return "Step 2 CK";
    case "step3":
      return "Step 3";
    default:
      return "USMLE";
  }
}

function getSessionBlockSize(
  sessionMeta: SessionSummary | null,
  itemCount: number
): number | null {
  const configured = sessionMeta?.settings_json?.block_size;

  if (typeof configured === "number" && configured > 0) {
    return configured;
  }

  if (sessionMeta?.mode === "timed_block" || sessionMeta?.mode === "exam_sim") {
    return 20;
  }

  return itemCount > 0 ? itemCount : null;
}

function getSessionBlockMinutes(sessionMeta: SessionSummary | null): number | null {
  const configured = sessionMeta?.settings_json?.block_minutes;

  if (typeof configured === "number" && configured > 0) {
    return configured;
  }

  if (sessionMeta?.mode === "timed_block" || sessionMeta?.mode === "exam_sim") {
    return 30;
  }

  return null;
}

function getFormatProfileLabel(sessionMeta: SessionSummary | null): string {
  if (sessionMeta?.settings_json?.exam_format_version === "usmle_2026_new_software") {
    return "USMLE 2026 format";
  }

  if (sessionMeta?.mode === "timed_block" || sessionMeta?.mode === "exam_sim") {
    return "Official-format block";
  }

  return "Practice mode";
}

function SimulatorMetric(props: {
  label: string;
  value: string;
  detail: string;
}) {
  const { label, value, detail } = props;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 14,
        border: "1px solid #bfdbfe",
        background: "rgba(255,255,255,0.78)",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 18,
          lineHeight: 1.1,
          fontWeight: 950,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 5,
          fontSize: 11,
          color: "#64748b",
          lineHeight: 1.35,
          wordBreak: "break-word",
        }}
      >
        {detail}
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
          fontWeight: 800,
          color: "#4b5563",
        }}
      >
        Areas:
      </span>

      {areas.map((area) => (
        <span
          key={`${area.slug}-${area.is_primary ? "primary" : "secondary"}`}
          style={{
            fontSize: 12,
            padding: "4px 8px",
            borderRadius: 999,
            border: area.is_primary ? "1px solid #93c5fd" : "1px solid #ddd",
            background: area.is_primary ? "#eff6ff" : "#fafafa",
            color: area.is_primary ? "#1d4ed8" : "#374151",
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

export default function SessionPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const router = useRouter();
  const sessionId = params.sessionId;

  const [sessionMeta, setSessionMeta] = useState<SessionSummary | null>(null);
  const [userSettings, setUserSettings] =
    useState<UserSettings>(defaultSettings);

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
  const [answeredPositions, setAnsweredPositions] = useState<Set<number>>(
    () => new Set()
  );
  const [flaggedPositions, setFlaggedPositions] = useState<Set<number>>(
    () => new Set()
  );

  const autoSubmitTriggeredRef = useRef(false);
  const intentionalNavigationRef = useRef(false);
  const questionStartedAtRef = useRef<number | null>(null);

  const current = useMemo(() => items[idx] ?? null, [items, idx]);
  const currentSessionItemId = current?.session_item_id ?? null;

  const sessionStatus = sessionMeta?.status ?? null;
  const sessionIsInProgress = isPlayableStatus(sessionStatus);
  const sessionIsSubmitted = sessionStatus === "submitted";
  const sessionIsClosed =
    Boolean(sessionMeta) && Boolean(sessionStatus) && !sessionIsInProgress;

  const isTimedMode = Boolean(sessionMeta?.timed);
  const reviewStrategy =
    sessionMeta?.settings_json?.review_strategy ??
    (isTimedMode ? "deferred" : "immediate");
  const showImmediateFeedback = reviewStrategy === "immediate";

  const getPostSubmitDestination = useCallback(() => {
    return userSettings.autoOpenReviewAfterSubmit
      ? `/session/${sessionId}/review`
      : "/results";
  }, [sessionId, userSettings.autoOpenReviewAfterSubmit]);

  const submitSessionAndRedirect = useCallback(
    async (fromTimer = false, ignoreBusyGuard = false) => {
      if (!ignoreBusyGuard && (saving || autoSubmitting)) return;

      if (fromTimer) {
        setAutoSubmitting(true);
      } else {
        setSaving(true);
      }

      setErr(null);

      try {
        await apiFetch(`/api/sessions/${sessionId}/submit`, {
          method: "POST",
        });

        const destination = getPostSubmitDestination();

        intentionalNavigationRef.current = true;
        setSessionMeta((currentMeta) =>
          currentMeta
            ? {
                ...currentMeta,
                status: "submitted",
                submitted_at:
                  currentMeta.submitted_at ?? new Date().toISOString(),
              }
            : currentMeta
        );

        router.replace(destination);
      } catch (error) {
        const message = getErrorMessage(error, "Failed to submit session");

        if (message.includes("Session is not in_progress")) {
          intentionalNavigationRef.current = true;
          router.replace(`/session/${sessionId}/review`);
          return;
        }

        setErr(message);
        autoSubmitTriggeredRef.current = false;
      } finally {
        if (fromTimer) {
          setAutoSubmitting(false);
        } else {
          setSaving(false);
        }
      }
    },
    [autoSubmitting, getPostSubmitDestination, router, saving, sessionId]
  );

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

  const loadSessionMeta = useCallback(async () => {
    setLoadingSessionMeta(true);
    setErr(null);

    try {
      const res = await apiFetch<{ sessions: SessionSummary[] }>(
        "/api/sessions"
      );

      const found =
        (res.sessions ?? []).find((session) => session.session_id === sessionId) ??
        null;

      if (!found) {
        setErr("Session metadata not found");
        setSessionMeta(null);
        return;
      }

      setSessionMeta(found);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load session metadata"));
      setSessionMeta(null);
    } finally {
      setLoadingSessionMeta(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void loadSessionMeta();
  }, [loadSessionMeta]);

  useEffect(() => {
    if (!sessionMeta) return;

    if (sessionMeta.status === "submitted") {
      setItems([]);
      setQ(null);
      setSelected(null);
      setSubmitted(false);
      setFeedback(null);
      setRemainingSeconds(null);
      intentionalNavigationRef.current = true;
      router.replace(`/session/${sessionId}/review`);
      return;
    }

    if (sessionMeta.status && sessionMeta.status !== "in_progress") {
      setItems([]);
      setQ(null);
      setSelected(null);
      setSubmitted(false);
      setFeedback(null);
      setRemainingSeconds(null);
    }
  }, [router, sessionId, sessionMeta]);

  useEffect(() => {
    if (!userSettings.confirmBeforeLeavingSession) return;
    if (!sessionMeta) return;
    if (sessionMeta.status !== "in_progress") return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (intentionalNavigationRef.current) return;

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

    if (sessionMeta.status !== "in_progress") {
      setRemainingSeconds(null);
      return;
    }

    if (!sessionMeta.started_at || !sessionMeta.time_limit_seconds) {
      setRemainingSeconds(null);
      return;
    }

    const startedAtMs = new Date(sessionMeta.started_at).getTime();

    if (!Number.isFinite(startedAtMs)) {
      setRemainingSeconds(null);
      return;
    }

    const deadlineMs = startedAtMs + sessionMeta.time_limit_seconds * 1000;

    function tick() {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((deadlineMs - now) / 1000));

      setRemainingSeconds(remaining);

      if (remaining <= 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        void submitSessionAndRedirect(true, true);
      }
    }

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [sessionMeta, submitSessionAndRedirect]);

  const loadItems = useCallback(async () => {
    setLoadingItems(true);
    setErr(null);

    try {
      let res: { items: SessionItem[] };

      try {
        res = await apiFetch<{ items: SessionItem[] }>(
          `/api/sessions/${sessionId}/items`,
          {
            method: "POST",
          }
        );
      } catch {
        res = await apiFetch<{ items: SessionItem[] }>(
          `/api/sessions/${sessionId}/items`
        );
      }

      const sortedItems = [...(res.items ?? [])].sort(
        (a, b) => a.position - b.position
      );

      setItems(sortedItems);
      setIdx(0);
      setAnsweredPositions(new Set());
      setFlaggedPositions(new Set());
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load session items"));
      setItems([]);
      setIdx(0);
    } finally {
      setLoadingItems(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (loadingSessionMeta) return;
    if (!sessionMeta) return;
    if (sessionMeta.status !== "in_progress") return;

    void loadItems();
  }, [loadItems, loadingSessionMeta, sessionMeta]);

  useEffect(() => {
    if (!currentSessionItemId) return;
    if (sessionMeta?.status !== "in_progress") return;

    let cancelled = false;

    async function loadQuestion() {
      setErr(null);
      setSelected(null);
      setQ(null);
      setSubmitted(false);
      setFeedback(null);

      questionStartedAtRef.current = Date.now();

      try {
        const res = await apiFetch<QuestionResponse>(
          `/api/session-items/${currentSessionItemId}/question`
        );

        if (!cancelled) {
          setQ(res);
        }
      } catch (error) {
        if (!cancelled) {
          const message = getErrorMessage(error, "Failed to load question");

          if (message.includes("Session is not in_progress")) {
            intentionalNavigationRef.current = true;
            router.replace(`/session/${sessionId}/review`);
            return;
          }

          setErr(message);
        }
      }
    }

    void loadQuestion();

    return () => {
      cancelled = true;
    };
  }, [currentSessionItemId, router, sessionId, sessionMeta?.status]);

  async function finish() {
    if (sessionMeta?.status === "submitted") {
      intentionalNavigationRef.current = true;
      router.replace(`/session/${sessionId}/review`);
      return;
    }

    if (sessionMeta?.status && sessionMeta.status !== "in_progress") {
      intentionalNavigationRef.current = true;
      router.replace("/study");
      return;
    }

    if (
      userSettings.confirmBeforeLeavingSession &&
      sessionMeta?.status === "in_progress" &&
      !autoSubmitting
    ) {
      const confirmed = window.confirm(
        "Do you want to finish this session now and leave the player?"
      );

      if (!confirmed) return;
    }

    await submitSessionAndRedirect(false, true);
  }

  async function submitOrNext() {
    if (!current) return;
    if (sessionMeta?.status !== "in_progress") return;

    if (showImmediateFeedback && submitted) {
      if (idx < items.length - 1) {
        setIdx(idx + 1);
      } else {
        await submitSessionAndRedirect(false, true);
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
      const attemptFeedback = await apiFetch<AttemptResponse>(
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

      setAnsweredPositions((previous) => {
        const next = new Set(previous);
        next.add(current.position);
        return next;
      });

      if (showImmediateFeedback) {
        setFeedback(attemptFeedback ?? null);
        setSubmitted(true);
      } else if (idx < items.length - 1) {
        setIdx(idx + 1);
      } else {
        await submitSessionAndRedirect(false, true);
      }
    } catch (error) {
      const message = getErrorMessage(error, "Failed to submit answer");

      if (message.includes("Session is not in_progress")) {
        intentionalNavigationRef.current = true;
        router.replace(`/session/${sessionId}/review`);
        return;
      }

      setErr(message);
    } finally {
      setSaving(false);
    }
  }

  const isCorrect = normalizeIsCorrect(feedback);

  const visibleChoices = useMemo<VisibleChoice[]>(() => {
    if (!q) return [];
    if (!showImmediateFeedback) return q.choices;
    if (!submitted) return q.choices;
    if (feedback?.choices && feedback.choices.length > 0) {
      return feedback.choices;
    }

    return q.choices;
  }, [feedback, q, showImmediateFeedback, submitted]);

  const correctChoiceId = useMemo(() => {
    if (!showImmediateFeedback || !submitted) return null;

    const feedbackChoices = feedback?.choices ?? [];
    const correct = feedbackChoices.find((choice) => choice.is_correct);

    return correct?.choice_id ?? null;
  }, [feedback, showImmediateFeedback, submitted]);

  const sessionModeLabel = useMemo(() => {
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

  const feedbackBibliography = Array.isArray(feedback?.bibliography)
    ? feedback.bibliography
    : [];

  const timerStyle: CSSProperties =
    isTimedMode && userSettings.emphasizeTimer
      ? {
          width: "100%",
          maxWidth: 260,
          padding: "14px 16px",
          borderRadius: 16,
          border: "2px solid #e7c77a",
          background:
            remainingSeconds !== null && remainingSeconds <= 300
              ? "#fdecea"
              : "#fff8e1",
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
            remainingSeconds !== null && remainingSeconds <= 300
              ? "#fdecea"
              : "#fff8e1",
          fontWeight: 800,
          textAlign: "center",
        };

  const isBusy = saving || autoSubmitting;
  const hasItems = items.length > 0;
  const canSubmitChoice =
    sessionIsInProgress &&
    (Boolean(selected) || (showImmediateFeedback && submitted));

  const blockSize = getSessionBlockSize(sessionMeta, items.length);
  const blockMinutes = getSessionBlockMinutes(sessionMeta);
  const currentPosition = items.length ? idx + 1 : null;
  const positionInBlock =
    currentPosition && blockSize ? ((currentPosition - 1) % blockSize) + 1 : currentPosition;
  const currentBlock =
    currentPosition && blockSize ? Math.floor((currentPosition - 1) / blockSize) + 1 : 1;
  const totalBlocks =
    blockSize && items.length ? Math.max(1, Math.ceil(items.length / blockSize)) : 1;
  const formatProfileLabel = getFormatProfileLabel(sessionMeta);
  const answeredCount = answeredPositions.size;
  const flaggedCount = flaggedPositions.size;
  const isCurrentFlagged = current ? flaggedPositions.has(current.position) : false;
  const pacingTarget =
    sessionMeta?.settings_json?.pacing_target_seconds_per_item ??
    (isTimedMode ? 90 : null);
  const flagWarningThreshold =
    sessionMeta?.settings_json?.flag_warning_threshold ?? 5;
  const pacingLabel =
    pacingTarget && blockMinutes
      ? `${pacingTarget}s/question target`
      : isTimedMode
      ? "Timed pacing"
      : "Untimed practice";

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
            Session {sessionId.slice(0, 8)}… — Q{" "}
            {items.length ? idx + 1 : "?"}/{items.length || "?"}
          </h1>

          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 12,
                padding: "4px 8px",
                borderRadius: 999,
                border: "1px solid #ddd",
                background: "#fafafa",
              }}
            >
              Mode: {loadingSessionMeta ? "Loading…" : sessionModeLabel}
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

            {sessionStatus ? (
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 8px",
                  borderRadius: 999,
                  border: "1px solid #ddd",
                  background: sessionIsInProgress ? "#eefaf0" : "#f3f4f6",
                }}
              >
                Status: {sessionStatus}
              </span>
            ) : null}
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
            onClick={() => void finish()}
            disabled={
              isBusy || loadingItems || !hasItems || !sessionIsInProgress
            }
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ccc",
              cursor:
                isBusy || loadingItems || !hasItems || !sessionIsInProgress
                  ? "not-allowed"
                  : "pointer",
              width: "100%",
              maxWidth: 240,
              flex: "0 1 240px",
            }}
          >
            {autoSubmitting
              ? "Submitting…"
              : userSettings.autoOpenReviewAfterSubmit
              ? "Finish & Review"
              : "Finish Session"}
          </button>
        </div>
      </div>

      <section
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 18,
          border: "1px solid #dbeafe",
          background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)",
          display: "grid",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}
        >
          <SimulatorMetric
            label="Exam"
            value={examLabel(sessionMeta?.exam)}
            detail={formatProfileLabel}
          />

          <SimulatorMetric
            label="Block"
            value={`${currentBlock}/${totalBlocks}`}
            detail={
              blockSize && blockMinutes
                ? `${blockSize}q · ${blockMinutes} min`
                : "Practice set"
            }
          />

          <SimulatorMetric
            label="Question"
            value={
              currentPosition
                ? `${positionInBlock ?? currentPosition}/${blockSize ?? items.length}`
                : "?/?"
            }
            detail={items.length ? `${currentPosition ?? "?"}/${items.length} total` : "Loading"}
          />

          <SimulatorMetric
            label="Answered"
            value={`${answeredCount}/${items.length || "?"}`}
            detail={showImmediateFeedback ? "Immediate review" : "Deferred review"}
          />

          <SimulatorMetric
            label="Flagged"
            value={`${flaggedCount}`}
            detail={
              flaggedCount >= flagWarningThreshold
                ? "High flag load"
                : `Warning at ${flagWarningThreshold}`
            }
          />

          <SimulatorMetric
            label="Pacing"
            value={isTimedMode ? "Active" : "Off"}
            detail={pacingLabel}
          />
        </div>
      </section>

      {err && <p style={{ color: "crimson", marginTop: 12 }}>Error: {err}</p>}

      {sessionIsSubmitted ? (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #dbeafe",
            background: "#eff6ff",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>Session completed</div>

          <div style={{ color: "#374151", lineHeight: 1.5 }}>
            This session has already been submitted. Opening review…
          </div>

          <button
            type="button"
            onClick={() => {
              intentionalNavigationRef.current = true;
              router.replace(`/session/${sessionId}/review`);
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #bfdbfe",
              background: "white",
              cursor: "pointer",
              width: "100%",
              maxWidth: 220,
              fontWeight: 800,
            }}
          >
            Open Review
          </button>
        </div>
      ) : sessionIsClosed ? (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #e5e7eb",
            background: "#f9fafb",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ fontWeight: 900 }}>Session unavailable</div>

          <div style={{ color: "#374151", lineHeight: 1.5 }}>
            This session is no longer active. Current status:{" "}
            <strong>{sessionStatus}</strong>.
          </div>

          <button
            type="button"
            onClick={() => {
              intentionalNavigationRef.current = true;
              router.replace("/study");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #d1d5db",
              background: "white",
              cursor: "pointer",
              width: "100%",
              maxWidth: 220,
              fontWeight: 800,
            }}
          >
            Back to Study
          </button>
        </div>
      ) : loadingItems || loadingSessionMeta ? (
        <p style={{ marginTop: 16 }}>
          {loadingSessionMeta ? "Loading session…" : "Loading session items…"}
        </p>
      ) : !current ? (
        <p style={{ marginTop: 16 }}>No session items found.</p>
      ) : !q ? (
        <p style={{ marginTop: 16 }}>Loading question…</p>
      ) : (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              marginBottom: 14,
              padding: 12,
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              background: "#fcfcfd",
              display: "grid",
              gap: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900 }}>
                Question navigator
              </div>

              <button
                type="button"
                onClick={() => {
                  if (!current) return;

                  setFlaggedPositions((previous) => {
                    const next = new Set(previous);

                    if (next.has(current.position)) {
                      next.delete(current.position);
                    } else {
                      next.add(current.position);
                    }

                    return next;
                  });
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: isCurrentFlagged ? "1px solid #f59e0b" : "1px solid #d1d5db",
                  background: isCurrentFlagged ? "#fffbeb" : "white",
                  color: isCurrentFlagged ? "#92400e" : "#374151",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 850,
                }}
              >
                {isCurrentFlagged ? "Unflag question" : "Flag for review"}
              </button>
            </div>

            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                paddingBottom: 2,
              }}
            >
              {items.map((item) => {
                const isActive = item.position === current.position;
                const isAnswered = answeredPositions.has(item.position);
                const isFlagged = flaggedPositions.has(item.position);

                return (
                  <button
                    key={item.session_item_id}
                    type="button"
                    onClick={() => {
                      if (!isBusy) {
                        setIdx(item.position - 1);
                      }
                    }}
                    disabled={isBusy}
                    title={`Question ${item.position}${isFlagged ? " · flagged" : ""}`}
                    style={{
                      minWidth: 34,
                      height: 34,
                      borderRadius: 999,
                      border: isActive
                        ? "2px solid #2563eb"
                        : isFlagged
                        ? "1px solid #f59e0b"
                        : "1px solid #d1d5db",
                      background: isActive
                        ? "#eff6ff"
                        : isAnswered
                        ? "#ecfdf5"
                        : isFlagged
                        ? "#fffbeb"
                        : "white",
                      color: isActive
                        ? "#1d4ed8"
                        : isAnswered
                        ? "#047857"
                        : isFlagged
                        ? "#92400e"
                        : "#374151",
                      cursor: isBusy ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 900,
                      flex: "0 0 auto",
                    }}
                  >
                    {item.position}
                  </button>
                );
              })}
            </div>

            <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
              Local navigator status: answered and flagged markers help with test-day rhythm. Persistent flag analytics will be added in the database phase.
            </div>
          </div>

          <AreaBadges areas={q.question.areas ?? []} />

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
            {visibleChoices.map((choice) => {
              const isSelected = selected === choice.choice_id;

              const showAfter = showImmediateFeedback && submitted;
              const isCorrectChoice =
                showAfter &&
                (choice.is_correct === true ||
                  choice.choice_id === correctChoiceId);
              const isWrongSelected =
                showAfter && isSelected && !isCorrectChoice;

              return (
                <label
                  key={choice.choice_id}
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
                    onChange={() => {
                      if (!submitted) {
                        setSelected(choice.choice_id);
                      }
                    }}
                    style={{
                      marginTop: 2,
                      transform: "scale(1.1)",
                    }}
                  />

                  <div style={{ width: "100%", minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div style={{ fontWeight: 800 }}>
                        {choice.label}
                        {showAfter && isCorrectChoice ? " ✅" : null}
                        {showAfter && isWrongSelected ? " ❌" : null}
                      </div>

                      {showAfter ? (
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.8,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isCorrectChoice ? "Correct" : "Incorrect"}
                        </div>
                      ) : null}
                    </div>

                    <div style={{ marginTop: 4, lineHeight: 1.45 }}>
                      {choice.choice_text}
                    </div>

                    {showAfter && choice.explanation ? (
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 13,
                          opacity: 0.95,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.45,
                        }}
                      >
                        {choice.explanation}
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
                  isCorrect === true
                    ? "#e9f7ef"
                    : isCorrect === false
                    ? "#fdecea"
                    : "#f7f7f7",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                {isCorrect === true
                  ? "✅ Correct"
                  : isCorrect === false
                  ? "❌ Incorrect"
                  : "Submitted"}
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

              {feedbackBibliography.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    References
                  </div>

                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {feedbackBibliography.map((reference, referenceIndex) => (
                      <li key={referenceIndex} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                          <span style={{ fontWeight: 800 }}>
                            {reference.title ?? "Reference"}
                          </span>
                          {reference.source ? ` — ${reference.source}` : ""}
                          {typeof reference.year === "number"
                            ? ` (${reference.year})`
                            : ""}
                        </div>

                        {reference.url ? (
                          <div
                            style={{
                              fontSize: 13,
                              marginTop: 4,
                              wordBreak: "break-word",
                            }}
                          >
                            <a
                              href={reference.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {reference.url}
                            </a>
                          </div>
                        ) : null}

                        {reference.note ? (
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.85,
                              marginTop: 4,
                              whiteSpace: "pre-wrap",
                            }}
                          >
                            {reference.note}
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
            onClick={() => void submitOrNext()}
            disabled={!canSubmitChoice || isBusy}
            style={{
              marginTop: 14,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #ccc",
              cursor: !canSubmitChoice || isBusy ? "not-allowed" : "pointer",
              width: "100%",
              maxWidth: 340,
            }}
          >
            {isBusy
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