// Submission view: summary, signals, evidence, timeline, text and baseline
// comparison. Evidence and interpretation are always shown separately.

import * as store from '../store.js';
import { getAnalysis, sevBadge, statusBadge, toast, download } from './common.js';
import { timelineHtml, wireTimeline } from './timeline.js';
import { docHtml, legendHtml } from './textView.js';
import { paragraphProcess } from '../process/metrics.js';
import { CATEGORIES } from '../pipeline/registry.js';
import { FEATURE_GROUPS } from '../text/features.js';
import { withUnit } from '../baseline/baseline.js';
import { reportHtml, reportText, INTERPRETATION } from '../report.js';
import { escapeHtml as h, fmtDate, fmtNum, excerpt, sevRank, plural, pct } from '../util.js';

const uiState = new Map();
const stateFor = (id) => {
  if (!uiState.has(id)) uiState.set(id, { sel: null, mode: 'signal', filter: 'all', hideLow: false, seg: null });
  return uiState.get(id);
};

export function renderSubmission(app, id) {
  const result = getAnalysis(id);
  if (!result) { app.innerHTML = '<p class="notice">Submission not found. <a href="#/">Back to submissions</a></p>'; return; }
  const st = stateFor(id);
  if (st.sel && !result.signals.some((s) => s.id === st.sel)) st.sel = null;
  if (st.sel === null && result.signals.length && st.firstVisit !== false) {
    const firstNotable = result.signals.find((s) => sevRank(s.severity) >= 1) || result.signals[0];
    st.sel = firstNotable.id;
  }
  st.firstVisit = false;

  // Keep inner scroll positions across re-renders.
  const keep = ['.signal-list', '.doc'].map((sel) => [sel, app.querySelector(sel)?.scrollTop || 0]);

  const { submission: sub, student, summary, signals, replay: rep, baseline } = result;
  const visible = signals.filter((s) => (st.filter === 'all' || s.category === st.filter) && (!st.hideLow || s.severity !== 'Low'));
  const selected = signals.find((s) => s.id === st.sel) || null;
  const tl = rep ? timelineHtml(result, { selectedSeg: st.seg, selectedSignal: st.sel }) : null;
  const segRanges = tl && st.seg != null ? tl.segs[st.seg]?.ranges : null;
  const mode = st.mode === 'segment' && !segRanges ? 'signal' : st.mode;

  app.innerHTML = `
    <div class="breadcrumb no-print"><a href="#/">Submissions</a> / ${h(student?.name || 'Unknown')}</div>
    <div class="page-head">
      <div>
        <h1>${h(sub.assignment)}</h1>
        <p><a href="#/student/${encodeURIComponent(sub.studentId)}">${h(student?.name || 'Unknown student')}</a> · ${h(fmtDate(sub.date))} · ${result.doc.wordCount} words</p>
      </div>
      <div class="btn-row no-print">
        <a class="btn btn-primary" href="#/report/${encodeURIComponent(sub.id)}">Teacher report</a>
        <button class="btn" data-action="export">Export data</button>
        <button class="btn btn-ghost" data-action="delete">Delete</button>
      </div>
    </div>
    ${result.warnings.map((w) => `<p class="notice" style="margin-bottom:10px">${h(w)}</p>`).join('')}

    <section class="card summary" aria-label="Summary">
      <div class="summary-main">
        <div class="summary-title">${statusBadge(summary.status)}<span class="muted small">${plural(summary.processCount, 'process signal')} · ${plural(summary.textualCount, 'textual signal')}${summary.dismissedCount ? ` · ${summary.dismissedCount} dismissed` : ''}</span></div>
        <p class="summary-text">${h(summary.text)}</p>
        <p class="disclaimer">${h(INTERPRETATION)} No signal on its own is evidence of misconduct or AI use.</p>
      </div>
      <div class="summary-side">
        <h3 class="small muted" style="text-transform:uppercase;letter-spacing:.05em">Evidence available</h3>
        <ul>${summary.coverage.map((c) => `<li>${h(c)}</li>`).join('')}</ul>
        ${summary.caveats.length ? `<ul>${summary.caveats.map((c) => `<li>${h(c)}</li>`).join('')}</ul>` : ''}
        ${result.skipped.length ? `<p class="small muted" style="margin-top:8px">Not run (data unavailable): ${h([...new Set(result.skipped.map((s) => s.name))].join(', '))}.</p>` : ''}
      </div>
    </section>

    <section class="cats" style="margin-top:16px" aria-label="Signals by category">
      ${summary.byCategory.map((c) => `
        <div class="card cat ${c.notable ? 'is-notable' : ''}" title="${h(c.description)}">
          <div class="cat-label">${h(c.label)}</div>
          <div class="cat-value">${c.count}</div>
          <div class="cat-sub">${c.count ? `${c.notable} medium/high · highest ${h(c.highest)}` : c.id === 'process' && !rep && !result.report ? 'no process data' : c.id === 'baseline' && !baseline ? 'no baseline' : 'none'}</div>
        </div>`).join('')}
    </section>

    <div class="split" style="margin-top:16px">
      <section class="card sticky-col" aria-label="Signals">
        <div class="card-head"><h2>Signals</h2><label class="check small"><input type="checkbox" data-action="hide-low" ${st.hideLow ? 'checked' : ''}> Hide low</label></div>
        <div class="signal-filters" role="group" aria-label="Filter by category">
          ${[{ id: 'all', label: 'All' }, ...CATEGORIES].map((c) => `<button class="chip" data-filter="${c.id}" aria-pressed="${st.filter === c.id}">${h(c.id === 'baseline' ? 'Baseline' : c.label)}</button>`).join('')}
        </div>
        ${visible.length ? `<ul class="signal-list" role="listbox" aria-label="Signals">
          ${visible.map((s) => `<li><button class="signal-item ${s.status === 'dismissed' ? 'is-dismissed' : ''}" role="option" data-signal="${h(s.id)}" aria-selected="${s.id === st.sel}">
            <div class="signal-top"><span class="signal-name">${h(s.name)}</span>${sevBadge(s.severity)}</div>
            <div class="signal-finding">${h(s.finding)}</div>
            <div class="signal-meta"><span class="tag">${h(CATEGORIES.find((c) => c.id === s.category)?.label || s.category)}</span>${s.status !== 'open' ? `<span class="tag">${h(s.status)}</span>` : ''}${s.note ? '<span class="tag">note</span>' : ''}${s.adjustments.length ? '<span class="tag">adjusted</span>' : ''}</div>
          </button></li>`).join('')}
        </ul>` : `<p class="empty">${signals.length ? 'No signals match this filter.' : 'No signals were produced with the current settings.'}</p>`}
      </section>

      <div class="stack">
        <section class="card" aria-label="Signal detail">${selected ? detailHtml(selected, result) : '<p class="empty">Select a signal to see its evidence.</p>'}</section>

        <section class="card" aria-label="Submitted text">
          <div class="card-head">
            <h2>Submitted text</h2>
            <div class="seg" role="group" aria-label="Highlight mode">
              <button data-mode="signal" aria-pressed="${mode === 'signal'}">Signal highlights</button>
              <button data-mode="origin" aria-pressed="${mode === 'origin'}" ${rep?.matchesSubmission ? '' : 'disabled title="Needs a matching writing log"'}>Text origin</button>
              <button data-mode="segment" aria-pressed="${mode === 'segment'}" ${segRanges ? '' : 'disabled title="Select an activity in the timeline"'}>Timeline selection</button>
            </div>
          </div>
          <div style="padding:10px 20px 0">${legendHtml(mode, !!rep?.matchesSubmission)}</div>
          <div class="doc">${docHtml(result, { mode, selectedSignal: st.sel, segRanges })}</div>
        </section>

        ${rep ? `
        <section class="card" aria-label="Writing timeline">
          <div class="card-head"><h2>Writing timeline</h2><span class="muted">Click an activity to highlight the text it produced</span></div>
          ${tl ? `<div class="timeline-chart" id="tl-root">${tl.svg}</div>
          <div class="legend" style="padding:0 16px 8px">
            <span><i class="swatch" style="background:var(--series)"></i>Document length (words)</span>
            <span><i class="swatch" style="background:var(--sev-high-fg);transform:rotate(45deg);width:10px"></i>Paste</span>
            <span><i class="swatch" style="background:var(--sev-med-bg)"></i>Flagged period</span>
          </div>
          <div id="tl-log">${tl.log}</div>` : '<p class="empty">No text events in this log.</p>'}
        </section>
        ${paragraphCard(result)}` : `
        ${result.report ? reportCard(result) : `<section class="card card-pad"><h2>Writing process</h2><p class="muted">No process data was provided for this submission, so process signals are unavailable. Add a process report PDF (e.g. from a Google Docs add-on) or a log from the <a href="capture.html" target="_blank" rel="noopener">writing capture page</a> when adding a submission.</p></section>`}`}

        ${baselineCard(result)}

        <section class="card card-pad no-print" aria-label="Teacher notes">
          <h2>Teacher notes on this submission</h2>
          <p class="muted small">Private notes. They appear in the report.</p>
          <textarea id="sub-note" placeholder="e.g. Spoke with the student on 23 Sept; they showed their handwritten plan.">${h(store.submissionNote(sub.id))}</textarea>
          <div class="btn-row" style="margin-top:8px"><button class="btn btn-sm" data-action="save-sub-note">Save note</button></div>
        </section>
      </div>
    </div>`;

  keep.forEach(([sel, top]) => { const el = app.querySelector(sel); if (el) el.scrollTop = top; });
  wire(app, id, result, tl);
}

