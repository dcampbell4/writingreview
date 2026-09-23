// Safeguards applied after detection. Each adjustment is recorded on the signal
// so the teacher can see exactly why a severity changed.

import { capSeverity, sevRank } from '../util.js';

const ACCOMMODATIONS = [
  {
    flag: 'dictation',
    label: 'uses dictation / speech-to-text',
    applies: (s) => s.tags?.includes('insertion') && s.detector !== 'paste' || s.tags?.includes('speed') || s.detector === 'continuous-composition' || s.detector === 'linear-drafting',
    cap: (c) => c.accommodations.dictationCap,
  },
  {
    flag: 'draftsElsewhere',
    label: 'is known to draft in another app and paste in',
    applies: (s) => ['paste', 'report-paste', 'report-paste-share', 'linear-drafting', 'low-revision', 'revision-discontinuity', 'continuous-composition', 'late-polishing'].includes(s.detector),
    cap: (c) => c.accommodations.draftsElsewhereCap,
  },
  {
    flag: 'ell',
    label: 'is an English language learner',
    applies: (s) => s.category === 'rhetoric',
    cap: (c) => c.accommodations.ellRhetoricCap,
  },
  {
    flag: 'assistiveTools',
    label: 'uses assistive writing tools (e.g. word prediction, grammar support)',
    applies: (s) => s.category === 'baseline' && (s.group === 'mechanics' || s.group === 'vocabulary') || s.tags?.includes('speed'),
    cap: () => 'Low',
  },
];

export const CONTEXT_FLAGS = ACCOMMODATIONS.map((a) => ({ flag: a.flag, label: a.label }));

export function applySafeguards(signals, student, config) {
  const context = student?.context || {};
  for (const s of signals) {
    s.originalSeverity = s.severity;
    for (const a of ACCOMMODATIONS) {
      if (!context[a.flag] || !a.applies(s)) continue;
      const cap = a.cap(config);
      if (sevRank(s.severity) > sevRank(cap)) {
        s.adjustments.push(`Student ${a.label}: severity capped at ${cap} (was ${s.severity}).`);
        s.severity = capSeverity(s.severity, cap);
      } else {
        s.adjustments.push(`Student ${a.label}: consider this first as an explanation.`);
      }
    }
  }
  return signals;
}
