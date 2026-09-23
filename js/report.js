// Concise teacher report (DESIGN.md §7). Available as printable HTML and as
// plain text for pasting into notes or email.

import { escapeHtml as h, fmtDate, excerpt } from './util.js';
import { RHETORIC_FAMILIES } from './text/lexicons.js';

export const INTERPRETATION = 'These signals identify unusual characteristics of the writing process or language. They do not establish how the text was produced.';
export const ACTION = "Review the highlighted passages alongside the student's previous writing and classroom work. If appropriate, ask the student to explain their reasoning, sources, drafting process, or choices in the passage.";

function textualLines(result) {
  const active = result.signals.filter((s) => s.status !== 'dismissed');
  const lines = [];
  for (const s of active.filter((x) => x.category === 'rhetoric' && x.matches)) {
    const fam = RHETORIC_FAMILIES.find((f) => `rhetoric-${f.id}` === s.id);
    lines.push(`${s.matches.length} ${fam ? fam.name.toLowerCase() : s.name.toLowerCase()} (${s.severity})`);
  }
  const other = active.filter((x) => x.category !== 'process' && !x.matches);
  for (const s of other.filter((x) => x.severity !== 'Low')) lines.push(`${s.name}: ${s.finding} (${s.severity})`);
  const low = other.filter((x) => x.severity === 'Low').length;
  if (low) lines.push(`${low} further low-severity ${low === 1 ? 'difference' : 'differences'} (context only; see the evidence page)`);
  return lines;
}

// The longest highlighted range of a signal, used as its representative passage.
const mainRange = (s) => [...s.ranges].sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];

function passagesToReview(result) {
  const seen = [];
  const out = [];
  for (const s of result.signals.filter((x) => x.status !== 'dismissed' && x.severity !== 'Low' && x.ranges?.length)) {
    const r = mainRange(s);
    if (seen.some((q) => r.start < q.end && q.start < r.end)) continue;
    seen.push(r);
    out.push({ signal: s, range: r });
    if (out.length === 3) break;
  }
  return out;
}

export function reportHtml(result, teacherNote = '') {
  const { submission, student, summary, signals } = result;
  const process = signals.filter((s) => s.category === 'process');
  const dismissed = signals.filter((s) => s.status === 'dismissed');
  const notes = signals.filter((s) => s.note && s.status !== 'dismissed');
  const passages = passagesToReview(result);
  return `
  <article class="report">
    <h1>Writing Process Review</h1>
    <dl class="report-meta">
      <div><dt>Student</dt><dd>${h(student?.name || 'Unknown')}</dd></div>
      <div><dt>Assignment</dt><dd>${h(submission.assignment)}</dd></div>
      <div><dt>Date</dt><dd>${h(fmtDate(submission.date))}</dd></div>
      <div><dt>Status</dt><dd>${h(summary.status)}</dd></div>
    </dl>
    <p>${h(summary.text)}</p>
    <ul class="coverage">${summary.coverage.map((c) => `<li>${h(c)}</li>`).join('')}</ul>

    <h2>Process signals</h2>
    ${process.length ? `<table><thead><tr><th>Signal</th><th>Finding</th><th>Severity</th></tr></thead><tbody>
      ${process.map((s) => `<tr class="${s.status === 'dismissed' ? 'is-dismissed' : ''}"><td>${h(s.name)}</td><td>${h(s.finding)}</td><td>${h(s.severity)}${s.status === 'dismissed' ? ' (dismissed)' : ''}</td></tr>`).join('')}
    </tbody></table>` : `<p class="muted">${result.replay || result.report ? 'No process signals.' : 'No writing-process data was available for this submission.'}</p>`}

    <h2>Textual patterns</h2>
    ${textualLines(result).length ? `<ul>${textualLines(result).map((l) => `<li>${h(l)}</li>`).join('')}</ul>` : '<p class="muted">No textual patterns above threshold.</p>'}

    ${passages.length ? `<h2>Passages to review</h2>${passages.map(({ signal, range }) => `<blockquote><strong>${h(signal.name)}:</strong> “${h(excerpt(result.text, range, 220))}”</blockquote>`).join('')}` : ''}

    <h2>Interpretation</h2>
    <p class="callout">${h(INTERPRETATION)}</p>
    ${summary.caveats.map((c) => `<p class="muted">${h(c)}</p>`).join('')}

    <h2>Suggested teacher action</h2>
    <p class="callout">${h(ACTION)}</p>

    ${notes.length || teacherNote ? `<h2>Teacher notes</h2>${teacherNote ? `<p>${h(teacherNote)}</p>` : ''}<ul>${notes.map((s) => `<li><strong>${h(s.name)}:</strong> ${h(s.note)}</li>`).join('')}</ul>` : ''}
    ${dismissed.length ? `<h2>Dismissed by teacher</h2><ul>${dismissed.map((s) => `<li>${h(s.name)}${s.note ? `: ${h(s.note)}` : ''}</li>`).join('')}</ul>` : ''}
  </article>`;
}

export function reportText(result, teacherNote = '') {
  const { submission, student, summary, signals } = result;
  const out = [];
  out.push('WRITING PROCESS REVIEW', '');
  out.push(`Student: ${student?.name || 'Unknown'}`, `Assignment: ${submission.assignment}`, `Date: ${fmtDate(submission.date)}`, `Status: ${summary.status}`, '');
  out.push(summary.text, '', ...summary.coverage.map((c) => `- ${c}`), '');
  out.push('PROCESS SIGNALS');
  const process = signals.filter((s) => s.category === 'process');
  if (!process.length) out.push(result.replay || result.report ? '- None' : '- No writing-process data available');
  process.forEach((s) => out.push(`- ${s.name} [${s.severity}${s.status === 'dismissed' ? ', dismissed' : ''}]: ${s.finding}`));
  out.push('', 'TEXTUAL PATTERNS');
  const t = textualLines(result);
  if (!t.length) out.push('- None above threshold');
  t.forEach((l) => out.push(`- ${l}`));
  out.push('', 'INTERPRETATION', INTERPRETATION, ...summary.caveats, '', 'SUGGESTED TEACHER ACTION', ACTION);
  const notes = signals.filter((s) => s.note);
  if (teacherNote || notes.length) {
    out.push('', 'TEACHER NOTES');
    if (teacherNote) out.push(teacherNote);
    notes.forEach((s) => out.push(`- ${s.name}${s.status === 'dismissed' ? ' (dismissed)' : ''}: ${s.note}`));
  }
  return out.join('\n');
}