function detailHtml(s, result) {
  const excerpts = [...(s.ranges || [])].sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, 3).sort((a, b) => a.start - b.start).map((r) => `<blockquote class="excerpt">${h(excerpt(result.text, r, 260))}</blockquote>`).join('');
  const more = (s.ranges || []).length > 3 ? `<p class="small muted">…and ${s.ranges.length - 3} more highlighted in the text below.</p>` : '';
  return `<div class="detail">
    <div class="detail-head">
      <div>
        <div class="small muted">${h(CATEGORIES.find((c) => c.id === s.category)?.label || '')}${s.group ? ` · ${h(FEATURE_GROUPS[s.group]?.label || '')}` : ''}</div>
        <h2>${h(s.name)}</h2>
      </div>
      <div class="btn-row">${sevBadge(s.severity)}${s.ranges?.length ? '<button class="btn btn-sm" data-action="jump">Show in text</button>' : ''}</div>
    </div>

    <h3>Observed evidence</h3>
    <div class="evidence-box">
      <p style="margin-top:0"><strong>${h(s.finding)}</strong></p>
      <dl class="kv">${s.evidence.map((e) => `<dt>${h(e.label)}</dt><dd>${h(String(e.value))}</dd>`).join('')}</dl>
      ${excerpts ? `<div style="margin-top:10px"><div class="small muted">Text</div>${excerpts}${more}</div>` : ''}
    </div>

    ${s.baseline ? `<h3>Student baseline</h3><p>${h(s.baseline)}</p>` : ''}

    <h3>Interpretation</h3>
    <div class="interp-box">
      <p style="margin-top:0">${h(s.explanation)}</p>
      <div class="small muted">Other possible explanations</div>
      <ul>${s.alternatives.map((a) => `<li>${h(a)}</li>`).join('')}</ul>
    </div>

    <h3>How the severity was set</h3>
    <p class="small">${h(s.rule)}</p>
    ${s.adjustments.map((a) => `<div class="adjust">${h(a)}</div>`).join('')}

    <div class="annot no-print">
      <h3 style="margin-top:0">Your review</h3>
      <div class="seg" role="group" aria-label="Review status">
        ${['open', 'reviewed', 'dismissed'].map((v) => `<button data-status="${v}" aria-pressed="${s.status === v}">${v === 'open' ? 'Open' : v === 'reviewed' ? 'Reviewed' : 'Dismiss'}</button>`).join('')}
      </div>
      <div class="field" style="margin-top:10px">
        <label for="sig-note">Note (reason for dismissing, conversation with the student, etc.)</label>
        <textarea id="sig-note" rows="3">${h(s.note)}</textarea>
      </div>
      <div class="btn-row" style="margin-top:8px"><button class="btn btn-sm" data-action="save-note">Save note</button><span class="small muted">Dismissed signals stay visible but are left out of the status.</span></div>
    </div>
  </div>`;
}

