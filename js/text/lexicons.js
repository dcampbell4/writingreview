// Word lists used by the fingerprint and discourse analysis. They are small,
// transparent and editable; each feature that uses them says so in its
// description. None of them is treated as evidence on its own.

const set = (s) => new Set(s.trim().split(/\s+/));

// ~300 very common English words: anything outside this list (and at least
// 7 letters long) counts as a "less common" word.
export const COMMON_WORDS = set(`
the be to of and a in that have i it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are were been being has had did does said says made went seen done got
very really much many more most such same own each every both few little long great big small high old young right left last next early late important different large public bad able
man woman child world life hand part place case week company system program question government number night point home water room mother area money story fact month lot study book eye job word business issue side kind head house service friend father power hour game line end member law car city community name president team minute idea kid body information back parent face others level office door health person art war history party result change morning reason research girl guy moment air teacher force education
shows show showed says tells told explains explained means meant uses used makes making gets thing things something someone everyone everything nothing because though although while where why how again always never often still also however another example
feel feels felt become became leave put mean keep let begin seem help talk turn start might may must should shall need try call ask tell find found live lived believe bring happen write provide sit stand lose pay meet include continue set learn lead understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear buy wait serve die send expect build stay fall cut reach kill remain
`);

// Academic Word List–style vocabulary (a representative subset).
export const ACADEMIC_WORDS = set(`
analyse analyze analysis approach area assess assessment assume assumption authority available benefit concept consist constitute context contract create data define definition derive distribute economy environment establish estimate evident evidence export factor finance formula function identify income indicate individual interpret interpretation involve issue labour legal legislate major method occur percent period policy principle proceed process require research respond response role section sector significant significance similar source specific structure theory vary variable
achieve acquire administration affect appropriate aspect assist category chapter commission community complex compute conclude conclusion conduct consequent construct construction consume credit culture design distinct element equate evaluate feature final focus impact injure institute institution invest item journal maintain normal obtain participate perceive perception positive potential previous primary purchase range region regulate relevant reside resource restrict secure seek select site strategy survey text tradition transfer
alternative circumstance comment compensate component consent considerable constant constrain contribute convene coordinate core corporate correspond criteria deduce demonstrate document dominate dominant emphasis ensure exclude framework fund illustrate immigrate imply implication initial instance interact justify layer link locate maximise minor negate outcome partner philosophy physical proportion publish react register rely remove scheme sequence sex shift specify sufficient task technical technique technology valid volume
access adequate annual apparent approximate attitude attribute civil code commit communicate concentrate confer contrast cycle debate despite dimension domestic emerge error ethnic goal grant hence hypothesis implement implicate impose integrate internal investigate job label mechanism obvious occupy option output overall parallel parameter phase predict principal prior professional project promote regime resolve retain series statistic status stress subsequent sum summary undertake
abstract accurate acknowledge aggregate allocate assign attach author bond brief capable cite cooperate discriminate display diverse domain edit enhance estate exceed expert explicit federal fee flexible furthermore gender ignorance incentive incidence incorporate index inhibit initiate input instruct intelligence interval lecture migrate minimum ministry motive neutral nevertheless overseas precede presume rational recover reveal scope subsidy tape trace transform transport underlie utilise
ambiguity ambiguous paradox paradoxical duality dichotomy juxtaposition juxtapose motif symbolism imagery ideology ideological discourse narrative perspective agency subjectivity liminal liminality epistemology epistemological hegemony hegemonic ontological dialectic paradigm construct constructed construction tension instability destabilize subvert subversion critique interrogate foreground complicate problematize nuance nuanced
`);

// Analytical reporting verbs, basic vs advanced repertoire.
export const BASIC_ANALYTIC_VERBS = set(`shows show showed showing says say said tells tell told explains explain explained means mean meant uses use used makes make made gives give describes describe talks talk proves prove`);
export const ADVANCED_ANALYTIC_VERBS = set(`
interrogates interrogate interrogating foregrounds foreground foregrounding complicates complicate complicating juxtaposes juxtapose juxtaposing illuminates illuminate illuminating underscores underscore underscoring epitomizes epitomises epitomize exemplifies exemplify subverts subvert subverting destabilizes destabilises destabilize problematizes problematize critiques critique evokes evoke evoking conveys convey conveying highlights highlight highlighting emphasizes emphasises emphasize emphasizing reinforces reinforce reinforcing encapsulates encapsulate signifies signify connotes connote elucidates elucidate articulates articulate delineates delineate interrogated foregrounded complicated juxtaposed illuminated underscored exemplified subverted conveyed highlighted emphasized reinforced embodies embody embodying accentuates accentuate galvanizes situates situate positions reframes reframe undermines undermine
`);

