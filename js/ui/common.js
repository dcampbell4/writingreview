// Shared UI helpers and the analysis cache.

import * as store from '../store.js';
import { analyzeSubmission, summarize, STATUS } from '../pipeline/analyze.js';
import { escapeHtml as h } from '../util.js';

let dataVersion = 0;
const cache = new Map();

export function invalidate() { dataVersion++; cache.clear(); }

// Runs (or reuses) the analysis for one submission and applies the current annotations.
export function getAnalysis(submissionId) {
  const sub = store.submission(submissionId);
  if (!sub) return null;
  let entry = cache.get(submissionId);
  if (!entry || entry.version !== dataVersion) {
    const config = store.getConfig();
    const result = analyzeSubmission({
      submission: sub,
      student: store.student(sub.studentId),
      samples: store.samplesFor(sub.studentId),
      config,
      annotations: store.annotationsFor(sub.id),
    });
    entry = { version: dataVersion, result, config };
    cache.set(submissionId, entry);
  }
  // Annotations can change without re-running detectors.
  const ann = store.annotationsFor(sub.id);
  for (const s of entry.result.signals) {
    s.status = ann[s.id]?.status || 'open';
    s.note = ann[s.id]?.note || '';
  }
  entry.result.summary = summarize(entry.result.signals, { rep: entry.result.replay, baseline: entry.result.baseline, config: entry.config, doc: entry.result.doc });
  return entry.result;
}

export const sevBadge = (sev) => sev ? `<span class="sev sev-${sev}">${h(sev)}</span>` : '<span class="sev sev-none">None</span>';

export function statusBadge(status) {
  const cls = status === STATUS.review ? 'status-review' : status === STATUS.some ? 'status-some' : 'status-none';
  return `<span class="status ${cls}">${h(status)}</span>`;
}

export function teacherStatus(result) {
  const reviewed = result.signals.filter((s) => s.status !== 'open').length;
  if (!result.signals.length) return '<span class="muted">—</span>';
  if (reviewed === result.signals.length) return '<span class="tag">All signals reviewed</span>';
  if (reviewed) return `<span class="tag">${reviewed} of ${result.signals.length} reviewed</span>`;
  return '<span class="muted small">Not reviewed</span>';
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'status');
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--surface);padding:8px 16px;border-radius:6px;font-size:14px;z-index:50;transition:opacity .2s';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2200);
}
