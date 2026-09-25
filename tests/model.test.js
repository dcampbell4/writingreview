// The anomaly model: profile weighting, sufficiency, trends, levels, safeguards.
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDemo } from '../js/demo/demoData.js';
import { analyze } from '../js/analysis/run.js';
import { mergeConfig } from '../js/config.js';
import { similarityWeight, sufficiency, trendOf } from '../js/profile/profile.js';
import { investigationPriority } from '../js/analysis/aggregate.js';
import { parseProcessReport } from '../js/import/processReport.js';
import { computeDiscourse } from '../js/features/discourse.js';
import { analyzeDocument } from '../js/text/tokenize.js';

const config = mergeConfig();
const demo = buildDemo();
const run = (sampleId, extra = {}) => {
  const s = { ...demo.samples.find((x) => x.id === sampleId), ...(extra.sample || {}) };
  return analyze({
    sample: s,
    student: { ...demo.students.find((x) => x.id === s.student_id), ...(extra.student || {}) },
    baseline: extra.baseline || demo.samples.filter((x) => x.student_id === s.student_id && x.role === 'baseline'),
    assignment: extra.assignment || demo.assignments[0],
    config: extra.config || config,
    dismissed: extra.dismissed,
  });
};

test('converging changes across independent categories give HIGH priority', () => {
  const r = run('S-1042-c1');
  assert.equal(r.priority.level, 'HIGH');
  const levels = Object.fromEntries(r.categories.map((c) => [c.id, c.level]));
  assert.ok(['HIGH', 'VERY HIGH'].includes(levels.style));
  assert.ok(['HIGH', 'VERY HIGH'].includes(levels.external));
  assert.ok(r.strongest.length >= 3);
});

test('a consistent writer is LOW priority', () => {
  assert.equal(run('S-2217-c1').priority.level, 'LOW');
});

test('steady development is recognised as development, not an anomaly', () => {
  const r = run('S-3308-c1');
  assert.equal(r.priority.level, 'LOW');
  assert.ok(r.rows.some((x) => x.trend?.kind === 'development'), 'some features are trend-adjusted');
  const abstraction = r.rows.find((x) => x.id === 'abstractionIndex');
  assert.equal(abstraction.strength, 'Typical');
});

test('insufficient baseline is reported, never compensated for', () => {
  const r = run('S-4410-c1');
  assert.equal(r.priority.level, 'INCONCLUSIVE');
  assert.equal(r.profile.sufficiency.level, 'insufficient');
  assert.ok(r.categories.every((c) => !c.assessed));
  assert.equal(r.anomalies.length, 0);
});

test('with an insufficient baseline, process evidence alone can never reach HIGH', () => {
  const r = run('S-1042-c1', { baseline: demo.samples.filter((x) => x.id === 'S-1042-b1') });
  assert.equal(r.profile.sufficiency.level, 'insufficient');
  assert.notEqual(r.priority.level, 'HIGH');
  assert.ok(r.priority.notes.some((n) => /Insufficient baseline/.test(n)));
});

test('genre matching weights earlier samples', () => {
  const cur = { genre: 'Literary analysis', assignment_type: 'Literary essay', subject: 'English', timed: false, word_count: 500 };
  assert.equal(similarityWeight({ ...cur }, cur, config).weight, 1);
  assert.equal(similarityWeight({ ...cur, assignment_type: 'Other' }, cur, config).weight, 0.9);
  assert.equal(similarityWeight({ genre: 'Reflection', subject: 'History', timed: false, word_count: 500 }, cur, config).weight, 0.4);
  assert.equal(similarityWeight({ ...cur, timed: true }, cur, config).weight, 0.3);
});

test('baseline sufficiency levels', () => {
  assert.equal(sufficiency(2, 1, config).level, 'insufficient');
  assert.equal(sufficiency(3, 1, config).level, 'minimum');
  assert.equal(sufficiency(6, 2, config).level, 'preferred');
  assert.equal(sufficiency(12, 3, config).level, 'strong');
  assert.equal(sufficiency(12, 1, config).level, 'preferred');
});

test('trend detection distinguishes steady growth from a jump', () => {
  const steady = trendOf([10, 12, 14, 16, 18].map((v) => ({ v })));
  assert.ok(steady.r2 > 0.99);
  assert.ok(Math.abs(steady.predictedNext - 20) < 1e-9);
  const flat = trendOf([10, 10.5, 9.8, 10.2].map((v) => ({ v })));
  assert.ok(flat.r2 < 0.5);
});

test('priority requires independent categories to converge', () => {
  const cat = (id, index) => ({ id, assessed: true, index });
  const p = { sufficiency: { level: 'preferred' } };
  assert.equal(investigationPriority([cat('style', 4), cat('discourse', 0), cat('process', 0), cat('external', 0)], p).level, 'MODERATE');
  assert.equal(investigationPriority([cat('style', 3), cat('discourse', 3), cat('process', 0), cat('external', 0)], p).level, 'HIGH');
  assert.equal(investigationPriority([cat('style', 1), cat('discourse', 1), cat('process', 0), cat('external', 0)], p).level, 'LOW');
});

