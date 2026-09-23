// Add a submission: paste the final text (text-only analysis), and/or attach
// process data: a PDF process report (e.g. from a Google Docs add-on), a JSON
// export, or a log from the capture page. Anything read from a report is shown
// for the teacher to check and correct before analysis.

import * as store from '../store.js';
import { invalidate, readFile } from './common.js';
import { parseImport, normalizeLog } from '../schema.js';
import { replay } from '../process/replay.js';
import { parseProcessReport, proseFromReport } from '../import/processReport.js';
import { escapeHtml as h, uid, fmtNum } from '../util.js';

const METRIC_FIELDS = [
  ['writingMinutes', 'Writing time (minutes)'],
  ['sessions', 'Sessions'],
  ['edits', 'Edits / revisions'],
  ['pasteCount', 'Number of pastes'],
  ['pastedWords', 'Words pasted'],
  ['pastedChars', 'Characters pasted'],
  ['totalWords', 'Word count'],
];

export function renderNewSubmission(app) {
  const students = [...store.students()].sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = `
    <div class="page-head"><div><h1>Add submission</h1>
      <p>Attach a <strong>process report PDF</strong> (for example from a Google Docs add-on such as Revision History, Process Feedback, Draftback or Brisk), a JSON export, or a log from the <a href="capture.html" target="_blank" rel="noopener">writing capture page</a>. Then paste the student's final text. You can also paste the text alone for a text-only review.</p></div></div>
    <form id="new-sub" class="card card-pad" style="max-width:900px">
      <div class="field"><label for="ns-file">Process report or log (PDF or JSON, optional)</label>
        <input type="file" id="ns-file" accept=".pdf,.json,application/pdf,application/json">
        <span class="small muted" id="file-info">Files are read in this browser only. Nothing is uploaded.</span></div>
      <p id="ns-error" class="notice" hidden style="margin-top:10px"></p>
      <div id="report-review"></div>
      <div class="fields-row" style="margin-top:14px">
        <div class="field"><label for="ns-student">Student</label>
          <input type="text" id="ns-student" name="student" list="student-list" required placeholder="Type or pick a name">
          <datalist id="student-list">${students.map((s) => `<option value="${h(s.name)}">`).join('')}</datalist></div>
        <div class="field"><label for="ns-assign">Assignment</label><input type="text" id="ns-assign" name="assignment" required></div>
        <div class="field"><label for="ns-date">Date</label><input type="date" id="ns-date" name="date" value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="field" style="margin-top:14px"><label for="ns-text">Final submitted text</label>
        <textarea id="ns-text" name="text" rows="12" placeholder="Paste the student's final text here (for example, copy it from the Google Doc)."></textarea>
        <span class="small muted">Process reports usually contain only excerpts, so the full text is needed for the textual analysis and to locate pasted passages.</span></div>
      <div class="field"><label for="ns-terms">Assignment terms to exclude from the vocabulary comparison (optional, comma-separated)</label>
        <input type="text" id="ns-terms" name="terms" placeholder="e.g. symbolism, civilization, allegory"></div>
      <div class="btn-row" style="margin-top:16px"><button class="btn btn-primary">Analyse submission</button><a class="btn btn-ghost" href="#/">Cancel</a></div>
    </form>`;

  const form = app.querySelector('#new-sub');
  const err = app.querySelector('#ns-error');
  const info = app.querySelector('#file-info');
  const review = app.querySelector('#report-review');
  let parsedLog = null;
  let report = null;

  const showError = (msg) => { err.textContent = msg; err.hidden = !msg; };
  const prefill = (student, assignment) => {
    if (student && !form.student.value) form.student.value = student;
    if (assignment && !form.assignment.value) form.assignment.value = assignment;
  };

  app.querySelector('#ns-file').addEventListener('change', async (e) => {
    parsedLog = null; report = null; review.innerHTML = ''; showError('');
    const file = e.target.files[0];
    if (!file) return;
    const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
    try {
      if (isPdf) {
        info.textContent = 'Reading PDF…';
        const { pdfToText } = await import('../import/pdfText.js');
        const text = await pdfToText(await file.arrayBuffer());
        report = parseProcessReport(text, { fileName: file.name });
      } else {
        const parsed = parseImport(await readFile(file), { fileName: file.name });
        if (parsed.kind === 'bundle') throw new Error('This file is a full data export from this app. Import it under Settings → Import data.');
        if (parsed.kind === 'report') report = parsed.data;
        else {
          parsedLog = parsed.data;
          const { log, problems } = normalizeLog(parsedLog.log);
          if (!log || !log.events.length) throw new Error(problems[0] || 'No events found.');
          const rep = replay(log);
          prefill(parsedLog.studentName, parsedLog.assignment);
          if (!form.text.value) form.text.value = parsedLog.finalText || rep.finalText;
          info.textContent = `${parsedLog.note || `Loaded ${log.events.length} writing events`}${problems.length ? ` (${problems.length} skipped)` : ''}. The final text was filled in from the file.`;
          return;
        }
      }
      prefill(report.student || report.studentName, report.title || report.assignment);
      info.textContent = `Read ${file.name}. Check the figures below before analysing.`;
      renderReview();
    } catch (ex) {
      info.textContent = 'Files are read in this browser only. Nothing is uploaded.';
      showError(`Could not read ${file.name}: ${ex.message}`);
    }
  });

  function renderReview() {
    const m = report.metrics || {};
    review.innerHTML = `
      <section class="card" style="margin-top:14px;box-shadow:none">
        <div class="card-head"><h2>Check the imported report</h2><span class="muted">${h(report.tool)}${report.fileName ? ` · ${h(report.fileName)}` : ''}</span></div>
        <div class="card-pad">
          <p class="small muted" style="margin-top:0">These figures were read automatically. Correct anything that is wrong and clear anything that was misread; empty fields are ignored.</p>
          <div class="fields-row">
            ${METRIC_FIELDS.map(([k, label]) => `<div class="field"><label for="rm-${k}">${h(label)}</label><input type="number" step="any" min="0" id="rm-${k}" data-metric="${k}" value="${m[k] != null ? fmtNum(m[k], 1) : ''}"></div>`).join('')}
          </div>
          <h3 style="margin-top:18px">Pastes found (${report.pastes.length})</h3>
          ${report.pastes.length ? `<div class="table-wrap"><table class="table">
            <thead><tr><th>Use</th><th>Time</th><th>Size</th><th>Excerpt</th></tr></thead>
            <tbody>${report.pastes.map((p, i) => `<tr>
              <td><input type="checkbox" data-paste="${i}" ${p.include !== false ? 'checked' : ''} aria-label="Use paste ${i + 1}"></td>
              <td class="small">${p.time ? h(new Date(p.time).toLocaleString()) : '<span class="muted">—</span>'}</td>
              <td class="small">${p.words != null ? `${p.words} words` : p.chars != null ? `${p.chars} characters` : '<span class="muted">—</span>'}</td>
              <td class="small">${p.excerpt ? h(p.excerpt.length > 220 ? p.excerpt.slice(0, 219) + '…' : p.excerpt) : `<span class="muted">${h(p.line)}</span>`}</td>
            </tr>`).join('')}</tbody></table></div>`
            : '<p class="small muted">No individual pastes were recognised. If the report lists some, check the extracted text below.</p>'}
          <details style="margin-top:14px"><summary class="small">Show all text extracted from the file</summary>
            <pre style="white-space:pre-wrap;font-size:12px;max-height:300px;overflow:auto;background:var(--surface-2);padding:10px;border-radius:6px">${h(report.rawText)}</pre></details>
          <div class="btn-row" style="margin-top:10px"><button type="button" class="btn btn-sm" data-action="use-prose">Fill the text box with the report's prose</button>
          <span class="small muted">Use this only if the report contains the whole essay.</span></div>
        </div>
      </section>`;
    review.querySelector('[data-action="use-prose"]').addEventListener('click', () => {
      const prose = proseFromReport(report.rawText);
      if (!prose) { showError('No long prose passages were found in the report.'); return; }
      form.text.value = prose;
    });
  }

  function collectReport() {
    const metrics = {};
    review.querySelectorAll('[data-metric]').forEach((inp) => {
      const v = Number(inp.value);
      if (inp.value !== '' && Number.isFinite(v)) metrics[inp.dataset.metric] = v;
    });
    const pastes = report.pastes.map((p, i) => ({ ...p, include: review.querySelector(`[data-paste="${i}"]`)?.checked ?? true }));
    return { ...report, metrics, pastes };
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const text = String(fd.get('text') || '');
    if (!text.trim() && !parsedLog) { showError('Paste the final submitted text (process reports usually do not contain the whole essay).'); form.text.focus(); return; }
    const student = store.findOrCreateStudent(String(fd.get('student')));
    const sub = {
      id: uid('sub'),
      studentId: student.id,
      assignment: String(fd.get('assignment')),
      date: String(fd.get('date') || new Date().toISOString()),
      finalText: text.trim() ? text : null,
      log: parsedLog ? parsedLog.log : null,
      report: report ? collectReport() : null,
      assignmentTerms: String(fd.get('terms') || '').split(',').map((t) => t.trim()).filter(Boolean),
    };
    store.upsert('submissions', sub);
    invalidate();
    location.hash = `#/submission/${encodeURIComponent(sub.id)}`;
  });
}
