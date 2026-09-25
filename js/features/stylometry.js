// Student authorship fingerprint: sentence, lexical, syntax, voice and
// mechanics features, plus low-weight "surface" indicators.
// Every feature is a plain number with a human-readable description so it can
// be compared against the student's own distribution of past values.

import { words as tokenWords, syllables, stem, quotedRanges, inRanges } from '../text/tokenize.js';
import {
  COMMON_WORDS, ACADEMIC_WORDS, BASIC_ANALYTIC_VERBS, ADVANCED_ANALYTIC_VERBS, HEDGES, BOOSTERS, INTENSIFIERS,
  MODALS, EVALUATIVE, FIRST_PERSON, SUBORDINATORS, RELATIVES, PREPOSITIONS, LY_NOT_ADVERBS, TRANSITION_PHRASES,
  ABSTRACT_TERMS, WEAK_SURFACE, COMMON_MISSPELLINGS,
} from '../text/lexicons.js';

export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
export const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const sd = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const per = (n, d, unit) => (d ? (n / d) * unit : 0);
const countRe = (text, re) => (text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) || []).length;
const lemmaIn = (w, list) => list.has(w) || list.has(w.replace(/(?:ies)$/, 'y')) || list.has(w.replace(/(?:es|s|ed|ing|ly|al)$/, '')) || list.has(w.replace(/(?:ing|ed)$/, 'e'));

// Tokens used for vocabulary measures: outside quotations, not names, not taught terms.
function vocabTokens(doc, taught) {
  const quotes = quotedRanges(doc.text);
  return doc.words.filter((w) => {
    if (inRanges(w.start, quotes)) return false;
    const before = doc.text.slice(Math.max(0, w.start - 3), w.start);
    if (/^[A-Z]/.test(w.text) && !/(^|[.!?]\s+|\n\s*)$/.test(before)) return false;
    if (taught.size && (taught.has(w.lower) || taught.has(stem(w.lower)))) return false;
    return true;
  });
}

function clauseMarkers(sentence) {
  const ws = sentence.words.map((w) => w.lower);
  let sub = 0;
  let rel = 0;
  ws.forEach((w, i) => {
    if (SUBORDINATORS.has(w) && !(w === 'as' && ws[i + 1] === 'well')) sub++;
    else if (RELATIVES.has(w) && i > 0 && !(w === 'that' && /^(?:this|that|these|those|the|a|an)$/.test(ws[i + 1] || ''))) rel++;
  });
  const coord = (sentence.text.match(/,\s+(?:and|but|or|so|yet)\s/gi) || []).length;
  return { sub, rel, coord, clauses: 1 + sub + rel + coord };
}

