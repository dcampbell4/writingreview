// Run with:  node --test writing-review/tests/
import test from 'node:test';
import assert from 'node:assert/strict';

import { mergeConfig } from '../js/config.js';
import { analyzeDocument, sentences, syllables } from '../js/text/tokenize.js';
import { computeFeatures } from '../js/text/features.js';
import { normalizeLog } from '../js/schema.js';
import { replay, diff } from '../js/process/replay.js';
import { analyzeSubmission, STATUS } from '../js/pipeline/analyze.js';
import { buildBaseline } from '../js/baseline/baseline.js';
import { buildDemo } from '../js/demo/demoData.js';
import { simulateSession } from '../js/demo/simulate.js';

const config = mergeConfig();
const demo = buildDemo();
const run = (subId, overrides = {}) => {
  const sub = demo.submissions.find((s) => s.id === subId);
  const student = { ...demo.students.find((s) => s.id === sub.studentId), ...(overrides.student || {}) };
  return analyzeSubmission({ submission: sub, student, samples: demo.samples.filter((s) => s.studentId === sub.studentId), config: overrides.config || config, annotations: overrides.annotations || {} });
};

test('tokenizer keeps offsets and handles abbreviations', () => {
  const text = 'Mr. Smith arrived. He said "Hi!" Then he left.';
  const s = sentences(text);
  assert.equal(s.length, 3);
  assert.equal(text.slice(s[0].start, s[0].end), 'Mr. Smith arrived.');
  assert.equal(syllables('civilization'), 5);
  const doc = analyzeDocument('One two.\n\nThree four five.');
  assert.equal(doc.paragraphs.length, 2);
  assert.equal(doc.wordCount, 5);
});

test('replay rebuilds text and tracks provenance', () => {
  const { log } = normalizeLog({ events: [
    { t: 0, type: 'insert', pos: 0, text: 'Hello world' },
    { t: 1000, type: 'delete', pos: 5, length: 6 },
    { t: 2000, type: 'paste', pos: 5, text: ' there, friend' },
    { t: 3000, type: 'replace', pos: 0, length: 5, text: 'Hi' },
    { t: 4000, type: 'snapshot', text: 'Hi there, dear friend' },
  ] });
  const rep = replay(log, 'Hi there, dear friend');
  assert.equal(rep.finalText, 'Hi there, dear friend');
  assert.ok(rep.matchesSubmission);
  const pasteEvent = rep.events.find((e) => e.type === 'paste');
  assert.equal(rep.chars[3].ev, pasteEvent.id);
  assert.equal(rep.events[3].mid, true, 'replace inside existing text is a mid-document edit');
});

test('replay warns when the log does not match the submitted text', () => {
  const { log } = normalizeLog({ events: [{ t: 0, type: 'insert', pos: 0, text: 'abc' }] });
  const rep = replay(log, 'something else');
  assert.equal(rep.matchesSubmission, false);
  assert.match(rep.warnings[0], /does not rebuild/);
});

test('diff finds a single changed region', () => {
  assert.deepEqual(diff('abcdef', 'abXYef'), { pos: 2, removed: 2, inserted: 'XY' });
  assert.equal(diff('same', 'same'), null);
});

test('schema reports invalid events instead of crashing', () => {
  const { log, problems } = normalizeLog({ events: [{ t: 'nope', type: 'insert' }, { t: 5, type: 'weird' }, { t: 6, type: 'insert', pos: 0, text: 'ok' }] });
  assert.equal(log.events.length, 1);
  assert.equal(problems.length, 2);
});

test('demo: pasted, formulaic submission reaches "Review recommended"', () => {
  const r = run('sub-sam-lotf');
  assert.equal(r.summary.status, STATUS.review);
  const paste = r.signals.find((s) => s.detector === 'paste');
  assert.equal(paste.severity, 'High');
  assert.ok(paste.ranges.length, 'paste links to text ranges');
  assert.ok(r.signals.some((s) => s.category === 'baseline' && s.severity !== 'Low'));
});

test('demo: typed essay with a pasted quotation is not escalated', () => {
  const r = run('sub-avery-lotf');
  assert.notEqual(r.summary.status, STATUS.review);
  const paste = r.signals.find((s) => s.detector === 'paste');
  assert.equal(paste.severity, 'Low');
  assert.match(paste.adjustments.join(' '), /quotation/);
});

