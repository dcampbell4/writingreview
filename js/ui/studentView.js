// Students list and the longitudinal student writing profile.

import * as store from '../store.js';
import { extractFeatures, FEATURE_BY_ID } from '../features/index.js';
import { sufficiency } from '../profile/profile.js';
import { withUnit } from '../analysis/compare.js';
import { resultFor, priorityHtml, nameOf, toast } from './common.js';
import { escapeHtml as h, fmtDate, fmtNum, plural } from '../util.js';

const CONTEXT_FLAGS = [
  ['dictation', 'Uses dictation / speech-to-text'],
  ['draftsElsewhere', 'Usually drafts elsewhere (paper, another app) and pastes in'],
  ['ell', 'English language learner'],
  ['assistiveTools', 'Uses assistive writing tools (word prediction, grammar support)'],
];
const TREND_FEATURES = ['meanSentenceLength', 'clauseDensity', 'academicRate', 'rareWordRate', 'abstractionIndex', 'movesPerParagraph', 'mechanicsRate', 'revisionDensity'];

function genreCounts(list) {
  const c = {};
  list.forEach((s) => { const g = (s.genre || 'Other').toLowerCase(); c[g] = (c[g] || 0) + 1; });
  return Object.entries(c).map(([g, n]) => `${n} × ${g}`).join(', ');
}

export function renderStudents(app) {
  const cfg = store.config();
  const list = [...store.students()].sort((a, b) => store.displayName(a).localeCompare(store.displayName(b)));
  app.innerHTML = `
    <div class="page-head"><div><h1>Students</h1><p>Each student has a longitudinal writing profile built from writing you consider authentic and representative. Students are identified by ID; names are optional and can be hidden.</p></div>
      <form class="btn-row" id="new-student"><input type="text" name="name" placeholder="Name (optional)" aria-label="Name (optional)" style="width:200px"><button class="btn btn-primary">New student</button></form></div>
    <div class="sheet">${list.length ? `<div class="table-wrap"><table class="table">
      <thead><tr><th>Student</th><th>Baseline writing</th><th>Profile</th><th>Pieces under review</th><th>Context</th></tr></thead>
      <tbody>${list.map((s) => {
        const base = store.samplesOf(s.id).filter((x) => x.role === 'baseline' && x.include !== false && x.authentic !== false);
        const cur = store.samplesOf(s.id).filter((x) => x.role === 'current');
        const suff = sufficiency(base.length, new Set(base.map((x) => x.genre)).size, cfg);
        const flags = CONTEXT_FLAGS.filter(([k]) => s.context?.[k]).map(([, l]) => l.split(' (')[0]);
        return `<tr class="link" data-href="#/student/${encodeURIComponent(s.id)}" tabindex="0">
          <td><a href="#/student/${encodeURIComponent(s.id)}">${nameOf(s)}</a><div class="small muted">${h(s.id)}${s.gradeLevel ? ` · grade ${h(s.gradeLevel)}` : ''}</div></td>
          <td class="small">${base.length ? h(genreCounts(base)) : '<span class="muted">none yet</span>'}</td>
          <td class="small">${h(suff.label)}</td>
          <td>${cur.map((c) => priorityHtml(resultFor(c.id).priority.level)).join(' ') || '<span class="muted small">—</span>'}</td>
          <td class="small">${flags.map((f) => `<span class="tag">${h(f)}</span>`).join(' ') || '<span class="muted">—</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>` : '<p class="empty">No students yet.</p>'}</div>`;
  app.querySelector('#new-student').addEventListener('submit', (e) => {
    e.preventDefault();
    const s = store.saveStudent({ id: store.nextStudentId(), displayName: new FormData(e.target).get('name').trim(), gradeLevel: '', context: {}, notes: '' });
    location.hash = `#/student/${encodeURIComponent(s.id)}`;
  });
  app.querySelectorAll('tr.link').forEach((tr) => {
    tr.addEventListener('click', (e) => { if (e.target.tagName !== 'A') location.hash = tr.dataset.href; });
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') location.hash = tr.dataset.href; });
  });
}

