// Turns per-feature comparisons into an Anomaly Profile: four independent
// categories, each with a level, and an overall investigation priority.
// Nothing here is a probability; levels describe how unusual the piece is for
// this student and how much independent evidence converges.

export const LEVELS = ['LOW', 'MODERATE', 'MODERATE-HIGH', 'HIGH', 'VERY HIGH'];
export const BAR_SEGMENTS = [2, 4, 6, 8, 10];

export const CATEGORIES = [
  { id: 'style', label: 'Style', question: 'How much does the language differ from the student’s established profile?' },
  { id: 'discourse', label: 'Discourse', question: 'How much do reasoning and argument structure differ?' },
  { id: 'process', label: 'Process', question: 'How much does the composition process differ?' },
  { id: 'external', label: 'External insertion', question: 'How much text entered in large inserted blocks?' },
];

const levelIndex = (score, c) => (score >= c.veryHigh ? 4 : score >= c.high ? 3 : score >= c.moderateHigh ? 2 : score >= c.moderate ? 1 : 0);

export function categoryProfile(rows, { profile, current, cfg }) {
  const insufficient = profile.sufficiency.level === 'insufficient';
  return CATEGORIES.map((cat) => {
    const catRows = rows.filter((r) => r.category === cat.id && r.compared && !r.dismissed);
    const textCat = cat.id === 'style' || cat.id === 'discourse';
    let assessed = true;
    let note = '';
    if (textCat && insufficient) { assessed = false; note = profile.sufficiency.message; }
    if (!textCat && !current.process) { assessed = false; note = 'No writing-process data for this piece.'; }
    if (assessed && !catRows.length) { assessed = false; note = 'Not enough information to compare.'; }
    if (!assessed) return { ...cat, assessed, note, level: 'NOT ASSESSED', index: -1, rows: catRows, notable: [] };

    const k = cfg.categories.topFeatures;
    const contribs = catRows.map((r) => Math.abs(r.z) * r.weight * (r.evidence_quality === 'Low' && !r.weak ? 0.8 : 1)).sort((a, b) => b - a);
    const top = contribs.slice(0, k);
    while (top.length < k) top.push(0);
    // Breadth (several features) or one very strong feature, whichever is larger.
    const score = Math.max(Math.sqrt(top.reduce((s, x) => s + x * x, 0) / k), 0.8 * top[0]);
    let index = levelIndex(score, cfg.categories);
    const caps = [];
    if (textCat && profile.sufficiency.level === 'minimum' && index > 3) { index = 3; caps.push('Level capped at HIGH because the baseline is at the minimum size.'); }
    if (cat.id === 'process' && catRows.every((r) => r.basis === 'reference') && index > 2) { index = 2; caps.push('Compared with general reference values only (no earlier process data for this student), so the level is capped at MODERATE-HIGH.'); }
    if (!textCat && current.process?.source === 'report' && index > 3) { index = 3; caps.push('Based on an imported report rather than a full writing log, so the level is capped at HIGH.'); }
    const notable = catRows.filter((r) => r.strength !== 'Typical').sort((a, b) => Math.abs(b.z) * b.weight - Math.abs(a.z) * a.weight);
    const qualities = notable.slice(0, 3).map((r) => r.evidence_quality);
    const quality = qualities.includes('High') ? 'High' : qualities.includes('Moderate') ? 'Moderate' : qualities.length ? 'Low' : '—';
    return { ...cat, assessed, score, index, level: LEVELS[index], segments: BAR_SEGMENTS[index], rows: catRows, notable, evidenceQuality: quality, caps, note };
  });
}

