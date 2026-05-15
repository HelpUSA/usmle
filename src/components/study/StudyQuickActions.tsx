type StudyQuickActionsProps = {
  defaultExamLabel: string;
  defaultCount: number;
  loading: boolean;
  onPractice: () => void;
  onTimedBlock: () => void;
  onPartialSimulation: () => void;
  onSettings: () => void;
};

export function StudyQuickActions(props: StudyQuickActionsProps) {
  const {
    defaultExamLabel,
    defaultCount,
    loading,
    onPractice,
    onTimedBlock,
    onPartialSimulation,
    onSettings,
  } = props;

  return (
    <section
      style={{
        padding: 18,
        borderRadius: 24,
        border: "1px solid #e5e7eb",
        background: "white",
        display: "grid",
        gap: 14,
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.05)",
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
        <div>
          <div style={{ fontWeight: 950, fontSize: 22, color: "#0f172a" }}>
            Quick start
          </div>
          <div
            style={{
              marginTop: 5,
              color: "#64748b",
              lineHeight: 1.5,
              fontSize: 14,
            }}
          >
            Pick the next move for {defaultExamLabel}. Built for short,
            high-frequency mobile sessions.
          </div>
        </div>

        <button
          type="button"
          onClick={onSettings}
          style={{
            padding: "10px 12px",
            borderRadius: 999,
            border: "1px solid #e2e8f0",
            background: "#f8fafc",
            color: "#334155",
            cursor: "pointer",
            fontWeight: 850,
          }}
        >
          Settings
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        }}
      >
        <ActionCard
          emoji="⚡"
          title="Practice"
          subtitle={`${defaultCount} questions`}
          accent="#16a34a"
          disabled={loading}
          onClick={onPractice}
        />
        <ActionCard
          emoji="⏱️"
          title="Timed block"
          subtitle="20Q / 30 min"
          accent="#d97706"
          disabled={loading}
          onClick={onTimedBlock}
        />
        <ActionCard
          emoji="🔥"
          title="Simulation"
          subtitle="Partial USMLE 2026"
          accent="#dc2626"
          disabled={loading}
          onClick={onPartialSimulation}
        />
        <ActionCard
          emoji="🎯"
          title="Review"
          subtitle="Missed & recent"
          accent="#7c3aed"
          disabled={true}
          onClick={() => undefined}
          badge="Soon"
        />
      </div>
    </section>
  );
}

function ActionCard(props: {
  emoji: string;
  title: string;
  subtitle: string;
  accent: string;
  disabled: boolean;
  onClick: () => void;
  badge?: string;
}) {
  const { emoji, title, subtitle, accent, disabled, onClick, badge } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 118,
        padding: 14,
        borderRadius: 20,
        border: `1px solid ${accent}33`,
        background: disabled
          ? "#f8fafc"
          : `linear-gradient(135deg, ${accent}12 0%, #ffffff 100%)`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.62 : 1,
        textAlign: "left",
        display: "grid",
        alignContent: "space-between",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 28 }}>{emoji}</span>
        {badge ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: accent,
              background: "white",
              border: `1px solid ${accent}33`,
              borderRadius: 999,
              padding: "4px 7px",
            }}
          >
            {badge}
          </span>
        ) : null}
      </div>

      <div>
        <div style={{ fontWeight: 950, color: "#0f172a", fontSize: 16 }}>
          {title}
        </div>
        <div style={{ marginTop: 4, color: "#64748b", fontSize: 13 }}>
          {subtitle}
        </div>
      </div>
    </button>
  );
}
