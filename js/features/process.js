// Composition-process features, from a full event log (capture page, saved
// versions) or, with less detail, from an imported process report (PDF).

import { replay, activitySegments } from '../process/replay.js';
import { normalizeLog } from '../schema.js';
import { countWords } from '../text/tokenize.js';
import { locateExcerpt } from '../import/processReport.js';

export const PROCESS_FEATURES = [
  { id: 'activeMinutes', category: 'process', label: 'Active writing time', unit: 'minutes', digits: 0, minSpread: 8, direction: 'down', weight: 0.6,
    plain: 'time spent actively writing (long pauses excluded)' },
  { id: 'sessions', category: 'process', label: 'Writing sessions', unit: 'sessions', digits: 0, minSpread: 1, direction: 'down', weight: 0.5,
    plain: 'separate sittings (a gap of 30+ minutes starts a new one)' },
  { id: 'typingRate', category: 'process', label: 'Composition speed', unit: 'words per active minute', digits: 1, minSpread: 4, direction: 'up', weight: 0.8,
    plain: 'typed words per active minute (pastes excluded)' },
  { id: 'revisionDensity', category: 'process', label: 'Substantive revision density', unit: 'per 100 final words', digits: 1, minSpread: 1.2, direction: 'down', weight: 1,
    plain: 'edits that change wording, sentences or ideas, per 100 words of the final text' },
  { id: 'surfaceEditRate', category: 'process', label: 'Surface edits (spelling, punctuation, typos)', unit: 'per 100 final words', digits: 1, minSpread: 1.5, direction: 'down', weight: 0.5,
    plain: 'small corrections while typing' },
  { id: 'firstDraftShare', category: 'process', label: 'Final text present in the first substantial draft', unit: '% of final text', digits: 0, minSpread: 10, direction: 'up', weight: 1,
    plain: 'how much of the final wording already existed when the document first reached half its final length' },
  { id: 'retention', category: 'process', label: 'Written text that survived to the end', unit: '% of text written', digits: 0, minSpread: 6, direction: 'up', weight: 0.7,
    plain: 'share of everything typed or inserted that remains in the final version' },
  { id: 'longestContinuous', category: 'process', label: 'Longest uninterrupted, unrevised writing period', unit: 'words', digits: 0, minSpread: 60, direction: 'up', weight: 0.9,
    plain: 'most words added in one stretch with no pauses over a minute and almost no deletions' },
  { id: 'continuousShare', category: 'process', label: 'Final text from long continuous periods', unit: '% of final text', digits: 0, minSpread: 12, direction: 'up', weight: 1,
    plain: 'share of the final text produced in long stretches with almost no revision' },
  { id: 'pastedShare', category: 'external', label: 'Final text that entered by paste or bulk insertion', unit: '% of final text', digits: 0, minSpread: 8, direction: 'up', weight: 1,
    plain: 'share of the final text inserted in large blocks rather than composed in the document' },
  { id: 'largestInsertion', category: 'external', label: 'Largest single insertion', unit: 'words', digits: 0, minSpread: 30, direction: 'up', weight: 1,
    plain: 'most words entering the document in one step' },
  { id: 'pasteEvents', category: 'external', label: 'External paste events (15+ words)', unit: 'events', digits: 0, minSpread: 1, direction: 'up', weight: 0.6,
    plain: 'pastes that did not come from elsewhere in the same document' },
  { id: 'multiParagraphPastes', category: 'external', label: 'Multi-paragraph pastes', unit: 'events', digits: 0, minSpread: 0.8, direction: 'up', weight: 0.8,
    plain: 'single insertions containing more than one paragraph' },
];

const TYPED = new Set(['insert', 'replace']);

function isSurfaceChange(removed, inserted) {
  const a = removed.trim();
  const b = inserted.trim();
  if (!a && !b) return true;
  if (/^[\W_]*$/.test(a) && /^[\W_]*$/.test(b)) return true; // punctuation/whitespace only
  if (a.toLowerCase() === b.toLowerCase()) return true; // capitalisation
  if (!/\s/.test(a) && !/\s/.test(b) && Math.abs(a.length - b.length) <= 2 && a.length <= 14) {
    // small change inside a single word: spelling
    let same = 0;
    while (same < Math.min(a.length, b.length) && a[same] === b[same]) same++;
    return a.length - same <= 3 || b.length - same <= 3;
  }
  return false;
}

