// Imported process reports (PDF text / other tools' JSON).
import test from 'node:test';
import assert from 'node:assert/strict';

import { parseProcessReport, locateExcerpt, parseDuration, findTimestamp } from '../js/import/processReport.js';
import { parseImport } from '../js/schema.js';
import { docxXmlToText } from '../js/import/documents.js';

// Layout A: label and value on separate lines, a "Pasted content" section with quoted excerpts.
const LAYOUT_A = `Writing Process Report
Document: Lord of the Flies Symbolism Essay
Student: Sam Rivera
Writing time
1h 12m
Sessions
3
Edits
1,284
Pastes
2
Session 1 Sep 20, 2026 7:14 PM 38 min
Session 2 Sep 21, 2026 4:02 PM 21 min
Session 3 Sep 22, 2026 9:00 AM 13 min
Pasted content
Sep 22, 2026 9:09 AM · 2,431 characters
"Furthermore, the conch serves as a powerful symbol of civilization and democratic order. When Ralph first
blows the conch, it gathers the scattered boys and establishes a sense of structure on the island."
Sep 22, 2026 9:15 AM · 96 characters
"Things are breaking up. I don't understand why."`;

// Layout B: "label: value" lines, day-first dates, paste lines without a heading.
const LAYOUT_B = `Process report
Name: Avery Chen
Title: Speaking and the conch
Total time spent: 01:35:10
Number of sessions: 4
Copy-paste events: 1
Pasted 17 words at 22/09/2026 13:14
Things are breaking up. I don't understand why. We began well; we were happy
Word count: 342`;

test('parses a report with labels and values on separate lines', () => {
  const r = parseProcessReport(LAYOUT_A);
  assert.equal(r.student, 'Sam Rivera');
  assert.equal(r.title, 'Lord of the Flies Symbolism Essay');
  assert.deepEqual(r.metrics, { writingMinutes: 72, sessions: 3, edits: 1284, pasteCount: 2 });
  assert.equal(r.pastes.length, 2);
  assert.equal(r.pastes[0].chars, 2431);
  assert.match(r.pastes[0].excerpt, /^Furthermore, the conch .* on the island\.$/);
  assert.equal(new Date(r.pastes[0].time).getHours(), 9);
  assert.equal(r.sessions.length, 3);
  assert.equal(r.sessions[0].minutes, 38);
});

test('parses a report with "label: value" lines and day-first dates', () => {
  const r = parseProcessReport(LAYOUT_B);
  assert.equal(r.student, 'Avery Chen');
  assert.equal(Math.round(r.metrics.writingMinutes), 95);
  assert.equal(r.metrics.sessions, 4);
  assert.equal(r.metrics.pasteCount, 1);
  assert.equal(r.metrics.totalWords, 342);
  assert.equal(r.pastes.length, 1);
  assert.equal(r.pastes[0].words, 17);
  const d = new Date(r.pastes[0].time);
  assert.equal(d.getDate(), 22);
  assert.equal(d.getMonth(), 8);
  assert.match(r.pastes[0].excerpt, /^Things are breaking up/);
});

test('durations and timestamps', () => {
  assert.equal(parseDuration('2 hours 5 minutes'), 125);
  assert.equal(parseDuration('45 min'), 45);
  assert.equal(parseDuration('00:30:00'), 30);
  assert.equal(new Date(findTimestamp('Edited 2026-09-22 14:05').t).getHours(), 14);
  assert.equal(findTimestamp('no date here'), null);
});

test('locates a pasted excerpt in the final text despite line breaks and curly quotes', () => {
  const final = 'Intro.\n\nFurthermore, the conch serves as a powerful\nsymbol of civilization. Next.';
  const r = locateExcerpt(final, 'Furthermore, the conch serves as a powerful symbol of civilization.');
  assert.ok(r);
  assert.equal(final.slice(r.start, r.end), 'Furthermore, the conch serves as a powerful\nsymbol of civilization');
});

test('JSON import is forgiving and explains failures', () => {
  assert.equal(parseImport('﻿{"events":[{"t":1,"type":"insert","pos":0,"text":"hi"}]}').kind, 'submission');
  const revs = parseImport(JSON.stringify({ title: 'Essay', revisions: [{ time: '2026-09-22T09:00:00Z', content: 'a' }, { time: '2026-09-22T09:05:00Z', content: 'a b' }] }));
  assert.equal(revs.kind, 'submission');
  assert.equal(revs.data.log.events[0].type, 'snapshot');
  const other = parseImport(JSON.stringify({ student: 'X', typingTime: '45 minutes', sessions: 3, pastes: [{ timestamp: '2026-09-22 09:09', characters: 1200, text: 'Some pasted text that is long enough to count.' }] }));
  assert.equal(other.kind, 'report');
  assert.equal(other.data.metrics.writingMinutes, 45);
  assert.equal(other.data.pastes.length, 1);
  assert.equal(other.data.pastes[0].chars, 1200);
  assert.throws(() => parseImport('{bad'), /not valid JSON/);
  assert.throws(() => parseImport('{"foo":1}'), /no writing events/);
});

test('table layout: a row of labels followed by a row of values', () => {
  const r = parseProcessReport('Writing time Sessions Edits Pastes\n1h 12m 3 1,284 2\nOther text');
  assert.deepEqual(r.metrics, { writingMinutes: 72, sessions: 3, edits: 1284, pasteCount: 2 });
});

test('reads paragraphs from Word document XML', () => {
  const xml = '<w:document><w:body><w:p><w:r><w:t>First &amp; foremost</w:t></w:r><w:r><w:t xml:space="preserve"> line.</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p></w:body></w:document>';
  assert.equal(docxXmlToText(xml), 'First & foremost line.\nSecond');
});
