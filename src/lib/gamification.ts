/*
 * File: src/lib/gamification.ts
 *
 * Responsibility:
 * - Local & authenticated gamification state management.
 * - Manages study streaks, daily goals, XP calculations, and level progression.
 * - Tracks weak area review queue.
 */

export type UserGamificationState = {
  streakDays: number;
  lastActiveDate: string; // YYYY-MM-DD
  dailyGoalQuestions: number;
  dailyGoalFlashcards: number;
  todayQuestionsCount: number;
  todayFlashcardsCount: number;
  totalXp: number;
  level: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  missedQuestionsCount: number;
};

export type ExternalScoreEntry = {
  id: string;
  examType: "NBME Form 25" | "NBME Form 26" | "NBME Form 27" | "NBME Form 28" | "NBME Form 29" | "NBME Form 30" | "NBME Form 31" | "Free 120";
  score: number; // percentage or 3-digit score
  date: string;
  estimatedPassProbability: number;
};

const STORAGE_KEY_GAMIFICATION = "usmle_gamification_v1";
const STORAGE_KEY_SCORES = "usmle_external_scores_v1";

function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function calculateLevelInfo(xp: number): { level: number; currentXp: number; nextLevelXp: number } {
  // 500 XP per level
  const level = Math.floor(xp / 500) + 1;
  const currentXp = xp % 500;
  const nextLevelXp = 500;
  return { level, currentXp, nextLevelXp };
}

export function getDefaultGamificationState(): UserGamificationState {
  const today = getTodayString();
  return {
    streakDays: 3,
    lastActiveDate: today,
    dailyGoalQuestions: 20,
    dailyGoalFlashcards: 15,
    todayQuestionsCount: 12,
    todayFlashcardsCount: 8,
    totalXp: 1450,
    level: 3,
    xpForCurrentLevel: 450,
    xpForNextLevel: 500,
    missedQuestionsCount: 4,
  };
}

export function loadGamificationState(): UserGamificationState {
  if (typeof window === "undefined") {
    return getDefaultGamificationState();
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GAMIFICATION);
    if (!raw) {
      const initial = getDefaultGamificationState();
      localStorage.setItem(STORAGE_KEY_GAMIFICATION, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    const today = getTodayString();
    
    // Auto reset daily counters if new day
    if (parsed.lastActiveDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      if (parsed.lastActiveDate === yesterdayStr) {
        parsed.streakDays += 1;
      } else {
        parsed.streakDays = 1;
      }
      parsed.lastActiveDate = today;
      parsed.todayQuestionsCount = 0;
      parsed.todayFlashcardsCount = 0;
      localStorage.setItem(STORAGE_KEY_GAMIFICATION, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return getDefaultGamificationState();
  }
}

export function addXpAndProgress(xpDelta: number, questionsDelta = 0, flashcardsDelta = 0): UserGamificationState {
  const state = loadGamificationState();
  state.totalXp += xpDelta;
  state.todayQuestionsCount += questionsDelta;
  state.todayFlashcardsCount += flashcardsDelta;

  const { level, currentXp, nextLevelXp } = calculateLevelInfo(state.totalXp);
  state.level = level;
  state.xpForCurrentLevel = currentXp;
  state.xpForNextLevel = nextLevelXp;

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_GAMIFICATION, JSON.stringify(state));
  }
  return state;
}

// ----------------------------------------------------
// NBME / Free 120 Readiness Calculators
// ----------------------------------------------------

export function calculatePassProbability(scorePercent: number): number {
  if (scorePercent >= 75) return 99;
  if (scorePercent >= 70) return 97;
  if (scorePercent >= 65) return 92;
  if (scorePercent >= 60) return 82;
  if (scorePercent >= 55) return 65;
  if (scorePercent >= 50) return 45;
  return 20;
}

export function loadExternalScores(): ExternalScoreEntry[] {
  if (typeof window === "undefined") {
    return [
      { id: "1", examType: "NBME Form 30", score: 68, date: "2026-05-10", estimatedPassProbability: 95 },
      { id: "2", examType: "Free 120", score: 72, date: "2026-05-15", estimatedPassProbability: 98 },
    ];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SCORES);
    if (!raw) {
      const initial: ExternalScoreEntry[] = [
        { id: "1", examType: "NBME Form 30", score: 68, date: "2026-05-10", estimatedPassProbability: 95 },
        { id: "2", examType: "Free 120", score: 72, date: "2026-05-15", estimatedPassProbability: 98 },
      ];
      localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveExternalScore(entry: Omit<ExternalScoreEntry, "id" | "estimatedPassProbability">): ExternalScoreEntry[] {
  const scores = loadExternalScores();
  const passProb = calculatePassProbability(entry.score);
  const newEntry: ExternalScoreEntry = {
    ...entry,
    id: Date.now().toString(),
    estimatedPassProbability: passProb,
  };
  const updated = [newEntry, ...scores];
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY_SCORES, JSON.stringify(updated));
  }
  return updated;
}
