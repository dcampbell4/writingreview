// Textual detectors: rhetorical pattern clusters (counted and shown in context)
// and within-document style changes. No single phrase is ever flagged alone.

import { makeSignal, grade, fmtNum, plural, capSeverity, fmtTime, pct } from '../util.js';
import { RHETORIC_FAMILIES, GENERIC_TERMS_RE } from './lexicons.js';
import { quotedRanges, inRanges, syllables } from './tokenize.js';
import { findErrors, mean, sd } from './features.js';

// Finds every match of a pattern family, with its character range.
export function findFamilyMatches(doc, family) {
  const out = [];
  const quotes = quotedRanges(doc.text);
  if (family.scope === 'sentence') {
    for (const s of doc.sentences) {
      if (inRanges(s.start, quotes) && inRanges(s.end - 1, quotes)) continue;
      if (family.test(s.text)) {
        const m = family.matchRe ? s.text.match(family.matchRe) : null;
        const end = m ? s.start + m[0].length : s.end;
        out.push({ start: s.start, end, text: m ? m[0] : s.text, paragraph: s.paragraph });
      }
    }
  } else {
    const re = new RegExp(family.re.source, family.re.flags.includes('g') ? family.re.flags : family.re.flags + 'g');
    let m;
    while ((m = re.exec(doc.text))) {
      if (!m[0]) { re.lastIndex++; continue; }
      if (inRanges(m.index, quotes)) continue;
      const para = doc.paragraphs.find((p) => m.index >= p.start && m.index < p.end);
      out.push({ start: m.index, end: m.index + m[0].length, text: m[0], paragraph: para ? para.index : 0 });
    }
  }
  return out;
}

export function familyRates(doc) {
  const rates = {};
  for (const f of RHETORIC_FAMILIES) {
    rates[f.id] = doc.wordCount ? (findFamilyMatches(doc, f).length / doc.wordCount) * 1000 : 0;
  }
  return rates;
}

// Describes where matches came from, when a writing log is available.
function provenanceNote(ctx, matches) {
  const rep = ctx.replay;
  if (!rep || !rep.matchesSubmission || !matches.length) return null;
  const byEvent = new Map();
  for (const m of matches) {
    const ch = rep.chars[m.start];
    if (!ch) continue;
    const ev = rep.events[ch.ev];
    if (ev.type === 'paste' && !ev.internalMove) byEvent.set(ev.id, (byEvent.get(ev.id) || 0) + 1);
  }
  if (!byEvent.size) return { label: 'Where the matches came from', value: 'All in typed text' };
  const parts = [...byEvent].map(([id, n]) => `${n} in the paste at ${fmtTime(rep.events[id].t)}`);
  return { label: 'Where the matches came from', value: `${parts.join('; ')}; ${matches.length - [...byEvent.values()].reduce((a, b) => a + b, 0)} in typed text` };
}

