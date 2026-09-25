// All settings live here; teachers can edit them on the Settings page.
// Saved values are merged over these defaults.

export const DEFAULT_CONFIG = {
  general: { idleGapSec: 120 },
  baseline: {
    minimumSamples: 3,        // below this: "Insufficient baseline"
    preferredSamples: 5,
    strongSamples: 10,        // plus at least two different genres
    minWords: 120,            // samples shorter than this count for less
    relativeSpreadFloor: 0.12,
  },
  // How much each earlier sample counts, by similarity to the current task.
  genreWeights: {
    sameAssignmentType: 1.0,
    sameGenre: 0.9,
    sameSubject: 0.7,
    differentGenre: 0.4,
    timedVsPolished: 0.3,     // cap when one is timed and the other is not
  },
  strength: {
    // Deviation (in units of the student's own spread) needed for each strength.
    moderate: 1.75,
    high: 2.75,
    veryHigh: 3.75,
  },
  trend: {
    minSamples: 4,            // dated samples needed to recognise a trend
    minFit: 0.5,              // how steadily the feature must have been changing (R²)
  },
  categories: {
    // Category level from the combined deviation of its strongest features.
    moderate: 1.5,
    moderateHigh: 2.2,
    high: 3.0,
    veryHigh: 4.0,
    topFeatures: 4,
  },
  process: {
    sessionGapMin: 30,
    idleGapSec: 120,
    continuousGapSec: 60,
    continuousMinWords: 120,
    continuousMaxRevision: 0.05,
    bulkInsertWords: 40,
    minPasteWords: 15,
  },
  // General reference values used only when a student has no earlier process data.
  processReference: {
    typingRate: { mean: 14, spread: 6 },
    revisionDensity: { mean: 4, spread: 2 },
    firstDraftShare: { mean: 55, spread: 15 },
    retention: { mean: 82, spread: 8 },
    longestContinuous: { mean: 140, spread: 80 },
    continuousShare: { mean: 20, spread: 15 },
    pastedShare: { mean: 3, spread: 6 },
    largestInsertion: { mean: 35, spread: 30 },
    pasteEvents: { mean: 0.5, spread: 1 },
    multiParagraphPastes: { mean: 0, spread: 0.6 },
  },
};

export const SETTINGS_SCHEMA = [
  { section: 'baseline', title: 'Baseline requirements', fields: [
    ['minimumSamples', 'Minimum baseline samples'], ['preferredSamples', 'Preferred baseline samples'], ['strongSamples', 'Strong longitudinal profile (samples)'], ['minWords', 'Samples shorter than this count for less (words)'],
  ]},
  { section: 'genreWeights', title: 'Genre matching weights (0–1)', fields: [
    ['sameAssignmentType', 'Same assignment type'], ['sameGenre', 'Same genre'], ['sameSubject', 'Same subject'], ['differentGenre', 'Different genre'], ['timedVsPolished', 'Timed vs. polished (maximum)'],
  ]},
  { section: 'strength', title: 'Deviation strength (in the student’s own spreads)', fields: [
    ['moderate', 'Moderate from'], ['high', 'High from'], ['veryHigh', 'Very high from'],
  ]},
  { section: 'trend', title: 'Longitudinal development', fields: [
    ['minSamples', 'Dated samples needed to recognise a trend'], ['minFit', 'Steadiness of trend required (0–1)'],
  ]},
  { section: 'categories', title: 'Category levels (combined deviation)', fields: [
    ['moderate', 'Moderate from'], ['moderateHigh', 'Moderate-high from'], ['high', 'High from'], ['veryHigh', 'Very high from'], ['topFeatures', 'Strongest features combined per category'],
  ]},
  { section: 'process', title: 'Process analysis', fields: [
    ['sessionGapMin', 'New session after a gap of (minutes)'], ['idleGapSec', 'Pause excluded from active time (seconds)'], ['continuousGapSec', 'Continuous writing breaks after (seconds)'],
    ['continuousMinWords', 'Long continuous period (words)'], ['continuousMaxRevision', 'Maximum deletion ratio in a continuous period'], ['bulkInsertWords', 'Bulk insertion between saved versions (words)'], ['minPasteWords', 'Ignore pastes smaller than (words)'],
  ]},
];

export function mergeConfig(saved) {
  const out = structuredClone(DEFAULT_CONFIG);
  if (!saved) return out;
  for (const [section, values] of Object.entries(saved)) {
    if (!out[section] || typeof values !== 'object') continue;
    for (const [k, v] of Object.entries(values)) if (k in out[section]) out[section][k] = v;
  }
  return out;
}
