"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

type BreakTimerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCompleteBreak: () => void;
};

const TOTAL_BREAK_SECONDS = 55 * 60; // 55 minutes standard USMLE 2026 break pool

export default function BreakTimerModal({ isOpen, onClose, onCompleteBreak }: BreakTimerModalProps) {
  const { t } = useLanguage();
  const [secondsRemaining, setSecondsRemaining] = useState(TOTAL_BREAK_SECONDS);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isOpen && isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0) {
      setIsRunning(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, isRunning, secondsRemaining]);

  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const percentage = Math.round(((TOTAL_BREAK_SECONDS - secondsRemaining) / TOTAL_BREAK_SECONDS) * 100);

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <span style={badgeStyle}>{t("official_break_title")}</span>
          <h2 style={{ margin: "8px 0 4px 0", fontSize: "1.25rem", color: "#0f172a" }}>{t("cumulative_break_time")}</h2>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
            {t("track_break_pool")}
          </p>
        </div>

        <div style={timerContainerStyle}>
          <div style={timerDisplayStyle}>{formattedTime}</div>
          <div style={progressOuterStyle}>
            <div style={{ ...progressInnerStyle, width: `${percentage}%` }} />
          </div>
          <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "6px" }}>
            {55 - Math.floor(secondsRemaining / 60)} {t("minutes_used_of")}
          </div>
        </div>

        <div style={actionRowStyle}>
          {!isRunning ? (
            <button
              onClick={() => setIsRunning(true)}
              style={{ ...buttonStyle, backgroundColor: "#2563eb", color: "#ffffff" }}
            >
              {t("start_break")}
            </button>
          ) : (
            <button
              onClick={() => setIsRunning(false)}
              style={{ ...buttonStyle, backgroundColor: "#f59e0b", color: "#ffffff" }}
            >
              {t("pause_break")}
            </button>
          )}

          <button
            onClick={() => {
              setIsRunning(false);
              onCompleteBreak();
              onClose();
            }}
            style={{ ...buttonStyle, backgroundColor: "#10b981", color: "#ffffff" }}
          >
            {t("finish_break")}
          </button>

          <button
            onClick={onClose}
            style={{ ...buttonStyle, backgroundColor: "#f1f5f9", color: "#475569" }}
          >
            {t("close_button")}
          </button>
        </div>
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
  maxWidth: "460px",
  width: "100%",
  boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: "9999px",
  backgroundColor: "#e0f2fe",
  color: "#0369a1",
  fontSize: "0.75rem",
  fontWeight: 600,
  letterSpacing: "0.025em",
};

const timerContainerStyle: React.CSSProperties = {
  backgroundColor: "#f8fafc",
  borderRadius: "12px",
  padding: "24px 16px",
  textAlign: "center",
  border: "1px solid #e2e8f0",
};

const timerDisplayStyle: React.CSSProperties = {
  fontSize: "3.5rem",
  fontWeight: 700,
  fontFamily: "monospace",
  color: "#0f172a",
  letterSpacing: "-0.05em",
};

const progressOuterStyle: React.CSSProperties = {
  height: "8px",
  width: "100%",
  backgroundColor: "#e2e8f0",
  borderRadius: "9999px",
  overflow: "hidden",
  marginTop: "12px",
};

const progressInnerStyle: React.CSSProperties = {
  height: "100%",
  backgroundColor: "#2563eb",
  transition: "width 0.3s ease",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: "10px",
  border: "none",
  fontWeight: 600,
  fontSize: "0.9rem",
  cursor: "pointer",
  transition: "all 0.2s ease",
  textAlign: "center",
};
