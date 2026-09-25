// Neutral follow-up questions for the teacher, and student-facing prompts for
// conference mode. They point at specific passages so the conversation is
// about the student's own work, never about suspicion.

import { fmtClock, excerpt } from '../util.js';

function mostComplexSentence(current) {
  const s = current.discourse.sentences
    .filter((x) => x.text.split(/\s+/).length >= 12 && !/^["“]/.test(x.text))
    .map((x) => ({ x, score: x.level * 2 + (x.text.match(/,/g) || []).length + x.text.split(/\s+/).length / 12 }))
    .sort((a, b) => b.score - a.score)[0];
  return s?.x || null;
}

export function followUpQuestions(result) {
  const { current, categories, assignment } = result;
  const d = current.discourse;
  const qs = [];
  const thesis = d.sentences.find((s) => s.move === 'thesis');
  qs.push({ q: 'Can the student explain the main argument in their own words?', detail: thesis ? `Thesis as written: "${excerpt(current.doc.text, thesis, 200)}"` : null });
  const ev = d.sentences.find((s) => s.move === 'evidence' && /["“]/.test(s.text));
  qs.push({ q: 'Can the student explain why they selected their evidence?', detail: ev ? `For example: "${excerpt(current.doc.text, ev, 180)}"` : null });
  const complex = mostComplexSentence(current);
  if (complex) qs.push({ q: 'Can the student explain the meaning of a particularly sophisticated sentence?', detail: `"${excerpt(current.doc.text, complex, 240)}"` });
  const body = d.paragraphs.find((p) => p.role === 'body' && p.sequence.length >= 4) || d.paragraphs.find((p) => p.role === 'body');
  qs.push({ q: 'Can the student reproduce part of the reasoning under supervised conditions?', detail: body ? `For instance, the argument of paragraph ${body.index + 1} (${body.pattern}).` : null });
  const proc = current.process;
  const big = proc?.insertions?.filter((i) => !i.internalMove).sort((a, b) => b.words - a.words)[0];
  if (big && big.words >= 40) qs.push({ q: 'Does the student have drafts, notes, or planning documents?', detail: `In particular for the ${big.words}-word block that entered the document${big.t ? ` at ${fmtClock(big.t)}` : ''}.` });
  else if (proc?.periods?.some((p) => p.long)) {
    const p = proc.periods.filter((x) => x.long).sort((a, b) => b.words - a.words)[0];
    qs.push({ q: 'Does the student have drafts, notes, or planning documents?', detail: `How was the ${p.words}-word passage written between ${fmtClock(p.start)} and ${fmtClock(p.end)} prepared?` });
  } else qs.push({ q: 'Does the student have drafts, notes, or planning documents?', detail: null });
  const lex = categories.find((c) => c.id === 'style')?.notable.find((r) => ['academicRate', 'rareWordRate', 'advancedVerbShare'].includes(r.id));
  const newWords = result.newVocabulary?.slice(0, 6) || [];
  qs.push({
    q: 'Does the writing reflect material taught recently in class?',
    detail: assignment?.taughtTerms?.length ? `Terms taught for this task: ${assignment.taughtTerms.join(', ')}.` : lex && newWords.length ? `Where did the student encounter words such as ${newWords.join(', ')}?` : null,
  });
  const disc = categories.find((c) => c.id === 'discourse')?.notable[0];
  if (disc) qs.push({ q: 'Can the student talk through how this argument was built?', detail: `This piece differs from earlier work in ${disc.label.toLowerCase()}.` });
  return qs;
}

export function conferencePrompts(result) {
  const out = [
    'Can you walk me through your main argument, in your own words?',
    'How did you choose the quotations and examples you used?',
    'Tell me about how you planned and wrote this piece. Where and when did you work on it?',
  ];
  const complex = mostComplexSentence(result.current);
  if (complex) out.push(`What did you mean in this sentence: "${excerpt(result.current.doc.text, complex, 200)}"?`);
  const big = result.current.process?.insertions?.filter((i) => !i.internalMove).sort((a, b) => b.words - a.words)[0];
  if (big && big.words >= 40) out.push(`Some text${big.t ? ` (around ${fmtClock(big.t)})` : ''} was added in one block. Where did you write that part first?`);
  out.push('Is there anything we worked on in class that helped you write this way?');
  return out;
}
