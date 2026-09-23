// Detectors for imported process *reports* (e.g. a Google Docs add-on PDF).
// Reports give summary figures and paste excerpts rather than a full event
// log, so these detectors are deliberately fewer and more cautious.

import { makeSignal, grade, fmtTime, fmtNum, pct, plural } from '../util.js';
import { locateExcerpt } from '../import/processReport.js';
import { countWords, quotedRanges } from '../text/tokenize.js';

const CHARS_PER_WORD = 6; // rough conversion when a report gives characters only

// Resolves each included paste: where it sits in the final text and how big it is.
export function resolvePastes(report, text) {
  const quotes = quotedRanges(text);
  return (report.pastes || []).filter((p) => p.include !== false).map((p, i) => {
    const range = locateExcerpt(text, p.excerpt);
    let words = p.words;
    let wordsSource = 'reported';
    if (words == null && p.chars != null) { words = Math.round(p.chars / CHARS_PER_WORD); wordsSource = `estimated from ${p.chars} characters`; }
    if (words == null && p.excerpt) { words = countWords(p.excerpt); wordsSource = 'counted from the excerpt'; }
    let quoteShare = 0;
    if (range) {
      const len = range.end - range.start;
      const inQuotes = quotes.reduce((n, q) => n + Math.max(0, Math.min(range.end, q.end) - Math.max(range.start, q.start)), 0);
      quoteShare = len ? inQuotes / len : 0;
    } else if (p.excerpt && /^["“]/.test(p.excerpt.trim())) quoteShare = 1;
    return { ...p, index: i, range, words: words ?? 0, wordsSource, quoteShare, inFinal: range ? countWords(text.slice(range.start, range.end)) : null };
  });
}

const sourceNote = (report) => `From the imported ${report.tool && report.tool !== 'Tool not recognised' ? report.tool + ' ' : ''}report${report.fileName ? ` (${report.fileName})` : ''}.`;

export const reportDetectors = [
  {
    id: 'report-paste',
    category: 'process',
    name: 'Paste event (reported)',
    requires: ['report'],
    run(ctx) {
      const { report, text, config } = ctx;
      const c = config.paste;
      return resolvePastes(report, text).filter((p) => p.words >= c.minWords).map((p) => {
        const adjustments = [];
        let severity = grade(p.words, c.mediumWords, c.highWords);
        if (p.quoteShare >= c.quoteShareDowngrade) {
          severity = 'Low';
          adjustments.push(`${pct(p.quoteShare)} of the pasted text is inside quotation marks (probably quoted evidence), so severity is set to Low.`);
        } else if (p.excerpt && !p.range) {
          adjustments.push('The pasted excerpt was not found in the submitted text; it may have been rewritten or removed later.');
          if (severity === 'High') severity = 'Medium';
        }
        const large = p.words >= c.largeWords;
        return makeSignal({
          id: `report-paste-${p.index}`,
          detector: 'report-paste',
          category: 'process',
          name: large ? 'Large insertion (paste, reported)' : 'Paste event (reported)',
          severity,
          finding: `The report lists a paste of about ${p.words} words${p.time ? ` at ${fmtTime(p.time)}` : ''}${p.range ? `; ${p.inFinal} of those words appear in the submitted text` : ''}.`,
          evidence: [
            ...(p.time ? [{ label: 'Time', value: new Date(p.time).toLocaleString() }] : []),
            { label: 'Size', value: `${p.words} words (${p.wordsSource})` },
            { label: 'Found in submitted text', value: p.range ? `Yes (${p.inFinal} words matched)` : p.excerpt ? 'No' : 'No excerpt in the report' },
            { label: 'Share inside quotation marks', value: pct(p.quoteShare) },
            { label: 'Report line', value: p.line },
          ],
          baseline: null,
          explanation: 'The imported report records a substantial amount of text entering the document through a paste, so how that passage was drafted is not visible.',
          alternatives: [
            'Drafted in another document, notes app or on paper, then pasted in.',
            'Moved or restructured their own text (reports do not always distinguish this).',
            'Pasted a quotation or source material to cite.',
          ],
          rule: `Counted from ${c.minWords} words; Medium at ${c.mediumWords}; High at ${c.highWords}. ${sourceNote(report)}`,
          adjustments,
          ranges: p.range ? [{ start: p.range.start, end: p.range.end }] : [],
          time: p.time ? { start: p.time, end: p.time } : null,
          tags: ['insertion'],
        });
      });
    },
  },
  {
    id: 'report-paste-share',
    category: 'process',
    name: 'Share of text pasted (reported)',
    requires: ['report'],
    run(ctx) {
      const { report, text, config, doc } = ctx;
      const c = config.report;
      if (doc.wordCount < c.minWords) return [];
      const pastes = resolvePastes(report, text).filter((p) => p.quoteShare < config.paste.quoteShareDowngrade);
      let pasted = pastes.reduce((n, p) => n + (p.inFinal ?? p.words), 0);
      let basis = `${plural(pastes.length, 'listed paste')} (quotations excluded)`;
      if (!pastes.length && report.metrics?.pastedWords) { pasted = report.metrics.pastedWords; basis = 'the report’s "words pasted" figure'; }
      if (!pastes.length && !pasted && report.metrics?.pastedChars) { pasted = Math.round(report.metrics.pastedChars / CHARS_PER_WORD); basis = 'the report’s "characters pasted" figure (estimated words)'; }
      const share = Math.min(1, pasted / doc.wordCount);
      if (share < c.pasteShareMedium) return [];
      return [makeSignal({
        id: 'report-paste-share',
        detector: 'report-paste-share',
        category: 'process',
        name: 'Share of text pasted (reported)',
        severity: share >= c.pasteShareHigh ? 'High' : 'Medium',
        finding: `About ${pct(share)} of the submitted text (${pasted} of ${doc.wordCount} words) entered through pastes.`,
        evidence: [
          { label: 'Pasted words', value: `${pasted}, based on ${basis}` },
          { label: 'Submitted words', value: doc.wordCount },
        ],
        explanation: 'A large part of the finished text did not develop inside the document.',
        alternatives: ['The student drafts elsewhere (another app, offline, or on a phone) and pastes in.', 'Text was moved between documents the student owns.'],
        rule: `Medium at ${pct(c.pasteShareMedium)} of the text, High at ${pct(c.pasteShareHigh)}. ${sourceNote(report)}`,
        ranges: pastes.filter((p) => p.range).map((p) => ({ start: p.range.start, end: p.range.end })),
        tags: ['insertion'],
      })];
    },
  },
  {
    id: 'report-speed',
    category: 'process',
    name: 'Writing time vs length (reported)',
    requires: ['report'],
    run(ctx) {
      const { report, config, doc } = ctx;
      const c = config.report;
      const minutes = report.metrics?.writingMinutes;
      if (!minutes || doc.wordCount < c.minWords) return [];
      const rate = doc.wordCount / minutes;
      if (rate < c.mediumWpm) return [];
      return [makeSignal({
        id: 'report-speed',
        detector: 'report-speed',
        category: 'process',
        name: 'Writing time vs length (reported)',
        severity: grade(rate, c.mediumWpm, c.highWpm),
        finding: `${doc.wordCount} words in ${fmtNum(minutes, 0)} minutes of reported writing time (about ${fmtNum(rate, 0)} words per minute overall).`,
        evidence: [
          { label: 'Reported writing time', value: `${fmtNum(minutes, 0)} minutes` },
          { label: 'Submitted words', value: doc.wordCount },
          ...(report.metrics.sessions != null ? [{ label: 'Sessions', value: report.metrics.sessions }] : []),
          ...(report.metricSources?.writingMinutes ? [{ label: 'Report line', value: report.metricSources.writingMinutes }] : []),
        ],
        explanation: 'Composing, including planning and revising, usually takes far longer per word than this, so part of the text may have been produced outside the tracked document.',
        alternatives: ['The tool may count only active time in this document.', 'Drafting in another document or on paper.', 'Speech-to-text dictation.', 'The student copied the document from an earlier file.'],
        rule: `Final words ÷ reported writing minutes: Medium at ${c.mediumWpm}, High at ${c.highWpm}. ${sourceNote(report)}`,
        tags: ['speed'],
      })];
    },
  },
];