function mattr(tokens, window = 50) {
  if (!tokens.length) return 0;
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

function quotesInfo(doc) {
  const q = quotedRanges(doc.text).filter((r) => doc.text.slice(r.start, r.end).split(/\s+/).length >= 2);
  return q.map((r) => {
    const before = doc.text.slice(Math.max(0, r.start - 40), r.start);
    const introducedBySays = /\b(?:says?|said|states?|stated|writes?|wrote|tells?|told|explains?|claims?|remarks?|notes?|argues?)\b[^a-z]{0,4}$/i.test(before) || /:\s*$/.test(before);
    const midSentence = /[a-z,]\s*$/.test(before) && !introducedBySays;
    return { ...r, words: doc.text.slice(r.start, r.end).split(/\s+/).length, introducedBySays, midSentence };
  });
}

export const GROUPS = {
  sentence: { label: 'Sentences', category: 'style' },
  lexical: { label: 'Vocabulary', category: 'style' },
  syntax: { label: 'Syntax', category: 'style' },
  voice: { label: 'Voice', category: 'style' },
  mechanics: { label: 'Mechanics', category: 'style' },
  surface: { label: 'Surface indicators (weak)', category: 'style' },
};

// Each feature: how it is computed, how to talk about it, and how much it may
// weigh. `weight` < 1 marks weak signals.
export const STYLE_FEATURES = [
  // --- Sentence level
  { id: 'meanSentenceLength', group: 'sentence', label: 'Mean sentence length', unit: 'words', digits: 1, minSpread: 2.5,
    plain: 'average number of words per sentence', compute: (d) => mean(d.sentences.map((s) => s.words.length)) },
  { id: 'medianSentenceLength', group: 'sentence', label: 'Median sentence length', unit: 'words', digits: 0, minSpread: 2.5,
    plain: 'typical sentence length', compute: (d) => median(d.sentences.map((s) => s.words.length)) },
  { id: 'sentenceLengthSD', group: 'sentence', label: 'Sentence-length variation', unit: 'words (SD)', digits: 1, minSpread: 2,
    plain: 'how much sentence lengths vary', compute: (d) => sd(d.sentences.map((s) => s.words.length)) },
  { id: 'clauseDensity', group: 'sentence', label: 'Clauses per sentence (estimated)', unit: '', digits: 2, minSpread: 0.25,
    plain: 'how many clauses a sentence typically contains', compute: (d) => mean(d.sentences.map((s) => clauseMarkers(s).clauses)) },
  { id: 'subordinateRate', group: 'sentence', label: 'Subordinate clauses', unit: 'per sentence', digits: 2, minSpread: 0.15,
    plain: 'clauses introduced by because, although, which, who…', compute: (d) => mean(d.sentences.map((s) => { const c = clauseMarkers(s); return c.sub + c.rel; })) },
  { id: 'coordinationRate', group: 'sentence', label: 'Coordinated clauses (", and", ", but")', unit: 'per sentence', digits: 2, minSpread: 0.1,
    plain: 'clauses joined with and/but/so', compute: (d) => mean(d.sentences.map((s) => clauseMarkers(s).coord)) },
  { id: 'fragmentRate', group: 'sentence', label: 'Very short sentences / fragments', unit: '% of sentences', digits: 0, minSpread: 4,
    plain: 'sentences of four words or fewer', compute: (d) => per(d.sentences.filter((s) => s.words.length <= 4).length, d.sentences.length, 100) },
  { id: 'rhetoricalQuestionRate', group: 'sentence', label: 'Questions', unit: '% of sentences', digits: 0, minSpread: 3,
    plain: 'sentences that ask a question (outside quotations)', compute: (d) => { const q = quotedRanges(d.text); return per(d.sentences.filter((s) => /\?\s*$/.test(s.text) && !inRanges(s.end - 1, q)).length, d.sentences.length, 100); } },
  { id: 'openerVariety', group: 'sentence', label: 'Variety of sentence openings', unit: '% distinct', digits: 0, minSpread: 6,
    plain: 'share of sentences that start with a different first word', compute: (d) => per(new Set(d.sentences.map((s) => s.words[0]?.lower)).size, d.sentences.length, 100) },
  { id: 'patternRepetition', group: 'sentence', label: 'Repeated sentence openings', unit: '% of sentences', digits: 0, minSpread: 6,
    plain: 'sentences whose first two words repeat an earlier opening (e.g. "This shows…")', compute: (d) => {
      const seen = new Set(); let rep = 0;
      for (const s of d.sentences) { const k = s.words.slice(0, 2).map((w) => w.lower).join(' '); if (seen.has(k)) rep++; seen.add(k); }
      return per(rep, d.sentences.length, 100);
    } },

  // --- Lexical
  { id: 'mattr', group: 'lexical', label: 'Vocabulary diversity (MATTR)', unit: '', digits: 3, minSpread: 0.03,
    plain: 'how varied the vocabulary is, independent of length', compute: (d) => mattr(d.words.map((w) => w.lower)) },
  { id: 'ttr300', group: 'lexical', label: 'Type-token ratio (first 300 words)', unit: '', digits: 3, minSpread: 0.04,
    plain: 'share of different words in the first 300 words', compute: (d) => { const t = d.words.slice(0, 300).map((w) => w.lower); return t.length ? new Set(t).size / t.length : 0; } },
  { id: 'rareWordRate', group: 'lexical', label: 'Less common words', unit: '% of words', digits: 1, minSpread: 1.5,
    plain: 'words of 7+ letters outside a list of everyday words (quotations, names and taught terms excluded)', compute: (d, x) => { const t = vocabTokens(d, x.taught); return per(t.filter((w) => w.text.length >= 7 && !lemmaIn(w.lower, COMMON_WORDS)).length, t.length, 100); } },
  { id: 'academicRate', group: 'lexical', label: 'Academic vocabulary', unit: '% of words', digits: 1, minSpread: 1.2,
    plain: 'words from an academic word list (taught terms excluded)', compute: (d, x) => { const t = vocabTokens(d, x.taught); return per(t.filter((w) => lemmaIn(w.lower, ACADEMIC_WORDS)).length, t.length, 100); } },
  { id: 'longWordRate', group: 'lexical', label: 'Words of 3+ syllables', unit: '% of words', digits: 1, minSpread: 2,
    plain: 'share of long, multi-syllable words', compute: (d, x) => { const t = vocabTokens(d, x.taught); return per(t.filter((w) => syllables(w.text) >= 3).length, t.length, 100); } },
  { id: 'abstractNounRate', group: 'lexical', label: 'Abstract concepts (power, identity, ideology…)', unit: 'per 100 words', digits: 2, minSpread: 0.5,
    plain: 'references to abstract concepts', compute: (d) => per(countRe(d.text, ABSTRACT_TERMS), d.wordCount, 100) },
  { id: 'modifierDensity', group: 'lexical', label: 'Adjective/adverb density (estimated)', unit: 'per 100 words', digits: 1, minSpread: 1,
    plain: 'descriptive modifiers identified by common endings (-ly, -ous, -ive, -ful…)', compute: (d) => per(d.words.filter((w) => (/ly$/.test(w.lower) && w.lower.length > 4 && !LY_NOT_ADVERBS.has(w.lower)) || /(?:ous|ive|ful|less|able|ible|ical)$/.test(w.lower)).length, d.wordCount, 100) },
  { id: 'advancedVerbShare', group: 'lexical', label: 'Advanced analytical verbs', unit: '% of analytical verbs', digits: 0, minSpread: 10,
    plain: 'share of analytical verbs like "interrogates, foregrounds" rather than "shows, says, explains"', compute: (d) => {
      const b = d.words.filter((w) => BASIC_ANALYTIC_VERBS.has(w.lower)).length;
      const a = d.words.filter((w) => ADVANCED_ANALYTIC_VERBS.has(w.lower)).length;
      return a + b >= 2 ? per(a, a + b, 100) : null;
    } },
  { id: 'hedgingRate', group: 'lexical', label: 'Hedging words', unit: 'per 1,000 words', digits: 1, minSpread: 4,
    plain: 'perhaps, may, might, suggests…', compute: (d) => per(d.words.filter((w) => HEDGES.has(w.lower)).length, d.wordCount, 1000) },
  { id: 'intensifierRate', group: 'lexical', label: 'Intensifiers', unit: 'per 1,000 words', digits: 1, minSpread: 3,
    plain: 'very, really, extremely, deeply…', compute: (d) => per(d.words.filter((w) => INTENSIFIERS.has(w.lower)).length, d.wordCount, 1000) },
  { id: 'modalRate', group: 'lexical', label: 'Modal verbs', unit: 'per 100 words', digits: 2, minSpread: 0.5,
    plain: 'can, could, should, would…', compute: (d) => per(d.words.filter((w) => MODALS.has(w.lower)).length, d.wordCount, 100) },
  { id: 'transitionRate', group: 'lexical', label: 'Transition words and discourse markers', unit: 'per 100 words', digits: 2, minSpread: 0.5,
    plain: 'however, therefore, for example, also…', compute: (d) => { const low = d.text.toLowerCase(); return per(TRANSITION_PHRASES.reduce((n, p) => n + (low.match(new RegExp(`\\b${p.replace(/ /g, '\\s+')}\\b`, 'g')) || []).length, 0), d.wordCount, 100); } },
  { id: 'repeatedPhraseRate', group: 'lexical', label: 'Repeated three-word phrases', unit: 'per 1,000 words', digits: 1, minSpread: 3,
    plain: 'three-word phrases used more than once', compute: (d) => {
      const w = d.words.map((x) => x.lower); const c = new Map();
      for (let i = 0; i + 2 < w.length; i++) { const k = `${w[i]} ${w[i + 1]} ${w[i + 2]}`; c.set(k, (c.get(k) || 0) + 1); }
      return per([...c.values()].filter((n) => n > 1).length, d.wordCount, 1000);
    } },

  // --- Syntax
  { id: 'embedding', group: 'syntax', label: 'Clause embedding (estimated depth)', unit: 'markers per sentence', digits: 2, minSpread: 0.2,
    plain: 'how deeply clauses are nested inside sentences', compute: (d) => mean(d.sentences.map((s) => { const c = clauseMarkers(s); return c.sub + c.rel + (s.text.match(/,\s+\w+ing\b/g) || []).length; })) },
  { id: 'passiveRate', group: 'syntax', label: 'Passive constructions', unit: '% of sentences', digits: 0, minSpread: 5,
    plain: '"was written", "is shown"…', compute: (d) => per(d.sentences.filter((s) => /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/i.test(s.text)).length, d.sentences.length, 100) },
  { id: 'nominalizationRate', group: 'syntax', label: 'Nominalizations (-tion, -ity, -ment…)', unit: 'per 100 words', digits: 1, minSpread: 0.8,
    plain: 'actions turned into nouns ("the destruction of", "the fragility of")', compute: (d) => per(countRe(d.text, /\b[a-z]{3,}(?:tion|sion|ment|ness|ity|ance|ence|ism)s?\b/gi), d.wordCount, 100) },
  { id: 'prepDensity', group: 'syntax', label: 'Prepositional phrases', unit: 'per 100 words', digits: 1, minSpread: 1.2,
    plain: 'of, in, through, between…', compute: (d) => per(d.words.filter((w) => PREPOSITIONS.has(w.lower)).length, d.wordCount, 100) },
  { id: 'introClauseRate', group: 'syntax', label: 'Sentences opening with an introductory clause', unit: '% of sentences', digits: 0, minSpread: 6,
    plain: 'e.g. "When Ralph first blows the conch, …"', compute: (d) => per(d.sentences.filter((s) => { const f = s.words[0]?.lower || ''; return (SUBORDINATORS.has(f) || PREPOSITIONS.has(f) || /(?:ing|ed)$/.test(f)) && /,/.test(s.text.split(/\s+/).slice(0, 14).join(' ')); }).length, d.sentences.length, 100) },
  { id: 'participialRate', group: 'syntax', label: 'Participial phrases', unit: 'per 10 sentences', digits: 1, minSpread: 1,
    plain: 'phrases such as ", revealing the…" or "Having lost…, "', compute: (d) => per(d.sentences.filter((s) => /,\s+[a-z]+ing\b/.test(s.text) || /^[A-Z][a-z]+(?:ing|ed)\b[^.]*,/.test(s.text)).length, d.sentences.length, 10) },
  { id: 'semicolonRate', group: 'syntax', label: 'Semicolons', unit: 'per 1,000 words', digits: 1, minSpread: 1.5, plain: 'semicolon use', compute: (d) => per(countRe(d.text, /;/g), d.wordCount, 1000) },
  { id: 'colonRate', group: 'syntax', label: 'Colons', unit: 'per 1,000 words', digits: 1, minSpread: 1.5, plain: 'colon use', compute: (d) => per(countRe(d.text, /:(?!\d)/g), d.wordCount, 1000) },
  { id: 'dashRate', group: 'syntax', label: 'Dashes', unit: 'per 1,000 words', digits: 1, minSpread: 1.5, plain: 'em/en dashes and spaced hyphens', compute: (d) => per(countRe(d.text, /—|–| - |--/g), d.wordCount, 1000) },
  { id: 'parentheticalRate', group: 'syntax', label: 'Parenthetical asides', unit: 'per 1,000 words', digits: 1, minSpread: 1.5,
    plain: 'brackets other than page citations', compute: (d) => per(countRe(d.text, /\((?!\s*(?:p\.?\s*)?\d)[^)]{3,}\)/g), d.wordCount, 1000) },

  // --- Voice
  { id: 'firstPersonRate', group: 'voice', label: 'First person (I, my)', unit: 'per 100 words', digits: 2, minSpread: 0.4,
    plain: 'use of I / me / my', compute: (d) => per(d.words.filter((w) => FIRST_PERSON.has(w.lower)).length, d.wordCount, 100) },
  { id: 'quoteIntroSays', group: 'voice', label: 'Evidence introduced with "says / states"', unit: '% of quotations', digits: 0, minSpread: 12,
    plain: 'quotations introduced with a reporting verb or colon', compute: (d) => { const q = quotesInfo(d); return q.length >= 2 ? per(q.filter((x) => x.introducedBySays).length, q.length, 100) : null; } },
  { id: 'quoteIntegrated', group: 'voice', label: 'Quotations woven into the sentence', unit: '% of quotations', digits: 0, minSpread: 12,
    plain: 'quotations embedded mid-sentence rather than introduced separately', compute: (d) => { const q = quotesInfo(d); return q.length >= 2 ? per(q.filter((x) => x.midSentence).length, q.length, 100) : null; } },
  { id: 'paragraphOpenerTransition', group: 'voice', label: 'Paragraphs opening with a transition', unit: '% of paragraphs', digits: 0, minSpread: 15,
    plain: 'body paragraphs that begin with "Furthermore", "Another example"…', compute: (d) => { const ps = d.paragraphs.slice(1); return ps.length >= 2 ? per(ps.filter((p) => { const low = p.text.toLowerCase(); return TRANSITION_PHRASES.some((t) => low.startsWith(`${t} `) || low.startsWith(`${t},`)); }).length, ps.length, 100) : null; } },
  { id: 'certaintyRate', group: 'voice', label: 'Certainty markers (clearly, must, definitely…)', unit: 'per 1,000 words', digits: 1, minSpread: 3,
    plain: 'how often claims are stated with certainty', compute: (d) => per(d.words.filter((w) => BOOSTERS.has(w.lower)).length, d.wordCount, 1000) },
  { id: 'evaluativeRate', group: 'voice', label: 'Evaluative language (important, powerful…)', unit: 'per 1,000 words', digits: 1, minSpread: 4,
    plain: 'evaluative adjectives', compute: (d) => per(d.words.filter((w) => EVALUATIVE.has(w.lower)).length, d.wordCount, 1000) },
  { id: 'qualificationRate', group: 'voice', label: 'Qualified statements', unit: '% of sentences', digits: 0, minSpread: 7,
    plain: 'sentences that concede or limit a claim (although, however, to some extent…)', compute: (d) => per(d.sentences.filter((s) => /\b(?:although|though|however|while|whereas|to some extent|in part|partly|not entirely|it could be argued|may|might|perhaps)\b/i.test(s.text)).length, d.sentences.length, 100) },

  // --- Mechanics
  { id: 'mechanicsRate', group: 'mechanics', label: 'Recurring spelling and mechanics habits', unit: 'per 1,000 words', digits: 1, minSpread: 3,
    plain: 'common misspellings, lowercase "i", lowercase sentence starts, missing apostrophes', compute: (d) => {
      const q = quotedRanges(d.text);
      let n = d.words.filter((w) => !inRanges(w.start, q) && (w.text === 'i' || COMMON_MISSPELLINGS.has(w.lower))).length;
      n += d.sentences.filter((s) => /^[a-z]/.test(s.text)).length;
      return per(n, d.wordCount, 1000);
    } },
  { id: 'contractionRate', group: 'mechanics', label: 'Contractions', unit: 'per 100 words', digits: 2, minSpread: 0.4,
    plain: "don't, it's, can't…", compute: (d) => per(countRe(d.text, /\b\w+['’](?:t|s|re|ve|ll|d|m)\b/gi), d.wordCount, 100) },

  // --- Weak surface indicators (low weight; never decisive)
  ...WEAK_SURFACE.map((w) => ({
    id: `surface_${w.id}`, group: 'surface', label: w.label, unit: 'per 1,000 words', digits: 1, minSpread: 2, weight: 0.25, weak: true,
    plain: 'weak surface indicator', compute: (d) => per(countRe(d.text, w.re), d.wordCount, 1000),
  })),
  { id: 'surface_uniformity', group: 'surface', label: 'Uniform sentence construction', unit: 'variation (lower = more uniform)', digits: 2, minSpread: 0.08, weight: 0.25, weak: true,
    plain: 'weak surface indicator: coefficient of variation of sentence length', compute: (d) => { const l = d.sentences.map((s) => s.words.length); return l.length >= 5 ? sd(l) / Math.max(1, mean(l)) : null; } },
];

// Details shown in comparisons (vocabulary repertoires, notable words).
export function styleDetails(doc, taught = new Set()) {
  const counts = (list) => {
    const m = new Map();
    doc.words.forEach((w) => { if (list.has(w.lower)) m.set(w.lower, (m.get(w.lower) || 0) + 1); });
    return [...m].sort((a, b) => b[1] - a[1]).map(([w, n]) => ({ word: w, n }));
  };
  const tokens = vocabTokens(doc, taught);
  const rare = new Map();
  // Sophisticated vocabulary: long words that are academic or multi-syllable, not everyday words.
  tokens.forEach((w) => { if (w.text.length >= 8 && !lemmaIn(w.lower, COMMON_WORDS) && (lemmaIn(w.lower, ACADEMIC_WORDS) || syllables(w.text) >= 3 || ADVANCED_ANALYTIC_VERBS.has(w.lower))) rare.set(stem(w.lower), w.lower); });
  return {
    basicVerbs: counts(BASIC_ANALYTIC_VERBS),
    advancedVerbs: counts(ADVANCED_ANALYTIC_VERBS),
    rareStems: rare,
    vocabulary: new Set(doc.words.map((w) => stem(w.lower))),
  };
}

export function computeStyle(doc, { taught = new Set() } = {}) {
  const values = {};
  for (const f of STYLE_FEATURES) {
    let v = null;
    try { v = doc.wordCount ? f.compute(doc, { taught }) : null; } catch { v = null; }
    values[f.id] = Number.isFinite(v) ? v : null;
  }
  return values;
}
