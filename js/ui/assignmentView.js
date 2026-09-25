// Assignment context: the questions a teacher answers before analysis.

import * as store from '../store.js';
import { GENRES, SUBJECTS } from '../genres.js';
import { resultFor, priorityHtml, nameOf, toast } from './common.js';
import { escapeHtml as h, fmtDate } from '../util.js';

const YESNO = [
  ['inClass', 'Completed in class'],
  ['researchAllowed', 'Outside research was allowed'],
  ['notesAllowed', 'Students could use notes'],
  ['aiAllowed', 'AI use was explicitly permitted'],
  ['collaborationAllowed', 'Collaboration was allowed'],
  ['sentenceFrames', 'Students were given sentence frames or templates'],
  ['modelEssay', 'A model essay was studied beforehand'],
];

export function assignmentFormHtml(a = null) {
  a = a || {};
  return `<div class="stack" data-asgform>
    <div class="fields">
      <div class="field"><label>What was the assignment?</label><input type="text" data-k="title" value="${h(a.title || '')}" placeholder="e.g. Lord of the Flies: Symbolism Essay"></div>
      <div class="field"><label>Genre</label><select data-k="genre">${GENRES.map((g) => `<option ${g === (a.genre || 'Literary analysis') ? 'selected' : ''}>${h(g)}</option>`).join('')}</select></div>
      <div class="field"><label>Assignment type</label><input type="text" data-k="assignment_type" value="${h(a.assignment_type || '')}" placeholder="e.g. Literary essay"></div>
      <div class="field"><label>Subject</label><select data-k="subject">${SUBJECTS.map((g) => `<option ${g === (a.subject || 'English') ? 'selected' : ''}>${h(g)}</option>`).join('')}</select></div>
      <div class="field"><label>Grade level</label><input type="text" data-k="gradeLevel" value="${h(a.gradeLevel || '')}"></div>
      <div class="field"><label>Approximate time available (minutes)</label><input type="number" min="0" data-k="durationMinutes" value="${a.durationMinutes ?? ''}"></div>
    </div>
    <div class="checks">
      <label class="check"><input type="checkbox" data-k="timed" ${a.timed ? 'checked' : ''}> Timed</label>
      ${YESNO.map(([k, l]) => `<label class="check"><input type="checkbox" data-k="${k}" ${a[k] ? 'checked' : ''}> ${h(l)}</label>`).join('')}
    </div>
    <div class="field"><label>Vocabulary or terminology explicitly taught for this task (comma-separated)</label>
      <textarea data-k="taughtTerms" rows="2" placeholder="e.g. juxtaposition, liminality, ideological apparatus, epistemology">${h((a.taughtTerms || []).join(', '))}</textarea>
      <span class="small muted">These words will not be counted as new or unusual vocabulary.</span></div>
  </div>`;
}

export function readAssignmentForm(root) {
  const out = {};
  root.querySelectorAll('[data-k]').forEach((el) => {
    const k = el.dataset.k;
    if (el.type === 'checkbox') out[k] = el.checked;
    else if (k === 'taughtTerms') out[k] = el.value.split(/[,;\n]/).map((t) => t.trim()).filter(Boolean);
    else if (k === 'durationMinutes') out[k] = el.value === '' ? null : Number(el.value);
    else out[k] = el.value.trim();
  });
  return out;
}

export function renderAssignments(app) {
  const list = store.assignments();
  app.innerHTML = `
    <div class="page-head"><div><h1>Assignments</h1><p>The context of each task: genre, conditions, and anything taught beforehand. Context is used to interpret differences, never to raise suspicion.</p></div></div>
    <div class="sheet">${list.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Assignment</th><th>Genre</th><th>Conditions</th><th>Pieces</th></tr></thead>
      <tbody>${list.map((a) => {
        const pieces = store.samples().filter((s) => s.assignment_id === a.id && s.role === 'current');
        return `<tr class="link" data-href="#/assignment/${encodeURIComponent(a.id)}" tabindex="0"><td><a href="#/assignment/${encodeURIComponent(a.id)}">${h(a.title)}</a><div class="small muted">${h(fmtDate(a.date))}</div></td>
          <td class="small">${h(a.genre || '')}</td>
          <td class="small">${[a.timed ? 'timed' : 'untimed', ...YESNO.filter(([k]) => a[k]).map(([, l]) => l.toLowerCase())].map(h).join(' · ')}</td>
          <td>${pieces.length}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="empty">No assignments yet. They are created when you add a piece to review.</p>'}</div>`;
  app.querySelectorAll('tr.link').forEach((tr) => {
    tr.addEventListener('click', (e) => { if (e.target.tagName !== 'A') location.hash = tr.dataset.href; });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = tr.dataset.href; });
  });
}

export function renderAssignment(app, id) {
  const a = store.assignment(id);
  if (!a) { app.innerHTML = '<p class="notice">Assignment not found.</p>'; return; }
  const pieces = store.samples().filter((s) => s.assignment_id === id && s.role === 'current');
  app.innerHTML = `
    <div class="crumb"><a href="#/assignments">Assignments</a></div>
    <div class="page-head"><div><h1>${h(a.title)}</h1><p>Assignment context. Changes apply to every piece of writing for this assignment.</p></div></div>
    <div class="cols">
      <form class="sheet sheet-pad stack" id="af">${assignmentFormHtml(a)}<div class="btn-row"><button class="btn btn-primary">Save context</button></div></form>
      <section class="sheet sheet-pad"><h2>Pieces</h2>
        <ul>${pieces.map((p) => `<li style="margin:6px 0"><a href="#/piece/${encodeURIComponent(p.id)}">${nameOf(store.student(p.student_id))}</a> ${priorityHtml(resultFor(p.id).priority.level)}</li>`).join('') || '<li class="muted">None</li>'}</ul></section>
    </div>`;
  app.querySelector('#af').addEventListener('submit', (e) => {
    e.preventDefault();
    const upd = readAssignmentForm(app.querySelector('#af'));
    store.saveAssignment({ ...a, ...upd });
    // Pieces inherit genre and conditions from their assignment.
    pieces.forEach((p) => store.saveSample({ ...p, genre: upd.genre, assignment_type: upd.assignment_type, subject: upd.subject, timed: upd.timed }));
    toast('Context saved; analyses updated.');
    renderAssignment(app, id);
  });
}