function reportCard(result) {
  const r = result.report;
  const m = r.metrics || {};
  const labels = { writingMinutes: 'Writing time', sessions: 'Sessions', edits: 'Edits / revisions', pasteCount: 'Pastes', pastedWords: 'Words pasted', pastedChars: 'Characters pasted', totalWords: 'Word count (report)' };
  const rows = Object.entries(labels).filter(([k]) => m[k] != null)
    .map(([k, label]) => `<dt>${h(label)}</dt><dd>${k === 'writingMinutes' ? `${fmtNum(m[k], 0)} minutes` : h(String(m[k]))}</dd>`).join('');
  const pastes = (r.pastes || []).filter((p) => p.include !== false);
  const pasteSignals = result.signals.filter((s) => s.detector === 'report-paste');
  const events = [
    ...(r.sessions || []).filter((s) => s.start).map((s) => ({ t: s.start, label: `Session${s.minutes != null ? ` · ${fmtNum(s.minutes, 0)} min` : ''}`, flag: false })),
    ...pastes.filter((p) => p.time).map((p) => ({ t: p.time, label: `Paste · ${p.words != null ? `${p.words} words` : p.chars != null ? `${p.chars} characters` : 'size not given'}`, flag: true })),
  ].sort((a, b) => a.t - b.t);
  return `<section class="card" aria-label="Imported process report">
    <div class="card-head"><h2>Imported process report</h2><span class="muted">${h(r.tool)}${r.fileName ? ` · ${h(r.fileName)}` : ''}</span></div>
    <div class="card-pad">
      <p class="small muted" style="margin-top:0">Summary figures read from the report and checked when the submission was added. A report is less detailed than a full writing log, so the timeline chart and revision-by-paragraph views are not available.</p>
      ${rows ? `<dl class="kv">${rows}</dl>` : '<p class="muted">No summary figures were recognised.</p>'}
      ${events.length ? `<h3 style="margin-top:16px">Activity listed in the report</h3><ul class="eventlog" aria-label="Reported activity">${events.map((e) => `<li><button type="button" disabled style="cursor:default"><span>${h(new Date(e.t).toLocaleDateString([], { month: 'short', day: 'numeric' }))}</span><span>${h(new Date(e.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}</span><span></span><span class="kind ${e.flag ? 'flag' : ''}">${h(e.label)}</span></button></li>`).join('')}</ul>` : ''}
      ${pastes.length ? `<h3 style="margin-top:16px">Pastes listed (${pastes.length})</h3><ul class="small">${pastes.map((p, i) => {
        const sig = pasteSignals.find((s) => s.id === `report-paste-${i}`);
        return `<li style="margin:6px 0">${p.time ? `${h(new Date(p.time).toLocaleString())} · ` : ''}${p.words != null ? `${p.words} words` : p.chars != null ? `${p.chars} characters` : ''}${sig ? ` ${sevBadge(sig.severity)} <button class="btn btn-sm btn-ghost" data-show-signal="${h(sig.id)}">Show</button>` : ' <span class="muted">(below the paste threshold)</span>'}${p.excerpt ? `<div class="excerpt" style="font-size:14px">${h(p.excerpt.length > 300 ? p.excerpt.slice(0, 299) + '…' : p.excerpt)}</div>` : ''}</li>`;
      }).join('')}</ul>` : ''}
      <details style="margin-top:12px"><summary class="small">Show the report's extracted text</summary><pre style="white-space:pre-wrap;font-size:12px;max-height:300px;overflow:auto;background:var(--surface-2);padding:10px;border-radius:6px">${h(r.rawText || '')}</pre></details>
    </div>
  </section>`;
}

