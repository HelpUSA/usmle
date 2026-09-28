"use client";

import { useState } from "react";
import { saveExternalScore, calculatePassProbability } from "@/lib/gamification";
import type { ExternalScoreEntry } from "@/lib/gamification";
import { useLanguage } from "@/context/LanguageContext";

type ScoreLoggerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onScoreSaved: (scores: ExternalScoreEntry[]) => void;
};

const EXAM_OPTIONS: ExternalScoreEntry["examType"][] = [
  "NBME Form 25",
  "NBME Form 26",
  "NBME Form 27",
  "NBME Form 28",
  "NBME Form 29",
  "NBME Form 30",
  "NBME Form 31",
  "Free 120",
];

export default function ScoreLoggerModal({ isOpen, onClose, onScoreSaved }: ScoreLoggerModalProps) {
  const { t } = useLanguage();
  const [examType, setExamType] = useState<ExternalScoreEntry["examType"]>("NBME Form 30");
  const [score, setScore] = useState<number>(68);

  if (!isOpen) return null;

  const currentProbability = calculatePassProbability(score);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const updated = saveExternalScore({
      examType,
      score,
      date: new Date().toISOString().split("T")[0],
    });
    onScoreSaved(updated);
    onClose();
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ textAlign: "center" }}>
          <span style={badgeStyle}>{t("readiness_predictor")}</span>
          <h2 style={{ margin: "8px 0 4px 0", fontSize: "1.25rem", color: "#0f172a" }}>
            {t("log_external_exam")}
          </h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            {t("enter_nbme_score")}
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>{t("select_exam")}</label>
            <select
              value={examType}
              onChange={(e) => setExamType(e.target.value as ExternalScoreEntry["examType"])}
              style={selectStyle}
            >
              {EXAM_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>{t("correct_percentage")}</label>
            <input
              type="number"
              min="0"
              max="100"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              style={inputStyle}
            />
          </div>

          <div style={previewBoxStyle}>
            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>{t("estimated_pass_prob")}</div>
            <div style={{ fontSize: "2rem", fontWeight: 700, color: currentProbability >= 90 ? "#10b981" : "#f59e0b" }}>
              {currentProbability}%
            </div>
            <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
              {t("based_on_correlation")}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
            <button type="submit" style={submitButtonStyle}>
              {t("save_exam_score")}
            </button>
            <button type="button" onClick={onClose} style={cancelButtonStyle}>
              {t("cancel_button")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(4px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "16px",
};

const modalStyle: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  padding: "24px",
  maxWidth: "440px",
  width: "100%",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "9999px",
  backgroundColor: "#f0fdf4",
  color: "#166534",
  fontSize: "0.75rem",
  fontWeight: 600,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.85rem",
  fontWeight: 600,
  color: "#334155",
  marginBottom: "6px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "0.9rem",
  backgroundColor: "#ffffff",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "8px",
  border: "1px solid #cbd5e1",
  fontSize: "1rem",
};

const previewBoxStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "12px",
  padding: "16px",
  textAlign: "center",
};

const submitButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: "12px",
  backgroundColor: "#2563eb",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
};

const cancelButtonStyle: React.CSSProperties = {
  padding: "12px 16px",
  backgroundColor: "#f1f5f9",
  color: "#475569",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
};
