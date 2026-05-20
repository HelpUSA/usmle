/*
 * File: src/app/flashcards/session/page.tsx
 * Responsibility: render the first Flashcards active-recall session scaffold.
 * Current scope: UI-only starter session. Persistent scheduling comes next.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';

type Rating = 'again' | 'hard' | 'good' | 'easy';
type Flashcard = { id: string; tag: string; front: string; answer: string; explanation: string; pearl: string };

const cards: Flashcard[] = [
 { id: 'acetaminophen', tag: 'Pharmacology', front: 'The antidote for acetaminophen overdose is [...].', answer: 'N-acetylcysteine', explanation: 'Replenishes glutathione and helps prevent hepatic injury.', pearl: 'Treat early when overdose is suspected.' },
 { id: 'aortic-stenosis', tag: 'Cardiology', front: 'Aortic stenosis classically radiates to the [...].', answer: 'carotids', explanation: 'The systolic crescendo-decrescendo murmur commonly radiates to the carotid arteries.', pearl: 'Syncope, angina, and dyspnea are late warning symptoms.' },
 { id: 'pheochromocytoma', tag: 'Endocrine', front: 'Episodic headache, sweating, palpitations, and hypertension suggest [...].', answer: 'pheochromocytoma', explanation: 'Catecholamine secretion can cause paroxysmal adrenergic symptoms.', pearl: 'Alpha blockade comes before beta blockade.' },
 { id: 'glycogen', tag: 'Biochemistry', front: 'Glycogen phosphorylase is positively regulated by [...].', answer: 'AMP', explanation: 'AMP signals low energy and stimulates glycogen breakdown.', pearl: 'ATP and glucose-6-phosphate oppose breakdown.' },
];

const ratingCopy: Record<Rating, [string, string]> = { again: ['Again', '<20 min'], hard: ['Hard', '+1 day'], good: ['Good', '+3 days'], easy: ['Easy', '+7 days'] };

export default function FlashcardsSessionPage() {
 const [index, setIndex] = useState(0);
 const [revealed, setRevealed] = useState(false);
 const [ratings, setRatings] = useState<Rating[]>([]);
 const card = cards[index];
 const done = ratings.length >= cards.length;
 const pct = Math.round((ratings.length / cards.length) * 100);
 const counts = useMemo(() => ratings.reduce<Record<Rating, number>>((a, r) => ({ ...a, [r]: a[r] + 1 }), { again: 0, hard: 0, good: 0, easy: 0 }), [ratings]);

 useEffect(() => {
 function onKey(event: KeyboardEvent) {
 if (event.code === 'Space' && !done) { event.preventDefault(); setRevealed((v) => !v); }
 }
 window.addEventListener('keydown', onKey);
 return () => window.removeEventListener('keydown', onKey);
 }, [done]);

 function rate(rating: Rating) {
 if (!revealed) return;
 setRatings((current) => [...current, rating]);
 setRevealed(false);
 setIndex((current) => Math.min(current + 1, cards.length));
 }

 function restart() { setIndex(0); setRevealed(false); setRatings([]); }

 return (
 <main style={page}>
 <header style={header}>
 <div>
 <Link href='/flashcards' style={back}>← Flashcards</Link>
 <h1 style={title}>Quick recall session</h1>
 <p style={muted}>Think first. Tap the card or press Space to reveal.</p>
 </div>
 <div style={counter}>{ratings.length}/{cards.length}</div>
 </header>
 <div style={track}><div style={{ ...fill, width: ${pct}% }} /></div>

 {done ? (
 <section style={summary}>
 <h2 style={summaryTitle}>Session complete</h2>
 <p style={muted}>Starter UI scaffold completed. Persistent due-card scheduling comes next.</p>
 <div style={ratingGrid}>{(Object.keys(ratingCopy) as Rating[]).map((r) => <div key={r} style={ratingSummary}><strong>{counts[r]}</strong><span>{ratingCopy[r][0]}</span></div>)}</div>
 <button onClick={restart} style={primaryButton}>Restart session</button>
 </section>
 ) : card ? (
 <>
 <button type='button' onClick={() => setRevealed(true)} style={flashcard}>
 <div style={tag}>{card.tag}</div>
 <div style={label}>{revealed ? 'Answer' : 'Question'}</div>
 <div style={prompt}>{revealed ? card.answer : card.front}</div>
 {revealed ? <div style={answer}><p>{card.explanation}</p><p><strong>Clinical pearl:</strong> {card.pearl}</p></div> : <div style={hint}>Tap to reveal answer</div>}
 </button>
 <section style={panel}>
 <div style={smallTitle}>{revealed ? 'How well did you remember it?' : 'Reveal the answer before rating.'}</div>
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

