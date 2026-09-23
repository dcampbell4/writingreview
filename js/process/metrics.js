// Measurements derived from a replayed log. Used by process detectors and to
// build a student's process baseline from earlier logs.

import { quotedRanges } from '../text/tokenize.js';

const isTyped = (e) => e.type === 'insert' || e.type === 'replace' || e.type === 'snapshot';

// Non-overlapping windows in which typed insertions add at least `minWords`.
export function typedBursts(rep, windowSec, minWords) {
  const ev = rep.events.filter((e) => isTyped(e) && e.insertedWords > 0);
  const out = [];
  let i = 0;
  while (i < ev.length) {
    let j = i;
    let words = 0;
    while (j < ev.length && ev[j].t - ev[i].t <= windowSec * 1000) { words += ev[j].insertedWords; j++; }
    if (words >= minWords) {
      const events = ev.slice(i, j);
      out.push({ words, start: events[0].t, end: events[events.length - 1].t, events });
      i = j;
    } else i++;
  }
  return out;
}

// Largest amount of typed text added within any window, in words.
export function largestTypedWindow(rep, windowSec) {
  const ev = rep.events.filter((e) => isTyped(e) && e.insertedWords > 0);
  let best = 0;
  let j = 0;
  let sum = 0;
  for (let i = 0; i < ev.length; i++) {
    while (j < ev.length && ev[j].t - ev[i].t <= windowSec * 1000) { sum += ev[j].insertedWords; j++; }
    best = Math.max(best, sum);
    sum -= ev[i].insertedWords;
  }
  return best;
}

export function largestInsertion(rep, windowSec) {
  const paste = Math.max(0, ...rep.events.filter((e) => e.type === 'paste' && !e.internalMove).map((e) => e.insertedWords));
  return Math.max(paste, largestTypedWindow(rep, windowSec));
}

// Typed words per active minute (pastes excluded).
export function typingWpm(rep) {
  const words = rep.events.filter(isTyped).reduce((n, e) => n + e.insertedWords, 0);
  const minutes = rep.activeMs / 60000;
  return minutes > 0.5 ? words / minutes : null;
}

export function sustainedWpm(rep, windowSec) {
  return (largestTypedWindow(rep, windowSec) / windowSec) * 60;
}

// Revision measured over text the student typed (pastes excluded).
export function typedRevisionRatio(rep) {
  const typed = rep.totals.typedChars;
  return typed ? rep.totals.deletedChars / typed : 0;
}

// Uninterrupted writing stretches (no pause longer than idleGap).
export function stretches(rep, idleGapSec) {
  const out = [];
  let cur = null;
  for (const e of rep.textEvents) {
    if (e.type === 'paste') { if (cur) out.push(cur); cur = null; continue; }
    if (!cur || e.t - cur.end > idleGapSec * 1000) {
      if (cur) out.push(cur);
      cur = { start: e.t, end: e.t, inserted: 0, deleted: 0, words: 0, events: [] };
    }
    cur.end = e.t;
    cur.inserted += e.inserted;
    cur.deleted += e.deleted;
    cur.words += e.insertedWords;
    cur.events.push(e);
  }
  if (cur) out.push(cur);
  return out;
}

// Process facts for each paragraph of the final text.
export function paragraphProcess(rep, doc) {
  const quotes = quotedRanges(rep.finalText);
  return doc.paragraphs.map((p) => {
    let edits = 0;
    let pasted = 0;
    let quoted = 0;
    const midEvents = new Set();
    const eventIds = new Set();
    for (let i = p.start; i < p.end && i < rep.chars.length; i++) {
      const ch = rep.chars[i];
      edits += ch.edits;
      if (ch.mid) midEvents.add(ch.ev);
      eventIds.add(ch.ev);
      const ev = rep.events[ch.ev];
      if (ev.type === 'paste' && !ev.internalMove) pasted++;
      if (quotes.some((q) => i >= q.start && i < q.end)) quoted++;
    }
    const len = Math.max(1, p.end - p.start);
    const times = [...eventIds].map((id) => rep.events[id].t);
    const words = p.words.length;
    return {
      index: p.index,
      start: p.start,
      end: p.end,
      words,
      edits,
      midEdits: midEvents.size,
      density: words ? ((edits + midEvents.size) / words) * 100 : 0,
      pastedShare: pasted / len,
      quotedShare: quoted / len,
      eventIds: [...eventIds],
      firstT: times.length ? Math.min(...times) : null,
      lastT: times.length ? Math.max(...times) : null,
    };
  });
}

// Summary of a prior log, stored as part of a student's process baseline.
export function processProfile(rep, config) {
  return {
    largestInsertionWords: largestInsertion(rep, config.insertion.windowSec),
    largestTypedWindowWords: largestTypedWindow(rep, config.insertion.windowSec),
    revisionRatio: rep.revisionRatio,
    typedRevisionRatio: typedRevisionRatio(rep),
    typingWpm: typingWpm(rep),
    sustainedWpm: sustainedWpm(rep, config.speed.windowSec),
  };
}
