// Add a submission: paste the final text (text-only analysis), and/or attach a
// writing-process log exported from the capture page or another editor.

import * as store from '../store.js';
import { invalidate, readFile } from './common.js';
import { parseImport, normalizeLog } from '../schema.js';
import { replay } from '../process/replay.js';
import { escapeHtml as h, uid } from '../util.js';

export function renderNewSubmission(app) {
  const students = [...store.students()].sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = `
    <div class="page-head"><div><h1>Add submission</h1>
      <p>Paste the final text for a text-only review, or attach a writing-process log (from the <a href="capture.html" target="_blank" rel="noopener">writing capture page</a> or any editor that exports the documented format) to enable process signals and the timeline.</p></div></div>
    <form id="new-sub" class="card card-pad" style="max-width:820px">
      <div class="fields-row">
        <div class="field"><label for="ns-student">Student</label>
          <input type="text" id="ns-student" name="student" list="student-list" required placeholder="Type or pick a name">
          <datalist id="student-list">${students.map((s) => `<option value="${h(s.name)}">`).join('')}</datalist></div>
        <div class="field"><label for="ns-assign">Assignment</label><input type="text" id="ns-assign" name="assignment" required></div>
        <div class="field"><label for="ns-date">Date</label><input type="date" id="ns-date" name="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="field" style="margin-top:14px"><label for="ns-log">Writing-process log (optional, JSON)</label>
        <input type="file" id="ns-log" name="log" accept=".json,application/json">
        <span class="small muted" id="log-info">If the log contains the final text, you can leave the text box empty.</span></div>
      <div class="field" style="margin-top:14px"><label for="ns-text">Final submitted text</label><textarea id="ns-text" name="text" rows="12" placeholder="Paste the submitted text here."></textarea></div>
      <div class="field"><label for="ns-terms">Assignment terms to exclude from the vocabulary comparison (optional, comma-separated)</label>
        <input type="text" id="ns-terms" name="terms" placeholder="e.g. symbolism, civilization, allegory"></div>
      <p id="ns-error" class="notice" hidden></p>
      <div class="btn-row" style="margin-top:16px"><button class="btn btn-primary">Analyse submission</button><a class="btn btn-ghost" href="#/">Cancel</a></div>
    </form>`;

  let parsedLog = null;
  const form = app.querySelector('#new-sub');
  const err = app.querySelector('#ns-error');
  app.querySelector('#ns-log').addEventListener('change', async (e) => {
    parsedLog = null;
    err.hidden = true;
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = parseImport(await readFile(file));
      if (parsed.kind !== 'submission') throw new Error('This file is a full data export. Import it from Settings instead.');
      parsedLog = parsed.data;
      const { log, problems } = normalizeLog(parsedLog.log);
      if (!log || !log.events.length) throw new Error(problems[0] || 'No events found.');
      const rep = replay(log);
      if (parsedLog.studentName && !form.student.value) form.student.value = parsedLog.studentName;
      if (parsedLog.assignment && !form.assignment.value) form.assignment.value = parsedLog.assignment;
      if (!form.text.value) form.text.value = parsedLog.finalText || rep.finalText;
      app.querySelector('#log-info').textContent = `Loaded ${log.events.length} events${problems.length ? ` (${problems.length} skipped)` : ''}. The final text was filled in from the log.`;
    } catch (ex) {
      err.textContent = `Could not read the log: ${ex.message}`;
      err.hidden = false;
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const text = String(fd.get('text') || '');
    if (!text.trim() && !parsedLog) { err.textContent = 'Paste the final text or attach a log.'; err.hidden = false; return; }
    const student = store.findOrCreateStudent(String(fd.get('student')));
    const sub = {
      id: uid('sub'),
      studentId: student.id,
      assignment: String(fd.get('assignment')),
      date: String(fd.get('date') || new Date().toISOString()),
      finalText: text.trim() ? text : null,
      log: parsedLog ? parsedLog.log : null,
      assignmentTerms: String(fd.get('terms') || '').split(',').map((t) => t.trim()).filter(Boolean),
    };
    store.upsert('submissions', sub);
    invalidate();
    location.hash = `#/submission/${encodeURIComponent(sub.id)}`;
  });
}
