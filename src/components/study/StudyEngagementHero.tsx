import { useLanguage } from "@/context/LanguageContext";

type StudyEngagementHeroProps = {
  signedInLabel: string;
  defaultExamLabel: string;
  defaultModeLabel: string;
  defaultCount: number;
  levelLabel: string;
  levelProgressLabel: string;
  activityLabel: string;
  weeklyValue: string;
  missionProgressPercent: number;
  missionProgressLabel: string;
  activeSessionLabel?: string | null;
  loading: boolean;
  onPrimaryAction: () => void;
};

export function StudyEngagementHero(props: StudyEngagementHeroProps) {
  const { t } = useLanguage();
  const {
    signedInLabel,
    defaultExamLabel,
    defaultModeLabel,
    defaultCount,
    levelLabel,
    levelProgressLabel,
    activityLabel,
    weeklyValue,
    missionProgressPercent,
    missionProgressLabel,
    activeSessionLabel,
    loading,
    onPrimaryAction,
  } = props;

  const hasActiveSession = Boolean(activeSessionLabel);

  return (
    <section
      style={{
        padding: 18,
        borderRadius: 26,
        border: "1px solid #dbeafe",
        background:
          "radial-gradient(circle at top left, #dbeafe 0%, #eff6ff 34%, #ffffff 100%)",
        boxShadow: "0 18px 45px rgba(37, 99, 235, 0.12)",
        display: "grid",
        gap: 16,
        overflow: "hidden",
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
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              color: "#2563eb",
              fontWeight: 900,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            {t("daily_study_arena")}
          </div>

          <h1
            style={{
              margin: "6px 0 0",
              fontSize: 32,
              lineHeight: 1.02,
              fontWeight: 950,
              color: "#0f172a",
            }}
          >
            {t("keep_streak_alive")}
          </h1>

          <div
            style={{
              marginTop: 8,
              color: "#475569",
              lineHeight: 1.5,
              maxWidth: 620,
              fontSize: 14,
            }}
          >
            {signedInLabel} {t("next_block_ready")} {defaultExamLabel}.
          </div>
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 999,
            background: "rgba(255,255,255,0.86)",
            border: "1px solid rgba(37, 99, 235, 0.18)",
            fontWeight: 900,
            color: "#1d4ed8",
            whiteSpace: "nowrap",
          }}
        >
          <div>{levelLabel}</div>
          <div
            style={{
              marginTop: 2,
              fontSize: 11,
              fontWeight: 800,
              color: "#64748b",
            }}
          >
            {levelProgressLabel}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
        }}
      >
        <MetricPill label={t("activity")} value={activityLabel} tone="#f97316" />
        <MetricPill label={t("this_week")} value={weeklyValue} tone="#16a34a" />
        <MetricPill label={t("default_pill")} value={`${defaultCount}Q`} tone="#7c3aed" />
        <MetricPill label={t("mode_pill")} value={defaultModeLabel} tone="#0f766e" />
      </div>

      <div
        style={{
          padding: 14,
          borderRadius: 20,
          background: "rgba(255,255,255,0.82)",
          border: "1px solid rgba(148, 163, 184, 0.28)",
          display: "grid",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 950, color: "#0f172a" }}>
              {t("todays_mission")}
            </div>
            <div style={{ marginTop: 3, fontSize: 13, color: "#64748b" }}>
              {hasActiveSession
                ? `${t("continue_your_run")} (${activeSessionLabel})`
                : t("complete_focused_block")}
            </div>
          </div>

          <div style={{ fontWeight: 950, color: "#1d4ed8" }}>
            {missionProgressLabel}
          </div>
        </div>

        <div
          style={{
            height: 12,
            borderRadius: 999,
            background: "#e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${missionProgressPercent}%`,
              height: "100%",
              borderRadius: 999,
              background: "linear-gradient(90deg, #2563eb, #22c55e)",
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onPrimaryAction}
        disabled={loading}
        style={{
          width: "100%",
          padding: "16px 18px",
          borderRadius: 20,
          border: "1px solid #1d4ed8",
          background: loading
            ? "#bfdbfe"
            : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
          color: "white",
          fontWeight: 950,
          fontSize: 16,
          cursor: loading ? "not-allowed" : "pointer",
          boxShadow: "0 14px 28px rgba(37, 99, 235, 0.24)",
        }}
      >
        {loading
          ? t("starting_session")
          : hasActiveSession
            ? `${t("continue_mode")} ${activeSessionLabel}`
            : t("start_todays_block")}
      </button>
    </section>
  );
}

function MetricPill(props: { label: string; value: string; tone: string }) {
  const { label, value, tone } = props;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 18,
        background: "rgba(255,255,255,0.78)",
        border: "1px solid rgba(148, 163, 184, 0.22)",
      }}
    >
      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ marginTop: 5, fontWeight: 950, color: tone }}>{value}</div>
    </div>
  );
}
