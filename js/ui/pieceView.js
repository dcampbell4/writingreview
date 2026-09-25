// Investigation view for one piece of writing.
// Tabs: Overview · Evidence · Side by side · Argument map · Process · Statistics

import * as store from '../store.js';
import { resultFor, levelHtml, priorityHtml, nameOf, contextSummary, toast, barHtml } from './common.js';
import { renderSideBySide } from './sideBySide.js';
import { argumentMapHtml } from './argumentMap.js';
import { processHtml, wireProcess } from './processView.js';
import { withUnit } from '../analysis/compare.js';
import { escapeHtml as h, fmtDate, fmtNum, plural } from '../util.js';

const TABS = [
  ['overview', 'Overview'],
  ['evidence', 'Evidence'],
  ['compare', 'Side by side'],
  ['argument', 'Argument map'],
  ['process', 'Process timeline'],
  ['stats', 'Statistics'],
];
const tabState = new Map();

export function evidenceCard(row, sampleId, { compact = false } = {}) {
  const a = store.annotations(sampleId)[row.id] || {};
  const status = row.dismissed ? 'dismissed' : a.status || 'open';
  const support = row.basis === 'reference' ? 'General reference values (no earlier process data)' : `${plural(row.n, 'earlier sample')}`;
  return `<article class="card ${status === 'dismissed' ? 'dismissed' : ''}" data-row="${h(row.id)}">
    <div class="card-top"><h4>${h(row.label)}</h4><span class="strength">${h(row.strength)}</span></div>
    <div class="meta"><span class="tag">${h(row.feature.groupLabel)}</span><span class="tag">Evidence quality: ${h(row.evidence_quality)}</span><span class="tag">Historical support: ${h(support)}</span>${row.trend?.kind === 'development' ? '<span class="tag">Consistent with gradual development</span>' : ''}${row.weak ? '<span class="tag">Weak signal</span>' : ''}</div>
    <p style="margin:0">${h(row.explanation)}</p>
    ${row.adjustments.length ? `<ul>${row.adjustments.map((x) => `<li>${h(x.reason)}</li>`).join('')}</ul>` : ''}
    <details><summary>Alternative explanations</summary><ul>${row.alternative_explanations.map((x) => `<li>${h(x)}</li>`).join('')}</ul></details>
    ${compact ? '' : `<div class="annot no-print">
      <div class="btn-row">
        <span class="small muted">Your review:</span>
        <div class="seg" role="group" aria-label="Review status for ${h(row.label)}">
          ${['open', 'reviewed', 'dismissed'].map((v) => `<button data-annot="${v}" aria-pressed="${status === v}">${v === 'open' ? 'Open' : v === 'reviewed' ? 'Reviewed' : 'Dismiss'}</button>`).join('')}
        </div>
      </div>
      <textarea rows="2" placeholder="Note (e.g. taught this vocabulary on 14 Sept)" style="margin-top:6px" data-note>${h(a.note || '')}</textarea>
    </div>`}
  </article>`;
}

export function profileBlock(result) {
  return `<div class="profile-block" role="table" aria-label="Anomaly profile">
    ${result.categories.map((c) => `<div class="profile-row" role="row">
      <span class="name" role="cell">${h(c.label)}</span>
      <span class="bar" role="cell">${barHtml(c.assessed ? c.segments : 0)}</span>
      <span class="word" role="cell">${h(c.assessed ? c.level : 'Not assessed')}</span>
      <span class="note" role="cell">${h(c.assessed ? `${c.question} Evidence quality: ${c.evidenceQuality}.${c.caps.length ? ` ${c.caps.join(' ')}` : ''}` : c.note)}</span>
    </div>`).join('')}
  </div>`;
}

