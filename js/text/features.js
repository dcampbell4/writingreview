// Stylometric features. Used both to describe a student's baseline and to
// describe a new submission. Every feature is a plain, explainable number.

import { analyzeDocument, syllables, quotedRanges, inRanges, words as tokenWords } from './tokenize.js';
import {
  TRANSITIONS, CONJUNCTIONS, SUBORDINATORS, MODALS, HEDGES, FIRST_PERSON, ANALYTICAL_VERB_RE,
  NOMINALIZATION_RE, FIGURATIVE_RE, PASSIVE_RE, CONTRACTION_RE, COMMON_MISSPELLINGS, CONCLUSION_OPENERS,
} from './lexicons.js';

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const per = (count, total, unit) => (total ? (count / total) * unit : 0);
const countRe = (text, re) => (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) || []).length;
const startsWithPhrase = (sentence, phrases) => {
  const s = sentence.toLowerCase();
  return phrases.some((p) => s.startsWith(p + ' ') || s.startsWith(p + ','));
};

// Groups control how deviations are explained to teachers.
export const FEATURE_GROUPS = {
  sentence: {
    label: 'Sentence structure',
    alternatives: ['Instruction on sentence variety or combining.', 'Different genre or assignment demands.', 'Genuine growth over time.', 'Feedback from a teacher, tutor or peer.'],
  },
  vocabulary: {
    label: 'Vocabulary',
    alternatives: ['Assignment-specific or source-text vocabulary.', 'Recent vocabulary instruction.', 'Thesaurus or dictionary use.', 'Genuine language growth.'],
  },
  rhetoric: {
    label: 'Rhetorical habits',
    alternatives: ['A new essay structure or sentence frames taught in class.', 'Different prompt type (e.g. argument vs. narrative).', 'Model essays the class studied.'],
  },
  mechanics: {
    label: 'Mechanics and punctuation',
    alternatives: ['Spellcheck or grammar tools in the writing environment.', 'Careful proofreading for a graded task.', 'Different device or keyboard.'],
  },
  structure: {
    label: 'Paragraph and essay structure',
    alternatives: ['Different length requirement or format.', 'A new structure taught in class.', 'Time available for the task.'],
  },
};

