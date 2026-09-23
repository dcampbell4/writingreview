// Student baseline: what is typical for this student, built only from samples
// the teacher has marked as authentic and included.

import { analyzeDocument, words as tokenWords, syllables, stem, quotedRanges, inRanges } from '../text/tokenize.js';
import { computeFeatures, FEATURES, FEATURE_GROUPS, mean, sd } from '../text/features.js';
import { familyRates } from '../text/detectors.js';
import { normalizeLog } from '../schema.js';
import { replay } from '../process/replay.js';
import { processProfile } from '../process/metrics.js';
import { makeSignal, grade, fmtNum, capSeverity, plural } from '../util.js';

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  if (!s.length) return null;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Sophisticated vocabulary: long or multi-syllable words that are not names
// and not inside quotations.
export function sophisticatedWords(text, extraExclusions = []) {
  const quotes = quotedRanges(text);
  const exclude = new Set(extraExclusions.map((w) => stem(w)));
  const out = [];
  for (const w of tokenWords(text)) {
    if (inRanges(w.start, quotes)) continue;
    const isSentenceStart = /(^|[.!?]\s+|\n\s*)$/.test(text.slice(Math.max(0, w.start - 3), w.start));
    if (/^[A-Z]/.test(w.text) && !isSentenceStart) continue; // probably a name
    if (!(syllables(w.text) >= 3 || w.text.length >= 9)) continue;
    const s = stem(w.text);
    if (exclude.has(s)) continue;
    out.push({ ...w, stem: s });
  }
  return out;
}

export function vocabularyOf(text) {
  return new Set(tokenWords(text).map((w) => stem(w.text)));
}

export function buildBaseline(samples, config) {
  const included = samples.filter((s) => s.authentic !== false && s.include !== false && s.text?.trim());
  if (!included.length) return null;
  const docs = included.map((s) => analyzeDocument(s.text));
  const featureSets = docs.map((d) => computeFeatures(d));
  const features = {};
  for (const f of FEATURES) {
    const vals = featureSets.map((fs) => fs.values[f.id]).filter((v) => v != null);
    if (!vals.length) continue;
    features[f.id] = { mean: mean(vals), sd: sd(vals), min: Math.min(...vals), max: Math.max(...vals), n: vals.length };
  }
  const totalWords = docs.reduce((n, d) => n + d.wordCount, 0);
  const rates = docs.map((d) => familyRates(d));
  const rhetoricRates = {};
  for (const id of Object.keys(rates[0])) rhetoricRates[id] = mean(rates.map((r) => r[id]));

  const vocabulary = new Set();
  docs.forEach((d) => vocabularyOf(d.text).forEach((w) => vocabulary.add(w)));

  // Expected rate of "new" sophisticated vocabulary, estimated leave-one-out.
  let expectedNewVocabRate = null;
  if (docs.length >= 2) {
    const perDoc = docs.map((d, i) => {
      const others = new Set();
      docs.forEach((o, j) => { if (j !== i) vocabularyOf(o.text).forEach((w) => others.add(w)); });
      const soph = sophisticatedWords(d.text);
      const fresh = new Set(soph.filter((w) => !others.has(w.stem)).map((w) => w.stem));
      return (fresh.size / Math.max(1, d.wordCount)) * 1000;
    });
    expectedNewVocabRate = mean(perDoc);
  }

  const openers = {};
  featureSets.forEach((fs) => { if (fs.conclusionOpener) openers[fs.conclusionOpener] = (openers[fs.conclusionOpener] || 0) + 1; });

  // Process baseline from any logs attached to samples.
  const profiles = included.filter((s) => s.log).map((s) => {
    const { log } = normalizeLog(s.log);
    return log && log.events.length ? processProfile(replay(log, null, config), config) : null;
  }).filter(Boolean);
  const process = profiles.length ? {
    count: profiles.length,
    largestInsertionWords: Math.round(median(profiles.map((p) => p.largestInsertionWords))),
    largestTypedWindowWords: Math.round(median(profiles.map((p) => p.largestTypedWindowWords))),
    revisionRatio: median(profiles.map((p) => p.revisionRatio)),
    typedRevisionRatio: median(profiles.map((p) => p.typedRevisionRatio)),
    typingWpm: median(profiles.map((p) => p.typingWpm).filter((v) => v != null)),
    sustainedWpm: median(profiles.map((p) => p.sustainedWpm)),
  } : null;

  const c = config.baseline;
  const reliability = included.length >= c.establishedSamples && totalWords >= c.establishedWords ? 'Established' : 'Limited';
  return {
    sampleCount: included.length,
    totalWords,
    reliability,
    features,
    rhetoricRates,
    vocabulary,
    expectedNewVocabRate,
    conclusionOpeners: openers,
    errorsSeen: [...new Set(featureSets.flatMap((fs) => fs.errors))],
    process,
    sampleTitles: included.map((s) => s.title),
  };
}