function sparkline(points, f) {
  if (points.length < 2) return '<p class="small muted">Not enough samples.</p>';
  const W = 220; const H = 56; const pad = 6;
  const vals = points.map((p) => p.v);
  const lo = Math.min(...vals); const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const y = (v) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const base = points.filter((p) => !p.current);
  const path = base.map((p, i) => `${i ? 'L' : 'M'}${x(points.indexOf(p)).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${h(f.label)} across ${points.length} samples: ${points.map((p) => `${fmtNum(p.v, f.digits)}${p.current ? ' (under review)' : ''}`).join(', ')}">
    <path class="s-line" d="${path}"/>
    ${points.map((p, i) => p.current ? `<circle class="s-cur" cx="${x(i)}" cy="${y(p.v)}" r="4.5"><title>${h(p.title)}: ${h(withUnit(p.v, f))} (under review)</title></circle>` : `<circle class="s-dot" cx="${x(i)}" cy="${y(p.v)}" r="3"><title>${h(p.title)}: ${h(withUnit(p.v, f))}</title></circle>`).join('')}
  </svg>`;
}

export function renderStudent(app, id) {
  const s = store.student(id);
  if (!s) { app.innerHTML = '<p class="notice">Student not found. <a href="#/students">Back</a></p>'; return; }
  const cfg = store.config();
  const all = store.samplesOf(id).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const base = all.filter((x) => x.role === 'baseline' && x.include !== false && x.authentic !== false);
  const suff = sufficiency(base.length, new Set(base.map((x) => x.genre)).size, cfg);
  const feats = all.map((smp) => ({ smp, f: extractFeatures(smp, { taughtTerms: store.assignment(smp.assignment_id)?.taughtTerms || [], config: cfg }) }));

  app.innerHTML = `
    <div class="crumb"><a href="#/students">Students</a> / ${h(s.id)}</div>
    <div class="page-head"><div><h1>${nameOf(s)}</h1><p>${h(s.id)}${s.gradeLevel ? ` · grade ${h(s.gradeLevel)}` : ''} · ${plural(base.length, 'baseline sample')}${base.length ? ` (${h(genreCounts(base))})` : ''}</p></div>
      <div class="btn-row"><a class="btn btn-primary" href="#/add?student=${encodeURIComponent(id)}&role=baseline">Add baseline writing</a><a class="btn" href="#/add?student=${encodeURIComponent(id)}&role=current">Add a piece to review</a></div></div>

    <div class="cols">
      <section class="sheet sheet-pad">
        <h2>Student writing profile</h2>
        <p><strong>${h(suff.label)}.</strong> ${h(suff.message)}</p>
        <p class="small muted">At least ${cfg.baseline.minimumSamples} samples are needed for any comparison; ${cfg.baseline.preferredSamples}–${cfg.baseline.strongSamples - 1} are preferred; ${cfg.baseline.strongSamples}+ across several kinds of writing make a strong longitudinal profile. When comparing a new piece, earlier samples count more when they match its genre and conditions.</p>
      </section>
      <section class="sheet sheet-pad">
        <h2>Context</h2>
        <form id="ctx" class="stack">
          <div class="fields"><div class="field"><label for="dn">Name (optional)</label><input type="text" id="dn" name="displayName" value="${h(s.displayName || '')}"></div>
            <div class="field"><label for="gl">Grade</label><input type="text" id="gl" name="gradeLevel" value="${h(s.gradeLevel || '')}"></div></div>
          <div class="checks">${CONTEXT_FLAGS.map(([k, l]) => `<label class="check"><input type="checkbox" name="${k}" ${s.context?.[k] ? 'checked' : ''}> ${h(l)}</label>`).join('')}</div>
          <div class="field"><label for="sn">Notes</label><textarea id="sn" name="notes" rows="2">${h(s.notes || '')}</textarea></div>
          <div class="btn-row"><button class="btn btn-sm">Save</button><span class="small muted">Context flags reduce the weight of related findings and are named wherever they apply.</span></div>
        </form>
      </section>
    </div>

    <section class="sheet" style="margin-top:16px">
      <div class="sheet-head"><h2>Writing over time</h2><span class="small muted">Filled dots: baseline samples · open circles: pieces under review</span></div>
      <div class="sheet-pad"><div class="sparks">${TREND_FEATURES.map((fid) => {
        const f = FEATURE_BY_ID[fid];
        const pts = feats.filter((x) => x.f.values[fid] != null && (x.smp.role === 'current' || (x.smp.include !== false && x.smp.authentic !== false))).map((x) => ({ v: x.f.values[fid], current: x.smp.role === 'current', title: x.smp.title || fmtDate(x.smp.timestamp) }));
        return `<div class="spark"><div class="small"><strong>${h(f.label)}</strong></div><div class="small muted">${h(f.unit)}</div>${sparkline(pts, f)}</div>`;
      }).join('')}</div>
      <p class="small muted">A steady rise across several samples is treated as development; a sudden jump after a stable history is treated as an anomaly worth reviewing.</p></div>
    </section>

    <section class="sheet" style="margin-top:16px">
      <div class="sheet-head"><h2>Writing samples</h2><span class="small muted">Only samples marked authentic and included form the baseline</span></div>
      ${all.length ? `<div class="table-wrap"><table class="table">
        <thead><tr><th>Title</th><th>Date</th><th>Kind</th><th class="num">Words</th><th>Process data</th><th>Role</th><th>Authentic</th><th>Include</th><th></th></tr></thead>
        <tbody>${all.map((x) => `<tr>
          <td>${x.role === 'current' ? `<a href="#/piece/${encodeURIComponent(x.id)}">${h(x.title || 'Untitled')}</a>` : `<details><summary>${h(x.title || 'Untitled')}</summary><div class="serif" style="white-space:pre-wrap;max-height:240px;overflow:auto;font-size:14px;margin-top:6px">${h(x.text)}</div></details>`}</td>
          <td class="small">${h(fmtDate(x.timestamp))}</td>
          <td class="small">${h(x.genre || '')}${x.timed ? ' · timed' : ''}</td>
          <td class="num">${x.word_count ?? ''}</td>
          <td class="small">${x.process_data?.log ? 'writing log' : x.process_data?.report ? 'report' : '—'}</td>
          <td class="small">${x.role === 'current' ? 'under review' : 'baseline'}</td>
          <td>${x.role === 'baseline' ? `<input type="checkbox" data-flag="authentic" data-id="${h(x.id)}" ${x.authentic !== false ? 'checked' : ''} aria-label="Authentic">` : ''}</td>
          <td>${x.role === 'baseline' ? `<input type="checkbox" data-flag="include" data-id="${h(x.id)}" ${x.include !== false ? 'checked' : ''} aria-label="Include in baseline">` : ''}</td>
          <td><button class="btn btn-sm btn-quiet" data-del="${h(x.id)}">Delete</button></td>
        </tr>`).join('')}</tbody></table></div>` : '<p class="empty">No writing yet.</p>'}
    </section>

    <section class="sheet sheet-pad" style="margin-top:16px">
      <h2>Delete this student’s profile</h2>
      <p class="small muted">Removes all writing samples, process data, notes and annotations for ${h(s.id)} from this browser. This cannot be undone.</p>
      <button class="btn" data-action="delete-student">Delete entire profile…</button>
    </section>`;

  app.querySelector('#ctx').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    store.saveStudent({ id, displayName: fd.get('displayName').trim(), gradeLevel: fd.get('gradeLevel').trim(), notes: fd.get('notes'), context: Object.fromEntries(CONTEXT_FLAGS.map(([k]) => [k, fd.get(k) === 'on'])) });
    toast('Saved.');
    renderStudent(app, id);
  });
  app.querySelectorAll('[data-flag]').forEach((cb) => cb.addEventListener('change', () => {
    const smp = store.sample(cb.dataset.id);
    store.saveSample({ ...smp, [cb.dataset.flag]: cb.checked });
    renderStudent(app, id);
  }));
  app.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Delete this piece of writing and its notes?')) return;
    store.deleteSample(b.dataset.del);
    renderStudent(app, id);
  }));
  app.querySelector('[data-action="delete-student"]').addEventListener('click', () => {
    const typed = prompt(`To delete the entire profile, type the student ID (${s.id}):`);
    if (typed !== s.id) { if (typed != null) toast('ID did not match; nothing deleted.'); return; }
    store.deleteStudent(id);
    toast('Profile deleted.');
    location.hash = '#/students';
  });
}
