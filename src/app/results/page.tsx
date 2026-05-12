/*
 * File: src/app/results/page.tsx
 *
 * Responsibility:
 * - Render the Results / History page.
 * - Load the authenticated user's study sessions.
 * - Show session counts, filters, quick actions, and recent session history.
 * - Let the user resume in-progress sessions or open review for completed sessions.
 *
 * API contract used:
 * - GET /api/sessions
 *
 * Current data limitation:
 * - This page still depends only on the sessions endpoint.
 * - It does not calculate per-session accuracy yet because the sessions endpoint
 *   does not currently return attempt-level aggregates.
 *
 * Important behavior:
 * - This page is client-side because it depends on NextAuth session state and UI filters.
 * - The application route is singular:
 *   - /session/[sessionId]
 *   - /session/[sessionId]/review
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { apiFetch } from "@/lib/apiClient";

type SessionMode = "practice" | "timed_block" | "exam_sim";
type KnownSessionStatus = "in_progress" | "submitted" | "abandoned";

type ModeFilter = "all" | SessionMode;
type StatusFilter = "all" | KnownSessionStatus;

type SessionSummary = {
  session_id: string;
  user_id: string;
  mode: SessionMode | string;
  exam: string;
  language?: string;
  timed?: boolean;
  time_limit_seconds?: number | null;
  status?: KnownSessionStatus | string | null;
  settings_json?: Record<string, unknown> | null;
  started_at?: string | null;
  submitted_at?: string | null;
};

type SessionsResponse = {
  sessions: SessionSummary[];
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return fallback;
}

function modeLabel(mode?: string | null): string {
  switch (mode) {
    case "practice":
      return "Practice";
    case "timed_block":
      return "Timed block";
    case "exam_sim":
      return "Exam simulation";
    default:
      return mode ?? "Unknown mode";
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString();
}

function getComparableTime(value?: string | null): number {
  if (!value) return 0;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

function formatStatus(status?: string | null): string {
  if (!status) return "Unknown";
  if (status === "in_progress") return "In progress";
  if (status === "submitted") return "Completed";
  if (status === "abandoned") return "Abandoned";
  return status;
}

function statusBadgeBackground(status?: string | null): string {
  if (status === "submitted") return "#eefaf0";
  if (status === "in_progress") return "#fff8e1";
  if (status === "abandoned") return "#fef2f2";
  return "#f3f4f6";
}

function statusBorderColor(status?: string | null): string {
  if (status === "submitted") return "#d7f0dc";
  if (status === "in_progress") return "#f0dfab";
  if (status === "abandoned") return "#f5caca";
  return "#e5e7eb";
}

function formatDuration(seconds?: number | null): string {
  if (!seconds || seconds <= 0) {
    return "Untimed";
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
}

function parseModeFilter(value: string): ModeFilter {
  if (
    value === "all" ||
    value === "practice" ||
    value === "timed_block" ||
    value === "exam_sim"
  ) {
    return value;
  }

  return "all";
}

function parseStatusFilter(value: string): StatusFilter {
  if (
    value === "all" ||
    value === "in_progress" ||
    value === "submitted" ||
    value === "abandoned"
  ) {
    return value;
  }

  return "all";
}

export default function ResultsPage() {
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const isAuthLoading = sessionStatus === "loading";
  const isSignedIn = sessionStatus === "authenticated" && !!session?.user?.email;

  const loadSessions = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!isSignedIn) {
      setSessions([]);
      setLoading(false);
      setErr(null);
      return;
    }

    setLoading(true);
    setErr(null);

    try {
      const res = await apiFetch<SessionsResponse>("/api/sessions");
      setSessions(Array.isArray(res.sessions) ? res.sessions : []);
    } catch (error) {
      setErr(getErrorMessage(error, "Failed to load results"));
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [isAuthLoading, isSignedIn]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const aTime = Math.max(
        getComparableTime(a.submitted_at),
        getComparableTime(a.started_at)
      );
      const bTime = Math.max(
        getComparableTime(b.submitted_at),
        getComparableTime(b.started_at)
      );

      return bTime - aTime;
    });
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sortedSessions.filter((sessionItem) => {
      const matchesMode =
        modeFilter === "all" ? true : sessionItem.mode === modeFilter;

      const matchesStatus =
        statusFilter === "all" ? true : sessionItem.status === statusFilter;

      return matchesMode && matchesStatus;
    });
  }, [sortedSessions, modeFilter, statusFilter]);

  const totalSessions = sessions.length;
  const completedSessions = sessions.filter(
    (sessionItem) => sessionItem.status === "submitted"
  ).length;
  const inProgressSessions = sessions.filter(
    (sessionItem) => sessionItem.status === "in_progress"
  ).length;
  const abandonedSessions = sessions.filter(
    (sessionItem) => sessionItem.status === "abandoned"
  ).length;

  const latestOpenSession = useMemo(
    () =>
      sortedSessions.find(
        (sessionItem) => sessionItem.status === "in_progress"
      ) ?? null,
    [sortedSessions]
  );

  const latestCompletedSession = useMemo(
    () =>
      sortedSessions.find((sessionItem) => sessionItem.status === "submitted") ??
      null,
    [sortedSessions]
  );

  return (
    <main
      style={{
        display: "grid",
        gap: 16,
      }}
    >
      <section
        style={{
          padding: 18,
          borderRadius: 22,
          border: "1px solid #e5e7eb",
          background: "linear-gradient(135deg, #ffffff 0%, #fbfcff 100%)",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {isAuthLoading
            ? "Loading session…"
            : isSignedIn
            ? `Signed in as ${session?.user?.email}`
            : "Not signed in"}
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 30,
            lineHeight: 1.08,
            fontWeight: 900,
          }}
        >
          Results
        </h1>

        <p
          style={{
            margin: 0,
            color: "#555",
            lineHeight: 1.65,
            maxWidth: 760,
          }}
        >
          Browse your study history, revisit completed sessions, and resume
          unfinished ones. This version focuses on session history and
          navigation. Score and deeper analytics can be added when the API
          returns attempt-level aggregates.
        </p>
      </section>

      {isAuthLoading ? (
        <section
          style={{
            padding: 18,
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          Loading your account…
        </section>
      ) : !isSignedIn ? (
        <section
          style={{
            padding: 18,
            borderRadius: 20,
            border: "1px solid #e5e7eb",
            background: "white",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 20 }}>
            Sign in to view your results
          </div>

          <p
            style={{
              marginTop: 10,
              marginBottom: 0,
              color: "#555",
              lineHeight: 1.65,
            }}
          >
            Your history is personal. Once signed in, this page can show past
            sessions, completion status, and future session-level performance
            data.
          </p>
        </section>
      ) : (
        <>
          {err ? (
            <section
              style={{
                padding: 16,
                borderRadius: 16,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#9f1239",
              }}
            >
              <div style={{ fontWeight: 900 }}>Error</div>
              <div style={{ marginTop: 6 }}>{err}</div>

              <button
                type="button"
                onClick={() => void loadSessions()}
                style={{
                  ...buttonStyle(),
                  marginTop: 12,
                  background: "white",
                }}
              >
                Try again
              </button>
            </section>
          ) : null}

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
              { label: "Abandoned", value: String(abandonedSessions) },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  padding: 16,
                  borderRadius: 18,
                  border: "1px solid #e5e7eb",
                  background: "white",
                }}
              >
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {card.label}
                </div>

                <div
                  style={{
                    marginTop: 8,
                    fontSize: 26,
                    lineHeight: 1.1,
                    fontWeight: 900,
                  }}
                >
                  {card.value}
                </div>
              </div>
            ))}
          </section>

          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 20 }}>
                Quick actions
              </div>

              <button
                type="button"
                onClick={() => void loadSessions()}
                disabled={loading}
                style={buttonStyle(loading)}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              {latestOpenSession ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(`/session/${latestOpenSession.session_id}`)
                  }
                  style={{
                    ...actionButtonStyle(),
                    border: "1px solid #e7d59d",
                    background: "#fffdf6",
                  }}
                >
                  <div>Resume latest open session</div>
                  <div style={actionSubtextStyle()}>
                    {modeLabel(latestOpenSession.mode)}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/study")}
                  style={actionButtonStyle()}
                >
                  <div>Start a new study session</div>
                  <div style={actionSubtextStyle()}>Open Study</div>
                </button>
              )}

              {latestCompletedSession ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/session/${latestCompletedSession.session_id}/review`
                    )
                  }
                  style={{
                    ...actionButtonStyle(),
                    border: "1px solid #d5ead8",
                    background: "#f8fff9",
                  }}
                >
                  <div>Open latest completed review</div>
                  <div style={actionSubtextStyle()}>
                    {modeLabel(latestCompletedSession.mode)}
                  </div>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/progress")}
                  style={actionButtonStyle()}
                >
                  <div>Open Progress</div>
                  <div style={actionSubtextStyle()}>View study trends</div>
                </button>
              )}
            </div>
          </section>

          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 12,
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 20 }}>Filters</div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>Mode</label>

                <select
                  value={modeFilter}
                  onChange={(event) =>
                    setModeFilter(parseModeFilter(event.target.value))
                  }
                  style={selectStyle()}
                >
                  <option value="all">All modes</option>
                  <option value="practice">Practice</option>
                  <option value="timed_block">Timed block</option>
                  <option value="exam_sim">Exam simulation</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 6 }}>
                <label style={{ fontSize: 13, color: "#555" }}>Status</label>

                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(parseStatusFilter(event.target.value))
                  }
                  style={selectStyle()}
                >
                  <option value="all">All statuses</option>
                  <option value="submitted">Completed</option>
                  <option value="in_progress">In progress</option>
                  <option value="abandoned">Abandoned</option>
                </select>
              </div>
            </div>
          </section>

          <section
            style={{
              padding: 18,
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "white",
              display: "grid",
              gap: 12,
            }}
          >
            <div>
              <div style={{ fontWeight: 900, fontSize: 20 }}>
                Session history
              </div>

              <div
                style={{
                  marginTop: 6,
                  color: "#555",
                  lineHeight: 1.6,
                }}
              >
                {loading
                  ? "Loading your history…"
                  : `${filteredSessions.length} session(s) match the current filters.`}
              </div>
            </div>

            {loading ? (
              <p style={{ margin: 0, color: "#555" }}>Loading results…</p>
            ) : filteredSessions.length === 0 ? (
              <EmptyHistory
                hasAnySession={sessions.length > 0}
                onStart={() => router.push("/study")}
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filteredSessions.map((sessionItem) => (
                  <SessionCard
                    key={sessionItem.session_id}
                    sessionItem={sessionItem}
                    onOpenSession={() =>
                      router.push(`/session/${sessionItem.session_id}`)
                    }
                    onOpenReview={() =>
                      router.push(`/session/${sessionItem.session_id}/review`)
                    }
                    onNewStudy={() => router.push("/study")}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

function EmptyHistory(props: {
  hasAnySession: boolean;
  onStart: () => void;
}) {
  const { hasAnySession, onStart } = props;

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 16,
        border: "1px dashed #d1d5db",
        background: "#fcfcfd",
        color: "#555",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 900, color: "#111827" }}>
        {hasAnySession ? "No sessions match these filters" : "No sessions yet"}
      </div>

      <div>
        {hasAnySession
          ? "Change the filters to see more study history."
          : "Start a study session to begin building your history."}
      </div>

      {!hasAnySession ? (
        <button type="button" onClick={onStart} style={buttonStyle()}>
          Start studying
        </button>
      ) : null}
    </div>
  );
}

function SessionCard(props: {
  sessionItem: SessionSummary;
  onOpenSession: () => void;
  onOpenReview: () => void;
  onNewStudy: () => void;
}) {
  const { sessionItem, onOpenSession, onOpenReview, onNewStudy } = props;

  const isInProgress = sessionItem.status === "in_progress";
  const isSubmitted = sessionItem.status === "submitted";

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 14,
        border: `1px solid ${statusBorderColor(sessionItem.status)}`,
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
          <div style={{ fontWeight: 800, fontSize: 16 }}>
            {modeLabel(sessionItem.mode)}
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 13,
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            Exam: {sessionItem.exam || "—"}
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 13,
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            Timing: {sessionItem.timed ? formatDuration(sessionItem.time_limit_seconds) : "Untimed"}
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 13,
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            Started: {formatDateTime(sessionItem.started_at)}
          </div>

          <div
            style={{
              marginTop: 2,
              fontSize: 13,
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            Submitted: {formatDateTime(sessionItem.submitted_at)}
          </div>
        </div>

        <div
          style={{
            fontSize: 12,
            padding: "5px 8px",
            borderRadius: 999,
            border: "1px solid #ddd",
            background: statusBadgeBackground(sessionItem.status),
          }}
        >
          {formatStatus(sessionItem.status)}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        }}
      >
        {isInProgress ? (
          <>
            <button type="button" onClick={onOpenSession} style={buttonStyle()}>
              Resume session
            </button>

            <button type="button" onClick={onNewStudy} style={buttonStyle()}>
              Open Study
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={isSubmitted ? onOpenReview : onOpenSession}
              style={buttonStyle()}
            >
              {isSubmitted ? "Open review" : "Open session"}
            </button>

            <button type="button" onClick={onNewStudy} style={buttonStyle()}>
              New study session
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function buttonStyle(disabled = false): CSSProperties {
  return {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "white",
    cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700,
    opacity: disabled ? 0.55 : 1,
  };
}

function actionButtonStyle(): CSSProperties {
  return {
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid #d1d5db",
    background: "#fcfcfd",
    cursor: "pointer",
    fontWeight: 800,
    textAlign: "left",
  };
}

function actionSubtextStyle(): CSSProperties {
  return {
    marginTop: 6,
    fontSize: 12,
    color: "#6b7280",
    fontWeight: 600,
  };
}

function selectStyle(): CSSProperties {
  return {
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    background: "white",
  };
}