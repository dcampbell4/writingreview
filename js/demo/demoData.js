// A fictional class for demonstration. Each student illustrates a different
// situation the tool must handle responsibly:
//   S-1042  substantial, converging change (style + discourse + process + insertion)
//   S-2217  consistent writer: current piece is typical for them
//   S-3308  steady development over a year: recognised as growth, not an anomaly
//   S-4410  only one earlier sample: insufficient baseline, inconclusive
import { simulateSession } from './simulate.js';
import { countWords } from '../text/tokenize.js';
import * as T from './texts.js';

const at = (iso) => Date.parse(iso);
const LIT = { genre: 'Literary analysis', subject: 'English', assignment_type: 'Literary essay', timed: false };

function sample(student_id, id, fields) {
  return { id, student_id, assignment_id: null, role: 'baseline', include: true, authentic: true, process_data: null, ...fields, word_count: countWords(fields.text) };
}

function withLog(text, date, seed, wpm, revise, rethink = 0.06) {
  const { log, finalText } = simulateSession({ start: at(date), seed, plan: [{ type: 'type', text, wpm, revise, rethink }] });
  return { text: finalText, process_data: { log } };
}

export function buildDemo() {
  const assignments = [{
    id: 'A-LOTF', title: 'Lord of the Flies: Symbolism Essay', genre: 'Literary analysis', subject: 'English', assignment_type: 'Literary essay',
    timed: false, durationMinutes: null, inClass: false, researchAllowed: false, notesAllowed: true, aiAllowed: false, collaborationAllowed: false,
    sentenceFrames: false, modelEssay: false, taughtTerms: ['symbolism', 'symbol', 'civilization', 'civilisation', 'savagery', 'allegory'], gradeLevel: '10', date: '2026-09-22',
  }];
  const students = [
    { id: 'S-1042', displayName: 'Sam Rivera', gradeLevel: '10', context: {}, notes: '' },
    { id: 'S-2217', displayName: 'Avery Chen', gradeLevel: '10', context: {}, notes: '' },
    { id: 'S-3308', displayName: 'Jordan Price', gradeLevel: '10', context: {}, notes: '' },
    { id: 'S-4410', displayName: 'Riley Okafor', gradeLevel: '10', context: {}, notes: 'Joined the school this term.' },
  ];
  const samples = [];

  // S-1042: established profile with process logs.
  T.SAM_PRIOR.forEach((s, i) => samples.push(sample('S-1042', `S-1042-b${i + 1}`, { title: s.title, timestamp: s.date, ...LIT, ...withLog(s.text, s.date, 11 + i, 26, 0.3, 0.2) })));
  T.SAM_EXTRA.forEach((s, i) => samples.push(sample('S-1042', `S-1042-x${i + 1}`, { title: s.title, timestamp: s.date, genre: s.genre, subject: 'English', assignment_type: s.type, timed: s.timed, text: s.text })));
  const sam = simulateSession({
    start: at('2026-09-22T09:02:00'), seed: 42,
    plan: [
      { type: 'type', text: T.SAM_TYPED, wpm: 28, revise: 0.3, rethink: 0.08 },
      { type: 'pause', sec: 150 },
      { type: 'type', text: T.SAM_CONTINUOUS, wpm: 62, revise: 0, rethink: 0 },
      { type: 'pause', sec: 70 },
      { type: 'paste', text: T.SAM_INSERTED },
      { type: 'pause', sec: 60 },
      { type: 'edit', find: 'talk about the conch, Simon and Piggys glasses', replace: 'talk about the fire, the conch, Simon and Piggys glasses' },
      { type: 'pause', sec: 40 },
    ],
  });
  samples.push(sample('S-1042', 'S-1042-c1', { role: 'current', assignment_id: 'A-LOTF', title: 'Lord of the Flies: Symbolism Essay', timestamp: '2026-09-22T09:50:00', ...LIT, text: sam.finalText, process_data: { log: sam.log } }));

  // S-2217: consistent, sophisticated writer.
  T.AVERY_PRIOR.forEach((s, i) => samples.push(sample('S-2217', `S-2217-b${i + 1}`, { title: s.title, timestamp: s.date, ...LIT, ...withLog(s.text, s.date, 21 + i, 31, 0.3, 0.12) })));
  T.AVERY_EXTRA.forEach((s, i) => samples.push(sample('S-2217', `S-2217-x${i + 1}`, { title: s.title, timestamp: s.date, genre: s.genre, subject: 'English', assignment_type: s.type, timed: s.timed, text: s.text })));
  const avery = simulateSession({
    start: at('2026-09-22T13:10:00'), seed: 7,
    plan: [
      { type: 'type', text: T.AVERY_PART1, wpm: 31, revise: 0.3, rethink: 0.12 },
      { type: 'paste', text: T.AVERY_QUOTE },
      { type: 'type', text: T.AVERY_PART2, wpm: 31, revise: 0.3, rethink: 0.12 },
    ],
  });
  samples.push(sample('S-2217', 'S-2217-c1', { role: 'current', assignment_id: 'A-LOTF', title: 'Lord of the Flies: Symbolism Essay', timestamp: '2026-09-22T13:45:00', ...LIT, text: avery.finalText, process_data: { log: avery.log } }));

  // S-3308: gradual development across the year (no process data).
  T.JORDAN_SERIES.forEach((s, i) => samples.push(sample('S-3308', `S-3308-b${i + 1}`, { title: s.title, timestamp: s.date, ...LIT, text: s.text })));
  samples.push(sample('S-3308', 'S-3308-c1', { role: 'current', assignment_id: 'A-LOTF', title: 'Lord of the Flies: Symbolism Essay', timestamp: '2026-09-22T15:00:00', ...LIT, text: T.JORDAN_CURRENT }));

  // S-4410: a single earlier sample.
  samples.push(sample('S-4410', 'S-4410-b1', { title: 'Goals for this year (reflection)', timestamp: '2026-09-02T10:00:00', genre: 'Reflection', subject: 'English', assignment_type: 'Reflection', timed: false, text: T.RILEY_BASELINE }));
  samples.push(sample('S-4410', 'S-4410-c1', { role: 'current', assignment_id: 'A-LOTF', title: 'Lord of the Flies: Symbolism Essay', timestamp: '2026-09-22T16:00:00', ...LIT, text: T.RILEY_CURRENT }));

  return { students, assignments, samples };
}
