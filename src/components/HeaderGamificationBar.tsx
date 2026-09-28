"use client";

import { useEffect, useState } from "react";
import { loadGamificationState } from "@/lib/gamification";
import type { UserGamificationState } from "@/lib/gamification";

export default function HeaderGamificationBar() {
  const [state, setState] = useState<UserGamificationState | null>(null);

  useEffect(() => {
    setState(loadGamificationState());
  }, []);

  if (!state) return null;

  const pctGoal = Math.min(100, Math.round((state.todayQuestionsCount / state.dailyGoalQuestions) * 100));

  return (
    <div style={containerStyle}>
      <div style={badgeStyle}>
        <span style={{ fontSize: "1rem" }}>🔥</span>
        <span style={{ fontWeight: 700, color: "#ea580c" }}>{state.streakDays}</span>
        <span style={{ color: "#475569", fontSize: "0.8rem" }}>day streak</span>
      </div>

      <div style={badgeStyle}>
        <span style={{ fontSize: "1rem" }}>⭐</span>
        <span style={{ fontWeight: 700, color: "#2563eb" }}>Lvl {state.level}</span>
        <span style={{ color: "#64748b", fontSize: "0.8rem" }}>
          ({state.xpForCurrentLevel}/{state.xpForNextLevel} XP)
        </span>
      </div>

      <div style={goalContainerStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", fontSize: "0.75rem", fontWeight: 600 }}>
          <span style={{ color: "#334155" }}>Daily Goal: {state.todayQuestionsCount}/{state.dailyGoalQuestions} Qs</span>
          <span style={{ color: "#2563eb" }}>{pctGoal}%</span>
        </div>
        <div style={progressTrackStyle}>
          <div style={{ ...progressFillStyle, width: `${pctGoal}%` }} />
        </div>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "8px 16px",
  marginBottom: "16px",
  flexWrap: "wrap",
};

const badgeStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "0.85rem",
  backgroundColor: "#f8fafc",
  padding: "4px 10px",
  borderRadius: "8px",
  border: "1px solid #f1f5f9",
};

const goalContainerStyle: React.CSSProperties = {
  flex: 1,
  minWidth: "180px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const progressTrackStyle: React.CSSProperties = {
  height: "6px",
  width: "100%",
  backgroundColor: "#e2e8f0",
  borderRadius: "9999px",
  overflow: "hidden",
};

const progressFillStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "#2563eb",
  borderRadius: "9999px",
  transition: "width 0.3s ease",
};
