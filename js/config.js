// All detection thresholds live here. Teachers can change any of them on the
// Settings page; saved values are merged over these defaults.

export const DEFAULT_CONFIG = {
  general: {
    idleGapSec: 120,          // a pause longer than this is not counted as active writing time
    minWordsForRates: 150,    // rate-based textual detectors need at least this many words
  },
  paste: {
    minWords: 15,             // pastes smaller than this are ignored
    mediumWords: 50,
    highWords: 150,
    largeWords: 60,           // pastes this size or larger are named "Large insertion (paste)"
    quoteShareDowngrade: 0.6, // if this share of a paste is inside quotation marks, downgrade
  },
  insertion: {
    windowSec: 60,            // sliding window for typed (non-paste) insertions
    mediumWords: 120,         // words added within the window
    highWords: 200,
    baselineMediumRatio: 2,   // relative to the student's usual largest insertion
    baselineHighRatio: 4,
  },
  continuous: {
    minWords: 200,            // an uninterrupted stretch must add at least this many words
    maxRevisionRatio: 0.03,   // deleted chars / inserted chars within the stretch
    highWords: 400,
  },
  revision: {
    referenceRatio: 0.15,     // typical revision ratio used only when there is no baseline
    mediumShare: 0.35,        // flag when ratio is below this share of the baseline/reference
    highShare: 0.15,
    minWords: 150,
  },
  linear: {
    minParagraphWords: 60,
    mediumShare: 0.5,         // share of final words in paragraphs with no later development
    highShare: 0.8,
  },
  speed: {
    windowSec: 120,
    plausibleWpm: 70,         // sustained typed words per minute considered unusually fast
    highWpm: 110,
    baselineMediumRatio: 1.8,
    baselineHighRatio: 2.5,
  },
  discontinuity: {
    revisedDensity: 4,        // edits per 100 words that count as "heavily revised"
    unrevisedDensity: 0.5,    // edits per 100 words that count as "almost untouched"
    minWords: 60,
    highWords: 200,
  },
  latePolish: {
    lateShare: 0.2,           // final 20% of active writing time
    minWords: 100,
    mediumRatio: 1.4,         // sophistication (long-word rate) of late text vs earlier text
    highRatio: 1.8,
  },
  style: {
    minParagraphs: 4,
    mediumDistance: 2.5,      // combined robust z-distance of one paragraph from the others
    highDistance: 3.5,
    uniformCv: 0.28,          // sentence-length coefficient of variation considered uniform
    uniformMinSentences: 15,
  },
  rhetoric: {
    // Matches per 1,000 words. A pattern family also needs minCount matches.
    minCount: 3,
    mediumRate: 6,
    highRate: 12,
    baselineRatioNoConcern: 1.5, // within this ratio of the student's own rate → Low only
    capWithoutBaseline: 'Medium',
  },
  baseline: {
    lowZ: 1.5,
    mediumZ: 2.5,
    highZ: 3.5,
    relativeSpreadFloor: 0.15,
    establishedSamples: 3,
    establishedWords: 800,
    limitedCap: 'Low',     // with a limited baseline, deviations are shown for context only
    vocabMinCount: 4,
    vocabMediumRatio: 2,
    vocabHighRatio: 3.5,
  },
  summary: {
    reviewMinCategories: 2,
    requireHighForReview: true,
    requireProcessOrBaseline: true, // textual style alone never reaches "Review recommended"
  },
  accommodations: {
    dictationCap: 'Low',       // large insertion + speed
    draftsElsewhereCap: 'Low', // paste + linear drafting + low revision
    ellRhetoricCap: 'Low',
  },
};