test('textual patterns alone never reach "Review recommended"', () => {
  const r = run('sub-jordan-media');
  assert.equal(r.replay, null);
  assert.equal(r.baseline, null);
  assert.notEqual(r.summary.status, STATUS.review);
  assert.ok(r.signals.every((s) => s.severity !== 'High'), 'rhetoric is capped without a baseline');
  assert.ok(r.summary.caveats.length > 0);
});

test('no output ever contains probability or accusatory language', () => {
  const banned = /\bAI\b|probabilit|percent chance|cheat|generated|detected/i;
  for (const sub of demo.submissions) {
    const r = run(sub.id);
    const strings = [r.summary.text, ...r.summary.caveats, ...r.signals.flatMap((s) => [s.name, s.finding, s.explanation, s.rule, ...s.alternatives, ...s.adjustments, ...s.evidence.map((e) => `${e.label} ${e.value}`)])];
    for (const str of strings) assert.doesNotMatch(str, banned, str);
  }
});

test('every signal carries evidence, alternatives and a rule', () => {
  for (const sub of demo.submissions) {
    for (const s of run(sub.id).signals) {
      assert.ok(s.finding, `${s.id} finding`);
      assert.ok(s.evidence.length, `${s.id} evidence`);
      assert.ok(s.alternatives.length, `${s.id} alternatives`);
      assert.ok(s.rule, `${s.id} rule`);
      assert.ok(['Low', 'Medium', 'High'].includes(s.severity));
    }
  }
});

test('dismissed signals are excluded from the status but kept', () => {
  const first = run('sub-sam-lotf');
  const annotations = Object.fromEntries(first.signals.filter((s) => s.severity !== 'Low').map((s) => [s.id, { status: 'dismissed', note: 'discussed' }]));
  const r = run('sub-sam-lotf', { annotations });
  assert.equal(r.summary.status, STATUS.none);
  assert.equal(r.signals.length, first.signals.length);
});

test('student context caps related signals and records why', () => {
  const r = run('sub-sam-lotf', { student: { context: { draftsElsewhere: true } } });
  const paste = r.signals.find((s) => s.detector === 'paste');
  assert.equal(paste.severity, 'Low');
  assert.match(paste.adjustments.join(' '), /draft in another app/);
});

test('thresholds are configurable', () => {
  const strict = mergeConfig({ paste: { highWords: 10000, mediumWords: 5000 } });
  const r = run('sub-sam-lotf', { config: strict });
  assert.equal(r.signals.find((s) => s.detector === 'paste').severity, 'Low');
});

test('moving your own text is recognised as an internal move', () => {
  const para = 'This paragraph was written by the student and then moved to a different place in the essay.';
  const { log } = normalizeLog({ events: [
    { t: 0, type: 'insert', pos: 0, text: 'Intro. ' + para },
    { t: 5000, type: 'delete', pos: 7, length: para.length },
    { t: 9000, type: 'paste', pos: 0, text: para + ' ' },
  ] });
  const r = analyzeSubmission({ submission: { id: 'x', finalText: null, log }, student: {}, samples: [], config });
  const paste = r.signals.find((s) => s.detector === 'paste');
  assert.equal(paste.severity, 'Low');
  assert.match(paste.adjustments.join(' '), /moving their own writing/);
});

test('baseline reliability depends on samples and words', () => {
  const sam = buildBaseline(demo.samples.filter((s) => s.studentId === 'stu-sam'), config);
  const avery = buildBaseline(demo.samples.filter((s) => s.studentId === 'stu-avery'), config);
  assert.equal(sam.reliability, 'Established');
  assert.equal(avery.reliability, 'Limited');
  assert.ok(sam.process, 'process baseline from sample logs');
});

test('simulator output replays exactly', () => {
  const text = 'A short test paragraph with enough words to exercise the simulator properly.';
  const { log, finalText } = simulateSession({ start: 0, seed: 3, plan: [{ type: 'type', text, wpm: 40, revise: 0.3, rethink: 0.3 }] });
  assert.equal(finalText, text);
  const { log: norm } = normalizeLog(log);
  assert.equal(replay(norm).finalText, text);
});

test('features are finite numbers', () => {
  const f = computeFeatures(demo.samples[0].text);
  for (const [k, v] of Object.entries(f.values)) assert.ok(v === null || Number.isFinite(v), k);
});
