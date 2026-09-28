/*
 * File: src/app/flashcards/session/page.tsx
 * Responsibility: render the active Flashcards session with full i18n support.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';
import { useLanguage } from '@/context/LanguageContext';

type Rating = 'again' | 'hard' | 'good' | 'easy';
type Flashcard = { id: string; tag: string; front: string; answer: string; explanation: string; pearl: string; review_count?: number; due_at?: string };
type DueResponse = { cards: Flashcard[] };
type ReviewResponse = { review: { card_id: string; rating: Rating; review_count: number; next_due_at: string } };

const DECK_SLUG = 'usmle-starter-rapid-recall';

export default function FlashcardsSessionPage() {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rating, setRating] = useState(false);
  const card = cards[index];
  const done = ratings.length >= cards.length;
  const pct = cards.length > 0 ? Math.round((ratings.length / cards.length) * 100) : 0;
  const counts = useMemo(() => ratings.reduce<Record<Rating, number>>((a, r) => ({ ...a, [r]: a[r] + 1 }), { again: 0, hard: 0, good: 0, easy: 0 }), [ratings]);

  const ratingCopy: Record<Rating, [string, string]> = {
    again: [t("rating_again"), '<20 min'],
    hard: [t("rating_hard"), '+1 day'],
    good: [t("rating_good"), '+3 days'],
    easy: [t("rating_easy"), '+7 days']
  };

  async function loadCards() {
    setLoading(true);
    setError(null);
    setRevealed(false);
    setIndex(0);
    setRatings([]);
    try {
      const data = await apiFetch<DueResponse>('/api/flashcards/due?deck=' + DECK_SLUG + '&limit=10');
      setCards(data.cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("unable_load_flashcards"));
      setCards([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCards();
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.code === 'Space' && !done) { event.preventDefault(); setRevealed((v) => !v); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  async function rate(nextRating: Rating) {
    if (!revealed || !card || rating) return;
    setRating(true);
    try {
      await apiFetch<ReviewResponse>('/api/flashcards/review', { method: 'POST', body: JSON.stringify({ cardId: card.id, rating: nextRating }) });
      setRatings((current) => [...current, nextRating]);
      setRevealed(false);
      setIndex((current) => Math.min(current + 1, cards.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record flashcard review');
    } finally {
      setRating(false);
    }
  }

  function restart() {
    void loadCards();
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <Link href='/flashcards' style={back}>← {t("nav_flashcards")}</Link>
          <h1 style={title}>{t("quick_recall_session")}</h1>
          <p style={muted}>{t("think_first_tap")}</p>
        </div>
        <div style={counter}>{ratings.length}/{cards.length}</div>
      </header>
      <div style={track}><div style={{ ...fill, width: `${pct}%` }} /></div>

      {done ? (
        <section style={summary}>
          <h2 style={summaryTitle}>{t("session_complete")}</h2>
          <p style={muted}>{t("starter_ui_scaffold")}</p>
          <div style={ratingGrid}>{(Object.keys(ratingCopy) as Rating[]).map((r) => <div key={r} style={ratingSummary}><strong>{counts[r]}</strong><span>{ratingCopy[r][0]}</span></div>)}</div>
          <button onClick={restart} style={primaryButton}>{t("restart_session")}</button>
        </section>
      ) : card ? (
        <>
          <button type='button' onClick={() => setRevealed(true)} style={flashcard}>
            <div style={tag}>{card.tag}</div>
            <div style={label}>{revealed ? t("answer_label") : t("question_label")}</div>
            <div style={prompt}>{revealed ? card.answer : card.front}</div>
            {revealed ? <div style={answer}><p>{card.explanation}</p><p><strong>{t("clinical_pearl")}</strong> {card.pearl}</p></div> : <div style={hint}>{t("tap_to_reveal")}</div>}
          </button>
          <section style={panel}>
            <div style={smallTitle}>{revealed ? t("how_well_remember") : t("reveal_before_rating")}</div>
            <div style={ratingGrid}>{(Object.keys(ratingCopy) as Rating[]).map((r) => <button key={r} onClick={() => rate(r)} disabled={!revealed} style={rateButton(!revealed)}><span>{ratingCopy[r][1]}</span><strong>{ratingCopy[r][0]}</strong></button>)}</div>
          </section>
        </>
      ) : null}
    </main>
  );
}

const page: CSSProperties = { maxWidth: 760, margin: '0 auto', padding: '22px 14px 42px' };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 16 };
const back: CSSProperties = { color: '#2563eb', textDecoration: 'none', fontSize: 13, fontWeight: 800 };
const title: CSSProperties = { margin: '8px 0 0', color: '#111827', fontSize: 'clamp(30px, 8vw, 46px)', lineHeight: 1, letterSpacing: '-.05em' };
const muted: CSSProperties = { color: '#6b7280', lineHeight: 1.55 };
const counter: CSSProperties = { alignSelf: 'flex-start', borderRadius: 16, padding: '10px 12px', background: '#111827', color: 'white', fontWeight: 900 };
const track: CSSProperties = { height: 10, borderRadius: 999, background: '#e5e7eb', overflow: 'hidden', marginBottom: 18 };
const fill: CSSProperties = { height: '100%', borderRadius: 999, background: '#2563eb', transition: 'width 180ms ease' };
const flashcard: CSSProperties = { width: '100%', minHeight: 350, textAlign: 'left', border: '1px solid #dbeafe', borderRadius: 30, background: 'linear-gradient(160deg, rgba(37,99,235,.08), rgba(16,185,129,.08)), #fff', padding: '26px 22px', boxShadow: '0 24px 70px rgba(15,23,42,.12)', cursor: 'pointer' };
const tag: CSSProperties = { display: 'inline-flex', borderRadius: 999, padding: '5px 10px', background: '#eff6ff', color: '#1d4ed8', fontSize: 12, fontWeight: 850, marginBottom: 18 };
const label: CSSProperties = { color: '#6b7280', fontSize: 12, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: 12 };
const prompt: CSSProperties = { fontSize: 'clamp(28px, 8vw, 44px)', lineHeight: 1.12, letterSpacing: '-.045em', fontWeight: 900, color: '#111827' };
const hint: CSSProperties = { marginTop: 26, color: '#2563eb', fontSize: 14, fontWeight: 850 };
const answer: CSSProperties = { marginTop: 22, color: '#374151', fontSize: 16, lineHeight: 1.65 };
const panel: CSSProperties = { marginTop: 16, borderRadius: 24, background: 'white', border: '1px solid #e5e7eb', padding: 14, boxShadow: '0 12px 32px rgba(15,23,42,.06)' };
const smallTitle: CSSProperties = { color: '#4b5563', fontSize: 13, fontWeight: 800, marginBottom: 12 };
const ratingGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 };
function rateButton(disabled: boolean): CSSProperties { return { borderRadius: 18, border: '1px solid #d1d5db', background: disabled ? '#f3f4f6' : '#fff', padding: '12px 8px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .45 : 1, display: 'grid', gap: 4, color: '#111827' }; }
const summary: CSSProperties = { borderRadius: 30, border: '1px solid #bbf7d0', background: '#f0fdf4', padding: '34px 22px', textAlign: 'center' };
const summaryTitle: CSSProperties = { margin: 0, color: '#111827', fontSize: 30, letterSpacing: '-.04em' };
const ratingSummary: CSSProperties = { display: 'grid', gap: 4, borderRadius: 16, background: 'white', padding: 12, color: '#374151' };
const primaryButton: CSSProperties = { marginTop: 22, border: 'none', borderRadius: 16, background: '#2563eb', color: 'white', padding: '13px 18px', fontWeight: 850, cursor: 'pointer' };
