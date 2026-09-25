# Writing Profiles: Design

**Central question:** how unusual is this piece of writing *for this particular student*?

The tool separates **detection** ("something is unusual") from **attribution** ("AI caused it"). It does only the first. It never converts anomaly evidence into an AI probability, never labels text as AI-written, and never makes a disciplinary decision. Every report includes:

> An anomaly is not evidence of misconduct. Students can change their writing because of tutoring, instruction, maturation, editing, collaboration, genre, topic familiarity, or other legitimate reasons.

## Architecture

```text
INPUT (.docx / .pdf / .txt / paste; optional process log or report)
  ↓
Document parser (js/import)            Assignment context (teacher questionnaire)
  ↓
 ┌───────────────┬──────────────────┬────────────────────┐
 Stylometry       Discourse          Process history
 features/        features/          features/process.js
 stylometry.js    discourse.js       (+ process/replay.js)
 └───────────────┴──────────────────┴────────────────────┘
  ↓
Student baseline model (profile/profile.js): genre weights, sufficiency, trends
  ↓
Anomaly detection (analysis/compare.js): per-feature deviation from the student's own distribution
  ↓
Evidence aggregation (analysis/aggregate.js): four categories, investigation priority
  ↓
Teacher explanation (analysis/explain.js, followup.js) → UI, conference mode, report
```

Everything runs in the browser. Each feature is a small declarative entry (id, label, unit, plain explanation, minimum spread, direction, weight), so new research features can be added in one place.

## Data model

```js
Student    { id: 'S-1042', displayName?, gradeLevel, context: { dictation, draftsElsewhere, ell, assistiveTools }, notes }
Assignment { id, title, genre, assignment_type, subject, timed, durationMinutes, inClass, researchAllowed, notesAllowed,
             aiAllowed, collaborationAllowed, sentenceFrames, modelEssay, taughtTerms[], gradeLevel }
Sample     { id, student_id, assignment_id, role: 'baseline' | 'current', timestamp, genre, assignment_type, subject, timed,
             word_count, text, process_data: { log } | { report } | null, include, authentic }
Profile    { items (weighted samples), n, nEff, sufficiency, features: { id: { mean, sd, min, max, points, trend } } }
Anomaly    { category, feature, deviation, strength, evidence_quality, explanation, alternative_explanations[] }
```

## Evidence

**Style (authorship fingerprint).** These are tracked as distributions across the student's samples:
- **Sentences:** mean and median length, variation, clauses, subordination, coordination, fragments, questions, opening variety, repeated patterns.
- **Vocabulary:** MATTR diversity, type-token ratio, less common words, academic words, abstract concepts, modifier density, advanced vs. everyday analytical verbs, hedging, intensifiers, modals, transitions, repeated phrases.
- **Syntax:** estimated embedding, passives, nominalisation, prepositional density, introductory clauses, participial phrases, semicolons, colons, dashes, parentheticals.
- **Voice:** first person, how evidence is introduced and integrated, paragraph openers, certainty, evaluative language, qualification.
- **Mechanics:** recurring spelling and punctuation habits, contractions.
- **Weak surface indicators:** generic transitions, "not only… but also", metadiscourse, generic conclusions, concessive templates, signposting, uniformity. These carry **weight 0.25**, are always rated Low evidence quality, and never appear among the strongest deviations.

**Discourse.** Each sentence gets a move by transparent cue rules: thesis, claim, context, evidence, explanation, reasoning link, qualification, counterpoint, implication, retelling or conclusion. The sentence is also rated concrete (0), analytical (1) or abstract (2). From these the tool measures:
- **Architecture:** moves per paragraph, chain length, evidence per claim, explanation per evidence, qualifications, counterpoints, implications, retelling, repeated claims.
- **Abstraction:** the index, and the abstract and concrete shares.
- **Reasoning:** steps taken after evidence, technique naming, leaps to broad themes.
- **Evidence selection:** quotation rate and length, paraphrase, specificity, and the kinds of evidence used.

Minimum counts prevent unstable ratios.