function paragraphCard(result) {
  const rep = result.replay;
  if (!rep.matchesSubmission) return '';
  const pp = paragraphProcess(rep, result.doc);
  const max = Math.max(8, ...pp.map((p) => p.density));
  return `<section class="card" aria-label="Revision by paragraph">
    <div class="card-head"><h2>Revision by paragraph</h2><span class="muted">Edits per 100 words while writing</span></div>
    <ul class="para-bars">
      ${pp.map((p) => `<li>
        <span class="mono">¶${p.index + 1}</span>
        <span class="track" title="${fmtNum(p.density, 1)} edits per 100 words"><span class="fill ${p.pastedShare > 0.5 ? 'pasted' : ''}" style="width:${p.pastedShare > 0.5 ? 100 : Math.max(1, (p.density / max) * 100)}%"></span></span>
        <span class="small">${p.pastedShare > 0.5 ? `pasted (${pct(p.pastedShare)})` : `${fmtNum(p.density, 1)} · ${p.words} words`}</span>
      </li>`).join('')}
    </ul>
  </section>`;
}

function rangeViz(row) {
  const lo = Math.min(row.baseline.min, row.value);
  const hi = Math.max(row.baseline.max, row.value);
  const pad = (hi - lo) * 0.1 || 1;
  const x = (v) => 6 + ((v - (lo - pad)) / (hi - lo + 2 * pad)) * 148;
  return `<svg class="range-viz" viewBox="0 0 160 18" aria-hidden="true">
    <line class="rv-track" x1="4" x2="156" y1="9" y2="9"/>
    <rect class="rv-band" x="${x(row.baseline.min)}" y="4" width="${Math.max(2, x(row.baseline.max) - x(row.baseline.min))}" height="10" rx="2"/>
    <circle class="rv-dot" cx="${x(row.value)}" cy="9" r="4"/>
  </svg>`;
}

