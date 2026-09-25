// Class dashboard: one row per piece under investigation, sortable.

import * as store from '../store.js';
import { resultFor, levelHtml, priorityHtml, nameOf } from './common.js';
import { escapeHtml as h, fmtDate } from '../util.js';

const RANK = { 'VERY HIGH': 5, HIGH: 4, 'MODERATE-HIGH': 3, MODERATE: 2, LOW: 1, INCONCLUSIVE: 0, 'NOT ASSESSED': -1 };
const SUFF = { strong: 3, preferred: 2, minimum: 1, insufficient: 0 };
let sort = { key: 'priority', dir: -1 };
let filter = 'all';

export function renderClass(app) {
  const pieces = store.currentSamples();
  const rows = pieces.map((s) => {
    const r = resultFor(s.id);
    const cat = Object.fromEntries(r.categories.map((c) => [c.id, c]));
    return { s, r, cat, student: store.student(s.student_id), assignment: store.assignment(s.assignment_id) };
  }).filter((x) => filter === 'all' || x.s.assignment_id === filter);
  const val = (x, key) => ({
    student: store.displayName(x.student).toLowerCase(),
    assignment: (x.assignment?.title || x.s.title || '').toLowerCase(),
    date: x.s.timestamp || '',
    priority: RANK[x.r.priority.level] ?? -1,
    style: RANK[x.cat.style.level], discourse: RANK[x.cat.discourse.level], process: RANK[x.cat.process.level], external: RANK[x.cat.external.level],
    evidence: SUFF[x.r.profile.sufficiency.level] * 10 + (x.r.current.process ? 1 : 0),
  }[key]);
  rows.sort((a, b) => { const va = val(a, sort.key); const vb = val(b, sort.key); return (va > vb ? 1 : va < vb ? -1 : 0) * sort.dir; });
  const th = (key, label, cls = '') => `<th class="${cls}" aria-sort="${sort.key === key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}"><button data-sort="${key}">${h(label)}${sort.key === key ? (sort.dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;

  app.innerHTML = `
    <div class="page-head">
      <div><h1>Class overview</h1>
      <p>How unusual is each piece of writing <em>for that particular student</em>? Levels compare each piece with the student's own earlier writing and writing process. They are prompts for investigation, not judgements about authorship.</p></div>
      <div class="btn-row"><a class="btn btn-primary" href="#/add">Add writing</a></div>
    </div>
    ${store.get().demo ? '<p class="notice no-print" style="margin-bottom:16px">You are looking at a <strong>fictional demo class</strong>. Reset or clear it under <a href="#/privacy">Privacy</a>.</p>' : ''}
    <div class="sheet">
      <div class="sheet-head">
        <h2>Pieces under review</h2>
        <div class="btn-row">
          <label for="flt" class="small">Assignment</label>
          <select id="flt" style="width:auto">
            <option value="all">All assignments</option>
            ${store.assignments().map((a) => `<option value="${h(a.id)}" ${filter === a.id ? 'selected' : ''}>${h(a.title)}</option>`).join('')}
          </select>
          <label class="check small"><input type="checkbox" id="hide" ${store.get().hideNames ? 'checked' : ''}> Show student IDs only</label>
        </div>
      </div>
      ${rows.length ? `<div class="table-wrap"><table class="table">
        <thead><tr>
          ${th('student', 'Student')}${th('assignment', 'Assignment')}${th('date', 'Date')}${th('priority', 'Investigation priority')}
          ${th('process', 'Process')}${th('style', 'Style')}${th('discourse', 'Discourse')}${th('external', 'External insertion')}${th('evidence', 'Evidence available')}
        </tr></thead>
        <tbody>${rows.map((x) => `
          <tr class="link" data-href="#/piece/${encodeURIComponent(x.s.id)}" tabindex="0">
            <td><a href="#/piece/${encodeURIComponent(x.s.id)}">${nameOf(x.student)}</a>${store.get().hideNames ? '' : `<div class="small muted">${h(x.student?.id || '')}</div>`}</td>
            <td>${h(x.assignment?.title || x.s.title || 'Untitled')}</td>
            <td class="small">${h(fmtDate(x.s.timestamp))}</td>
            <td>${priorityHtml(x.r.priority.level)}</td>
            <td>${levelHtml(x.cat.process.level, x.cat.process.segments)}</td>
            <td>${levelHtml(x.cat.style.level, x.cat.style.segments)}</td>
            <td>${levelHtml(x.cat.discourse.level, x.cat.discourse.segments)}</td>
            <td>${levelHtml(x.cat.external.level, x.cat.external.segments)}</td>
            <td class="small">${h(x.r.profile.sufficiency.label)}<br><span class="muted">${x.r.profile.n} earlier sample${x.r.profile.n === 1 ? '' : 's'}${x.r.current.process ? ` · process ${x.r.current.process.source === 'log' ? 'log' : 'report'}` : ' · no process data'}</span></td>
          </tr>`).join('')}</tbody>
      </table></div>` : '<p class="empty">Nothing to review yet. <a href="#/add">Add a piece of writing</a>.</p>'}
    </div>
    <p class="small muted" style="margin-top:12px">Every level is written in words; the bars are only a visual aid. "Not assessed" means the data needed for that category is missing (for example, fewer than 3 earlier samples or no process data).</p>`;

  app.querySelectorAll('[data-sort]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sort;
    sort = sort.key === k ? { key: k, dir: -sort.dir } : { key: k, dir: ['student', 'assignment'].includes(k) ? 1 : -1 };
    renderClass(app);
  }));
  app.querySelector('#flt').addEventListener('change', (e) => { filter = e.target.value; renderClass(app); });
  app.querySelector('#hide').addEventListener('change', (e) => { store.setHideNames(e.target.checked); renderClass(app); });
  app.querySelectorAll('tr.link').forEach((tr) => {
    tr.addEventListener('click', (e) => { if (e.target.tagName !== 'A') location.hash = tr.dataset.href; });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = tr.dataset.href; });
  });
}
