// Runs the whole pipeline for one piece of writing:
// parse → features → student baseline → comparison → anomaly profile → report.

import { extractFeatures } from '../features/index.js';
import { buildProfile } from '../profile/profile.js';
import { compareAll, toAnomaly } from './compare.js';
import { categoryProfile, investigationPriority, summaryText, composites, strongestDeviations } from './aggregate.js';
import { followUpQuestions, conferencePrompts } from './followup.js';
import { DISCLAIMER, LIMITATIONS } from './explain.js';
import { stem } from '../text/tokenize.js';

/**
 * sample:   the piece under investigation
 * baseline: the student's other samples that count as baseline
 * assignment: context answers for the current task (may be null)
 * assignmentsById: to look up taught terms of baseline samples
 */
export function analyze({ sample, student, baseline, assignment, assignmentsById = {}, config, dismissed = new Set() }) {
  const current = extractFeatures(sample, { taughtTerms: assignment?.taughtTerms || [], config });
  const base = baseline.map((b) => ({ sample: b, features: extractFeatures(b, { taughtTerms: assignmentsById[b.assignment_id]?.taughtTerms || [], config }) }));
  const profile = buildProfile(base, sample, config);
  const rows = compareAll({ current, profile, cfg: config, assignment: assignment || {}, studentContext: student?.context || {} });
  rows.forEach((r) => { r.dismissed = dismissed.has(r.id); });
  const categories = categoryProfile(rows, { profile, current, cfg: config });
  const priority = investigationPriority(categories, profile);

  // Less common words in this piece that never appear in the baseline.
  const baseVocab = new Set();
  base.forEach((b) => b.features.details.vocabulary.forEach((w) => baseVocab.add(w)));
  const newVocabulary = [...current.details.rareStems].filter(([s]) => !baseVocab.has(s)).map(([, w]) => w);
  const baseVerbs = new Map();
  base.forEach((b) => b.features.details.basicVerbs.concat(b.features.details.advancedVerbs).forEach(({ word, n }) => baseVerbs.set(word, (baseVerbs.get(word) || 0) + n)));

  const result = {
    sample, student, assignment, current, profile, rows, categories, priority,
    anomalies: rows.filter((r) => r.compared && r.strength !== 'Typical' && !r.dismissed).map(toAnomaly),
    strongest: strongestDeviations(rows),
    composites: composites(rows),
    summary: summaryText(categories, priority, profile),
    newVocabulary: profile.n ? newVocabulary : [],
    verbRepertoire: {
      baseline: [...baseVerbs].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([w]) => w),
      current: current.details.basicVerbs.concat(current.details.advancedVerbs).sort((a, b) => b.n - a.n).slice(0, 10).map((x) => x.word),
    },
    disclaimer: DISCLAIMER,
    limitations: LIMITATIONS,
    warnings: current.process?.problems?.slice(0, 4) || [],
  };
  result.followUps = followUpQuestions(result);
  result.conference = conferencePrompts(result);
  result.isNewWord = (w) => !baseVocab.has(stem(w.toLowerCase()));
  return result;
}