**Process** comes from a replayed event log, in which every final character is traced to the event that produced it. It measures:
- active time and sessions
- composition speed
- **substantive vs. surface revision density**: rewording or deleting ideas vs. typo, spelling and punctuation fixes
- draft growth: share of the final text present at 25%, 50%, 75% and 100% of the session, and in the first substantial draft
- retention
- continuous unrevised writing: the longest period, and the share of the final text written that way

**External insertion:** the share of the text inserted in blocks, the largest single insertion, external paste events, and multi-paragraph pastes. Saved-version exports (snapshots) and imported PDF reports are supported with lower evidence quality.

## Statistics (no fixed thresholds)

- **Genre weighting.** Each earlier sample counts according to its similarity to the current task:

  | Similarity | Weight |
  |---|---|
  | Same assignment type | 1.0 |
  | Same genre | 0.9 |
  | Same subject | 0.7 |
  | Different genre | 0.4 |
  | Timed vs. polished | at most 0.3 |

  Short samples count half. The effective sample size is reported, and all weights are configurable.
- **Deviation.** `z = (x − weighted mean) / spread`, where the spread is the largest of the weighted SD, 12% of the mean, or a per-feature floor. It is reported in words: "higher than in 7 of 8 earlier samples". Raw z-values appear only in the Statistics tab.
- **Direction.** Process and insertion features count only in the concerning direction (e.g. less revision, larger insertions).
- **Rare events.** An increase built on fewer than 3 occurrences is scaled down.
- **Longitudinal learning.** With 4 or more dated samples and a steady trend (R² ≥ 0.5), the deviation is measured from the value the trend predicts. Steady growth is therefore "consistent with gradual development", while a jump after a stable history is flagged as "abrupt".
- **Context adjustments.** Deviations are multiplied by a factor, and the reason is always shown:
  - Assignment: sentence frames, model essay, research, notes, collaboration, taught terms. Taught terms are also removed from vocabulary counts.
  - Student: dictation, drafting elsewhere, English learners, assistive tools.
- **Strength.** Moderate from 1.75, high from 2.75, very high from 3.75 spreads.
- **Evidence quality** (High, Moderate or Low) is lowered for:
  - a minimum-size baseline
  - an effective sample size below 2.5
  - texts under 250 words
  - discourse features (heuristic)
  - general reference values (no earlier process data)
  - imported reports instead of full logs
  - weak signals

## Anomaly profile and priority

- **Four categories:** Style, Discourse, Process and External insertion. Each category's score is the larger of:
  - the root mean square of its four strongest weighted deviations
  - 0.8 × its single strongest deviation

  Scores map to LOW, MODERATE, MODERATE-HIGH, HIGH or VERY HIGH.
- **Caps:**
  - Minimum baseline: text categories at most HIGH.
  - Process compared only with reference values: at most MODERATE-HIGH.
  - Imported report: at most HIGH.
- **Baseline requirement:** fewer than 3 samples means "Insufficient baseline for reliable authorship comparison", and Style and Discourse are not assessed.
- **Investigation priority:**
  - **HIGH:** 2 or more categories at HIGH, or 3 at MODERATE-HIGH.
  - **MODERATE:** 1 category at HIGH, or 2 at MODERATE-HIGH, or 3 at MODERATE.
  - **LOW:** anything less.
  - **INCONCLUSIVE:** no category can be assessed.
- **Insufficient baseline:** process evidence alone is capped at MODERATE.
- **Dismissed findings** stay visible but leave the calculation.

## Safeguards

- Neutral language only. A test fails if any output contains accusatory or probabilistic phrasing.
- Every finding carries its evidence, evidence quality, historical support and alternative explanations.
- The limitations are stated in every report.
- Follow-up questions and conference prompts are about the student's own work, e.g. "Can you explain what you meant in this sentence…".
- Privacy:
  - all processing is local
  - no external requests, fonts or trackers
  - students are identified by ID, with names optional and hideable
  - optional AES-GCM encryption with a passphrase (PBKDF2, 250k iterations)
  - export, delete a student's profile, delete everything

## Known limitations

- Discourse moves and the abstraction level are cue-based approximations. The UI shows the move for each sentence so the teacher can check it.
- Word lists (academic, analytical verbs, abstract terms) are small and editable in `js/text/lexicons.js`.
- Process evidence covers only the tracked document.
