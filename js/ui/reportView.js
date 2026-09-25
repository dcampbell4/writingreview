// Writing Authorship & Process Review: a concise, printable teacher report.

import * as store from '../store.js';
import { resultFor, toast, download } from './common.js';
import { profileBlock } from './pieceView.js';
import { ALTERNATIVES } from '../analysis/explain.js';
import { escapeHtml as h, fmtDate } from '../util.js';

function barLine(c) {
  if (!c.assessed) return `${c.label.toUpperCase().padEnd(20)} ··········  Not assessed (${c.note})`;
  return `${c.label.toUpperCase().padEnd(20)} ${'█'.repeat(c.segments)}${'░'.repeat(10 - c.segments)}  ${c.level}`;
}

export function reportText(r) {
  const smp = r.sample;
  const student = store.student(smp.student_id);
  const asg = r.assignment;
  const L = [];
  L.push('WRITING AUTHORSHIP & PROCESS REVIEW', '');
  L.push(`Student: ${store.displayName(student)}`, `Assignment: ${asg?.title || smp.title || ''}`, `Date: ${fmtDate(smp.timestamp)}`, `Baseline: ${r.profile.sufficiency.label} (${r.profile.n} earlier samples)`, '');
  L.push('ANOMALY PROFILE', ...r.categories.map(barLine), `Overall investigation priority: ${r.priority.level}`, '');
  L.push('SUMMARY', ...r.summary, '');
  L.push('STRONGEST DEVIATIONS');
  if (!r.strongest.length) L.push('- None');
  r.strongest.forEach((x) => L.push(`- ${x.label} [${x.strength}; evidence quality ${x.evidence_quality}]: ${x.explanation}`));
  for (const c of r.categories) {
    L.push('', c.label.toUpperCase());
    if (!c.assessed) { L.push(`Not assessed: ${c.note}`); continue; }
    L.push(`${c.level} deviation. ${c.question}`);
    const notable = c.notable.filter((x) => !x.weak).slice(0, 5);
    if (!notable.length) L.push('- Within the student’s usual range.');
    notable.forEach((x) => L.push(`- ${x.explanation}`));
    const weak = c.notable.filter((x) => x.weak);
    if (weak.length) L.push(`- Weak surface indicators (low weight): ${weak.map((x) => x.label.toLowerCase()).join('; ')}.`);
  }
  const groups = [...new Set(r.strongest.map((x) => x.group))];
  const alts = [...new Set(groups.flatMap((g) => ALTERNATIVES[g] || []))].slice(0, 8);
  L.push('', 'ALTERNATIVE EXPLANATIONS', ...(alts.length ? alts : ALTERNATIVES.process.slice(0, 4)).map((a) => `- ${a}`));
  L.push('', 'SUGGESTED FOLLOW-UP', ...r.followUps.map((q, i) => `${i + 1}. ${q.q}${q.detail ? ` ${q.detail}` : ''}`));
  L.push('', 'EVIDENCE LIMITATIONS', ...r.limitations.map((x) => `- ${x}`), '', r.disclaimer);
  const note = store.note(smp.id);
  if (note) L.push('', 'TEACHER NOTES', note);
  return L.join('\n');
}

export function renderReport(app, id) {
  const r = resultFor(id);
  if (!r) { app.innerHTML = '<p class="notice">Not found.</p>'; return; }
  const smp = r.sample;
  const student = store.student(smp.student_id);
  const asg = r.assignment;
  const groups = [...new Set(r.strongest.map((x) => x.group))];
  const alts = [...new Set(groups.flatMap((g) => ALTERNATIVES[g] || []))].slice(0, 8);
  const ann = store.annotations(id);
  const annotated = r.rows.filter((x) => ann[x.id]?.note || ann[x.id]?.status === 'dismissed');
  app.innerHTML = `
    <div class="btn-row no-print" style="justify-content:space-between;max-width:820px;margin:0 auto 16px">
      <a class="btn" href="#/piece/${encodeURIComponent(id)}">← Back</a>
      <div class="btn-row"><button class="btn" data-a="copy">Copy as text</button><button class="btn" data-a="txt">Download .txt</button><button class="btn btn-primary" onclick="window.print()">Print / save as PDF</button></div>
    </div>
    <article class="report">
      <h1>Writing Authorship &amp; Process Review</h1>
      <p class="muted">${h(store.displayName(student))} · ${h(asg?.title || smp.title || '')} · ${h(fmtDate(smp.timestamp))} · Baseline: ${h(r.profile.sufficiency.label.toLowerCase())} (${r.profile.n} earlier samples)</p>
      <h2>Summary</h2>
      ${r.summary.map((s) => `<p>${h(s)}</p>`).join('')}
      <div style="margin:12px 0">${profileBlock(r)}</div>
      <p><strong>Overall investigation priority: ${h(r.priority.level)}</strong>. This is a recommendation for teacher review, not a judgement about authorship.</p>
      <h2>Strongest deviations</h2>
      ${r.strongest.length ? `<ol>${r.strongest.map((x) => `<li><strong>${h(x.label)}</strong> (${h(x.strength.toLowerCase())}; evidence quality ${h(x.evidence_quality.toLowerCase())}). ${h(x.explanation)}</li>`).join('')}</ol>` : '<p>None.</p>'}
      ${r.categories.map((c) => `<h2>${h(c.label)}</h2>${c.assessed ? `<p><strong>${h(c.level)}</strong> deviation.</p><ul>${c.notable.filter((x) => !x.weak).slice(0, 5).map((x) => `<li>${h(x.explanation)}</li>`).join('') || '<li>Within the student’s usual range.</li>'}</ul>${c.notable.some((x) => x.weak) ? `<p class="small muted">Weak surface indicators (low weight): ${h(c.notable.filter((x) => x.weak).map((x) => x.label.toLowerCase()).join('; '))}.</p>` : ''}` : `<p class="muted">Not assessed: ${h(c.note)}</p>`}`).join('')}
      <h2>Alternative explanations</h2>
      <ul>${(alts.length ? alts : ALTERNATIVES.process.slice(0, 4)).map((a) => `<li>${h(a)}</li>`).join('')}</ul>
      <h2>Suggested follow-up</h2>
      <ol>${r.followUps.map((q) => `<li>${h(q.q)}${q.detail ? `<div class="small muted">${h(q.detail)}</div>` : ''}</li>`).join('')}</ol>
      <h2>Evidence limitations</h2>
      <ul>${r.limitations.map((x) => `<li>${h(x)}</li>`).join('')}</ul>
      <p class="disclaimer">${h(r.disclaimer)}</p>
      ${store.note(id) ? `<h2>Teacher notes</h2><p>${h(store.note(id))}</p>` : ''}
      ${annotated.length ? `<h2>Teacher annotations</h2><ul>${annotated.map((x) => `<li>${h(x.label)}${ann[x.id].status === 'dismissed' ? ' (dismissed)' : ''}${ann[x.id].note ? `: ${h(ann[x.id].note)}` : ''}</li>`).join('')}</ul>` : ''}
    </article>`;
  app.querySelector('[data-a="copy"]').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(reportText(r)); toast('Report copied.'); } catch { download('writing-review.txt', reportText(r), 'text/plain'); }
  });
  app.querySelector('[data-a="txt"]').addEventListener('click', () => download(`writing-review-${smp.student_id}.txt`, reportText(r), 'text/plain'));
}
