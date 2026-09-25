// Discourse and argument analysis: what the writer does with ideas.
// Each sentence is given a rhetorical "move" (claim, evidence, explanation…)
// using transparent cue rules, then the essay's architecture, abstraction,
// reasoning chains and evidence choices are summarised.
// These are approximations computed on the teacher's device; the teacher sees
// the move assigned to every sentence and can judge it directly.

import { quotedRanges, inRanges } from '../text/tokenize.js';
import { ABSTRACT_TERMS, EVIDENCE_TYPES } from '../text/lexicons.js';
import { mean } from './stylometry.js';

export const MOVES = {
  thesis: { code: 'T', label: 'Thesis' },
  claim: { code: 'C', label: 'Claim' },
  context: { code: 'Ctx', label: 'Context' },
  evidence: { code: 'E', label: 'Evidence' },
  explanation: { code: 'X', label: 'Explanation' },
  reasoning: { code: 'R', label: 'Reasoning link' },
  qualification: { code: 'Q', label: 'Qualification' },
  counterpoint: { code: 'Cp', label: 'Counterpoint' },
  implication: { code: 'I', label: 'Implication' },
  summary: { code: 'S', label: 'Retelling / summary' },
  conclusion: { code: 'Cn', label: 'Conclusion' },
};

const CUES = {
  thesis: /\b(?:I (?:will )?argue|this essay (?:will )?(?:argue|explore|show|discuss|examine)|in this essay|I will (?:talk|discuss|explain|show))\b/i,
  counterpoint: /\b(?:some (?:readers |critics )?(?:might|may|could|would) (?:argue|suggest|say|read)|on the other hand|critics|one could argue|it could be argued|alternatively|a different reading|another reading|others (?:might|may) (?:argue|suggest|read)|admittedly|at first glance)\b/i,
  citation: /\(\s*(?:p\.?\s*|pp\.?\s*|ch\.?\s*|chapter\s+)?\d+(?:[.:\-–]\d+)*\s*\)/i,
  evidenceLead: /\b(?:for example|for instance|in chapter \d+|according to|the (?:text|novel|poem|author|narrator) (?:states|says|describes)|is described as|when [A-Z][a-z]+ (?:says|tells|first|sees|finds|holds|blows))\b/,
  qualification: /\b(?:although|though|whereas|to some extent|in part|partly|not entirely|not simply|not merely|arguably|perhaps|complicat\w*|ambigu\w*|however|nevertheless|while (?:it|this|the|he|she|they)\b[^,]*,)/i,
  implication: /\b(?:ultimately|more broadly|beyond the|universal\w*|human (?:nature|condition|experience|heart)|humanity|society|societies|the novel as a whole|wider|broader implications?|what it means to|our own world|today)\b/i,
  context: /\b(?:written (?:in|after|during)|published|at the time|historical(?:ly)?|historic|context|post-war|during the|century|era|world war|cold war|biograph\w*)\b|\b(?:1[5-9]\d\d|20[0-2]\d)s?\b/i,
  reasoning: /\b(?:therefore|thus|because|since|as a result|consequently|which means|this means|so that|hence|which is why|that is why)\b/i,
  explanation: /\b(?:this|these|that|which|it|such|here)\s+(?:\w+\s+){0,2}?(?:shows?|suggests?|reveals?|means?|demonstrates?|highlights?|implies?|represents?|symboli[sz]es|conveys?|emphasi[sz]es|illustrates?|indicates?|underscores?|foregrounds?|interrogates?|exposes?|complicates?|reflects?|signals?)\b|\b(?:represents|symboli[sz]es|shows that|suggests that|reveals that|means that|in other words)\b/i,
  analytic: /\b(?:shows?|suggests?|reveals?|means?|demonstrates?|highlights?|implies?|represents?|symboli[sz]es|conveys?|emphasi[sz]es|illustrates?|indicates?|underscores?|foregrounds?|interrogates?|exposes?|complicates?|reflects?|because|evokes?|juxtapos\w*|critiques?)\b/i,
};

const TECHNIQUE_RE = new RegExp(Object.entries(EVIDENCE_TYPES).filter(([k]) => k !== 'context').map(([, r]) => r.source).join('|'), 'i');

function hasQuote(s, quotes) {
  return quotes.some((q) => q.start >= s.start && q.end <= s.end + 1 && q.words >= 3);
}