export const FEATURES = [
  { id: 'avgSentenceLength', label: 'Average sentence length', unit: 'words', group: 'sentence', minSpread: 2.5, digits: 1,
    compute: (d) => mean(d.sentences.map((s) => s.words.length)) },
  { id: 'sentenceLengthSD', label: 'Sentence-length variation (SD)', unit: 'words', group: 'sentence', minSpread: 2, digits: 1,
    compute: (d) => sd(d.sentences.map((s) => s.words.length)) },
  { id: 'complexSentenceRate', label: 'Complex sentences', unit: '% of sentences', group: 'sentence', minSpread: 8, digits: 0,
    compute: (d) => per(d.sentences.filter((s) => s.words.some((w) => SUBORDINATORS.includes(w.lower)) || /;/.test(s.text) || (s.text.match(/,/g) || []).length >= 2).length, d.sentences.length, 100) },
  { id: 'commasPerSentence', label: 'Commas per sentence', unit: '', group: 'mechanics', minSpread: 0.3, digits: 2,
    compute: (d) => per(countRe(d.text, /,/g), d.sentences.length, 1) },
  { id: 'avgWordLength', label: 'Average word length', unit: 'letters', group: 'vocabulary', minSpread: 0.2, digits: 2,
    compute: (d) => mean(d.words.map((w) => w.text.length)) },
  { id: 'longWordRate', label: 'Words of 3+ syllables', unit: '% of words', group: 'vocabulary', minSpread: 2, digits: 1,
    compute: (d) => per(d.words.filter((w) => syllables(w.text) >= 3).length, d.wordCount, 100) },
  { id: 'lexicalDiversity', label: 'Lexical diversity (MATTR-50)', unit: '', group: 'vocabulary', minSpread: 0.04, digits: 3,
    compute: (d) => mattr(d.words.map((w) => w.lower), 50) },
  { id: 'nominalizationRate', label: 'Abstract nouns (-tion, -ity, -ness…)', unit: 'per 100 words', group: 'vocabulary', minSpread: 0.8, digits: 1,
    compute: (d) => per(countRe(d.text, NOMINALIZATION_RE), d.wordCount, 100) },
  { id: 'transitionRate', label: 'Transition words', unit: 'per 100 words', group: 'rhetoric', minSpread: 0.5, digits: 2,
    compute: (d) => per(countPhrases(d.text, TRANSITIONS), d.wordCount, 100) },
  { id: 'transitionOpenerShare', label: 'Sentences opening with a transition', unit: '% of sentences', group: 'rhetoric', minSpread: 5, digits: 0,
    compute: (d) => per(d.sentences.filter((s) => startsWithPhrase(s.text, TRANSITIONS)).length, d.sentences.length, 100) },
  { id: 'thisTheItOpeners', label: 'Sentences opening with This / The / It', unit: '% of sentences', group: 'rhetoric', minSpread: 6, digits: 0,
    compute: (d) => per(d.sentences.filter((s) => /^(?:This|The|It|These)\b/.test(s.text)).length, d.sentences.length, 100) },
  { id: 'analyticalVerbRate', label: 'Analytical verbs (highlights, conveys…)', unit: 'per 1,000 words', group: 'rhetoric', minSpread: 3, digits: 1,
    compute: (d) => per(countRe(d.text, ANALYTICAL_VERB_RE), d.wordCount, 1000) },
  { id: 'hedgingRate', label: 'Hedging words', unit: 'per 1,000 words', group: 'rhetoric', minSpread: 3, digits: 1,
    compute: (d) => per(d.words.filter((w) => HEDGES.includes(w.lower)).length, d.wordCount, 1000) },
  { id: 'modalRate', label: 'Modal verbs', unit: 'per 100 words', group: 'rhetoric', minSpread: 0.6, digits: 2,
    compute: (d) => per(d.words.filter((w) => MODALS.includes(w.lower)).length, d.wordCount, 100) },
  { id: 'firstPersonRate', label: 'First person (I, my, me)', unit: 'per 100 words', group: 'rhetoric', minSpread: 0.5, digits: 2,
    compute: (d) => per(d.words.filter((w) => FIRST_PERSON.includes(w.lower)).length, d.wordCount, 100) },
  { id: 'passiveRate', label: 'Passive-voice sentences', unit: '% of sentences', group: 'sentence', minSpread: 5, digits: 0,
    compute: (d) => per(d.sentences.filter((s) => PASSIVE_RE.test(s.text)).length, d.sentences.length, 100) },
  { id: 'conjunctionRate', label: 'Conjunctions (and, but, so, because)', unit: 'per 100 words', group: 'sentence', minSpread: 0.8, digits: 2,
    compute: (d) => per(d.words.filter((w) => CONJUNCTIONS.includes(w.lower)).length, d.wordCount, 100) },
  { id: 'figurativeRate', label: 'Figurative comparisons (like, as if)', unit: 'per 1,000 words', group: 'vocabulary', minSpread: 2, digits: 1,
    compute: (d) => per(countRe(d.text, FIGURATIVE_RE), d.wordCount, 1000) },
  { id: 'semicolonColonRate', label: 'Semicolons and colons', unit: 'per 1,000 words', group: 'mechanics', minSpread: 2, digits: 1,
    compute: (d) => per(countRe(d.text, /[;:]/g), d.wordCount, 1000) },
  { id: 'dashRate', label: 'Dashes', unit: 'per 1,000 words', group: 'mechanics', minSpread: 2, digits: 1,
    compute: (d) => per(countRe(d.text, /—|–| - |--/g), d.wordCount, 1000) },
  { id: 'contractionRate', label: 'Contractions', unit: 'per 100 words', group: 'mechanics', minSpread: 0.4, digits: 2,
    compute: (d) => per(countRe(d.text, CONTRACTION_RE), d.wordCount, 100) },
  { id: 'errorRate', label: 'Recurring errors (spelling, lowercase "i", etc.)', unit: 'per 1,000 words', group: 'mechanics', minSpread: 2, digits: 1,
    compute: (d) => per(findErrors(d).length, d.wordCount, 1000) },
  { id: 'quoteRate', label: 'Quotations', unit: 'per 1,000 words', group: 'structure', minSpread: 2, digits: 1,
    compute: (d) => per(quotedRanges(d.text).length, d.wordCount, 1000) },
  { id: 'avgParagraphLength', label: 'Average paragraph length', unit: 'words', group: 'structure', minSpread: 20, digits: 0,
    compute: (d) => mean(d.paragraphs.map((p) => p.words.length)) },
  { id: 'thesisLength', label: 'Thesis sentence length (last sentence of paragraph 1)', unit: 'words', group: 'structure', minSpread: 6, digits: 0,
    compute: (d) => { const p = d.paragraphs[0]; if (!p || d.paragraphs.length < 3 || !p.sentences.length) return null; return p.sentences[p.sentences.length - 1].words.length; } },
];

