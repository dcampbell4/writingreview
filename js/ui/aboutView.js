// How it works: the method in plain language.

import * as store from '../store.js';
import { DISCLAIMER, LIMITATIONS } from '../analysis/explain.js';
import { escapeHtml as h } from '../util.js';

export function renderAbout(app) {
  const c = store.config();
  app.innerHTML = `
    <div class="page-head"><div><h1>How it works</h1><p>The central question: <em>how unusual is this piece of writing for this particular student?</em></p></div></div>
    <div class="cols">
      <section class="sheet sheet-pad"><h2>Detection, not attribution</h2>
        <p>The tool can responsibly say that <strong>something is unusual</strong> compared with a student’s own history. It cannot say <strong>why</strong>, and text alone cannot show whether AI was involved. It never produces an AI probability, never labels a text as AI-written and never makes a disciplinary decision.</p>
        <p class="disclaimer">${h(DISCLAIMER)}</p></section>
      <section class="sheet sheet-pad"><h2>Three kinds of evidence, four categories</h2>
        <ul>
          <li><strong>Style</strong>: the student’s authorship fingerprint (sentences, vocabulary, syntax, voice, mechanics). Generic "AI-sounding" surface features are included only as weak signals with low weight.</li>
          <li><strong>Discourse</strong>: what the writer does with ideas: claims, evidence, explanation, qualification, counterpoints, abstraction, reasoning chains, and evidence choices.</li>
          <li><strong>Process</strong>: how the document was composed: active time, sessions, revision density (surface vs. substantive), draft growth, and continuous unrevised writing.</li>
          <li><strong>External insertion</strong>: large blocks entering the document at once. A paste can come from notes, earlier drafts or sources; it is never treated as proof of anything.</li>
        </ul></section>
      <section class="sheet sheet-pad"><h2>Comparing with the student’s own writing</h2>
        <ul>
          <li>Each feature is compared with the student’s earlier samples, weighted by similarity: same assignment type ${c.genreWeights.sameAssignmentType}, same genre ${c.genreWeights.sameGenre}, same subject ${c.genreWeights.sameSubject}, different genre ${c.genreWeights.differentGenre}, timed vs. polished at most ${c.genreWeights.timedVsPolished}.</li>
          <li>Differences are measured in units of the student’s own variation (moderate from ${c.strength.moderate}, high from ${c.strength.high}, very high from ${c.strength.veryHigh}) and explained in words: "higher than in 7 of 8 earlier samples".</li>
          <li>Fewer than ${c.baseline.minimumSamples} samples: <strong>insufficient baseline</strong>, so no style or discourse comparison. Confidence is never increased to make up for missing data.</li>
          <li>If a feature has been rising steadily, the tool compares with the trend, so gradual development is not flagged again and again.</li>
          <li>Assignment context (taught vocabulary, sentence frames, model essays, research, notes, collaboration) and student context (dictation, drafting elsewhere, English learners, assistive tools) reduce the weight of related findings, and the reason is shown.</li>
        </ul></section>
      <section class="sheet sheet-pad"><h2>Levels and priority</h2>
        <p>Each category gets a level (LOW, MODERATE, MODERATE-HIGH, HIGH, VERY HIGH) from its strongest features. The overall <strong>investigation priority</strong> depends on how many <em>independent</em> categories converge: HIGH needs at least two categories at HIGH (or three at MODERATE-HIGH). A single category, and weak surface signals, can never produce a HIGH priority.</p></section>
      <section class="sheet sheet-pad"><h2>Limitations</h2><ul>${LIMITATIONS.map((l) => `<li>${h(l)}</li>`).join('')}</ul></section>
      <section class="sheet sheet-pad"><h2>Getting process data</h2>
        <p>Students can write in the <a href="capture.html" target="_blank" rel="noopener">writing capture page</a>, which records typing, deleting and pasting and tells them clearly that it does. You can also import revision-history exports or process-report PDFs from Google Docs add-ons.</p></section>
    </div>`;
}