function classifySentence(s, pIndex, sIndex, nParas, paraLen, quotes) {
  const t = s.text;
  const tags = [];
  const intro = nParas >= 3 && pIndex === 0;
  const outro = nParas >= 3 && pIndex === nParas - 1;
  if (CUES.counterpoint.test(t)) tags.push('counterpoint');
  if (hasQuote(s, quotes) || CUES.citation.test(t) || CUES.evidenceLead.test(t)) tags.push('evidence');
  // A sentence that opens by interpreting ("This shows…") is an explanation first.
  if (/^(?:This|These|That|Which|Such|It|Here)\b/.test(t) && CUES.explanation.test(t.slice(0, 60))) tags.push('explanation');
  if (CUES.qualification.test(t)) tags.push('qualification');
  if (CUES.implication.test(t)) tags.push('implication');
  if (CUES.context.test(t)) tags.push('context');
  if (CUES.explanation.test(t) && !tags.includes('explanation')) tags.push('explanation');
  if (CUES.reasoning.test(t)) tags.push('reasoning');
  let primary;
  if (intro) {
    primary = CUES.thesis.test(t) || sIndex === paraLen - 1 ? 'thesis' : tags.includes('context') ? 'context' : 'context';
  } else if (outro) {
    primary = sIndex === 0 ? 'conclusion' : tags.includes('implication') ? 'implication' : tags.includes('qualification') ? 'qualification' : 'conclusion';
  } else if (sIndex === 0 && !tags.includes('evidence')) {
    primary = 'claim';
  } else {
    primary = tags[0];
    if (!primary) {
      const namesSomeone = /\s[A-Z][a-z]+/.test(t.slice(1));
      primary = namesSomeone && !CUES.analytic.test(t) ? 'summary' : 'explanation';
    }
  }
  const moves = [primary, ...tags.filter((x) => x !== primary)];
  return { primary, moves };
}

// Concrete (0), analytical (1) or abstract (2) level of a sentence.
function abstractionLevel(s) {
  const t = s.text;
  const abstract = (t.match(ABSTRACT_TERMS) || []).length;
  const nominal = (t.match(/\b[a-z]{3,}(?:tion|sion|ment|ness|ity|ance|ence|ism)s?\b/gi) || []).length;
  if (abstract >= 2 || (abstract >= 1 && nominal >= 2)) return 2;
  if (CUES.analytic.test(t) || TECHNIQUE_RE.test(t)) return 1;
  return 0;
}

export const DISCOURSE_FEATURES = [
  { id: 'movesPerParagraph', group: 'architecture', label: 'Paragraph architecture (distinct moves per paragraph)', unit: 'moves', digits: 1, minSpread: 0.5,
    plain: 'how many different kinds of move a body paragraph makes' },
  { id: 'chainLength', group: 'architecture', label: 'Length of paragraph argument chain', unit: 'steps', digits: 1, minSpread: 0.8,
    plain: 'number of steps in a body paragraph (claim → evidence → explanation…)' },
  { id: 'evidencePerClaim', group: 'architecture', label: 'Evidence per claim', unit: 'ratio', digits: 1, minSpread: 0.5,
    plain: 'pieces of evidence offered for each claim' },
  { id: 'explanationPerEvidence', group: 'architecture', label: 'Explanation per piece of evidence', unit: 'ratio', digits: 1, minSpread: 0.4,
    plain: 'explaining or reasoning sentences for each piece of evidence' },
  { id: 'qualificationPerParagraph', group: 'architecture', label: 'Qualifications per paragraph', unit: 'per paragraph', digits: 2, minSpread: 0.5,
    plain: 'acknowledging limits, ambiguity or complexity' },
  { id: 'counterPerParagraph', group: 'architecture', label: 'Counterpoints per paragraph', unit: 'per paragraph', digits: 2, minSpread: 0.25,
    plain: 'engaging with alternative interpretations' },
  { id: 'implicationPerParagraph', group: 'architecture', label: 'Implications per paragraph', unit: 'per paragraph', digits: 2, minSpread: 0.3,
    plain: 'extending the argument beyond the immediate evidence' },
  { id: 'summaryShare', group: 'architecture', label: 'Retelling (plot summary)', unit: '% of sentences', digits: 0, minSpread: 8,
    plain: 'sentences that retell events rather than analyse' },
  { id: 'claimRepetition', group: 'architecture', label: 'Repeated claims', unit: '% of claims', digits: 0, minSpread: 15,
    plain: 'body claims that largely repeat the thesis or another claim' },
  { id: 'abstractionIndex', group: 'abstraction', label: 'Conceptual abstraction', unit: 'index 0–2', digits: 2, minSpread: 0.15,
    plain: 'average level: concrete (0), analytical (1), abstract (2)' },
  { id: 'abstractShare', group: 'abstraction', label: 'Abstract sentences', unit: '% of sentences', digits: 0, minSpread: 8,
    plain: 'sentences reasoning mainly in abstract concepts' },
  { id: 'concreteShare', group: 'abstraction', label: 'Concrete sentences', unit: '% of sentences', digits: 0, minSpread: 8,
    plain: 'sentences describing events, actions or details' },
  { id: 'reasoningDepth', group: 'reasoning', label: 'Reasoning depth after evidence', unit: 'steps', digits: 1, minSpread: 0.6,
    plain: 'distinct steps taken after a piece of evidence (interpretation, technique, context, implication…)' },
  { id: 'techniqueNaming', group: 'reasoning', label: 'Naming techniques in analysis', unit: '% of analysis sentences', digits: 0, minSpread: 10,
    plain: 'analysis sentences that name a technique (imagery, juxtaposition, motif…)' },
  { id: 'thematicLeapRate', group: 'reasoning', label: 'Moves from evidence to broad theme', unit: '% of evidence', digits: 0, minSpread: 15,
    plain: 'evidence followed by an implication about society, humanity or ideology' },
  { id: 'quotesPer100', group: 'evidence', label: 'Direct quotations', unit: 'per 100 words', digits: 2, minSpread: 0.4,
    plain: 'how often direct quotation is used' },
  { id: 'meanQuoteLength', group: 'evidence', label: 'Quotation length', unit: 'words', digits: 1, minSpread: 4,
    plain: 'average length of quoted evidence' },
  { id: 'paraphraseShare', group: 'evidence', label: 'Evidence by paraphrase', unit: '% of evidence', digits: 0, minSpread: 15,
    plain: 'evidence given without direct quotation' },
  { id: 'evidenceSpecificity', group: 'evidence', label: 'Evidence specificity', unit: '% of evidence', digits: 0, minSpread: 15,
    plain: 'evidence with a quotation, page reference or precise detail' },
  { id: 'evidenceTypeDiversity', group: 'evidence', label: 'Kinds of evidence discussed', unit: 'types', digits: 0, minSpread: 1.5,
    plain: 'range of techniques/evidence types discussed (imagery, symbolism, structure…)' },
].map((f) => ({ ...f, weight: 0.8, category: 'discourse' }));

