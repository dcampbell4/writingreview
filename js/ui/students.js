// Students and their baselines: authentic writing samples, context flags
// (accommodations) and a summary of what the baseline currently describes.

import * as store from '../store.js';
import { invalidate, readFile, toast } from './common.js';
import { buildBaseline } from '../baseline/baseline.js';
import { FEATURES, FEATURE_GROUPS } from '../text/features.js';
import { withUnit } from '../baseline/baseline.js';
import { CONTEXT_FLAGS } from '../pipeline/severity.js';
import { countWords } from '../text/tokenize.js';
import { parseImport } from '../schema.js';
import { escapeHtml as h, fmtDate, fmtNum, plural, pct, uid } from '../util.js';

export function renderStudents(app) {
  const config = store.getConfig();
  const list = [...store.students()].sort((a, b) => a.name.localeCompare(b.name));
  app.innerHTML = `
    <div class="page-head">
      <div><h1>Students &amp; baselines</h1>
      <p>A baseline describes a student's normal writing, built only from samples you mark as authentic (for example, in-class writing). Comparisons with a student's own baseline are far more informative than generic comparisons.</p></div>
    </div>
    <div class="card">
      <div class="card-head"><h2>Students</h2>
        <form class="btn-row" id="add-student" style="flex-wrap:nowrap"><input type="text" name="name" placeholder="New student name" aria-label="New student name" required style="width:220px"><button class="btn btn-sm">Add</button></form>
      </div>
      ${list.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Student</th><th class="num">Samples</th><th class="num">Words</th><th>Baseline</th><th>Context</th><th class="num">Submissions</th></tr></thead>
        <tbody>${list.map((s) => {
          const samples = store.samplesFor(s.id);
          const b = buildBaseline(samples, config);
          const ctx = CONTEXT_FLAGS.filter((f) => s.context?.[f.flag]);
          return `<tr class="row-link" data-href="#/student/${encodeURIComponent(s.id)}" tabindex="0">
            <td><a href="#/student/${encodeURIComponent(s.id)}">${h(s.name)}</a></td>
            <td class="num">${samples.length}</td>
            <td class="num">${b ? b.totalWords : 0}</td>
            <td>${b ? `<span class="tag">${h(b.reliability)}</span>` : '<span class="muted">None</span>'}</td>
            <td>${ctx.length ? ctx.map((f) => `<span class="tag">${h(f.flag === 'ell' ? 'ELL' : f.flag === 'dictation' ? 'Dictation' : f.flag === 'draftsElsewhere' ? 'Drafts elsewhere' : 'Assistive tools')}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
            <td class="num">${store.submissions().filter((x) => x.studentId === s.id).length}</td>
          </tr>`;
        }).join('')}</tbody></table></div>` : '<p class="empty">No students yet.</p>'}
    </div>`;
  app.querySelector('#add-student').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = new FormData(e.target).get('name').trim();
    if (!name) return;
    const s = store.findOrCreateStudent(name);
    location.hash = `#/student/${encodeURIComponent(s.id)}`;
  });
  app.querySelectorAll('tr.row-link').forEach((tr) => {
    tr.addEventListener('click', (e) => { if (e.target.tagName !== 'A') location.hash = tr.dataset.href; });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = tr.dataset.href; });
  });
}

