// Splits text into paragraphs, sentences and words, keeping character offsets
// so that every finding can be highlighted in the original text.

const WORD_RE = /[A-Za-zÀ-ɏ]+(?:['’][A-Za-z]+)*/g;
const ABBREVIATIONS = /\b(?:Mr|Mrs|Ms|Dr|St|vs|etc|e\.g|i\.e|p|pp|ch|Vol|No)\.$/i;

export function words(text, offset = 0) {
  const out = [];
  WORD_RE.lastIndex = 0;
  let m;
  while ((m = WORD_RE.exec(text))) {
    out.push({ text: m[0], lower: m[0].toLowerCase(), start: offset + m.index, end: offset + m.index + m[0].length });
  }
  return out;
}

export function countWords(text) {
  const m = text.match(WORD_RE);
  return m ? m.length : 0;
}

export function paragraphs(text) {
  const out = [];
  const re = /[^\n]+/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    out.push({ text: body, start: m.index + lead, end: m.index + lead + body.length });
  }
  return out;
}

// Sentence splitter: ends at . ! ? (plus closing quotes/brackets) followed by
// whitespace, unless the period belongs to a common abbreviation.
export function sentences(text, offset = 0) {
  const out = [];
  let start = 0;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    let j = i + 1;
    while (j < n && /[.!?"'”’)\]]/.test(text[j])) j++;
    if (j < n && !/\s/.test(text[j])) continue;
    if (ch === '.' && ABBREVIATIONS.test(text.slice(Math.max(0, i - 5), i + 1))) continue;
    pushSentence(out, text, start, j, offset);
    start = j;
    i = j - 1;
  }
  pushSentence(out, text, start, n, offset);
  return out;
}

function pushSentence(out, text, a, b, offset) {
  const raw = text.slice(a, b);
  const lead = raw.length - raw.trimStart().length;
  const body = raw.trim();
  if (!body || countWords(body) === 0) return;
  out.push({ text: body, start: offset + a + lead, end: offset + a + lead + body.length });
}

export function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

// Full document structure used by all textual analysis.
export function analyzeDocument(text) {
  const paras = paragraphs(text).map((p, index) => {
    const sents = sentences(p.text, p.start).map((s) => ({ ...s, words: words(s.text, s.start) }));
    return { ...p, index, sentences: sents, words: words(p.text, p.start) };
  });
  const allSentences = [];
  paras.forEach((p) => p.sentences.forEach((s) => allSentences.push({ ...s, paragraph: p.index })));
  const allWords = paras.flatMap((p) => p.words);
  return { text, paragraphs: paras, sentences: allSentences, words: allWords, wordCount: allWords.length };
}

// Character ranges that sit inside quotation marks, e.g. quoted evidence.
export function quotedRanges(text) {
  const out = [];
  const re = /"[^"\n]{1,600}"|“[^”\n]{1,600}”/g;
  let m;
  while ((m = re.exec(text))) out.push({ start: m.index, end: m.index + m[0].length });
  return out;
}

export function inRanges(pos, ranges) {
  return ranges.some((r) => pos >= r.start && pos < r.end);
}

// Very small stemmer so that "symbolize" / "symbolizes" / "symbolized" match.
export function stem(word) {
  let w = word.toLowerCase().replace(/’/g, "'").replace(/'s$/, '');
  for (const suf of ['ically', 'ingly', 'ations', 'ation', 'ness', 'ments', 'ment', 'ities', 'ity', 'ing', 'ies', 'ied', 'ed', 'ly', 'es', 's']) {
    if (w.length - suf.length >= 4 && w.endsWith(suf)) return w.slice(0, -suf.length);
  }
  return w;
}