// Classifies each deletion/replacement as a surface or substantive edit.
function classifyEdits(rep) {
  let surface = 0;
  let substantive = 0;
  let lastInsertT = -Infinity;
  let docLen = 0;
  const detail = [];
  for (const e of rep.events) {
    const before = docLen;
    docLen = e.charsAfter ?? docLen;
    if (e.type === 'insert' || e.type === 'paste') {
      if (e.mid && e.insertedWords >= 3 && e.type === 'insert') { substantive++; detail.push({ t: e.t, kind: 'substantive', what: 'added words inside earlier text' }); }
      lastInsertT = e.t;
      continue;
    }
    if (!['delete', 'replace', 'snapshot'].includes(e.type) || !e.deleted) {
      if (e.type === 'snapshot' && e.inserted && e.mid && e.insertedWords >= 3) substantive++;
      continue;
    }
    const removed = e.deletedText || '';
    const inserted = e.type === 'delete' ? '' : (e.text && e.type === 'replace' ? e.text : '');
    const atFrontier = e.pos != null && e.pos + (e.length || 0) >= before - 1;
    const quick = e.t - lastInsertT < 15000;
    // Fixing what was just typed (a typo or a single word) is a surface edit.
    if (isSurfaceChange(removed, inserted) || (atFrontier && quick && countWords(removed) <= 1 && !inserted)) {
      surface++;
    } else if (countWords(removed) >= 1 || countWords(inserted) >= 1) {
      substantive++;
      detail.push({ t: e.t, kind: 'substantive', what: `${e.type === 'delete' ? 'deleted' : 'rewrote'} "${removed.slice(0, 60)}${removed.length > 60 ? '…' : ''}"` });
    } else surface++;
  }
  return { surface, substantive, detail };
}

function continuousPeriods(rep, gapSec) {
  const out = [];
  let cur = null;
  for (const e of rep.textEvents) {
    const typed = TYPED.has(e.type) || e.type === 'delete';
    if (!typed) { if (cur) out.push(cur); cur = null; continue; }
    if (!cur || e.t - cur.end > gapSec * 1000) {
      if (cur) out.push(cur);
      cur = { start: e.t, end: e.t, words: 0, inserted: 0, deleted: 0, events: [] };
    }
    cur.end = e.t;
    cur.words += e.insertedWords || 0;
    cur.inserted += e.inserted;
    cur.deleted += e.deleted;
    cur.events.push(e);
  }
  if (cur) out.push(cur);
  return out;
}