function overviewHtml(result) {
  const { sample, profile } = result;
  const counts = {};
  profile.items.forEach((x) => { const g = x.sample.genre || 'Other'; counts[g] = (counts[g] || 0) + 1; });
  const followUps = result.followUps;
  return `
    <div class="aside-layout">
      <div class="stack">
        <section class="sheet sheet-pad">
          <div class="btn-row" style="justify-content:space-between"><h2>Anomaly profile</h2><div>Overall investigation priority: ${priorityHtml(result.priority.level)}</div></div>
          <div style="margin-top:12px">${profileBlock(result)}</div>
          <div style="margin-top:14px" class="serif">${result.summary.map((s) => `<p>${h(s)}</p>`).join('')}</div>
          ${result.priority.notes?.length ? result.priority.notes.map((n) => `<p class="small muted">${h(n)}</p>`).join('') : ''}
          ${result.assignment?.aiAllowed ? '<p class="notice">AI use was permitted for this assignment, so differences may reflect permitted assistance.</p>' : ''}
          <p class="disclaimer" style="margin-top:12px">${h(result.disclaimer)} The overall priority is a recommendation for teacher review, not a judgement about authorship.</p>
        </section>

        <section class="sheet">
          <div class="sheet-head"><h2>Strongest deviations</h2><span class="small muted">What changed, and how unusual it is for this student</span></div>
          <div class="sheet-pad">
            ${result.strongest.length ? `<div class="cards">${result.strongest.map((r) => evidenceCard(r, sample.id)).join('')}</div>` : `<p class="muted">${profile.sufficiency.level === 'insufficient' && !result.current.process ? 'Not enough evidence to compare.' : 'No features stand out from this student’s usual range.'}</p>`}
          </div>
        </section>

        <section class="sheet sheet-pad">
          <h2>Suggested teacher follow-up</h2>
          <ol>${followUps.map((q) => `<li style="margin:8px 0"><strong>${h(q.q)}</strong>${q.detail ? `<div class="small muted serif" style="font-size:14px">${h(q.detail)}</div>` : ''}</li>`).join('')}</ol>
        </section>
      </div>

      <aside class="stack">
        <section class="sheet sheet-pad">
          <h3>Student writing profile</h3>
          <p style="margin:6px 0 2px"><strong>${h(profile.sufficiency.label)}</strong></p>
          <p class="small muted" style="margin:0">${h(profile.sufficiency.message)}</p>
          <ul class="small" style="padding-left:18px">${Object.entries(counts).map(([g, n]) => `<li>${n} × ${h(g.toLowerCase())}</li>`).join('') || '<li>No earlier samples</li>'}</ul>
          ${profile.n ? `<p class="small muted">Weighted by similarity to this task (effective sample size ${fmtNum(profile.nEff, 1)}). ${profile.processSamples ? `${plural(profile.processSamples, 'sample')} with process data.` : 'No earlier process data.'}</p>` : ''}
          <a class="small" href="#/student/${encodeURIComponent(sample.student_id)}">Open profile and history</a>
        </section>
        <section class="sheet sheet-pad">
          <h3>Current writing</h3>
          <p class="small" style="margin:6px 0">Word count: <strong>${result.current.wordCount}</strong></p>
          <h3 style="margin-top:12px">Profile comparison</h3>
          <ul class="compare-list">${result.composites.filter((c) => c.text).map((c) => `<li><span>${h(c.label)}${c.basis === 'reference' ? ' <span class="small muted">(general reference)</span>' : ''}</span><span class="val">${h(c.text)}</span></li>`).join('') || '<li><span class="muted">Not enough baseline for comparison.</span></li>'}</ul>
          <p class="small muted">Percentages compare this piece with the student’s weighted average. Whether a change is unusual depends on the student’s usual variation (see Evidence).</p>
        </section>
        <section class="sheet sheet-pad no-print">
          <h3>Teacher notes</h3>
          <textarea id="piece-note" rows="5" style="margin-top:6px" placeholder="Private notes, e.g. conversation with the student">${h(store.note(sample.id))}</textarea>
          <div class="btn-row" style="margin-top:6px"><button class="btn btn-sm" data-action="save-note">Save note</button></div>
        </section>
      </aside>
    </div>`;
}

function evidenceTabHtml(result) {
  return result.categories.map((c) => {
    const notable = c.rows.filter((r) => r.strength !== 'Typical');
    const dismissed = result.rows.filter((r) => r.category === c.id && r.dismissed);
    return `<section class="sheet" style="margin-bottom:16px">
      <div class="sheet-head"><h2>${h(c.label)}</h2>${levelHtml(c.level, c.segments)}</div>
      <div class="sheet-pad">
        <p class="small muted" style="margin-top:0">${h(c.question)}${c.assessed ? '' : ` ${h(c.note)}`}</p>
        ${notable.length ? `<div class="cards">${notable.map((r) => evidenceCard(r, result.sample.id)).join('')}</div>` : `<p class="muted">${c.assessed ? 'All measured features are within the student’s usual range.' : ''}</p>`}
        ${dismissed.length ? `<details style="margin-top:12px"><summary class="small">${plural(dismissed.length, 'dismissed finding')}</summary><div class="cards" style="margin-top:10px">${dismissed.map((r) => evidenceCard(r, result.sample.id)).join('')}</div></details>` : ''}
      </div>
    </section>`;
  }).join('');
}

