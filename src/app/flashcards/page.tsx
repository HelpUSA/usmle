/*
 * File: src/app/flashcards/page.tsx
 * Responsibility: render the Flashcards landing page and entry point.
 * Current scope: UI scaffold only. API-backed decks come next.
 */

import Link from 'next/link';
import type { CSSProperties } from 'react';

const features = [
 ['Active recall', 'Read an incomplete high-yield fact, think first, then reveal the answer.'],
 ['Game loop', 'Rate recall with Again, Hard, Good, or Easy after each reveal.'],
 ['Mobile-first', 'Large card, clear progress, and simple one-hand controls.'],
];

export default function FlashcardsPage() {
 return (
 <main style={page}>
 <section style={hero}>
 <div style={pill}>New study mode</div>
 <h1 style={title}>Flashcards for rapid USMLE recall</h1>
 <p style={subtitle}>
 A focused active-recall mode: incomplete prompt on the front,
 answer and pearl on the back, then a quick recall rating.
 </p>
 <div style={actions}>
 <Link href='/flashcards/session' style={primary}>Start quick review</Link>
 <Link href='/study' style={secondary}>Back to Study</Link>
 </div>
 </section>

 <section style={grid}>
 {features.map(([name, body]) => (
 <article key={name} style={card}>
 <h2 style={cardTitle}>{name}</h2>
 <p style={cardText}>{body}</p>
 </article>
 ))}
 </section>
 </main>
 );
}

const page: CSSProperties = { maxWidth: 980, margin: '0 auto', padding: '28px 16px 48px' };
const hero: CSSProperties = { borderRadius: 28, border: '1px solid #e5e7eb', background: 'linear-gradient(135deg, rgba(37,99,235,.10), rgba(16,185,129,.10)), #fff', padding: '30px 20px', boxShadow: '0 18px 50px rgba(15,23,42,.08)' };
const pill: CSSProperties = { display: 'inline-flex', borderRadius: 999, padding: '6px 10px', background: '#dbeafe', color: '#1d4ed8', fontSize: 12, fontWeight: 850, marginBottom: 14 };
const title: CSSProperties = { margin: 0, color: '#111827', fontSize: 'clamp(34px, 8vw, 58px)', lineHeight: 1, letterSpacing: '-.055em' };
const subtitle: CSSProperties = { maxWidth: 760, margin: '18px 0 0', color: '#4b5563', fontSize: 17, lineHeight: 1.65 };
const actions: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 26 };
const primary: CSSProperties = { textDecoration: 'none', borderRadius: 16, padding: '13px 18px', background: '#2563eb', color: 'white', fontWeight: 850 };
const secondary: CSSProperties = { textDecoration: 'none', borderRadius: 16, padding: '13px 18px', background: 'white', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 800 };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginTop: 18 };
const card: CSSProperties = { borderRadius: 22, background: 'white', border: '1px solid #e5e7eb', padding: 18, boxShadow: '0 10px 28px rgba(15,23,42,.05)' };
const cardTitle: CSSProperties = { margin: 0, color: '#111827', fontSize: 17 };
const cardText: CSSProperties = { margin: '8px 0 0', color: '#6b7280', lineHeight: 1.55 };
