// Word lists and pattern families. Each pattern is counted and shown in context;
// no single phrase is ever treated as meaningful on its own.

export const TRANSITIONS = [
  'furthermore', 'moreover', 'additionally', 'ultimately', 'in conclusion', 'similarly',
  'consequently', 'nevertheless', 'nonetheless', 'in addition', 'thus', 'hence', 'therefore',
  'however', 'in contrast', 'conversely', 'overall', 'in summary', 'to conclude', 'notably',
  'also', 'another', 'first', 'firstly', 'secondly', 'finally', 'for example', 'for instance',
];

export const FORMULAIC_SIGNPOSTS = [
  'furthermore', 'moreover', 'additionally', 'ultimately', 'in conclusion', 'similarly',
  'consequently', 'nevertheless', 'nonetheless', 'in addition', 'thus', 'hence', 'notably',
  'in essence', 'in summary', 'overall',
];

export const CONJUNCTIONS = ['and', 'but', 'so', 'because', 'or', 'yet'];
export const SUBORDINATORS = ['because', 'although', 'though', 'while', 'whereas', 'since', 'unless', 'which', 'who', 'whom', 'whose', 'when', 'where', 'if', 'as'];
export const MODALS = ['can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would'];
export const HEDGES = ['perhaps', 'possibly', 'potentially', 'arguably', 'seemingly', 'somewhat', 'likely', 'presumably', 'apparently', 'suggests', 'suggest', 'appears', 'seems'];
export const FIRST_PERSON = ['i', 'me', 'my', 'mine', 'myself'];
export const ANALYTICAL_VERB_RE = /\b(highlight(?:s|ed|ing)?|demonstrat(?:e|es|ed|ing)|emphasi[sz](?:e|es|ed|ing)|illustrat(?:e|es|ed|ing)|convey(?:s|ed|ing)?|reinforc(?:e|es|ed|ing)|underscor(?:e|es|ed|ing)|showcas(?:e|es|ed|ing)|signif(?:y|ies|ied|ying)|encapsulat(?:e|es|ed|ing)|exemplif(?:y|ies|ied|ying)|delv(?:e|es|ed|ing)|foreshadow(?:s|ed|ing)?)\b/gi;

