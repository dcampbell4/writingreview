# Writing Process Review: Design

A teacher decision-support tool that surfaces **unusual writing-process and textual patterns that may warrant review**.

It is **not** an AI detector. It never produces an "AI probability", never labels text as AI-generated and never decides whether a student cheated. Every flag points to observable evidence that a teacher can check and then dismiss or annotate.

---

## 1. Architecture

A static, browser-only web app. It needs no server, no build step and no third-party services, so student writing never leaves the teacher's browser.

```
writing-review/
├── index.html              Teacher dashboard (single-page app, hash routing)
├── capture.html            Optional writing-capture editor that records the event log
├── css/app.css
└── js/
    ├── config.js           Default thresholds + settings schema (all configurable)
    ├── store.js            Local persistence (students, samples, submissions, notes, settings)
    ├── schema.js           Event schema: validation + normalisation
    ├── text/
    │   ├── tokenize.js     Paragraphs, sentences, words, syllables (with character offsets)
    │   ├── lexicons.js     Pattern lists (transitions, hedges, analytical verbs, …)
    │   ├── features.js     Stylometric features, used for baselines and comparisons
    │   └── detectors.js    Rhetorical / textual pattern detectors
    ├── process/
    │   ├── replay.js       Replays events and tracks where every final character came from
    │   └── detectors.js    Process detectors (paste, large insertion, revision, speed, …)
    ├── baseline/
    │   └── baseline.js     Builds a student baseline and compares a submission to it
    ├── pipeline/
    │   ├── registry.js     Detector registry. New signals are added here.
    │   ├── severity.js     Severity rules, safeguards and accommodation adjustments
    │   └── analyze.js      Orchestration and the multi-signal summary
    ├── report.js           Teacher report (printable, plus copyable plain text)
    ├── demo/               Fictional demo students plus a deterministic writing simulator
    └── ui/                 Dashboard, submission view, timeline, text view, baselines, settings
```

**Data flow**

```
submission (final text + optional event log)
      │
      ├─► replay.js ──► provenance map (final char → event, time, paste?, edits)
      ├─► features.js ──► feature vector
      ├─► baseline.js (student's prior authentic samples) ──► baseline profile
      │
      └─► registry: every detector runs independently → Signal[]
                │
                ▼
         severity.js (thresholds, baseline reliability caps, accommodations)
                │
                ▼
         analyze.js → categories → convergence summary (no probability)
                │
                ▼
         Dashboard / Timeline / Text highlights / Report
```

## 2. Data model

```js
Student    { id, name, context: { dictation, assistiveTools, ell, draftsElsewhere }, notes }
Sample     { id, studentId, title, date, text, authentic: true, include: true, log?: EventLog }
Submission { id, studentId, assignment, date, finalText, log?: EventLog, assignmentTerms: [] }
Annotation { submissionId, signalId, status: 'open'|'reviewed'|'dismissed', note, updatedAt }
Settings   { ...thresholds }           // see config.js
```

`Signal`, the unit that everything else is built from:

```js
{
  id,            // stable: detectorId + location, so teacher notes survive re-analysis
  detector, category,        // 'process' | 'style' | 'rhetoric' | 'baseline'
  name,                      // neutral label, e.g. "Large insertion"
  severity,                  // 'Low' | 'Medium' | 'High'
  finding,                   // one-line observed fact: "487 words appeared within 1 second (paste)"
  evidence: [{label, value}],// observed facts only
  baseline,                  // what is typical for this student, or null
  explanation,               // teacher-friendly interpretation (kept separate from evidence)
  alternatives: [],          // plausible innocent explanations
  rule,                      // the threshold that produced this severity
  adjustments: [],           // any safeguard that changed the severity, and why
  ranges: [{start, end}],    // character ranges in the final text
  time: {start, end},        // when it happened (if process data exists)
  eventIds: []
}
```

## 3. Event schema (writing-process data)

