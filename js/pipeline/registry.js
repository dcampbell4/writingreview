// The detector registry. To add a new signal, write a detector object
// ({ id, category, name, requires, run(ctx) → Signal[] }) and add it here.
// `requires` may contain 'log' (writing-process data) and/or 'baseline'.

import { processDetectors } from '../process/detectors.js';
import { textDetectors } from '../text/detectors.js';
import { baselineDetectors } from '../baseline/baseline.js';

export const CATEGORIES = [
  { id: 'process', label: 'Process', description: 'Revision, insertion, speed and editing behaviour' },
  { id: 'style', label: 'Style', description: 'Changes in vocabulary, sentence structure and syntax within the document' },
  { id: 'rhetoric', label: 'Rhetoric', description: 'Clusters of formulaic constructions, signposting and generic claims' },
  { id: 'baseline', label: 'Baseline deviation', description: "Differences from the student's own previous writing" },
];

export const TEXTUAL_CATEGORIES = new Set(['style', 'rhetoric', 'baseline']);

export const DETECTORS = [...processDetectors, ...textDetectors, ...baselineDetectors];