export const DISCOURSE_GROUPS = {
  architecture: 'Argument architecture',
  abstraction: 'Conceptual abstraction',
  reasoning: 'Reasoning pattern',
  evidence: 'Evidence selection',
};

const contentWords = (t) => new Set((t.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !/^(?:this|that|with|from|have|they|their|there|which|when|what|also|into|about|shows|because|these|those|were|been|them|then|than|more|some)$/.test(w)));
const jaccard = (a, b) => { const i = [...a].filter((x) => b.has(x)).length; return i / Math.max(1, a.size + b.size - i); };

export function computeDiscourse(doc) {
  const quotes = quotedRanges(doc.text).map((q) => ({ ...q, words: doc.text.slice(q.start, q.end).split(/\s+/).length }));
  const nParas = doc.paragraphs.length;
  const sentences = [];
  const paragraphs = doc.paragraphs.map((p, pi) => {
    const items = p.sentences.map((s, si) => {
      const c = classifySentence(s, pi, si, nParas, p.sentences.length, quotes);
      const item = { start: s.start, end: s.end, text: s.text, paragraph: pi, move: c.primary, moves: c.moves, level: abstractionLevel(s), technique: TECHNIQUE_RE.test(s.text) };
      sentences.push(item);
      return item;
    });
    const seq = [];
    items.forEach((it) => { if (seq[seq.length - 1] !== it.move) seq.push(it.move); });
    const role = nParas >= 3 && pi === 0 ? 'introduction' : nParas >= 3 && pi === nParas - 1 ? 'conclusion' : 'body';
    return { index: pi, role, start: p.start, end: p.end, sequence: seq, pattern: seq.map((m) => MOVES[m].code).join(' → '), distinct: new Set(items.map((i) => i.move)).size };
  });

  const body = paragraphs.filter((p) => p.role === 'body');
  const bodyN = Math.max(1, body.length);
  const count = (m) => sentences.filter((s) => s.move === m).length;
  const claims = count('claim') + count('thesis');
  const evidence = count('evidence');

  // Reasoning chains: what follows each piece of evidence in its paragraph.
  const chains = [];
  sentences.forEach((s, i) => {
    if (s.move !== 'evidence') return;
    const steps = new Set();
    for (let j = i + 1; j < sentences.length && sentences[j].paragraph === s.paragraph; j++) {
      const n = sentences[j];
      if (n.move === 'evidence' || n.move === 'claim') break;
      if (n.technique) steps.add('technique');
      if (n.moves.includes('context')) steps.add('context');
      if (n.moves.includes('implication') || n.level === 2) steps.add('implication');
      if (n.moves.includes('qualification') || n.moves.includes('counterpoint')) steps.add('qualification');
      if (n.moves.includes('explanation') || n.moves.includes('reasoning') || n.move === 'summary') steps.add('interpretation');
    }
    if (s.technique) steps.add('technique');
    const order = ['interpretation', 'technique', 'context', 'qualification', 'implication'];
    chains.push({ at: s.start, steps: order.filter((x) => steps.has(x)) });
  });

  const analysisSentences = sentences.filter((s) => ['explanation', 'reasoning', 'implication', 'qualification'].includes(s.move));
  const evidenceSentences = sentences.filter((s) => s.move === 'evidence' || s.moves.includes('evidence'));
  const quotesInText = quotes.filter((q) => q.words >= 2);
  const evTypes = {};
  for (const [k, re] of Object.entries(EVIDENCE_TYPES)) {
    const n = sentences.filter((s) => re.test(s.text)).length;
    if (n) evTypes[k] = n;
  }
  const bodyClaims = sentences.filter((s) => s.move === 'claim').map((s) => contentWords(s.text));
  const thesis = sentences.find((s) => s.move === 'thesis');
  const thesisWords = thesis ? contentWords(thesis.text) : new Set();
  const repeated = bodyClaims.filter((c, i) => jaccard(c, thesisWords) >= 0.45 || bodyClaims.some((o, j) => j !== i && jaccard(c, o) >= 0.45)).length;
  const last = paragraphs[paragraphs.length - 1];
  const conclusionStrategy = !last || last.role !== 'conclusion' ? null : last.sequence.includes('implication') ? 'extends to broader implications' : 'restates the argument';

  // Per-paragraph rates use all paragraphs so short essays (one body paragraph) stay stable.
  const allN = Math.max(1, paragraphs.length);
  const perPara = (pred) => (sentences.length >= 6 ? sentences.filter(pred).length / allN : null);
  const archParas = body.length >= 2 ? body : paragraphs;
  const values = {
    movesPerParagraph: archParas.length && sentences.length >= 6 ? mean(archParas.map((p) => p.distinct)) : null,
    chainLength: archParas.length && sentences.length >= 6 ? mean(archParas.map((p) => p.sequence.length)) : null,
    evidencePerClaim: claims >= 2 ? evidence / claims : null,
    explanationPerEvidence: evidence >= 3 ? (count('explanation') + count('reasoning')) / evidence : null,
    qualificationPerParagraph: perPara((s) => s.moves.includes('qualification')),
    counterPerParagraph: perPara((s) => s.move === 'counterpoint'),
    implicationPerParagraph: perPara((s) => s.moves.includes('implication')),
    summaryShare: sentences.length >= 6 ? (count('summary') / sentences.length) * 100 : null,
    claimRepetition: bodyClaims.length >= 3 ? (repeated / bodyClaims.length) * 100 : null,
    abstractionIndex: sentences.length ? mean(sentences.map((s) => s.level)) : null,
    abstractShare: sentences.length ? (sentences.filter((s) => s.level === 2).length / sentences.length) * 100 : null,
    concreteShare: sentences.length ? (sentences.filter((s) => s.level === 0).length / sentences.length) * 100 : null,
    reasoningDepth: chains.length >= 2 ? mean(chains.map((c) => c.steps.length)) : null,
    techniqueNaming: analysisSentences.length >= 4 ? (analysisSentences.filter((s) => s.technique).length / analysisSentences.length) * 100 : null,
    thematicLeapRate: chains.length >= 3 ? (chains.filter((c) => c.steps.includes('implication')).length / chains.length) * 100 : null,
    quotesPer100: doc.wordCount ? (quotesInText.length / doc.wordCount) * 100 : null,
    meanQuoteLength: quotesInText.length >= 2 ? mean(quotesInText.map((q) => q.words)) : null,
    paraphraseShare: evidenceSentences.length >= 3 ? (evidenceSentences.filter((s) => !quotesInText.some((q) => q.start >= s.start && q.end <= s.end + 1)).length / evidenceSentences.length) * 100 : null,
    evidenceSpecificity: evidenceSentences.length >= 3 ? (evidenceSentences.filter((s) => quotesInText.some((q) => q.start >= s.start && q.end <= s.end + 1) || CUES.citation.test(s.text) || /\d/.test(s.text)).length / evidenceSentences.length) * 100 : null,
    evidenceTypeDiversity: Object.keys(evTypes).length,
  };
  for (const k of Object.keys(values)) if (values[k] != null && !Number.isFinite(values[k])) values[k] = null;

  // Most common reasoning chain, described in words.
  const chainPatterns = new Map();
  chains.forEach((c) => { const k = ['observation', ...c.steps].join(' → '); chainPatterns.set(k, (chainPatterns.get(k) || 0) + 1); });
  const typicalChain = [...chainPatterns].sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return { values, sentences, paragraphs, chains, typicalChain, evidenceTypes: evTypes, conclusionStrategy };
}