// Describes the editable settings for the Settings page.
export const CONFIG_SCHEMA = [
  { section: 'general', title: 'General', fields: [
    ['idleGapSec', 'Pause that ends active writing (seconds)'],
    ['minWordsForRates', 'Minimum words before textual rates are computed'],
  ]},
  { section: 'paste', title: 'Paste events', fields: [
    ['minWords', 'Ignore pastes smaller than (words)'],
    ['mediumWords', 'Medium at (words)'],
    ['highWords', 'High at (words)'],
    ['largeWords', 'Call it a "large insertion" at (words)'],
    ['quoteShareDowngrade', 'Downgrade when this share is quotation (0–1)'],
  ]},
  { section: 'insertion', title: 'Large typed insertions', fields: [
    ['windowSec', 'Window (seconds)'],
    ['mediumWords', 'Medium at words within window'],
    ['highWords', 'High at words within window'],
    ['baselineMediumRatio', 'Medium at × student’s usual largest insertion'],
    ['baselineHighRatio', 'High at × student’s usual largest insertion'],
  ]},
  { section: 'continuous', title: 'Continuous composition', fields: [
    ['minWords', 'Minimum words in an uninterrupted stretch'],
    ['maxRevisionRatio', 'Maximum revision ratio (0–1)'],
    ['highWords', 'High at (words)'],
  ]},
  { section: 'revision', title: 'Revision rate', fields: [
    ['referenceRatio', 'Reference revision ratio when there is no baseline'],
    ['mediumShare', 'Medium below this share of baseline'],
    ['highShare', 'High below this share of baseline'],
    ['minWords', 'Minimum words written'],
  ]},
  { section: 'linear', title: 'Linear drafting', fields: [
    ['minParagraphWords', 'Paragraph size considered (words)'],
    ['mediumShare', 'Medium at share of text never revisited'],
    ['highShare', 'High at share of text never revisited'],
  ]},
  { section: 'speed', title: 'Writing speed', fields: [
    ['windowSec', 'Window (seconds)'],
    ['plausibleWpm', 'Medium at sustained typed words/minute'],
    ['highWpm', 'High at sustained typed words/minute'],
    ['baselineMediumRatio', 'Medium at × student’s usual speed'],
    ['baselineHighRatio', 'High at × student’s usual speed'],
  ]},
  { section: 'discontinuity', title: 'Revision discontinuity', fields: [
    ['revisedDensity', 'Heavily revised (edits per 100 words)'],
    ['unrevisedDensity', 'Almost untouched (edits per 100 words)'],
    ['minWords', 'Minimum untouched words'],
    ['highWords', 'High at untouched words'],
  ]},
  { section: 'latePolish', title: 'Late polishing', fields: [
    ['lateShare', 'Final share of writing time (0–1)'],
    ['minWords', 'Minimum words added late'],
    ['mediumRatio', 'Medium at × sophistication of earlier text'],
    ['highRatio', 'High at × sophistication of earlier text'],
  ]},
  { section: 'style', title: 'Style within the document', fields: [
    ['minParagraphs', 'Minimum paragraphs'],
    ['mediumDistance', 'Medium at paragraph distance'],
    ['highDistance', 'High at paragraph distance'],
    ['uniformCv', 'Uniform rhythm below sentence-length variation'],
    ['uniformMinSentences', 'Minimum sentences for rhythm'],
  ]},
  { section: 'rhetoric', title: 'Rhetorical patterns', fields: [
    ['minCount', 'Minimum matches in a pattern family'],
    ['mediumRate', 'Medium at matches per 1,000 words'],
    ['highRate', 'High at matches per 1,000 words'],
    ['baselineRatioNoConcern', 'Low only if within × of student’s own rate'],
  ]},
  { section: 'baseline', title: 'Baseline comparison', fields: [
    ['lowZ', 'Low at deviation (z)'],
    ['mediumZ', 'Medium at deviation (z)'],
    ['highZ', 'High at deviation (z)'],
    ['relativeSpreadFloor', 'Minimum spread as share of mean'],
    ['establishedSamples', 'Samples for an established baseline'],
    ['establishedWords', 'Words for an established baseline'],
    ['vocabMinCount', 'Minimum new sophisticated words'],
    ['vocabMediumRatio', 'Medium at × expected new-vocabulary rate'],
    ['vocabHighRatio', 'High at × expected new-vocabulary rate'],
  ]},
  { section: 'summary', title: 'Overall status', fields: [
    ['reviewMinCategories', 'Categories needed for "Review recommended"'],
  ]},
];

export function mergeConfig(saved) {
  const out = structuredClone(DEFAULT_CONFIG);
  if (!saved) return out;
  for (const [section, values] of Object.entries(saved)) {
    if (!out[section] || typeof values !== 'object') continue;
    for (const [k, v] of Object.entries(values)) {
      if (k in out[section]) out[section][k] = v;
    }
  }
  return out;
}
