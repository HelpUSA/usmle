"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { apiFetch } from "@/lib/apiClient";
import type { FlashcardDeckSummary } from "@/lib/flashcards";
import { useLanguage } from "@/context/LanguageContext";

const DEFAULT_DECKS: FlashcardDeckSummary[] = [
  {
    id: "usmle-starter-rapid-recall",
    slug: "usmle-starter-rapid-recall",
    title: "USMLE Rapid Recall Starter",
    description: "High-yield core concepts across Step 1, Step 2, and Step 3.",
    exam: "step1",
    active_cards: 6,
    due_cards: 6,
  },
  {
    id: "cardiology-high-yield",
    slug: "cardiology-high-yield",
    title: "Cardiology & Vascular Medicine",
    description: "Murmurs, antiarrhythmics, heart failure, and EKG pearls.",
    exam: "step1",
    active_cards: 5,
    due_cards: 5,
  },
  {
    id: "pharmacology-antidotes",
    slug: "pharmacology-antidotes",
    title: "Pharmacology Antidotes & Tox",
    description: "Essential antidotes, toxicities, and mechanism of actions.",
    exam: "step1",
    active_cards: 5,
    due_cards: 5,
  },
  {
    id: "nutrition-science-2026",
    slug: "nutrition-science-2026",
    title: "USMLE 2026 Nutrition Science",
    description: "Vitamin deficiencies, metabolic pathways, and dietetics.",
    exam: "step1",
    active_cards: 5,
    due_cards: 5,
  },
  {
    id: "endocrine-metabolism",
    slug: "endocrine-metabolism",
    title: "Endocrine & Metabolic Disorders",
    description: "Adrenal, thyroid, pituitary, and diabetes high-yield cards.",
    exam: "step2ck",
    active_cards: 4,
    due_cards: 4,
  },
];

export default function FlashcardsPage() {
  const { t } = useLanguage();
  const [decks, setDecks] = useState<FlashcardDeckSummary[]>(DEFAULT_DECKS);
  const [selectedExam, setSelectedExam] = useState<string>("all");

  useEffect(() => {
    async function loadDecks() {
      try {
        const res = await apiFetch<{ decks: FlashcardDeckSummary[] }>("/api/flashcards/decks");
        if (Array.isArray(res.decks) && res.decks.length > 0) {
          setDecks(res.decks);
        }
      } catch {
        // Fallback decks used
      }
    }
    void loadDecks();
  }, []);

  const filteredDecks = decks.filter(
    (deck) => selectedExam === "all" || deck.exam.toLowerCase() === selectedExam.toLowerCase()
  );

  return (
    <main style={page}>
      <section style={hero}>
        <div style={pill}>{t("flashcards_hero_tag")}</div>
        <h1 style={title}>{t("flashcards_hero_title")}</h1>
        <p style={subtitle}>
          {t("flashcards_hero_subtitle")}
        </p>

        <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["all", "step1", "step2ck"].map((step) => (
            <button
              key={step}
              onClick={() => setSelectedExam(step)}
              style={{
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                backgroundColor: selectedExam === step ? "#2563eb" : "#ffffff",
                color: selectedExam === step ? "#ffffff" : "#475569",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              {step === "all" ? t("all_subjects") : step.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={actions}>
          <Link href="/flashcards/session?deck=usmle-starter-rapid-recall" style={primary}>
            {t("start_rapid_review")}
          </Link>
          <Link href="/study" style={secondary}>
            {t("back_to_study")}
          </Link>
        </div>
      </section>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: 28, marginBottom: 14, color: "#0f172a" }}>
        {t("available_decks")} ({filteredDecks.length})
      </h2>

      <section style={grid}>
        {filteredDecks.map((deck) => (
          <article key={deck.slug} style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
              <span style={deckExamTag}>{deck.exam.toUpperCase()}</span>
              <span style={deckCardBadge}>{deck.active_cards} {t("cards_count")}</span>
            </div>
            <h3 style={cardTitle}>{deck.title}</h3>
            <p style={cardText}>{deck.description}</p>

            <Link
              href={`/flashcards/session?deck=${deck.slug}`}
              style={deckStartBtn}
            >
              {t("start_deck")}
            </Link>
          </article>
        ))}
      </section>
    </main>
  );
}

const page: CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "28px 16px 48px" };
const hero: CSSProperties = {
  borderRadius: 24,
  border: "1px solid #e5e7eb",
  background: "linear-gradient(135deg, rgba(37,99,235,.08), rgba(16,185,129,.08)), #fff",
  padding: "30px 20px",
  boxShadow: "0 10px 30px rgba(15,23,42,.05)",
};
const pill: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "6px 12px",
  background: "#dbeafe",
  color: "#1d4ed8",
  fontSize: 12,
  fontWeight: 850,
  marginBottom: 14,
};
const title: CSSProperties = { margin: 0, color: "#111827", fontSize: "clamp(30px, 6vw, 48px)", lineHeight: 1.1, letterSpacing: "-.04em" };
const subtitle: CSSProperties = { maxWidth: 760, margin: "14px 0 0", color: "#4b5563", fontSize: 16, lineHeight: 1.6 };
const actions: CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24 };
const primary: CSSProperties = { textDecoration: "none", borderRadius: 14, padding: "12px 18px", background: "#2563eb", color: "white", fontWeight: 800 };
const secondary: CSSProperties = { textDecoration: "none", borderRadius: 14, padding: "12px 18px", background: "white", color: "#374151", border: "1px solid #e5e7eb", fontWeight: 700 };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 };
const card: CSSProperties = { borderRadius: 18, background: "white", border: "1px solid #e5e7eb", padding: 18, display: "flex", flexDirection: "column", gap: 8 };
const cardTitle: CSSProperties = { margin: 0, color: "#111827", fontSize: 17, fontWeight: 700 };
const cardText: CSSProperties = { margin: 0, color: "#6b7280", fontSize: "0.85rem", lineHeight: 1.5, flex: 1 };
const deckExamTag: CSSProperties = { fontSize: "0.7rem", fontWeight: 700, color: "#2563eb", backgroundColor: "#eff6ff", padding: "3px 8px", borderRadius: "999px" };
const deckCardBadge: CSSProperties = { fontSize: "0.75rem", color: "#64748b", fontWeight: 600 };
const deckStartBtn: CSSProperties = { textDecoration: "none", padding: "10px", borderRadius: "10px", backgroundColor: "#f8fafc", color: "#2563eb", textAlign: "center", fontWeight: 700, fontSize: "0.85rem", border: "1px solid #e2e8f0", marginTop: 12 };