function baselineCard(result) {
  const b = result.baseline;
  const link = `<a href="#/student/${encodeURIComponent(result.submission.studentId)}">Manage baseline samples</a>`;
  if (!b) {
    return `<section class="card card-pad" aria-label="Comparison with previous writing"><h2>Comparison with previous writing</h2>
      <p class="muted">No authentic writing samples are stored for this student, so no baseline comparison is possible. Individual comparisons are much more informative than generic ones. ${link}.</p></section>`;
  }
  const rowHtml = (r) => `<tr>
        <td>${h(r.feature.label)}<div class="small muted">${h(FEATURE_GROUPS[r.feature.group].label)}</div></td>
        <td>${r.severity ? sevBadge(result.signals.find((s) => s.id === `baseline-${r.feature.id}`)?.severity || r.severity) : '<span class="muted small">within range</span>'}</td>
        <td>${h(withUnit(r.baseline.mean, r.feature))} <span class="muted small">(${fmtNum(r.baseline.min, r.feature.digits)}–${fmtNum(r.baseline.max, r.feature.digits)})</span></td>
        <td>${h(withUnit(r.value, r.feature))}</td>
        <td class="small">${r.change != null && Math.abs(r.baseline.mean) > 0.01 ? `${r.change >= 0 ? '+' : ''}${fmtNum(r.change * 100, 0)}%` : '—'}</td>
        <td>${rangeViz(r)}</td>
      </tr>`;
  const head = '<thead><tr><th>Feature</th><th>Deviation</th><th>Baseline (mean, range)</th><th>This submission</th><th>Change</th><th title="Band = student\'s baseline range; dot = this submission">Range</th></tr></thead>';
  const flagged = result.comparison.filter((r) => r.severity);
  const others = result.comparison.filter((r) => !r.severity);
  return `<section class="card" aria-label="Comparison with previous writing">
    <div class="card-head"><h2>Comparison with previous writing</h2><span class="muted">Baseline ${h(b.reliability.toLowerCase())}: ${plural(b.sampleCount, 'sample')}, ${b.totalWords} words · ${link}</span></div>
    ${flagged.length ? `<div class="table-wrap"><table class="table">${head}<tbody>${flagged.map(rowHtml).join('')}</tbody></table></div>`
      : '<p class="card-pad muted">Every measured feature is within this student\'s usual range.</p>'}
    ${others.length ? `<details class="card-pad" style="border-top:1px solid var(--border)"><summary>Show ${plural(others.length, 'feature')} within the usual range</summary>
      <div class="table-wrap" style="margin-top:10px"><table class="table">${head}<tbody>${others.map(rowHtml).join('')}</tbody></table></div></details>` : ''}
    <p class="small muted" style="padding:10px 20px 0">In the Range column, the band is the student's range across baseline samples and the dot is this submission.</p>
    ${b.process ? `<p class="small muted" style="padding:0 20px 14px">Process baseline from ${plural(b.process.count, 'earlier log')}: largest insertion ${b.process.largestInsertionWords} words, revision ratio ${pct(b.process.revisionRatio)}, typing speed ${fmtNum(b.process.typingWpm, 0)} wpm.</p>` : ''}
  </section>`;
}