export const FEATURE_BY_ID = Object.fromEntries(FEATURES.map((f) => [f.id, f]));

export function computeFeatures(textOrDoc) {
  const doc = typeof textOrDoc === 'string' ? analyzeDocument(textOrDoc) : textOrDoc;
  const values = {};
  for (const f of FEATURES) {
    const v = doc.wordCount ? f.compute(doc) : null;
    values[f.id] = Number.isFinite(v) ? v : null;
  }
  return {
    values,
    wordCount: doc.wordCount,
    conclusionOpener: conclusionOpener(doc),
    errors: findErrors(doc).map((e) => e.label),
  };
}

export function conclusionOpener(doc) {
  if (doc.paragraphs.length < 3) return null;
  const last = doc.paragraphs[doc.paragraphs.length - 1].text;
  const hit = CONCLUSION_OPENERS.find(([, re]) => re.test(last));
  return hit ? hit[0] : 'other';
}

// Moving-average type/token ratio: length-independent lexical diversity.
export function mattr(tokens, window) {
  if (tokens.length === 0) return 0;
  if (tokens.length <= window) return new Set(tokens).size / tokens.length;
  const counts = new Map();
  let distinct = 0;
  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    counts.set(t, (counts.get(t) || 0) + 1);
    if (counts.get(t) === 1) distinct++;
    if (i >= window) {
      const old = tokens[i - window];
      counts.set(old, counts.get(old) - 1);
      if (counts.get(old) === 0) distinct--;
    }
    if (i >= window - 1) total += distinct / window;
  }
  return total / (tokens.length - window + 1);
}

function countPhrases(text, phrases) {
  const lower = text.toLowerCase();
  let n = 0;
  for (const p of phrases) {
    const re = new RegExp('\\b' + p.replace(/ /g, '\\s+') + '\\b', 'g');
    n += (lower.match(re) || []).length;
  }
  return n;
}

// Observable mechanics habits. Returned with positions so they can be shown.
export function findErrors(doc) {
  const out = [];
  const quotes = quotedRanges(doc.text);
  for (const w of doc.words) {
    if (inRanges(w.start, quotes)) continue;
    if (w.text === 'i') out.push({ label: 'lowercase "i"', start: w.start, end: w.end });
    else if (COMMON_MISSPELLINGS.includes(w.lower)) out.push({ label: `"${w.text}"`, start: w.start, end: w.end });
  }
  for (const s of doc.sentences) {
    if (/^[a-z]/.test(s.text)) out.push({ label: 'lowercase sentence start', start: s.start, end: s.start + 1 });
  }
  const re = /\b(\w+)\s+\1\b/gi;
  let m;
  while ((m = re.exec(doc.text))) {
    if (m[1].toLowerCase() !== 'that' && m[1].toLowerCase() !== 'had') out.push({ label: 'doubled word', start: m.index, end: m.index + m[0].length });
  }
  const re2 = /\s[,.]\S|  +\S/g;
  while ((m = re2.exec(doc.text))) out.push({ label: 'spacing around punctuation', start: m.index, end: m.index + m[0].length });
  return out;
}

// Sophistication proxy used by several detectors: share of long words.
export function sophistication(text) {
  const ws = tokenWords(text);
  if (!ws.length) return 0;
  return ws.filter((w) => syllables(w.text) >= 3).length / ws.length;
}

export { mean, sd };