const rhetoricDetectors = RHETORIC_FAMILIES.map((family) => ({
  id: `rhetoric-${family.id}`,
  category: 'rhetoric',
  name: family.name,
  requires: [],
  run(ctx) {
    const { doc, config, baseline } = ctx;
    const c = config.rhetoric;
    if (doc.wordCount < config.general.minWordsForRates) return [];
    const matches = findFamilyMatches(doc, family);
    const rate = (matches.length / doc.wordCount) * 1000;
    if (matches.length < c.minCount || rate < c.mediumRate / 2) return [];
    let severity = rate >= c.mediumRate ? grade(rate, c.mediumRate, c.highRate) : 'Low';
    const adjustments = [];
    const baseRate = baseline?.rhetoricRates?.[family.id];
    let baselineText = null;
    if (baseRate != null) {
      const ratio = baseRate > 0 ? rate / baseRate : Infinity;
      baselineText = `Student's usual rate: ${fmtNum(baseRate, 1)} per 1,000 words${Number.isFinite(ratio) ? ` (this submission is ${fmtNum(ratio, 1)}×)` : ' (not used in baseline samples)'}.`;
      if (ratio <= c.baselineRatioNoConcern && severity !== 'Low') {
        adjustments.push(`Consistent with this student's own writing (within ${c.baselineRatioNoConcern}× of their baseline rate), so severity is set to Low.`);
        severity = 'Low';
      }
    } else if (severity === 'High' && c.capWithoutBaseline) {
      severity = capSeverity(severity, c.capWithoutBaseline);
      adjustments.push(`No baseline for this student, so severity is capped at ${c.capWithoutBaseline}. These structures are often taught.`);
    }
    const paragraphs = new Set(matches.map((m) => m.paragraph)).size;
    const counts = new Map();
    for (const m of matches) {
      const key = m.text.length > 60 ? m.text.slice(0, 57).trim() + '…' : m.text.trim();
      const norm = key.toLowerCase();
      counts.set(norm, { key, n: (counts.get(norm)?.n || 0) + 1 });
    }
    const top = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 6).map((x) => `${x.key}${x.n > 1 ? ` ×${x.n}` : ''}`);
    const prov = provenanceNote(ctx, matches);
    return [makeSignal({
      id: `rhetoric-${family.id}`,
      detector: `rhetoric-${family.id}`,
      category: 'rhetoric',
      name: family.name,
      severity,
      finding: `${plural(matches.length, 'instance')} across ${plural(paragraphs, 'paragraph')} (${fmtNum(rate, 1)} per 1,000 words).`,
      evidence: [
        { label: 'Pattern', value: family.description },
        { label: 'Count', value: `${matches.length} in ${doc.wordCount} words` },
        { label: 'Examples', value: top.join(' · ') },
        ...(prov ? [prov] : []),
      ],
      baseline: baselineText,
      explanation: 'This construction appears repeatedly. Clusters of stock phrasing are common in generic academic prose, but they are also routinely taught.',
      alternatives: family.alternatives,
      rule: `Counted from ${c.minCount} matches; Medium at ${c.mediumRate} per 1,000 words, High at ${c.highRate}.`,
      adjustments,
      ranges: matches.map((m) => ({ start: m.start, end: m.end })),
      matches,
    })];
  },
}));