function wire(app, id, result, tl) {
  const st = stateFor(id);
  const rerender = () => renderSubmission(app, id);
  app.querySelectorAll('[data-signal].signal-item').forEach((b) => b.addEventListener('click', () => {
    st.sel = b.dataset.signal; st.mode = 'signal'; rerender();
  }));
  app.querySelectorAll('[data-show-signal]').forEach((b) => b.addEventListener('click', () => {
    st.sel = b.dataset.showSignal; st.mode = 'signal'; rerender();
    app.querySelector('[aria-label="Signal detail"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  app.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { st.filter = b.dataset.filter; rerender(); }));
  app.querySelector('[data-action="hide-low"]')?.addEventListener('change', (e) => { st.hideLow = e.target.checked; rerender(); });
  app.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { st.mode = b.dataset.mode; rerender(); }));
  app.querySelector('[data-action="jump"]')?.addEventListener('click', () => {
    if (st.mode !== 'signal') { st.mode = 'signal'; rerender(); }
    const el = document.getElementById('first-highlight');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  app.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
    const note = app.querySelector('#sig-note')?.value ?? '';
    store.annotate(id, st.sel, { status: b.dataset.status, note });
    toast(b.dataset.status === 'dismissed' ? 'Signal dismissed. It is kept in the record.' : `Marked as ${b.dataset.status}.`);
    rerender();
  }));
  app.querySelector('[data-action="save-note"]')?.addEventListener('click', () => {
    store.annotate(id, st.sel, { note: app.querySelector('#sig-note').value });
    toast('Note saved.');
    rerender();
  });
  app.querySelector('[data-action="save-sub-note"]')?.addEventListener('click', () => {
    store.setSubmissionNote(id, app.querySelector('#sub-note').value);
    toast('Note saved.');
  });
  app.querySelector('[data-action="export"]')?.addEventListener('click', () => {
    const sub = store.submission(id);
    const payload = { student: result.student?.name, assignment: sub.assignment, date: sub.date, finalText: sub.finalText, log: sub.log, annotations: store.annotationsFor(id) };
    download(`${(result.student?.name || 'submission').replace(/\W+/g, '-')}-${sub.id}.json`, JSON.stringify(payload, null, 2));
  });
  app.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
    if (!confirm('Delete this submission and its notes from this browser? This cannot be undone.')) return;
    store.remove('submissions', id);
    location.hash = '#/';
  });
  if (tl) {
    wireTimeline(app.querySelector('#tl-root').parentElement, tl, {
      onSegment: (i) => { st.seg = st.seg === i ? null : i; st.mode = st.seg == null ? 'signal' : 'segment'; rerender(); },
      onSignal: (sid) => { st.sel = sid; st.mode = 'signal'; rerender(); },
    });
  }
}

export function renderReport(app, id) {
  const result = getAnalysis(id);
  if (!result) { app.innerHTML = '<p class="notice">Submission not found.</p>'; return; }
  const note = store.submissionNote(id);
  app.innerHTML = `
    <div class="btn-row no-print" style="justify-content:space-between;margin-bottom:16px;max-width:780px;margin-left:auto;margin-right:auto">
      <a class="btn" href="#/submission/${encodeURIComponent(id)}">← Back to evidence</a>
      <div class="btn-row"><button class="btn" data-action="copy">Copy as text</button><button class="btn btn-primary" data-action="print">Print / save PDF</button></div>
    </div>
    ${reportHtml(result, note)}`;
  app.querySelector('[data-action="print"]').addEventListener('click', () => window.print());
  app.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    const text = reportText(result, note);
    try { await navigator.clipboard.writeText(text); toast('Report copied.'); } catch { download('writing-process-review.txt', text, 'text/plain'); }
  });
}