function fromLog(log, finalText, config) {
  const c = config.process;
  const { log: norm, problems } = normalizeLog(log);
  if (!norm || !norm.events.length) return { problems, values: null };
  const rep = replay(norm, finalText, config);
  const finalWords = countWords(rep.finalText) || 1;
  const finalChars = rep.chars.length || 1;
  const edits = classifyEdits(rep);

  // Sessions and active time.
  let sessions = rep.textEvents.length ? 1 : 0;
  let activeMs = 0;
  for (let i = 1; i < rep.textEvents.length; i++) {
    const gap = rep.textEvents[i].t - rep.textEvents[i - 1].t;
    if (gap > c.sessionGapMin * 60000) sessions++;
    if (gap <= c.idleGapSec * 1000) activeMs += gap;
  }
  const typedWords = rep.events.filter((e) => TYPED.has(e.type)).reduce((n, e) => n + e.insertedWords, 0);

  // Draft growth: share of the final text present over time.
  const finalCharTimes = rep.chars.map((ch) => rep.events[ch.ev].t).sort((a, b) => a - b);
  const presentAt = (t) => {
    let lo = 0; let hi = finalCharTimes.length;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (finalCharTimes[mid] <= t) lo = mid + 1; else hi = mid; }
    return (lo / finalChars) * 100;
  };
  const halfEvent = rep.events.find((e) => e.wordsAfter >= finalWords * 0.5);
  const firstDraftShare = halfEvent ? presentAt(halfEvent.t) : null;
  const span = Math.max(1, rep.end - rep.start);
  const growth = [0.25, 0.5, 0.75, 1].map((f) => ({ at: f, t: rep.start + span * f, share: presentAt(rep.start + span * f) }));

  // Continuous writing periods.
  const periods = continuousPeriods(rep, c.continuousGapSec);
  const surviving = (events) => events.reduce((n, e) => n + (e.surviving || 0), 0);
  const longPeriods = periods.filter((p) => p.words >= c.continuousMinWords && p.deleted / Math.max(1, p.inserted) <= c.continuousMaxRevision);
  const continuousShare = (surviving(longPeriods.flatMap((p) => p.events)) / finalChars) * 100;
  const longest = longPeriods.concat(periods.filter((p) => p.deleted / Math.max(1, p.inserted) <= c.continuousMaxRevision)).reduce((m, p) => (p.words > (m?.words || 0) ? p : m), null);

  // External insertions (pastes and bulk insertions, incl. between saved versions).
  const bulk = rep.events.filter((e) => ((e.type === 'paste' && !e.internalMove) || (e.type === 'snapshot' && e.insertedWords >= c.bulkInsertWords)) && e.insertedWords >= c.minPasteWords);
  const pastedChars = bulk.reduce((n, e) => n + e.surviving, 0);
  const windowMax = (() => {
    const ev = rep.events.filter((e) => TYPED.has(e.type) && e.insertedWords > 0);
    let best = 0; let j = 0; let sum = 0;
    for (let i = 0; i < ev.length; i++) {
      while (j < ev.length && ev[j].t - ev[i].t <= 60000) { sum += ev[j].insertedWords; j++; }
      best = Math.max(best, sum); sum -= ev[i].insertedWords;
    }
    return best;
  })();
  const largest = Math.max(windowMax, ...bulk.map((e) => e.insertedWords), 0);

  const values = {
    activeMinutes: activeMs / 60000,
    sessions,
    typingRate: activeMs > 30000 ? typedWords / (activeMs / 60000) : null,
    revisionDensity: (edits.substantive / finalWords) * 100,
    surfaceEditRate: (edits.surface / finalWords) * 100,
    firstDraftShare,
    retention: rep.totals.insertedChars ? (finalChars / rep.totals.insertedChars) * 100 : null,
    longestContinuous: longest?.words ?? 0,
    continuousShare,
    pastedShare: (pastedChars / finalChars) * 100,
    largestInsertion: largest,
    pasteEvents: bulk.filter((e) => e.type === 'paste').length,
    multiParagraphPastes: bulk.filter((e) => /\n\s*\S[\s\S]*\n\s*\S/.test(e.text || '') || (e.text || '').split(/\n\s*\n/).filter((x) => x.trim()).length >= 2).length,
  };
  return {
    source: 'log',
    problems: [...problems, ...rep.warnings],
    values,
    rep,
    edits,
    growth,
    periods: periods.map((p) => ({ start: p.start, end: p.end, words: p.words, deleted: p.deleted, inserted: p.inserted, long: longPeriods.includes(p) })),
    insertions: bulk.map((e) => ({ id: e.id, t: e.t, words: e.insertedWords, surviving: e.survivingWords, type: e.type, ranges: e.ranges, internalMove: e.internalMove })),
    segments: activitySegments(rep),
  };
}

function fromReport(report, finalText) {
  const m = report.metrics || {};
  const finalWords = countWords(finalText) || 1;
  const pastes = (report.pastes || []).filter((p) => p.include !== false).map((p) => {
    const range = locateExcerpt(finalText, p.excerpt);
    const words = p.words ?? (p.chars != null ? Math.round(p.chars / 6) : countWords(p.excerpt || ''));
    return { ...p, words, range };
  }).filter((p) => p.words >= 15);
  const pastedWords = pastes.reduce((n, p) => n + (p.range ? countWords(finalText.slice(p.range.start, p.range.end)) : p.words), 0) || m.pastedWords || (m.pastedChars ? Math.round(m.pastedChars / 6) : 0);
  const values = {
    activeMinutes: m.writingMinutes ?? null,
    sessions: m.sessions ?? null,
    typingRate: m.writingMinutes ? Math.max(0, finalWords - pastedWords) / m.writingMinutes : null,
    revisionDensity: null,
    surfaceEditRate: null,
    firstDraftShare: null,
    retention: null,
    longestContinuous: null,
    continuousShare: null,
    pastedShare: Math.min(100, (pastedWords / finalWords) * 100),
    largestInsertion: Math.max(0, ...pastes.map((p) => p.words)),
    pasteEvents: pastes.length || m.pasteCount || 0,
    multiParagraphPastes: pastes.filter((p) => (p.excerpt || '').length > 600).length,
  };
  return {
    source: 'report',
    problems: [],
    values,
    report,
    insertions: pastes.map((p, i) => ({ id: `r${i}`, t: p.time, words: p.words, ranges: p.range ? [{ start: p.range.start, end: p.range.end }] : [], type: 'paste (reported)', excerpt: p.excerpt })),
  };
}

export function computeProcess(processData, finalText, config) {
  if (!processData) return null;
  if (processData.log) return fromLog(processData.log, finalText, config);
  if (processData.report) return fromReport(processData.report, finalText);
  return null;
}