export function renderStudent(app, id) {
  const s = store.student(id);
  if (!s) { app.innerHTML = '<p class="notice">Student not found. <a href="#/students">Back</a></p>'; return; }
  const config = store.getConfig();
  const samples = store.samplesFor(id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const b = buildBaseline(samples, config);
  const subs = store.submissions().filter((x) => x.studentId === id);

  app.innerHTML = `
    <div class="breadcrumb"><a href="#/students">Students</a> / ${h(s.name)}</div>
    <div class="page-head"><div><h1>${h(s.name)}</h1><p>${plural(samples.length, 'writing sample')} · ${plural(subs.length, 'submission')}</p></div>
      <div class="btn-row"><button class="btn btn-ghost" data-action="delete-student">Delete student</button></div></div>

    <div class="grid-2">
      <section class="card card-pad">
        <h2>Context</h2>
        <p class="muted small">Known circumstances that produce unusual patterns for legitimate reasons. When checked, related signals are capped and the reason is shown on every affected signal.</p>
        <form id="ctx-form">
          ${CONTEXT_FLAGS.map((f) => `<label class="check" style="margin:8px 0"><input type="checkbox" name="${f.flag}" ${s.context?.[f.flag] ? 'checked' : ''}> Student ${h(f.label)}</label>`).join('')}
          <div class="field" style="margin-top:12px"><label for="st-notes">Notes</label><textarea id="st-notes" name="notes" rows="3">${h(s.notes || '')}</textarea></div>
          <div class="btn-row" style="margin-top:10px"><button class="btn btn-sm btn-primary">Save</button></div>
        </form>
      </section>

      <section class="card card-pad">
        <h2>Baseline summary</h2>
        ${b ? `<p><span class="tag">${h(b.reliability)}</span> ${plural(b.sampleCount, 'included sample')}, ${b.totalWords} words${b.process ? `, ${plural(b.process.count, 'process log')}` : ''}.</p>
          ${b.reliability === 'Limited' ? `<p class="small muted">An established baseline needs ${config.baseline.establishedSamples}+ samples and ${config.baseline.establishedWords}+ words. Until then, baseline deviations are capped at ${h(config.baseline.limitedCap)}.</p>` : ''}
          <dl class="kv small" style="margin-top:10px">
            ${['avgSentenceLength', 'avgWordLength', 'longWordRate', 'transitionRate', 'analyticalVerbRate', 'errorRate', 'avgParagraphLength'].map((fid) => {
              const f = FEATURES.find((x) => x.id === fid);
              const v = b.features[fid];
              return v ? `<dt>${h(f.label)}</dt><dd>${h(withUnit(v.mean, f))} <span class="muted">(${fmtNum(v.min, f.digits)}–${fmtNum(v.max, f.digits)})</span></dd>` : '';
            }).join('')}
            ${b.errorsSeen.length ? `<dt>Recurring habits seen</dt><dd>${h(b.errorsSeen.slice(0, 8).join(', '))}</dd>` : ''}
            ${b.process ? `<dt>Largest insertion</dt><dd>${b.process.largestInsertionWords} words</dd><dt>Revision ratio</dt><dd>${pct(b.process.revisionRatio)}</dd><dt>Typing speed</dt><dd>${fmtNum(b.process.typingWpm, 0)} wpm</dd>` : ''}
          </dl>` : '<p class="muted">No included authentic samples yet. Add in-class or otherwise verified writing below.</p>'}
      </section>
    </div>

    <section class="card" style="margin-top:16px">
      <div class="card-head"><h2>Writing samples</h2><span class="muted">Only samples marked authentic and included are used in the baseline</span></div>
      ${samples.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Title</th><th>Date</th><th class="num">Words</th><th>Process log</th><th>Authentic</th><th>Included</th><th></th></tr></thead>
        <tbody>${samples.map((x) => `<tr>
          <td><details><summary>${h(x.title || 'Untitled')}</summary><div style="white-space:pre-wrap;font-family:Georgia,serif;font-size:14px;max-height:260px;overflow:auto;margin-top:8px">${h(x.text)}</div></details></td>
          <td>${h(fmtDate(x.date))}</td>
          <td class="num">${countWords(x.text)}</td>
          <td>${x.log ? '<span class="tag">yes</span>' : '<span class="muted">—</span>'}</td>
          <td><input type="checkbox" data-sample="${h(x.id)}" data-field="authentic" ${x.authentic !== false ? 'checked' : ''} aria-label="Authentic"></td>
          <td><input type="checkbox" data-sample="${h(x.id)}" data-field="include" ${x.include !== false ? 'checked' : ''} aria-label="Included in baseline"></td>
          <td><button class="btn btn-sm btn-ghost" data-remove-sample="${h(x.id)}">Remove</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No samples yet.</p>'}
      <form id="add-sample" class="card-pad" style="border-top:1px solid var(--border)">
        <h3>Add an authentic sample</h3>
        <div class="fields-row" style="margin-top:10px">
          <div class="field"><label for="sm-title">Title</label><input type="text" id="sm-title" name="title" required placeholder="e.g. In-class essay: Of Mice and Men"></div>
          <div class="field"><label for="sm-date">Date written</label><input type="date" id="sm-date" name="date"></div>
        </div>
        <div class="field" style="margin-top:12px"><label for="sm-text">Text</label><textarea id="sm-text" name="text" rows="6" required placeholder="Paste writing you know the student produced themselves."></textarea></div>
        <div class="field"><label for="sm-log">Optional: writing-process log (JSON) for this sample</label><input type="file" id="sm-log" name="log" accept=".json,application/json"></div>
        <div class="btn-row" style="margin-top:12px"><button class="btn btn-primary">Add sample</button></div>
      </form>
    </section>

    <section class="card card-pad" style="margin-top:16px">
      <h2>Submissions</h2>
      ${subs.length ? `<ul>${subs.map((x) => `<li><a href="#/submission/${encodeURIComponent(x.id)}">${h(x.assignment)}</a> <span class="muted">· ${h(fmtDate(x.date))}</span></li>`).join('')}</ul>` : '<p class="muted">None yet.</p>'}
    </section>`;

  app.querySelector('#ctx-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const context = Object.fromEntries(CONTEXT_FLAGS.map((f) => [f.flag, fd.get(f.flag) === 'on']));
    store.upsert('students', { id, context, notes: fd.get('notes') });
    invalidate();
    toast('Saved. Analyses will use the updated context.');
  });
  app.querySelectorAll('[data-sample]').forEach((cb) => cb.addEventListener('change', () => {
    store.upsert('samples', { id: cb.dataset.sample, [cb.dataset.field]: cb.checked });
    invalidate();
    renderStudent(app, id);
  }));
  app.querySelectorAll('[data-remove-sample]').forEach((btn) => btn.addEventListener('click', () => {
    if (!confirm('Remove this sample from the baseline?')) return;
    store.remove('samples', btn.dataset.removeSample);
    invalidate();
    renderStudent(app, id);
  }));
  app.querySelector('#add-sample').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    let log = null;
    const file = fd.get('log');
    if (file && file.size) {
      try {
        const parsed = parseImport(await readFile(file));
        log = parsed.kind === 'submission' ? parsed.data.log : null;
      } catch (err) { alert(`Could not read the log: ${err.message}`); return; }
    }
    store.upsert('samples', {
      id: uid('sample'), studentId: id, title: fd.get('title'), date: fd.get('date') || new Date().toISOString().slice(0, 10),
      text: fd.get('text'), authentic: true, include: true, log,
    });
    invalidate();
    toast('Sample added to the baseline.');
    renderStudent(app, id);
  });
  app.querySelector('[data-action="delete-student"]').addEventListener('click', () => {
    if (!confirm(`Delete ${s.name}, their samples and submissions from this browser?`)) return;
    store.remove('students', id);
    invalidate();
    location.hash = '#/students';
  });
}

export { FEATURE_GROUPS };
