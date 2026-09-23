// Orchestrates the whole analysis and produces a neutral, categorical summary.
// There is deliberately no probability or score anywhere in this pipeline.

import { analyzeDocument } from '../text/tokenize.js';
import { computeFeatures } from '../text/features.js';
import { normalizeLog } from '../schema.js';
import { replay } from '../process/replay.js';
import { buildBaseline, compareFeatures } from '../baseline/baseline.js';
import { DETECTORS, CATEGORIES, TEXTUAL_CATEGORIES } from './registry.js';
import { applySafeguards } from './severity.js';
import { sevRank, maxSeverity, plural } from '../util.js';

export const STATUS = {
  review: 'Review recommended',
  some: 'Some unusual patterns',
  none: 'No notable patterns',
};

export function analyzeSubmission({ submission, student, samples, config, annotations = {} }) {
  const warnings = [];
  const skipped = [];

  // 1. Normalise the writing log (if any) and replay it.
  let rep = null;
  if (submission.log) {
    const { log, problems } = normalizeLog(submission.log);
    problems.slice(0, 5).forEach((p) => warnings.push(p));
    if (log && log.events.length) {
      rep = replay(log, submission.finalText, config);
      warnings.push(...rep.warnings.slice(0, 5));
    }
  }
  const text = submission.finalText ?? rep?.finalText ?? '';

  // 2. Text features.
  const doc = analyzeDocument(text);
  const processDoc = rep && !rep.matchesSubmission ? analyzeDocument(rep.finalText) : doc;
  const features = computeFeatures(doc);

  // 3. Baseline.
  const baseline = buildBaseline(samples || [], config);

  // 4. Run every detector whose data requirements are met.
  const ctx = { submission, student, text, doc, processDoc, features, replay: rep, baseline, config };
  let signals = [];
  for (const d of DETECTORS) {
    const missing = (d.requires || []).filter((r) => (r === 'log' && !rep) || (r === 'baseline' && !baseline));
    if (missing.length) { skipped.push({ id: d.id, name: d.name, missing }); continue; }
    try {
      signals.push(...d.run(ctx).map((s) => ({ ...s, category: s.category || d.category })));
    } catch (err) {
      warnings.push(`Detector "${d.name}" failed: ${err.message}`);
    }
  }

  // 5. Safeguards (accommodations) and teacher annotations.
  signals = applySafeguards(signals, student, config);
  for (const s of signals) {
    const a = annotations[s.id];
    s.status = a?.status || 'open';
    s.note = a?.note || '';
  }
  signals.sort((a, b) => sevRank(b.severity) - sevRank(a.severity) || CATEGORIES.findIndex((c) => c.id === a.category) - CATEGORIES.findIndex((c) => c.id === b.category));

  const summary = summarize(signals, { rep, baseline, config, doc });
  const comparison = baseline ? compareFeatures(features, baseline, config) : [];
  return { submission, student, text, doc, features, replay: rep, baseline, signals, summary, comparison, warnings, skipped };
}

// Multi-signal convergence. Counts *categories* with notable signals, never adds up scores.
export function summarize(signals, { rep, baseline, config, doc }) {
  const active = signals.filter((s) => s.status !== 'dismissed');
  const byCategory = CATEGORIES.map((c) => {
    const list = active.filter((s) => s.category === c.id);
    return { ...c, count: list.length, notable: list.filter((s) => sevRank(s.severity) >= 1).length, highest: maxSeverity(list.map((s) => s.severity)) };
  });
  const notableCats = byCategory.filter((c) => c.notable > 0);
  const hasHigh = active.some((s) => s.severity === 'High');
  const hasAnchor = notableCats.some((c) => c.id === 'process' || c.id === 'baseline');
  const c = config.summary;

  let status = STATUS.none;
  if (notableCats.length >= c.reviewMinCategories && (!c.requireHighForReview || hasHigh) && (!c.requireProcessOrBaseline || hasAnchor)) status = STATUS.review;
  else if (notableCats.length >= 1) status = STATUS.some;

  const top = active.filter((s) => sevRank(s.severity) >= 1).slice(0, 3).map((s) => s.name.toLowerCase());
  let text;
  if (status === STATUS.review) {
    text = `Several independent writing-process and textual patterns ${baseline ? "differ from this student's established baseline" : 'are unusual'}. The most notable signals are ${listJoin(top)}.`;
  } else if (status === STATUS.some) {
    text = `Some patterns are unusual (${listJoin(top)}), but they do not converge across independent categories in a way that calls for review on their own.`;
  } else {
    text = active.length
      ? `Only low-severity patterns were found (${plural(active.length, 'signal')}). These are recorded for context.`
      : 'No unusual writing-process or textual patterns were found with the current settings.';
  }

  const coverage = [];
  coverage.push(rep ? `Writing-process data: ${plural(rep.textEvents.length, 'editing event')}${rep.matchesSubmission ? '' : ' (does not fully match submitted text)'}` : 'Writing-process data: none (process signals not available)');
  coverage.push(baseline ? `Baseline: ${baseline.reliability.toLowerCase()} (${plural(baseline.sampleCount, 'sample')}, ${baseline.totalWords} words${baseline.process ? `, ${plural(baseline.process.count, 'process log')}` : ''})` : 'Baseline: none (comparisons with previous writing not available)');
  coverage.push(`Submission length: ${doc.wordCount} words`);
  const caveats = [];
  if (!rep && !baseline) caveats.push('With no process data and no baseline, only textual patterns are available. These are weak evidence on their own because many students are taught these structures.');
  if (baseline?.reliability === 'Limited') caveats.push('The baseline is limited; deviations are less reliable and have been capped.');
  if (doc.wordCount < config.general.minWordsForRates) caveats.push(`The text is short (${doc.wordCount} words); rate-based textual detectors were not run.`);

  const processCount = active.filter((s) => s.category === 'process').length;
  const textualCount = active.filter((s) => TEXTUAL_CATEGORIES.has(s.category)).length;
  return {
    status, text, byCategory, coverage, caveats,
    processCount, textualCount,
    highest: maxSeverity(active.map((s) => s.severity)),
    dismissedCount: signals.length - active.length,
  };
}

function listJoin(items) {
  if (!items.length) return 'none';
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
}