// One row per feature: baseline vs submission, used by the comparison table
// and to create baseline-deviation signals.
export function compareFeatures(features, baseline, config) {
  const c = config.baseline;
  const rows = [];
  for (const f of FEATURES) {
    const b = baseline.features[f.id];
    const v = features.values[f.id];
    if (!b || v == null) continue;
    const spread = Math.max(b.sd, c.relativeSpreadFloor * Math.abs(b.mean), f.minSpread);
    const z = (v - b.mean) / spread;
    const outside = v < b.min || v > b.max;
    let severity = null;
    const az = Math.abs(z);
    if (outside && az >= c.lowZ) severity = az >= c.highZ ? 'High' : az >= c.mediumZ ? 'Medium' : 'Low';
    rows.push({ feature: f, baseline: b, value: v, z, outside, severity, change: b.mean ? (v - b.mean) / Math.abs(b.mean) : null });
  }
  return rows;
}

export const withUnit = (v, f) => `${fmtNum(v, f.digits)}${f.unit ? (f.unit.startsWith('%') ? '' : ' ') + f.unit : ''}`;

function changeText(row) {
  const { feature: f, baseline: b, value: v } = row;
  const diff = v - b.mean;
  const rel = row.change != null && Math.abs(b.mean) > 0.01 ? ` (${diff >= 0 ? '+' : ''}${fmtNum(row.change * 100, 0)}%)` : '';
  return `${diff >= 0 ? 'Up' : 'Down'} by ${withUnit(Math.abs(diff), f)}${rel}`;
}