// Conclusion that restates the argument in more general terms.
const genericConclusion = {
  id: 'rhetoric-generic-conclusion',
  category: 'rhetoric',
  name: 'Generalised conclusion',
  requires: [],
  run(ctx) {
    const { doc } = ctx;
    if (doc.paragraphs.length < 3) return [];
    const last = doc.paragraphs[doc.paragraphs.length - 1];
    const body = doc.paragraphs.slice(1, -1);
    const generic = (s) => GENERIC_TERMS_RE.test(s.text);
    const specific = (text) => (text.match(/["“]/g) || []).length / 2 + (text.match(/\s[A-Z][a-z]+/g) || []).length;
    const lastGeneric = last.sentences.filter(generic).length;
    const lastShare = last.sentences.length ? lastGeneric / last.sentences.length : 0;
    const bodySents = body.flatMap((p) => p.sentences);
    const bodyShare = bodySents.length ? bodySents.filter(generic).length / bodySents.length : 0;
    const lastSpecific = specific(last.text) / Math.max(1, last.words.length) * 100;
    const bodySpecific = body.length ? mean(body.map((p) => specific(p.text) / Math.max(1, p.words.length) * 100)) : 0;
    if (lastGeneric < 2 || lastShare < 0.4 || lastShare <= bodyShare * 1.5 || lastSpecific > bodySpecific * 0.6) return [];
    return [makeSignal({
      id: 'rhetoric-generic-conclusion',
      detector: 'rhetoric-generic-conclusion',
      category: 'rhetoric',
      name: 'Generalised conclusion',
      severity: 'Low',
      finding: `${lastGeneric} of ${last.sentences.length} concluding sentences make broad claims, with fewer specific references than the body paragraphs.`,
      evidence: [
        { label: 'Broad-claim sentences (conclusion)', value: pct(lastShare) },
        { label: 'Broad-claim sentences (body)', value: pct(bodyShare) },
        { label: 'Specific references per 100 words (conclusion / body)', value: `${fmtNum(lastSpecific, 1)} / ${fmtNum(bodySpecific, 1)}` },
      ],
      explanation: 'The conclusion mostly restates the argument in more general language instead of extending the specific analysis.',
      alternatives: ['"Broaden out to the bigger picture" is a common taught conclusion move.', 'Time pressure at the end of the task.'],
      rule: 'At least 2 broad-claim sentences, 40%+ of the conclusion, 1.5× the body rate, and fewer specifics. Always Low: supporting context only.',
      ranges: [{ start: last.start, end: last.end }],
    })];
  },
};

// Within-document change of style between earlier and later sections.
const PARA_FEATURES = [
  { id: 'sent', label: 'Average sentence length', floor: 3, digits: 1, unit: 'words', f: (p) => mean(p.sentences.map((s) => s.words.length)) },
  { id: 'wlen', label: 'Average word length', floor: 0.25, digits: 2, unit: 'letters', f: (p) => mean(p.words.map((w) => w.text.length)) },
  { id: 'long', label: 'Words of 3+ syllables', floor: 3, digits: 1, unit: '%', f: (p) => (p.words.filter((w) => syllables(w.text) >= 3).length / Math.max(1, p.words.length)) * 100 },
  { id: 'formula', label: 'Formulaic constructions', floor: 1.5, digits: 1, unit: 'per 100 words', f: (p, doc) => formulaicPer100(p, doc) },
  { id: 'errors', label: 'Recurring errors', floor: 0.6, digits: 1, unit: 'per 100 words', f: (p, doc) => (findErrors(doc).filter((e) => e.start >= p.start && e.start < p.end).length / Math.max(1, p.words.length)) * 100 },
];

function formulaicPer100(p, doc) {
  let n = 0;
  for (const f of RHETORIC_FAMILIES) n += findFamilyMatches(doc, f).filter((m) => m.start >= p.start && m.start < p.end).length;
  return (n / Math.max(1, p.words.length)) * 100;
}

export function styleChangePoint(doc, minSide = 2) {
  const paras = doc.paragraphs.filter((p) => p.words.length >= 25);
  if (paras.length < minSide * 2) return null;
  const vals = paras.map((p) => PARA_FEATURES.map((pf) => pf.f(p, doc)));
  let best = null;
  for (let k = minSide; k <= paras.length - minSide; k++) {
    const details = PARA_FEATURES.map((pf, i) => {
      const a = vals.slice(0, k).map((v) => v[i]);
      const b = vals.slice(k).map((v) => v[i]);
      const pooled = Math.sqrt((sd(a) ** 2 + sd(b) ** 2) / 2);
      const spread = Math.max(pooled, pf.floor);
      return { ...pf, before: mean(a), after: mean(b), d: Math.abs(mean(a) - mean(b)) / spread };
    });
    const distance = Math.sqrt(mean(details.map((x) => x.d ** 2)));
    if (!best || distance > best.distance) best = { k, distance, details, before: paras.slice(0, k), after: paras.slice(k) };
  }
  return best;
}

const styleDiscontinuity = {
  id: 'style-discontinuity',
  category: 'style',
  name: 'Style discontinuity',
  requires: [],
  run(ctx) {
    const { doc, config } = ctx;
    const c = config.style;
    if (doc.paragraphs.length < c.minParagraphs) return [];
    const cp = styleChangePoint(doc);
    if (!cp || cp.distance < c.mediumDistance) return [];
    const first = (list) => list[0].index + 1;
    const lastIdx = (list) => list[list.length - 1].index + 1;
    const changed = cp.details.filter((d) => d.d >= 1.5).sort((a, b) => b.d - a.d);
    const rep = ctx.replay?.matchesSubmission ? ctx.replay : null;
    let timing = null;
    if (rep) {
      const ts = cp.after.flatMap((p) => { const out = []; for (let i = p.start; i < p.end; i += 20) out.push(rep.events[rep.chars[i].ev].t); return out; });
      timing = { label: 'When the later section was written', value: `${fmtTime(Math.min(...ts))} – ${fmtTime(Math.max(...ts))}` };
    }
    return [makeSignal({
      id: 'style-discontinuity',
      detector: 'style-discontinuity',
      category: 'style',
      name: 'Style discontinuity',
      severity: grade(cp.distance, c.mediumDistance, c.highDistance),
      finding: `Writing characteristics shift between paragraphs ${first(cp.before)}–${lastIdx(cp.before)} and ${first(cp.after)}–${lastIdx(cp.after)}${changed.length ? `, mainly ${changed.slice(0, 3).map((d) => d.label.toLowerCase()).join(', ')}` : ''}.`,
      evidence: [
        ...cp.details.map((d) => ({ label: d.label, value: `${fmtNum(d.before, d.digits)} → ${fmtNum(d.after, d.digits)} ${d.unit}` })),
        { label: 'Combined distance', value: fmtNum(cp.distance, 2) },
        ...(timing ? [timing] : []),
      ],
      explanation: 'The later section reads differently from the earlier section on several measurable features at once.',
      alternatives: ['Different paragraph purposes (e.g. summary vs. close analysis).', 'Written on different days or after feedback.', 'Incorporated feedback or a peer’s suggestions in one section.'],
      rule: `Best split with at least 2 paragraphs per side; combined distance (RMS of per-feature differences ÷ spread) Medium at ${c.mediumDistance}, High at ${c.highDistance}.`,
      ranges: cp.after.map((p) => ({ start: p.start, end: p.end })),
    })];
  },
};

const uniformRhythm = {
  id: 'style-uniform-rhythm',
  category: 'style',
  name: 'Uniform sentence rhythm',
  requires: [],
  run(ctx) {
    const { doc, config, baseline } = ctx;
    const c = config.style;
    const lens = doc.sentences.map((s) => s.words.length);
    if (lens.length < c.uniformMinSentences) return [];
    const cv = sd(lens) / Math.max(1, mean(lens));
    if (cv >= c.uniformCv || mean(lens) < 15) return [];
    const baseCv = baseline?.features?.avgSentenceLength && baseline.features.sentenceLengthSD
      ? baseline.features.sentenceLengthSD.mean / Math.max(1, baseline.features.avgSentenceLength.mean) : null;
    if (baseCv != null && cv >= baseCv * 0.8) return [];
    return [makeSignal({
      id: 'style-uniform-rhythm',
      detector: 'style-uniform-rhythm',
      category: 'style',
      name: 'Uniform sentence rhythm',
      severity: 'Low',
      finding: `Sentences are consistently long and similar in length (average ${fmtNum(mean(lens), 1)} words, variation ${fmtNum(cv * 100, 0)}%).`,
      evidence: [
        { label: 'Sentences', value: lens.length },
        { label: 'Average length', value: `${fmtNum(mean(lens), 1)} words` },
        { label: 'Coefficient of variation', value: `${fmtNum(cv * 100, 0)}%` },
      ],
      baseline: baseCv != null ? `Student's usual variation: ${fmtNum(baseCv * 100, 0)}%.` : null,
      explanation: 'Sentence lengths vary less than is typical of natural drafting.',
      alternatives: ['A deliberate, practised formal style.', 'Heavy editing for consistency.'],
      rule: `Variation below ${fmtNum(c.uniformCv * 100, 0)}% with ${c.uniformMinSentences}+ sentences averaging 15+ words. Always Low: supporting context only.`,
      ranges: [],
    })];
  },
};

export const textDetectors = [...rhetoricDetectors, genericConclusion, styleDiscontinuity, uniformRhythm];
