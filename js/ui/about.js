// "How it works": plain-language methodology for teachers.

import * as store from '../store.js';

export function renderAbout(app) {
  const c = store.getConfig();
  app.innerHTML = `
    <div class="page-head"><div><h1>How it works</h1>
      <p>A decision-support tool for teachers. It surfaces unusual writing-process and textual patterns so that you can look more closely. It is not an AI detector.</p></div></div>
    <div class="grid-2">
      <section class="card card-pad">
        <h2>What it does and does not do</h2>
        <ul>
          <li>It <strong>does</strong> show observable patterns: how the text was built (pastes, revision, speed) and how it reads (formulaic clusters, style shifts, differences from the student's own earlier writing).</li>
          <li>It <strong>does</strong> link every flag to its evidence: the events, the text ranges and the rule that set its severity.</li>
          <li>It <strong>does not</strong> estimate whether AI was used, produce a percentage or probability, or decide whether a student cheated.</li>
          <li>It <strong>does not</strong> treat any single signal as evidence of anything. Every signal lists other plausible explanations.</li>
        </ul>
      </section>
      <section class="card card-pad">
        <h2>Overall status</h2>
        <p>Signals are grouped into four independent categories: <strong>Process</strong>, <strong>Style</strong>, <strong>Rhetoric</strong> and <strong>Baseline deviation</strong>. The status depends on how many categories show a medium or high signal, not on adding up signals.</p>
        <ul>
          <li><strong>Review recommended</strong>: ${c.summary.reviewMinCategories}+ categories have medium or high signals${c.summary.requireHighForReview ? ', at least one of them is high' : ''}${c.summary.requireProcessOrBaseline ? ', and one of the categories is Process or Baseline deviation. Formulaic style on its own, which is often taught, never reaches this status' : ''}.</li>
          <li><strong>Some unusual patterns</strong>: at least one category has a medium or high signal.</li>
          <li><strong>No notable patterns</strong>: only low-severity context, or nothing at all.</li>
        </ul>
        <p class="muted small">Dismissed signals stay visible and in the report, but are left out of the status.</p>
      </section>
      <section class="card card-pad">
        <h2>Baselines</h2>
        <p>A baseline is built only from samples you mark as authentic, such as in-class writing. For each feature (sentence length, vocabulary, transitions, error habits…), a submission is flagged only when it falls <em>outside the student's observed range</em> and far from their average.</p>
        <p>With fewer than ${c.baseline.establishedSamples} samples or ${c.baseline.establishedWords} words, the baseline is <em>limited</em> and deviations are capped at ${c.baseline.limitedCap}. Students change and grow: exclude old samples when they no longer represent the student.</p>
      </section>
      <section class="card card-pad">
        <h2>Safeguards against false positives</h2>
        <ul>
          <li>Student context: dictation, assistive tools, English language learners and drafting elsewhere each cap related signals, and the reason is shown.</li>
          <li>Pasting text the student deleted earlier (moving their own text) and pasted quotations are downgraded.</li>
          <li>Rhetorical patterns are compared with the student's own rate and capped when there is no baseline.</li>
          <li>Teacher-supplied assignment terms, quotations and names are excluded from vocabulary comparisons.</li>
          <li>Short texts skip rate-based detectors; incomplete logs are flagged.</li>
        </ul>
      </section>
      <section class="card card-pad">
        <h2>Getting writing-process data</h2>
        <p>The <a href="capture.html" target="_blank" rel="noopener">writing capture page</a> is a simple editor that records typing, deleting and pasting, and exports a log you can import here. Students see a clear notice that their process is recorded.</p>
        <p class="small muted">Other editors can be supported by exporting the event format described in DESIGN.md §3 (insert, delete, replace, paste, snapshot).</p>
      </section>
      <section class="card card-pad">
        <h2>Suggested next step</h2>
        <p>Review the highlighted passages alongside the student's previous writing and classroom work. If appropriate, ask the student to explain their reasoning, sources, drafting process, or choices in the passage. A conversation is almost always more informative than any pattern.</p>
      </section>
    </div>`;
}