```json
{
  "schema": "writing-process-log",
  "version": 1,
  "startedAt": "2026-09-22T09:00:00Z",
  "events": [
    { "t": 1758531600000, "type": "insert",  "pos": 0,   "text": "Golding uses " },
    { "t": 1758531603000, "type": "delete",  "pos": 8,   "length": 5 },
    { "t": 1758531609000, "type": "replace", "pos": 8,   "length": 4, "text": "shows" },
    { "t": 1758532920000, "type": "paste",   "pos": 812, "text": "…" },
    { "t": 1758532990000, "type": "snapshot", "text": "full document text" },
    { "t": 1758533040000, "type": "submit" }
  ]
}
```

* `t` is epoch milliseconds or an ISO string. `pos` and `length` are character offsets in the document at that moment.
* `insert`: typed text (editors may batch several keystrokes into one event).
* `paste`: inserted from the clipboard or by drag-and-drop.
* `delete` and `replace`: removals, or removal followed by an insertion.
* `snapshot`: the full text at a point in time. This lets version-history exports (for example, one revision per minute) work: the replay turns each snapshot into a diff.
* `focus`, `blur`, `submit`, `session-start` and `session-end` are markers that don't change the text.

`capture.html` produces this format directly. Adapters for other editors only need to emit these events.

## 4. Detection pipeline

1. **Normalise** the submission and its log. Sort the events, convert times and validate the fields.
2. **Replay** the events. Each final character records which event inserted it, whether that event was a paste, whether it was inserted in the middle of existing text, and how many later edits touched it. The replay confirms that it rebuilds the submitted text and warns if it doesn't.
3. **Extract features** from the final text: whole document, per paragraph and per sentence.
4. **Build the baseline** from the student's included authentic samples, and from their logs if they have any.
5. **Run the detectors.** Each detector is independent, declares what it `requires` (`log`, `baseline` or only text) and is skipped when that data is missing. The skip is shown in the UI.
6. **Apply the severity rules and safeguards** (§6, §8).
7. **Summarise.** Signals are grouped into 4 categories, the tool checks how many categories independently show Medium or High signals, and it writes a neutral summary.

Detectors: process (paste, large insertion, continuous composition, low revision, linear drafting, speed, revision discontinuity, late polishing), style (within-document style discontinuity, uniform sentence rhythm), rhetoric (signposting, generic analytical language, abstract inflation, artificial nuance, symmetrical constructions, list stacking, generic claims, hedging, metadiscourse, analytical-verb repetition, generic conclusion) and baseline (a per-feature deviation plus vocabulary outside the baseline).

## 5. Baseline methodology

* Only samples the teacher marks as **authentic** and **included** count toward the baseline. Teachers can add, exclude or edit samples at any time.
* For each feature, the baseline stores the mean, SD, min and max across samples.
* **Deviation** is `z = (value − mean) / spread`, where `spread = max(SD, 15% of |mean|, feature floor)`. With few samples the SD is unreliable, so the floor stops tiny spreads from inflating z.
* A deviation is reported only when the value is also **outside the student's observed range**.
* **Reliability**: *Established* needs at least 3 samples and at least 800 words; anything less is *Limited*, and then baseline deviations are capped at Low (context only); with no samples there is *None*. The reliability level is always shown.
* **Vocabulary outside the baseline**: sophisticated words (3 or more syllables, or 9 or more letters) that never appear in the baseline, with simple stemming. Quotations, proper nouns and teacher-supplied *assignment terms* are excluded. The rate is compared with the student's own expected rate of new vocabulary, estimated leave-one-out across their samples.
* **Process baseline** (when prior logs exist): largest insertion, revision ratio and typing speed.

Features: sentence length (mean and SD), word length, rate of long words, lexical diversity (MATTR), paragraph length, transitions, share of transition-led sentence openers, "This/The/It" openers, commas per sentence, semicolons and colons, dashes, conjunctions, passive voice, hedging, modals, analytical verbs, nominalisation (abstraction), figurative language, quotation rate and length, error rate (common misspellings, lowercase "i", lowercase sentence starts, doubled words, contractions missing apostrophes), complex-sentence rate, first-person rate, contractions, thesis length and conclusion opener.

