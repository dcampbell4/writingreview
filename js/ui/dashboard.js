// Submissions overview table (DESIGN.md §7).

import * as store from '../store.js';
import { getAnalysis, sevBadge, statusBadge, teacherStatus } from './common.js';
import { escapeHtml as h, fmtDate } from '../util.js';
import { STATUS } from '../pipeline/analyze.js';

export function renderDashboard(app) {
  const subs = [...store.submissions()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const rows = subs.map((sub) => ({ sub, result: getAnalysis(sub.id), student: store.student(sub.studentId) }));
  const reviewCount = rows.filter((r) => r.result.summary.status === STATUS.review).length;

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Submissions</h1>
        <p>Unusual writing-process and textual patterns, compared with each student's own previous writing where possible. Open a submission to see the evidence behind every signal.</p>
      </div>
      <div class="btn-row"><a class="btn btn-primary" href="#/new">Add submission</a></div>
    </div>
    ${store.getState().demo ? `<p class="notice notice-info no-print" style="margin-bottom:16px">You are viewing <strong>fictional demo data</strong> (three invented students). You can reset or clear it on the <a href="#/settings">Settings</a> page.</p>` : ''}
    <div class="card">
      <div class="card-head">
        <h2>All submissions</h2>
        <span class="muted">${subs.length} submission${subs.length === 1 ? '' : 's'} · ${reviewCount} with review recommended</span>
      </div>
      ${subs.length ? `
      <div class="table-wrap">
      <table class="table">
        <thead><tr>
          <th>Student</th><th>Assignment</th><th>Date</th>
          <th class="num">Process signals</th><th class="num">Textual signals</th>
          <th>Highest severity</th><th>Status</th><th>Teacher review</th>
        </tr></thead>
        <tbody>
          ${rows.map(({ sub, result, student }) => `
            <tr class="row-link" data-href="#/submission/${encodeURIComponent(sub.id)}" tabindex="0">
              <td><a href="#/submission/${encodeURIComponent(sub.id)}">${h(student?.name || 'Unknown')}</a></td>
              <td>${h(sub.assignment)}${sub.log ? '' : sub.report ? ' <span class="tag" title="Imported process report">report</span>' : ' <span class="tag" title="No process data">text only</span>'}</td>
              <td>${h(fmtDate(sub.date))}</td>
              <td class="num">${result.replay || result.report ? result.summary.processCount : '<span class="muted" title="No process data">—</span>'}</td>
              <td class="num">${result.summary.textualCount}</td>
              <td>${sevBadge(result.summary.highest)}</td>
              <td>${statusBadge(result.summary.status)}</td>
              <td>${teacherStatus(result)}</td>
            </tr>`).join('')}
        </tbody>
      </table></div>` : `<div class="empty">No submissions yet. <a href="#/new">Add one</a>, or record writing with the capture page.</div>`}
    </div>
    <p class="muted small" style="margin-top:12px">Counts include low-severity signals, which are context only. The status is based on how many independent categories show medium or high signals, never on a score.</p>`;

  app.querySelectorAll('tr.row-link').forEach((tr) => {
    const go = () => { location.hash = tr.dataset.href; };
    tr.addEventListener('click', (e) => { if (e.target.tagName !== 'A') go(); });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  });
}