test('weak surface indicators alone can never raise a category', () => {
  const r = run('S-1042-c1');
  const weak = r.rows.filter((x) => x.weak);
  assert.ok(weak.length > 0);
  assert.ok(weak.every((x) => x.weight <= 0.25 && x.evidence_quality === 'Low'));
  assert.ok(!r.strongest.some((x) => x.weak));
});

test('taught vocabulary is not counted as new', () => {
  const plain = run('S-1042-c1', { assignment: { ...demo.assignments[0], taughtTerms: [] } });
  const taught = run('S-1042-c1', { assignment: { ...demo.assignments[0], taughtTerms: ['interrogates', 'foregrounds', 'epistemological', 'juxtaposes'] } });
  assert.ok(plain.newVocabulary.includes('interrogates'));
  assert.ok(!taught.newVocabulary.includes('interrogates'));
  assert.ok(taught.rows.find((x) => x.id === 'academicRate').adjustments.some((a) => /taught/.test(a.reason)));
});

test('student context reduces related findings and says why', () => {
  const r = run('S-1042-c1', { student: { context: { draftsElsewhere: true } } });
  const ins = r.rows.find((x) => x.id === 'largestInsertion');
  assert.ok(ins.adjustments.some((a) => /drafts? elsewhere/.test(a.reason)));
  assert.ok(Math.abs(ins.z) < Math.abs(run('S-1042-c1').rows.find((x) => x.id === 'largestInsertion').z));
});

test('dismissed findings are excluded from levels but kept', () => {
  const base = run('S-1042-c1');
  const all = new Set(base.rows.filter((x) => x.category === 'external').map((x) => x.id));
  const r = run('S-1042-c1', { dismissed: all });
  assert.equal(r.categories.find((c) => c.id === 'external').assessed, false);
  assert.ok(r.rows.filter((x) => x.dismissed).length === all.size);
});

test('an imported PDF report provides process and insertion evidence', () => {
  const report = parseProcessReport(`Writing time\n12 min\nSessions\n1\nPasted content\nSep 22, 2026 9:19 AM · 1,800 characters\n"Simon's encounter with the Lord of the Flies further complicates the novel's representation of evil."`);
  const r = run('S-1042-c1', { sample: { process_data: { report } } });
  assert.equal(r.current.process.source, 'report');
  assert.ok(r.categories.find((c) => c.id === 'external').assessed);
  assert.ok(r.current.process.insertions[0].ranges.length, 'pasted excerpt located in the text');
});

test('every anomaly follows the specified shape', () => {
  for (const id of ['S-1042-c1', 'S-2217-c1', 'S-3308-c1']) {
    for (const a of run(id).anomalies) {
      for (const k of ['category', 'feature', 'deviation', 'strength', 'evidence_quality', 'explanation', 'alternative_explanations']) assert.ok(a[k] != null, `${id} ${a.feature} ${k}`);
      assert.ok(a.alternative_explanations.length > 0);
      assert.ok(['Moderate', 'High', 'Very high'].includes(a.strength));
      assert.ok(['Low', 'Moderate', 'High'].includes(a.evidence_quality));
    }
  }
});

test('language safeguards: no accusations, probabilities or AI verdicts', () => {
  const banned = /AI detected|AI[- ]generated|written by AI|likely AI|AI probability|cheat|\d+\s*%\s*(?:AI|probability|likely)|probability/i;
  for (const s of demo.samples.filter((x) => x.role === 'current')) {
    const r = run(s.id);
    const text = [...r.summary, r.disclaimer, ...r.limitations, ...r.rows.flatMap((x) => [x.explanation || '', ...(x.alternative_explanations || []), ...(x.adjustments || []).map((a) => a.reason)]), ...r.followUps.flatMap((q) => [q.q, q.detail || '']), ...r.conference, ...r.categories.map((c) => c.note || '')].join('\n');
    assert.doesNotMatch(text, banned);
    assert.match(r.disclaimer, /An anomaly is not evidence of misconduct/);
  }
});

test('discourse analysis labels claims, evidence, qualification and counterpoints', () => {
  const doc = analyzeDocument('Golding presents power as fragile.\n\nRalph blows the conch. The boys gather "whoever holds the conch" (33). This shows that rules depend on agreement. Some readers might argue that Jack is simply a bully. Although this is partly true, the novel suggests more.\n\nIn conclusion, order is fragile in every society.');
  const d = computeDiscourse(doc);
  const moves = d.sentences.map((s) => s.move);
  assert.deepEqual(moves, ['thesis', 'claim', 'evidence', 'explanation', 'counterpoint', 'qualification', 'conclusion']);
});