## 6. Severity (never a probability)

* Each detector maps its measurement to **Low, Medium or High** using thresholds from `config.js`. The rule is stored on the signal, for example: *"High when ≥ 150 words (setting: Paste → High at words)"*.
* Where a baseline exists, severity uses the **ratio to this student's own baseline** rather than population norms.
* **The overall status is categorical.** It is based on *independent categories*, not on adding up signals:
  * **Review recommended**: 2 or more categories have a Medium or High signal, at least one of those signals is High, and at least one of the categories is **Process** or **Baseline deviation**. Formulaic style on its own, which is often taught, never reaches this status.
  * **Some unusual patterns**: at least 1 category has a Medium or High signal.
  * **No notable patterns**.
* Dismissed signals are kept and shown, but they are left out of the status.

## 7. Teacher dashboard

* **Submissions table**: student, assignment, date, number of process signals, number of textual signals, highest severity, review status and teacher status.
* **Submission view**:
  * a summary banner (status + neutral explanation + data coverage)
  * category counts
  * a signal list
  * a signal detail panel with **Observed evidence**, **Baseline**, **Interpretation**, **Other possible explanations**, **Rule**, **Adjustments** and a dismiss or annotate control
  * the writing timeline: a chart plus a readable event log, where clicking an event highlights the text it produced
  * revision by paragraph
  * the final text, with highlights for the selected signal or colouring by text origin (typed or pasted)
  * a baseline comparison table
* **Students & baselines**: manage samples and accommodations.
* **Settings**: every threshold.
* **Report**: a printable, concise report.

## 8. False positives and safeguards

| Legitimate situation | Signals it can trigger | Safeguard |
|---|---|---|
| Speech-to-text / dictation | Large insertion, speed | Student context flag caps those signals at Low, with the reason shown |
| Drafting in another app then pasting | Paste, low revision, linear drafting | "Drafts elsewhere" flag; alternatives listed; teacher can ask for the draft |
| Moving own text (cut/paste) | Paste | Paste matching text deleted earlier in the same document is marked *internal move* and not flagged |
| Pasting a quotation | Paste | Pastes that are mostly quoted text are downgraded, and the reason is noted |
| Taught structures (transitions, "This shows…") | Rhetoric | Compared with the student's own rate; severity capped at Medium with no baseline; rhetoric alone can't reach *Review recommended* |
| English language learners | Formulaic language, vocabulary shift, error changes | ELL flag adds explanations and caps rhetoric signals at Low |
| Spellcheck / grammar tools | Fewer errors than baseline | Listed as the first alternative; mechanics changes are capped at Medium |
| Genuine growth, tutoring, feedback | Baseline deviations | Old samples can be excluded; range + z rule; limited-baseline cap (Low) |
| Assignment-specific vocabulary | Vocabulary shift | Teacher-provided assignment terms, quotations and proper nouns are excluded |
| Short texts | Most textual rates | Minimum word counts before rate-based detectors run |
| Incomplete logs | Process signals | Replay mismatch warning shown prominently |

Always:

* The tool uses neutral language only, is never an AI percentage and never produces an automatic accusation.
* Evidence and interpretation are kept separate.
* Every flag links to text ranges and/or events.
* All thresholds can be edited.
* The report states that the signals do not establish how the text was produced, and suggests a conversation with the student as the next step.

## 9. Extending

Add an object to `js/pipeline/registry.js`:

```js
{ id: 'my-signal', category: 'rhetoric', name: 'My signal', requires: [],
  run(ctx) { return [ /* Signal objects, see §2 */ ]; } }
```

`ctx` provides `text`, `doc` (tokenised), `features`, `replay` (or null), `baseline` (or null), `config` and `student`.