function statsHtml(result) {
  const rows = result.rows;
  return `<section class="sheet">
    <div class="sheet-head"><h2>All measured features</h2><span class="small muted">Advanced view: underlying statistics</span></div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th>Feature</th><th>Category</th><th class="num">This piece</th><th class="num">Student mean</th><th class="num">Range</th><th class="num">Deviation (z)</th><th class="num">Adjusted</th><th>Strength</th><th>Basis</th><th>Notes</th></tr></thead>
      <tbody>${rows.map((r) => `<tr>
        <td>${h(r.feature.label)}<div class="small muted">${h(r.feature.plain || '')}</div></td>
        <td class="small">${h(r.feature.groupLabel)}</td>
        <td class="num">${h(withUnit(r.current, r.feature))}</td>
        <td class="num">${r.compared ? h(withUnit(r.baselineMean, r.feature)) : '—'}</td>
        <td class="num small">${r.compared && r.baselineMin != null ? `${fmtNum(r.baselineMin, r.feature.digits)}–${fmtNum(r.baselineMax, r.feature.digits)}` : '—'}</td>
        <td class="num mono">${r.compared ? fmtNum(r.rawZ, 2) : '—'}</td>
        <td class="num mono">${r.compared ? fmtNum(r.z, 2) : '—'}</td>
        <td class="small">${h(r.strength)}${r.dismissed ? ' (dismissed)' : ''}</td>
        <td class="small">${r.compared ? h(r.basis === 'reference' ? 'reference' : `${r.n} samples`) : '—'}</td>
        <td class="small">${r.trend?.kind === 'development' ? 'trend-adjusted; ' : ''}${r.weak ? 'weak signal; ' : ''}${(r.adjustments || []).map((a) => h(a.reason)).join(' ')}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    <p class="small muted sheet-pad">Deviation = (value − student mean) ÷ spread, where spread is the larger of the student’s weighted standard deviation, ${Math.round(store.config().baseline.relativeSpreadFloor * 100)}% of the mean, or a minimum per feature. "Adjusted" applies direction, trend, context and rare-event corrections.</p>
  </section>`;
}

export function renderPiece(app, id, tabParam) {
  const smp = store.sample(id);
  if (!smp) { app.innerHTML = '<p class="notice">Not found. <a href="#/">Back to the class</a></p>'; return; }
  const result = resultFor(id);
  const tab = tabParam || tabState.get(id) || 'overview';
  tabState.set(id, tab);
  const student = store.student(smp.student_id);
  const asg = smp.assignment_id ? store.assignment(smp.assignment_id) : null;
  const scrollY = window.scrollY;

  let body = '';
  if (tab === 'overview') body = overviewHtml(result);
  else if (tab === 'evidence') body = evidenceTabHtml(result);
  else if (tab === 'compare') body = '<div id="sbs"></div>';
  else if (tab === 'argument') body = argumentMapHtml(result);
  else if (tab === 'process') body = processHtml(result);
  else body = statsHtml(result);

  app.innerHTML = `
    <div class="crumb no-print"><a href="#/">Class</a> / <a href="#/student/${encodeURIComponent(smp.student_id)}">${nameOf(student)}</a></div>
    <div class="page-head">
      <div>
        <h1>${h(asg?.title || smp.title || 'Untitled')}</h1>
        <p>${nameOf(student)} · ${h(fmtDate(smp.timestamp))} · ${h(contextSummary(smp, asg))}${asg ? ` · <a href="#/assignment/${encodeURIComponent(asg.id)}">assignment context</a>` : ' · <a href="#/add?sample=' + encodeURIComponent(smp.id) + '">add assignment context</a>'}</p>
      </div>
      <div class="btn-row no-print">
        <a class="btn btn-primary" href="#/report/${encodeURIComponent(id)}">Report</a>
        <a class="btn" href="#/conference/${encodeURIComponent(id)}">Conference mode</a>
        <button class="btn" data-action="to-baseline" title="After review, count this piece as authentic writing in the student's profile">Add to student profile</button>
      </div>
    </div>
    ${result.warnings.map((w) => `<p class="notice">${h(w)}</p>`).join('')}
    <div class="tabs no-print" role="tablist">${TABS.map(([k, label]) => `<button role="tab" aria-selected="${k === tab}" data-tab="${k}">${h(label)}</button>`).join('')}</div>
    ${body}`;

  if (tab === 'compare') renderSideBySide(app.querySelector('#sbs'), result);
  if (tab === 'process') wireProcess(app, result);
  window.scrollTo(0, scrollY);

  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tabState.set(id, b.dataset.tab); renderPiece(app, id); }));
  app.querySelector('[data-action="save-note"]')?.addEventListener('click', () => { store.setNote(id, app.querySelector('#piece-note').value); toast('Note saved.'); });
  app.querySelector('[data-action="to-baseline"]')?.addEventListener('click', () => {
    if (!confirm('Count this piece as authentic, representative writing in the student’s profile? Do this only after review. It will then be used as baseline for later pieces.')) return;
    store.saveSample({ ...smp, role: 'baseline', include: true, authentic: true });
    toast('Added to the student profile.');
    location.hash = `#/student/${encodeURIComponent(smp.student_id)}`;
  });
  app.querySelectorAll('.card[data-row]').forEach((card) => {
    const key = card.dataset.row;
    card.querySelectorAll('[data-annot]').forEach((b) => b.addEventListener('click', () => {
      store.annotate(id, key, { status: b.dataset.annot, note: card.querySelector('[data-note]').value });
      toast(b.dataset.annot === 'dismissed' ? 'Dismissed: excluded from the levels, but kept in the record.' : `Marked as ${b.dataset.annot}.`);
      renderPiece(app, id);
    }));
    card.querySelector('[data-note]')?.addEventListener('change', (e) => { store.annotate(id, key, { note: e.target.value }); toast('Note saved.'); });
  });
}
