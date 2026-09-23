// Replays a writing-process log. Every character of the final text keeps a
// record of the event that inserted it, so any flag can be traced back to
// concrete moments in the writing process.

import { countWords } from '../text/tokenize.js';

export function replay(log, submittedText = null, config = null) {
  const idleGapMs = (config?.general?.idleGapSec ?? 120) * 1000;
  const events = log.events.map((e) => ({
    ...e,
    inserted: 0, deleted: 0, insertedWords: 0, surviving: 0, survivingWords: 0,
    mid: false, internalMove: false, wordsAfter: 0, charsAfter: 0, deletedText: '',
  }));
  let chars = []; // { c, ev, mid, edits }
  const deletions = []; // { t, text } for detecting cut-and-paste of the student's own text
  const warnings = [];

  const insertAt = (ev, pos, text) => {
    const p = Math.min(pos, chars.length);
    if (pos > chars.length) warnings.push(`Event ${ev.id + 1} inserts beyond the end of the document.`);
    const mid = p < chars.length && chars.slice(p).some((ch) => /\S/.test(ch.c));
    const items = Array.from(text).map((c) => ({ c, ev: ev.id, mid, edits: 0 }));
    chars.splice(p, 0, ...items);
    ev.inserted += items.length;
    ev.insertedWords += countWords(text);
    if (mid) ev.mid = true;
    if (p > 0) chars[p - 1].edits += mid ? 1 : 0;
  };

  const deleteAt = (ev, pos, length) => {
    if (length <= 0) return;
    if (pos + length > chars.length) warnings.push(`Event ${ev.id + 1} deletes beyond the end of the document.`);
    const removed = chars.splice(pos, length);
    const text = removed.map((ch) => ch.c).join('');
    ev.deleted += removed.length;
    ev.deletedText += text;
    deletions.push({ t: ev.t, text });
    // Attribute the edit to the neighbouring surviving character.
    const neighbour = chars[pos - 1] || chars[pos];
    if (neighbour) neighbour.edits += 1;
  };

  for (const ev of events) {
    switch (ev.type) {
      case 'insert':
      case 'paste':
        if (ev.type === 'paste') ev.internalMove = isInternalMove(ev.text, deletions);
        insertAt(ev, ev.pos, ev.text);
        break;
      case 'delete':
        deleteAt(ev, ev.pos, ev.length);
        break;
      case 'replace':
        deleteAt(ev, ev.pos, ev.length);
        insertAt(ev, ev.pos, ev.text);
        break;
      case 'snapshot': {
        const current = chars.map((ch) => ch.c).join('');
        const d = diff(current, ev.text);
        if (d) {
          deleteAt(ev, d.pos, d.removed);
          if (d.inserted) insertAt(ev, d.pos, d.inserted);
        }
        break;
      }
      default:
        break;
    }
    ev.charsAfter = chars.length;
    ev.wordsAfter = countWords(chars.map((ch) => ch.c).join(''));
  }

  const finalText = chars.map((ch) => ch.c).join('');
  // Surviving characters and ranges per event.
  const rangesByEvent = new Map();
  chars.forEach((ch, i) => {
    const ev = events[ch.ev];
    ev.surviving += 1;
    const list = rangesByEvent.get(ch.ev) || [];
    const last = list[list.length - 1];
    if (last && last.end === i) last.end = i + 1; else list.push({ start: i, end: i + 1 });
    rangesByEvent.set(ch.ev, list);
  });
  for (const [id, ranges] of rangesByEvent) {
    events[id].ranges = ranges;
    events[id].survivingWords = ranges.reduce((n, r) => n + countWords(finalText.slice(r.start, r.end)), 0);
  }
  events.forEach((e) => { if (!e.ranges) e.ranges = []; });

  let matchesSubmission = true;
  if (submittedText != null && normalize(submittedText) !== normalize(finalText)) {
    matchesSubmission = false;
    warnings.unshift('The event log does not rebuild the submitted text exactly. Process signals may be incomplete.');
  }

  const textEvents = events.filter((e) => ['insert', 'paste', 'delete', 'replace', 'snapshot'].includes(e.type));
  const start = events[0]?.t ?? 0;
  const end = events[events.length - 1]?.t ?? 0;
  let activeMs = 0;
  for (let i = 1; i < textEvents.length; i++) {
    const gap = textEvents[i].t - textEvents[i - 1].t;
    if (gap <= idleGapMs) activeMs += gap;
  }

  const totals = {
    insertedChars: events.reduce((n, e) => n + e.inserted, 0),
    deletedChars: events.reduce((n, e) => n + e.deleted, 0),
    typedChars: events.filter((e) => e.type !== 'paste').reduce((n, e) => n + e.inserted, 0),
    pastedSurvivingChars: events.filter((e) => e.type === 'paste' && !e.internalMove).reduce((n, e) => n + e.surviving, 0),
  };

  return {
    events,
    textEvents,
    chars,
    finalText,
    matchesSubmission,
    warnings,
    start,
    end,
    activeMs,
    totals,
    revisionRatio: totals.insertedChars ? totals.deletedChars / totals.insertedChars : 0,
  };
}

function normalize(s) {
  return s.replace(/\r\n/g, '\n').replace(/\s+$/g, '').replace(/[ \t]+\n/g, '\n');
}

// Minimal single-region diff: common prefix + common suffix.
export function diff(a, b) {
  if (a === b) return null;
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0;
  while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  return { pos: p, removed: a.length - p - s, inserted: b.slice(p, b.length - s) };
}

function isInternalMove(text, deletions) {
  const t = text.trim();
  if (t.length < 20) return false;
  return deletions.some((d) => d.text.includes(t) || (d.text.trim().length >= 20 && t.includes(d.text.trim()) && d.text.trim().length / t.length > 0.8));
}

// Helpers used by detectors and the UI.
export function wordsInRanges(text, ranges) {
  return ranges.reduce((n, r) => n + countWords(text.slice(r.start, r.end)), 0);
}

export function mergeRanges(ranges) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

// Groups text events into readable activity segments for the timeline.
export function activitySegments(rep, gapMs = 60000) {
  const segs = [];
  let cur = null;
  const close = () => { if (cur) segs.push(cur); cur = null; };
  for (const e of rep.events) {
    if (e.type === 'submit') {
      close();
      segs.push({ kind: 'submitted', start: e.t, end: e.t, events: [e], wordsAfter: e.wordsAfter, added: 0, deleted: 0 });
      continue;
    }
    if (!['insert', 'paste', 'delete', 'replace', 'snapshot'].includes(e.type)) continue;
    const isPaste = e.type === 'paste' && !e.internalMove;
    if (isPaste || !cur || e.t - cur.end > gapMs || cur.kind === 'paste') close();
    if (!cur) cur = { kind: isPaste ? 'paste' : 'writing', start: e.t, end: e.t, events: [], added: 0, deleted: 0, wordsBefore: e.wordsAfter - (e.insertedWords || 0) };
    cur.events.push(e);
    cur.end = e.t;
    cur.added += e.inserted;
    cur.deleted += e.deleted;
    cur.wordsAfter = e.wordsAfter;
    if (isPaste) close();
  }
  close();
  for (const s of segs) {
    if (s.kind === 'writing') {
      const ratio = s.added ? s.deleted / s.added : 1;
      if (s.added < 40) s.kind = 'minor edits';
      else if (ratio > 0.35) s.kind = 'revisions';
    }
    s.ranges = mergeRanges(s.events.flatMap((e) => e.ranges || []));
  }
  return segs;
}
