// Student conference mode: transparent, neutral, conversation-first.
// No levels, no priority, no teacher notes.

import * as store from '../store.js';
import { resultFor } from './common.js';
import { withUnit } from '../analysis/compare.js';
import { MOVES } from '../features/discourse.js';
import { escapeHtml as h, fmtClock } from '../util.js';

const STUDENT_WORDS = {
  largestInsertion: 'The biggest block of text added at once',
  pastedShare: 'How much of the text was added in large blocks',
  revisionDensity: 'How much you reworded and revised while writing',
  surfaceEditRate: 'Small corrections while typing',
  longestContinuous: 'Longest stretch written without stopping or revising',
  continuousShare: 'Text written in long stretches without revising',
  nominalizationRate: 'Nouns made from verbs or adjectives (like "destruction" or "fragility")',
  abstractNounRate: 'Big abstract ideas (power, identity, ideology…)',
  academicRate: 'Academic vocabulary',
  rareWordRate: 'Less common words',
  advancedVerbShare: 'Verbs like "interrogates" or "foregrounds" instead of "shows" or "says"',
  meanSentenceLength: 'Sentence length',
  clauseDensity: 'Clauses packed into each sentence',
  semicolonRate: 'Semicolons',
  dashRate: 'Dashes',
  abstractionIndex: 'How abstract the ideas are',
  reasoningDepth: 'Steps of reasoning after each piece of evidence',
  qualificationPerParagraph: 'Qualifying your claims ("although", "to some extent")',
  counterPerParagraph: 'Discussing other interpretations',
  mechanicsRate: 'Spelling and punctuation habits',
};

function friendly(r) {
  const more = r.rawZ > 0;
  return `<strong>${h(STUDENT_WORDS[r.id] || r.label)}</strong>: in this piece ${h(withUnit(r.current, r.feature))}; in your earlier writing usually about ${h(withUnit(r.baselineMean, r.feature))}${r.basis === 'reference' ? ' (a general reference, because we have no earlier process data for you)' : ''}. That is ${more ? 'more' : 'less'} than usual.`;
}

export function renderConference(app, id) {
  const smp = store.sample(id);
  if (!smp) { app.innerHTML = '<p class="notice">Not found.</p>'; return; }
  const r = resultFor(id);
  const different = r.priority.level === 'HIGH' || r.priority.level === 'MODERATE';
  const items = r.strongest.slice(0, 4);
  const proc = r.current.process;
  const segs = proc?.source === 'log' ? proc.segments.filter((s) => s.kind !== 'minor edits') : [];
  app.innerHTML = `
    <div class="btn-row no-print" style="justify-content:space-between;max-width:860px;margin:0 auto 16px"><a class="btn" href="#/piece/${encodeURIComponent(id)}">← Back to the teacher view</a><button class="btn" onclick="window.print()">Print</button></div>
    <article class="conference stack">
      <h1>Looking at your writing together</h1>
      <p class="lead">${different
        ? 'Your current essay differs from your previous writing in several areas. Let’s look at how your writing process and argument developed.'
        : 'Let’s look at how this piece compares with your earlier writing, and how your writing is developing.'}</p>
      <p class="muted">Writing changes for lots of good reasons: new things we have practised in class, feedback, reading, more time, or a topic you know well. This is a conversation, not a judgement.</p>

      ${items.length ? `<section><h2>What looks different this time</h2>${items.map((x) => `<div class="item">${friendly(x)}</div>`).join('')}</section>` : ''}

      ${segs.length ? `<section><h2>How this piece was written</h2>${segs.map((s) => `<div class="item">${h(fmtClock(s.start))}: ${s.kind === 'paste' ? `${s.words} words were added in one step` : s.kind === 'submitted' ? 'submitted' : s.kind === 'revisions' ? 'you revised and rewrote parts' : `you wrote about ${s.words} words`}</div>`).join('')}</section>` : ''}

      <section><h2>How your argument is built</h2>
        ${r.current.discourse.paragraphs.map((p) => `<div class="item"><span class="muted">Paragraph ${p.index + 1}:</span> ${p.sequence.map((m) => h(MOVES[m].label.toLowerCase())).join(' → ')}</div>`).join('')}
      </section>

      <section><h2>Let’s talk about</h2><ol>${r.conference.map((q) => `<li>${h(q)}</li>`).join('')}</ol></section>
    </article>`;
}