export function investigationPriority(categories, profile) {
  const assessed = categories.filter((c) => c.assessed);
  if (!assessed.length) {
    return { level: 'INCONCLUSIVE', text: 'The available evidence is inconclusive: there is not enough baseline writing for comparison and no process data.' };
  }
  const idx = assessed.map((c) => c.index);
  const strong = idx.filter((i) => i >= 3).length;
  const mh = idx.filter((i) => i >= 2).length;
  const mod = idx.filter((i) => i >= 1).length;
  let level = strong >= 2 || mh >= 3 ? 'HIGH' : strong >= 1 || mh >= 2 || mod >= 3 ? 'MODERATE' : 'LOW';
  const notes = [];
  if (profile.sufficiency.level === 'insufficient') {
    notes.push('Insufficient baseline for reliable authorship comparison: only process evidence was assessed.');
    if (level === 'HIGH') level = 'MODERATE';
  }
  return { level, strongCategories: strong, convergingCategories: mh, notes };
}

const phrase = (r) => `${r.label.toLowerCase()} ${r.rawZ > 0 ? 'above' : 'below'} the student’s usual range`;

export function summaryText(categories, priority, profile) {
  const out = [];
  if (priority.level === 'INCONCLUSIVE') return [priority.text];
  const lead = {
    HIGH: 'The current piece differs substantially from the student’s established writing profile across several independent dimensions.',
    MODERATE: 'Some features of the current piece differ from the student’s established writing profile.',
    LOW: 'The current piece is broadly consistent with the student’s established writing profile.',
  }[priority.level];
  out.push(lead);
  if (priority.convergingCategories >= 2) out.push('Multiple independent anomalies were detected.');
  const described = categories.filter((c) => c.assessed && c.index >= 1).map((c) => {
    const top = c.notable.filter((r) => !r.weak).slice(0, 2);
    return `${c.label}: ${c.level.toLowerCase()} deviation${top.length ? ` (${top.map(phrase).join('; ')})` : ''}.`;
  });
  out.push(...described);
  if (priority.level !== 'LOW') out.push('These findings indicate a change in the student’s writing or composition behaviour. They do not establish why the change occurred.');
  if (profile.sufficiency.level === 'insufficient') out.push(profile.sufficiency.message);
  return out;
}

// Headline percentage comparisons (DESIGN §24).
const COMPOSITES = [
  { id: 'sentenceComplexity', label: 'Sentence complexity', features: ['clauseDensity', 'meanSentenceLength'] },
  { id: 'vocabulary', label: 'Vocabulary sophistication', features: ['academicRate', 'rareWordRate', 'advancedVerbShare'] },
  { id: 'abstraction', label: 'Conceptual abstraction', features: ['abstractionIndex'] },
  { id: 'architecture', label: 'Paragraph architecture', features: ['movesPerParagraph', 'chainLength'] },
  { id: 'revision', label: 'Revision density', features: ['revisionDensity'] },
  { id: 'continuous', label: 'Continuous composition', features: ['longestContinuous'] },
  { id: 'inserted', label: 'Text inserted in blocks', features: ['pastedShare'] },
];

export function composites(rows) {
  return COMPOSITES.map((c) => {
    const all = rows.filter((r) => c.features.includes(r.id) && r.compared);
    if (!all.length) return { ...c, pct: null, text: null };
    const strongest = all.reduce((m, r) => (Math.abs(r.z) > Math.abs(m.z) ? r : m));
    const rs = all.filter((r) => r.pctChange != null);
    const pct = rs.length ? rs.reduce((s, r) => s + r.pctChange, 0) / rs.length : null;
    // When the baseline value is close to zero a percentage is misleading, so describe it instead.
    const text = pct != null ? `${pct >= 0 ? '+' : '\u2212'}${Math.abs(Math.round(pct))}%` : strongest.strength === 'Typical' ? 'similar' : strongest.rawZ > 0 ? 'new / well above usual' : 'well below usual';
    return { ...c, pct, text, strongest, basis: all.every((r) => r.basis === 'reference') ? 'reference' : 'student' };
  });
}

export function strongestDeviations(rows, n = 5) {
  const nonWeak = rows.filter((r) => r.compared && r.strength !== 'Typical' && !r.weak && !r.dismissed);
  return nonWeak.sort((a, b) => Math.abs(b.z) * b.weight - Math.abs(a.z) * a.weight).slice(0, n);
}
