// Add writing: baseline samples (one or many files) or a piece to review.
// For a piece under review the teacher answers the assignment-context
// questions first, so anomalies can be interpreted in context.

import * as store from '../store.js';
import { readDocument, titleFromFile } from '../import/documents.js';
import { parseImport } from '../schema.js';
import { parseProcessReport } from '../import/processReport.js';
import { GENRES, SUBJECTS } from '../genres.js';
import { assignmentFormHtml, readAssignmentForm } from './assignmentView.js';
import { toast } from './common.js';
import { escapeHtml as h, fmtNum } from '../util.js';

export function renderAdd(app, params) {
  const editing = params.get('sample') ? store.sample(params.get('sample')) : null;
  let role = editing?.role || params.get('role') || 'current';
  const studentId = editing?.student_id || params.get('student') || '';
  const files = [];     // { title, text, note }
  let processData = editing?.process_data || null;

  const render = () => {
    const students = [...store.students()].sort((a, b) => store.displayName(a).localeCompare(store.displayName(b)));
    const asgs = store.assignments();
    app.innerHTML = `
      <div class="page-head"><div><h1>${editing ? 'Complete the details' : 'Add writing'}</h1>
        <p>Baseline writing builds a student’s profile (use work you consider authentic and representative, such as in-class writing). A piece to review is compared with that profile.</p></div></div>
      <form id="add" class="stack" style="max-width:980px">
        <section class="sheet sheet-pad stack">
          <div class="fields">
            <div class="field"><label for="stu">Student</label>
              <select id="stu" name="student">
                <option value="">+ New student</option>
                ${students.map((s) => `<option value="${h(s.id)}" ${s.id === studentId ? 'selected' : ''}>${h(store.displayName(s))}${store.get().hideNames || !s.displayName ? '' : ` (${h(s.id)})`}</option>`).join('')}
              </select></div>
            <div class="field" id="newname"><label for="nm">New student name (optional)</label><input type="text" id="nm" name="newName" placeholder="Leave blank to use an ID only"></div>
          </div>
          <fieldset><legend>What are you adding?</legend>
            <div class="checks">
              <label class="check"><input type="radio" name="role" value="current" ${role === 'current' ? 'checked' : ''}> A piece of writing to review</label>
              <label class="check"><input type="radio" name="role" value="baseline" ${role === 'baseline' ? 'checked' : ''}> Baseline writing for the student’s profile (you can add several files)</label>
            </div>
          </fieldset>
        </section>

        <section class="sheet sheet-pad stack">
          <h2>The writing</h2>
          ${editing ? `<p class="small muted">Text from the writing capture page (${editing.word_count} words).</p>` : `
          <div class="field"><label for="files">Upload ${role === 'baseline' ? 'one or more files' : 'a file'} (.docx, .pdf, .txt)</label>
            <input type="file" id="files" accept=".docx,.pdf,.txt,.md" ${role === 'baseline' ? 'multiple' : ''}>
            <span class="small muted">Google Docs: File → Download → Microsoft Word (.docx). Files are read in this browser only.</span></div>
          <div id="filelist">${files.map((f, i) => `<p class="small">✓ ${h(f.title)} · ${f.text.split(/\s+/).filter(Boolean).length} words${f.note ? ` · <span class="muted">${h(f.note)}</span>` : ''} <button type="button" class="btn btn-sm btn-quiet" data-rm="${i}">Remove</button></p>`).join('')}</div>
          <div class="field"><label for="txt">…or paste the text</label><textarea id="txt" name="text" rows="8" placeholder="Paste the writing here"></textarea></div>`}
          <div class="fields">
            <div class="field"><label for="ttl">Title</label><input type="text" id="ttl" name="title" value="${h(editing?.title || '')}" placeholder="${role === 'baseline' ? 'Uses file names if left blank' : 'e.g. Lord of the Flies essay'}"></div>
            <div class="field"><label for="dt">Date written</label><input type="date" id="dt" name="date" value="${h((editing?.timestamp || new Date().toISOString()).slice(0, 10))}"></div>
            <div class="field"><label for="gn">Genre</label><select id="gn" name="genre">${GENRES.map((g) => `<option ${g === (editing?.genre || 'Literary analysis') ? 'selected' : ''}>${h(g)}</option>`).join('')}</select></div>
            <div class="field"><label for="at">Assignment type</label><input type="text" id="at" name="assignment_type" value="${h(editing?.assignment_type || '')}" placeholder="e.g. Literary essay, Paper 1"></div>
            <div class="field"><label for="sj">Subject</label><select id="sj" name="subject">${SUBJECTS.map((g) => `<option ${g === (editing?.subject || 'English') ? 'selected' : ''}>${h(g)}</option>`).join('')}</select></div>
          </div>
          <label class="check"><input type="checkbox" name="timed" ${editing?.timed ? 'checked' : ''}> Timed writing (e.g. exam or in-class timed response)</label>
        </section>

        <section class="sheet sheet-pad stack">
          <h2>Writing-process data <span class="small muted">(optional)</span></h2>
          <div class="field"><label for="proc">Process report PDF, revision-history export or writing-capture log (.pdf, .json)</label>
            <input type="file" id="proc" accept=".pdf,.json,application/pdf,application/json">
            <span class="small muted" id="procinfo">${processData ? (processData.log ? `Writing log attached (${processData.log.events?.length || 0} events).` : 'Process report attached.') : 'Without process data, the Process and External insertion categories are not assessed.'}</span></div>
          <div id="procreview">${processData?.report ? reportReviewHtml(processData.report) : ''}</div>
        </section>

        <section class="sheet sheet-pad stack" id="ctxsec" ${role === 'baseline' ? 'hidden' : ''}>
          <h2>Assignment context</h2>
          <p class="small muted" style="margin:0">Answer these before analysing: they change how differences are interpreted (for example, taught vocabulary is not counted as new).</p>
          <div class="field"><label for="asg">Assignment</label>
            <select id="asg" name="assignment">
              <option value="">+ New assignment</option>
              ${asgs.map((a) => `<option value="${h(a.id)}" ${a.id === (editing?.assignment_id || params.get('assignment')) ? 'selected' : ''}>${h(a.title)}</option>`).join('')}
            </select></div>
          <div id="asgform"></div>
        </section>

        <p class="notice" id="err" hidden></p>
        <div class="btn-row"><button class="btn btn-primary">${role === 'current' ? 'Save and analyse' : 'Save to profile'}</button><a class="btn btn-quiet" href="#/">Cancel</a></div>
      </form>`;
    wire();
  };

  const reportReviewHtml = (r) => `<div class="why">
      <p style="margin:0"><strong>Read from ${h(r.fileName || 'report')}</strong> (${h(r.tool)}). Check and correct these figures:</p>
      <div class="fields" style="margin-top:8px">${[['writingMinutes', 'Writing time (min)'], ['sessions', 'Sessions'], ['edits', 'Edits'], ['pasteCount', 'Pastes']].map(([k, l]) => `<div class="field"><label>${h(l)}</label><input type="number" step="any" min="0" data-metric="${k}" value="${r.metrics?.[k] != null ? fmtNum(r.metrics[k], 1) : ''}"></div>`).join('')}</div>
      ${r.pastes?.length ? `<p class="small" style="margin-bottom:2px"><strong>Pastes found</strong> (untick any that were misread):</p>${r.pastes.map((p, i) => `<label class="check small"><input type="checkbox" data-paste="${i}" ${p.include !== false ? 'checked' : ''}> ${p.time ? h(new Date(p.time).toLocaleString()) + ' · ' : ''}${p.words != null ? `${p.words} words` : p.chars != null ? `${p.chars} characters` : ''} <span class="serif muted">${h((p.excerpt || p.line).slice(0, 140))}</span></label>`).join('')}` : '<p class="small muted">No individual pastes recognised.</p>'}
      <details><summary class="small">All text extracted from the report</summary><pre class="small" style="white-space:pre-wrap;max-height:220px;overflow:auto">${h(r.rawText || '')}</pre></details>
    </div>`;

  function wire() {
    const form = app.querySelector('#add');
    const err = app.querySelector('#err');
    const showErr = (m) => { err.textContent = m; err.hidden = !m; };
    const stuSel = form.querySelector('#stu');
    const toggleNew = () => { app.querySelector('#newname').hidden = Boolean(stuSel.value); };
    toggleNew();
    stuSel.addEventListener('change', toggleNew);
    form.querySelectorAll('[name="role"]').forEach((r) => r.addEventListener('change', () => { role = r.value; render(); }));
    const asgSel = form.querySelector('#asg');
    const drawAsg = () => {
      const a = asgSel.value ? store.assignment(asgSel.value) : null;
      app.querySelector('#asgform').innerHTML = assignmentFormHtml(a || (editing ? { title: editing.title, genre: editing.genre, subject: editing.subject } : null));
      if (a && role === 'current') {
        // The piece inherits the assignment's genre and conditions.
        form.querySelector('#gn').value = a.genre || form.querySelector('#gn').value;
        form.querySelector('#at').value = a.assignment_type || '';
        if (a.subject) form.querySelector('#sj').value = a.subject;
        form.querySelector('[name="timed"]').checked = Boolean(a.timed);
        if (!form.querySelector('#ttl').value) form.querySelector('#ttl').value = a.title;
      }
    };
    drawAsg();
    asgSel.addEventListener('change', drawAsg);

    form.querySelector('#files')?.addEventListener('change', async (e) => {
      showErr('');
      for (const file of e.target.files) {
        try {
          const doc = await readDocument(file);
          files.push({ title: titleFromFile(file.name), text: doc.text, note: doc.note });
        } catch (ex) { showErr(`Could not read ${file.name}: ${ex.message}`); }
      }
      if (role === 'current' && files.length > 1) files.splice(0, files.length - 1);
      const keepText = form.querySelector('#txt')?.value;
      render();
      if (keepText) app.querySelector('#txt').value = keepText;
    });
    app.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { files.splice(Number(b.dataset.rm), 1); render(); }));

    form.querySelector('#proc').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const info = app.querySelector('#procinfo');
      try {
        if (/\.pdf$/i.test(file.name)) {
          const { pdfToText } = await import('../import/pdfText.js');
          processData = { report: parseProcessReport(await pdfToText(await file.arrayBuffer()), { fileName: file.name }) };
        } else {
          const parsed = parseImport(await file.text(), { fileName: file.name });
          if (parsed.kind === 'bundle') throw new Error('This is a full data export. Import it under Privacy → Import.');
          if (parsed.kind === 'report') processData = { report: parsed.data };
          else {
            processData = { log: parsed.data.log };
            const txt = form.querySelector('#txt');
            if (txt && !txt.value && parsed.data.finalText) txt.value = parsed.data.finalText;
          }
        }
        info.textContent = processData.log ? `Writing log attached (${processData.log.events?.length || 0} events).` : 'Process report read. Check the figures below.';
        app.querySelector('#procreview').innerHTML = processData.report ? reportReviewHtml(processData.report) : '';
      } catch (ex) {
        processData = null;
        info.textContent = `Could not read ${file.name}: ${ex.message}`;
      }
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      showErr('');
      const fd = new FormData(form);
      const pasted = String(fd.get('text') || '').trim();
      const items = editing ? [{ title: fd.get('title') || editing.title, text: editing.text }] : [...files];
      if (pasted) items.push({ title: fd.get('title') || 'Pasted text', text: pasted });
      if (!items.length) { showErr('Upload a file or paste the writing.'); return; }
      if (role === 'current' && items.length > 1) { showErr('Add one piece to review at a time (upload a file or paste text, not both).'); return; }
      if (processData?.report) {
        const r = processData.report;
        app.querySelectorAll('[data-metric]').forEach((inp) => { const v = Number(inp.value); if (inp.value === '') delete r.metrics[inp.dataset.metric]; else if (Number.isFinite(v)) r.metrics[inp.dataset.metric] = v; });
        r.pastes?.forEach((p, i) => { const cb = app.querySelector(`[data-paste="${i}"]`); if (cb) p.include = cb.checked; });
      }
      let sid = fd.get('student');
      if (!sid) sid = store.saveStudent({ id: store.nextStudentId(), displayName: String(fd.get('newName') || '').trim(), gradeLevel: '', context: {}, notes: '' }).id;
      let assignmentId = null;
      if (role === 'current') {
        const a = readAssignmentForm(app.querySelector('#asgform'));
        if (!a.title) { showErr('Give the assignment a title (under Assignment context).'); return; }
        assignmentId = fd.get('assignment') || store.newId('A');
        store.saveAssignment({ ...(store.assignment(assignmentId) || {}), ...a, id: assignmentId });
      }
      const common = {
        student_id: sid, role, timestamp: `${fd.get('date')}T12:00:00`, genre: fd.get('genre'), subject: fd.get('subject'),
        assignment_type: String(fd.get('assignment_type') || '').trim(), timed: fd.get('timed') === 'on', include: true, authentic: true,
        assignment_id: assignmentId,
      };
      let last = null;
      items.forEach((it) => {
        last = store.saveSample({ ...(editing || {}), id: editing?.id || store.newId('smp'), ...common, title: it.title, text: it.text, process_data: processData || editing?.process_data || null });
      });
      toast(role === 'current' ? 'Saved. Analysing…' : `${items.length} sample${items.length === 1 ? '' : 's'} added to the profile.`);
      location.hash = role === 'current' ? `#/piece/${encodeURIComponent(last.id)}` : `#/student/${encodeURIComponent(sid)}`;
    });
  }

  render();
}