export const HEDGES = set(`perhaps possibly potentially arguably seemingly somewhat likely presumably apparently maybe might may could suggests suggest suggesting appears appear seems seem partly partially relatively`);
export const BOOSTERS = set(`clearly obviously definitely certainly undoubtedly surely always never must indeed truly absolutely evidently undeniably`);
export const INTENSIFIERS = set(`very really extremely so highly incredibly deeply profoundly truly totally completely utterly particularly especially remarkably exceptionally`);
export const MODALS = set(`can could may might must shall should will would`);
export const EVALUATIVE = set(`important interesting powerful effective good bad great significant crucial vital essential meaningful striking compelling poignant sad happy strong weak`);
export const FIRST_PERSON = set(`i me my mine myself`);
export const SUBORDINATORS = set(`because although though while whereas since unless until whenever wherever whether if as after before once`);
export const RELATIVES = set(`which who whom whose that where when`);
export const COORDINATORS = set(`and but or so yet nor`);
export const PREPOSITIONS = set(`of in to for with on at by from about into through over after between under against during without within among throughout toward towards upon across beyond despite`);
export const LY_NOT_ADVERBS = set(`family only early likely lonely friendly ugly holy silly supply apply reply rely fly july italy daily ally belly bully`);

export const TRANSITION_PHRASES = [
  'furthermore', 'moreover', 'additionally', 'ultimately', 'in conclusion', 'similarly', 'consequently', 'nevertheless',
  'nonetheless', 'in addition', 'thus', 'hence', 'therefore', 'however', 'in contrast', 'conversely', 'overall',
  'in summary', 'to conclude', 'notably', 'also', 'another', 'first', 'firstly', 'secondly', 'finally', 'for example',
  'for instance', 'on the other hand', 'as a result', 'in other words', 'meanwhile', 'likewise',
];

// Literary/analytical technique vocabulary, grouped into evidence types.
export const EVIDENCE_TYPES = {
  imagery: /\b(?:imagery|image|images|visual(?:ly)?|describes? the|colou?rs?|light|darkness)\b/i,
  symbolism: /\b(?:symbol(?:s|ic|ism|izes|ises|ize)?|represents?|stands? for|signif(?:y|ies))\b/i,
  characterization: /\b(?:character(?:ization|isation|s)?|personality|motivations?|protagonist|antagonist)\b/i,
  perspective: /\b(?:narrator|narrative (?:voice|perspective)|point of view|first[- ]person|third[- ]person|perspective|focaliz\w*)\b/i,
  structure: /\b(?:structure|structural|chapter|opening|ending|climax|foreshadow\w*|flashback|pacing|cyclical)\b/i,
  visual: /\b(?:composition|framing|foreground|background|layout|camera|shot|panel|typography)\b/i,
  diction: /\b(?:diction|word choice|the word|the verb|the adjective|connotations?|lexis|language)\b/i,
  syntax: /\b(?:syntax|sentence (?:structure|length)|fragment|repetition|anaphora|parallelism|list)\b/i,
  juxtaposition: /\b(?:juxtapos\w*|contrast(?:s|ed|ing)?|opposition|binary)\b/i,
  motif: /\b(?:motifs?|recurring|recurs|repeated(?:ly)?)\b/i,
  context: /\b(?:historical|context|written in|published|at the time|era|century|society of the time|biograph\w*)\b/i,
};

// Abstract/conceptual vocabulary used for the abstraction estimate.
export const ABSTRACT_TERMS = /\b(?:ideolog\w*|epistemolog\w*|hegemon\w*|power|authority|institution\w*|identity|identities|society|societal|humanity|human nature|human condition|morality|moral|civili[sz]ation|order|chaos|freedom|justice|truth|reality|existence|construct\w*|instabilit\w*|agency|subjectivit\w*|discourse|paradigm|dialectic\w*|liminal\w*|duality|dichotom\w*|paradox\w*|tension|fragility|nature of|essence|condition|structures?|systems?|value systems?|collective|individualism)\b/gi;

// Weak surface indicators often associated with generic machine-written prose.
// These carry LOW weight and can never raise a category on their own.
export const WEAK_SURFACE = [
  { id: 'genericTransitions', label: 'Stock sentence-opening transitions (Furthermore, Moreover, Additionally…)', re: /(?:^|[.!?]\s+)(?:Furthermore|Moreover|Additionally|In addition|Ultimately|Consequently|Notably|In essence),/g },
  { id: 'notOnlyButAlso', label: '"not only … but also" constructions', re: /\bnot only\b[^.]{1,90}?\bbut(?: also)?\b/gi },
  { id: 'importantToNote', label: 'Metadiscourse ("It is important to recognize…", "It is worth noting…")', re: /\bit is (?:important|worth|crucial|essential|vital) to (?:note|recognize|recognise|consider|acknowledge|understand)\b|\bit is worth noting\b/gi },
  { id: 'genericConclusion', label: 'Generic conclusion language ("serves as a powerful reminder", "timeless", "the human experience")', re: /\bserves? as a (?:powerful |stark |poignant )?reminder\b|\btimeless\b|\bthe human (?:experience|condition)\b|\bremains relevant (?:today|to)\b/gi },
  { id: 'repetitiveQualification', label: 'Repeated concessive framing ("While X may…, it ultimately…")', re: /(?:^|[.!?]\s+)(?:While|Although)\b[^.]{5,}?,\s*[^.]*\bultimately\b/g },
  { id: 'signposting', label: 'Explicit signposting ("This essay will…", "This allows the reader to…")', re: /\bthis essay will\b|\bthis allows the reader\b|\bthe reader can (?:therefore )?see\b/gi },
];

export const COMMON_MISSPELLINGS = set(`alot becuase beacuse definately recieve seperate untill wich thier beleive occured begining realy finaly truely arguement goverment enviroment wierd tommorow basicly noone everytime infront thru gonna wanna kinda dont doesnt didnt cant wont isnt im ive thats`);