export const NOMINALIZATION_RE = /\b[a-z]{3,}(?:tion|sion|ment|ness|ity|ance|ence|ism)s?\b/gi;
export const FIGURATIVE_RE = /\b(?:like an?|as if|as though|as \w+ as)\b/gi;
export const PASSIVE_RE = /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/i;
export const CONTRACTION_RE = /\b\w+['’](?:t|s|re|ve|ll|d|m)\b/gi;

// Common misspellings and informal habits used as a "mechanics fingerprint".
export const COMMON_MISSPELLINGS = [
  'alot', 'becuase', 'beacuse', 'definately', 'recieve', 'seperate', 'untill', 'wich', 'thier',
  'beleive', 'occured', 'begining', 'realy', 'finaly', 'truely', 'arguement', 'goverment',
  'enviroment', 'wierd', 'tommorow', 'basicly', 'noone', 'alright', 'everytime', 'infront',
  'thru', 'gonna', 'wanna', 'kinda', 'dont', 'doesnt', 'didnt', 'cant', 'wont', 'isnt', 'im', 'ive', 'thats',
];

export const GENERIC_TERMS_RE = /\b(?:society|societal|humanity|human nature|the human (?:experience|condition|spirit)|mankind|identity|power|complexit(?:y|ies)|perspectives?|the world|universal|timeless|people everywhere|human beings|modern world|today's world)\b/i;

// Rhetorical pattern families. `scope: 'sentence'` patterns are tested once per
// sentence; the others are counted every time they occur.
export const RHETORIC_FAMILIES = [
  {
    id: 'signposting',
    name: 'Formulaic signposting',
    description: 'Stock transition words at the start of sentences.',
    scope: 'sentence',
    test: (s) => /^(?:Furthermore|Moreover|Additionally|Ultimately|In conclusion|Similarly|Consequently|Nevertheless|Nonetheless|In addition|Thus|Hence|Notably|In essence|Overall|In summary)\b/.test(s),
    matchRe: /^(?:Furthermore|Moreover|Additionally|Ultimately|In conclusion|Similarly|Consequently|Nevertheless|Nonetheless|In addition|Thus|Hence|Notably|In essence|Overall|In summary)\b/,
    alternatives: ['Transition words are widely taught and encouraged in essay instruction.', 'Sentence frames or writing templates provided in class.', 'The student may be imitating model essays.'],
  },
  {
    id: 'generic-analytical',
    name: 'Generic analytical language',
    description: 'Constructions such as "This highlights…" or "This demonstrates…".',
    re: /\b(?:This|These|That|Such|It|Which)\s+(?:\w+\s+){0,2}?(?:highlights|demonstrates|suggests|emphasizes|emphasises|illustrates|underscores|reveals|reflects|showcases|signifies|reinforces|conveys)\b/g,
    alternatives: ['"This shows / this highlights" is a common taught analysis frame (e.g. PEEL/TEEL paragraphs).', 'Rubric language may encourage explicit analysis statements.'],
  },
  {
    id: 'abstract-inflation',
    name: 'Abstract inflation',
    description: 'Inflated abstract noun phrases such as "the multifaceted nature of".',
    re: /\b(?:the\s+(?:profound|inherent|intricate|multifaceted|nuanced|broader|deeper|delicate|enduring|complex|fundamental)\s+(?:complexit(?:y|ies)|nature|implications|interplay|tapestry|significance|dynamics|tensions?|layers|fragility|duality|essence)|complexities inherent|multifaceted|intricate interplay|rich tapestry|profound(?:ly)? (?:complex|significant)|nuanced (?:exploration|understanding|portrayal))\b/gi,
    alternatives: ['Vocabulary absorbed from literary criticism or class readings.', 'Deliberate attempt to write in an elevated academic register.'],
  },
  {
    id: 'artificial-nuance',
    name: 'Concessive "nuance" structures',
    description: '"While X may appear…, it ultimately…", "At first glance…, however…".',
    scope: 'sentence',
    test: (s) => /^(?:While|Although|Though|Whereas)\b[^.]{5,}?,\s*[^.]*\b(?:ultimately|in fact|actually|also|truly|important|reveals?|serves?)\b/i.test(s)
      || /\bat first glance\b/i.test(s)
      || /\b(?:may|might) (?:seem|appear)\b[^.]*\b(?:but|however|yet|ultimately)\b/i.test(s)
      || /\bon the surface\b/i.test(s),
    alternatives: ['Concession-and-rebuttal is a taught argument move.', 'The student may be responding to a prompt that asks for counter-arguments.'],
  },
  {
    id: 'symmetry',
    name: 'Symmetrical constructions',
    description: '"not X, but Y", "not only X, but also Y", balanced contrasts.',
    re: /\b(?:not only\b[^.]{1,80}?\bbut(?: also)?\b|not (?:just |merely |simply )?[a-z]+(?:\s[a-z]+){0,4},?\s+but\s(?:rather\s)?|(?:less|not so much) about\b[^.]{1,60}?\b(?:more|than) about\b|is not [^.;]{1,40}; it is\b)/gi,
    alternatives: ['Parallel structure is taught as a rhetorical technique.', 'Debate or speech-writing practice.'],
  },
  {
    id: 'tricolon',
    name: 'List stacking (groups of three)',
    description: 'Repeated three-part lists of adjectives, concepts or clauses.',
    re: /\b[a-z]+(?:\s[a-z]+){0,2},\s[a-z]+(?:\s[a-z]+){0,2},?\s(?:and|or)\s[a-z]+\b/gi,
    alternatives: ['The "rule of three" is a widely taught rhetorical device.', 'Lists may simply reflect content with three parts.'],
  },
  {
    id: 'generic-claims',
    name: 'Generalised claims',
    description: 'Broad claims about society, humanity or "the human experience" with no quotation, name or specific detail in the sentence.',
    scope: 'sentence',
    test: (s) => GENERIC_TERMS_RE.test(s) && !/["“”]|\d/.test(s) && !/\s[A-Z][a-z]+/.test(s.slice(1).replace(/\b(?:I|I'm|I've)\b/g, '')),
    alternatives: ['Prompts about themes often invite general statements.', 'Students are often taught to "zoom out" to real-world significance.'],
  },
  {
    id: 'hedging',
    name: 'Stacked hedging',
    description: 'Hedges layered together, e.g. "could potentially suggest".',
    re: /\b(?:could|may|might)\s+(?:potentially|possibly|perhaps|arguably)\b|\b(?:arguably|perhaps)\s+(?:suggests?|demonstrates?|indicates?|shows?)\b|\bmay perhaps\b|\bit could be argued\b|\bseems? to suggest\b|\bto some extent\b|\bin some ways\b|\bone could argue\b/gi,
    alternatives: ['Students may be taught to use cautious academic language.', 'English language learners often rely on learned hedging formulas.'],
  },
  {
    id: 'metadiscourse',
    name: 'Metadiscourse',
    description: 'Commentary about the writing or reader, e.g. "It is important to recognize…".',
    re: /\bit is (?:important|worth|crucial|essential|vital|interesting|significant) to (?:note|recognize|recognise|consider|acknowledge|understand|mention|remember)\b|\bit is worth noting\b|\b(?:this|which) allows the reader\b|\bthe reader (?:can|is able to|is left to|therefore)\b|\bas (?:mentioned|discussed|noted) (?:above|earlier|previously)\b|\bthis essay will\b/gi,
    alternatives: ['Some teachers encourage explicit reader-focused commentary.', 'Common in exam-style writing.'],
  },
  {
    id: 'analytical-verbs',
    name: 'Analytical-verb repetition',
    description: 'Repeated use of highlights / demonstrates / emphasizes / underscores / conveys…',
    re: ANALYTICAL_VERB_RE,
    alternatives: ['Analytical verb lists are often given to students as vocabulary support.', 'The rubric may reward precise analytical verbs.'],
  },
];

export const CONCLUSION_OPENERS = [
  ['in conclusion', /^in conclusion\b/i],
  ['ultimately', /^ultimately\b/i],
  ['overall', /^overall\b/i],
  ['in summary', /^(?:in summary|to summarize|to summarise)\b/i],
  ['to conclude', /^to conclude\b/i],
  ['all in all', /^all in all\b/i],
];