export const baselineDetectors = [
  {
    id: 'baseline-feature',
    category: 'baseline',
    name: 'Baseline deviation',
    requires: ['baseline'],
    run(ctx) {
      const { features, baseline, config, doc } = ctx;
      if (doc.wordCount < config.general.minWordsForRates) return [];
      return compareFeatures(features, baseline, config).filter((r) => r.severity).map((r) => {
        const f = r.feature;
        const adjustments = [];
        let severity = r.severity;
        if (baseline.reliability === 'Limited') {
          const capped = capSeverity(severity, config.baseline.limitedCap);
          if (capped !== severity) adjustments.push(`Baseline is limited (${plural(baseline.sampleCount, 'sample')}, ${baseline.totalWords} words), so severity is capped at ${config.baseline.limitedCap}.`);
          severity = capped;
        }
        if (f.group === 'mechanics' && severity === 'High') {
          severity = 'Medium';
          adjustments.push('Mechanics changes are often caused by spellcheck or grammar tools, so severity is capped at Medium.');
        }
        return makeSignal({
          id: `baseline-${f.id}`,
          detector: 'baseline-feature',
          category: 'baseline',
          group: f.group,
          name: `${FEATURE_GROUPS[f.group].label}: ${f.label.toLowerCase()}`,
          severity,
          finding: `${withUnit(r.value, f)} in this submission vs. typically ${withUnit(r.baseline.mean, f)} (range ${fmtNum(r.baseline.min, f.digits)}–${fmtNum(r.baseline.max, f.digits)}).`,
          evidence: [
            { label: 'Baseline', value: `${withUnit(r.baseline.mean, f)} (range ${fmtNum(r.baseline.min, f.digits)}–${fmtNum(r.baseline.max, f.digits)} across ${plural(r.baseline.n, 'sample')})` },
            { label: 'New submission', value: withUnit(r.value, f) },
            { label: 'Change', value: changeText(r) },
            { label: 'Deviation', value: `${fmtNum(Math.abs(r.z), 1)} spreads ${r.z > 0 ? 'above' : 'below'} the student's mean; outside their observed range` },
          ],
          baseline: `Typical for this student: ${withUnit(r.baseline.mean, f)}.`,
          explanation: `This measure is outside the range seen in the student's previous writing.`,
          alternatives: FEATURE_GROUPS[f.group].alternatives,
          rule: `Reported only outside the student's observed range. Low at ${config.baseline.lowZ}, Medium at ${config.baseline.mediumZ} and High at ${config.baseline.highZ} spreads, where spread = max(SD, ${fmtNum(config.baseline.relativeSpreadFloor * 100, 0)}% of mean, ${f.minSpread}).`,
          adjustments,
        });
      });
    },
  },
  {
    id: 'baseline-vocabulary',
    category: 'baseline',
    name: 'Vocabulary outside baseline',
    requires: ['baseline'],
    run(ctx) {
      const { baseline, config, doc, submission } = ctx;
      const c = config.baseline;
      if (baseline.expectedNewVocabRate == null || doc.wordCount < config.general.minWordsForRates) return [];
      const soph = sophisticatedWords(doc.text, submission?.assignmentTerms || []);
      const fresh = soph.filter((w) => !baseline.vocabulary.has(w.stem));
      const distinct = [...new Map(fresh.map((w) => [w.stem, w])).values()];
      const rate = (distinct.length / doc.wordCount) * 1000;
      const expected = Math.max(baseline.expectedNewVocabRate, 5);
      const ratio = rate / expected;
      if (distinct.length < c.vocabMinCount || ratio < c.vocabMediumRatio) return [];
      let severity = grade(ratio, c.vocabMediumRatio, c.vocabHighRatio);
      const adjustments = [];
      if (baseline.reliability === 'Limited') {
        const capped = capSeverity(severity, c.limitedCap);
        if (capped !== severity) adjustments.push(`Baseline is limited, so severity is capped at ${c.limitedCap}.`);
        severity = capped;
      }
      return [makeSignal({
        id: 'baseline-vocabulary',
        detector: 'baseline-vocabulary',
        category: 'baseline',
        group: 'vocabulary',
        name: 'Vocabulary outside baseline',
        severity,
        finding: `${distinct.length} sophisticated words do not appear in any of the student's baseline samples (${fmtNum(rate, 1)} per 1,000 words; expected about ${fmtNum(expected, 1)}).`,
        evidence: [
          { label: 'Words', value: distinct.slice(0, 24).map((w) => w.text).join(', ') + (distinct.length > 24 ? ', …' : '') },
          { label: 'Rate', value: `${fmtNum(rate, 1)} per 1,000 words` },
          { label: 'Expected rate for this student', value: `${fmtNum(expected, 1)} per 1,000 words (leave-one-out across ${plural(baseline.sampleCount, 'sample')})` },
          { label: 'Excluded', value: 'Quotations, names, and assignment terms set by the teacher' },
        ],
        baseline: `Built from ${plural(baseline.sampleCount, 'sample')} (${baseline.totalWords} words).`,
        explanation: 'The submission uses much more unfamiliar sophisticated vocabulary than this student typically introduces in a new piece.',
        alternatives: FEATURE_GROUPS.vocabulary.alternatives,
        rule: `Words of 3+ syllables or 9+ letters not found in the baseline. Medium at ${c.vocabMediumRatio}× the expected rate, High at ${c.vocabHighRatio}×.`,
        adjustments,
        ranges: fresh.map((w) => ({ start: w.start, end: w.end })),
      })];
    },
  },
  {
    id: 'baseline-conclusion',
    category: 'baseline',
    name: 'Conclusion structure change',
    requires: ['baseline'],
    run(ctx) {
      const { baseline, features, doc } = ctx;
      const opener = features.conclusionOpener;
      const counts = baseline.conclusionOpeners;
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      if (!opener || total < 2 || counts[opener]) return [];
      const usual = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
      if (usual[1] / total < 0.66) return [];
      const last = doc.paragraphs[doc.paragraphs.length - 1];
      return [makeSignal({
        id: 'baseline-conclusion',
        detector: 'baseline-conclusion',
        category: 'baseline',
        group: 'structure',
        name: 'Conclusion structure change',
        severity: 'Low',
        finding: `The conclusion opens with "${opener}"; the student usually opens with "${usual[0]}" (${usual[1]} of ${total} samples).`,
        evidence: [{ label: 'Baseline openers', value: Object.entries(counts).map(([k, v]) => `${k} ×${v}`).join(', ') }, { label: 'This submission', value: opener }],
        explanation: 'A small change in a habitual structure. Useful context only.',
        alternatives: ['A new conclusion strategy taught in class.', 'Teacher feedback on repetitive openers.'],
        rule: 'Reported when the opener was never used in 2+ baseline samples that share a consistent habit. Always Low.',
        ranges: last ? [{ start: last.start, end: Math.min(last.end, last.start + 40) }] : [],
      })];
    },
  },
];
