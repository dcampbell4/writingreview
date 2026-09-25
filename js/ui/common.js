// Shared UI helpers: running analyses, level display, small widgets.

import * as store from '../store.js';
import { analyze } from '../analysis/run.js';
import { escapeHtml as h } from '../util.js';

let version = 0;
const cache = new Map();
store.onChange(() => { version++; });

export function resultFor(sampleId) {
  const smp = store.sample(sampleId);
  if (!smp) return null;
  const hit = cache.get(sampleId);
  if (hit && hit.version === version) return hit.result;
  const ann = store.annotations(sampleId);
  const dismissed = new Set(Object.entries(ann).filter(([, a]) => a.status === 'dismissed').map(([k]) => k));
  const assignmentsById = Object.fromEntries(store.assignments().map((a) => [a.id, a]));
  const result = analyze({
    sample: smp,
    student: store.student(smp.student_id),
    baseline: store.baselineFor(smp),
    assignment: smp.assignment_id ? store.assignment(smp.assignment_id) : null,
    assignmentsById,
    config: store.config(),
    dismissed,
  });
  cache.set(sampleId, { version, result });
  return result;
}

export function levelHtml(level, segments) {
  if (level === 'NOT ASSESSED' || level == null) return '<span class="level na"><span class="word">Not assessed</span></span>';
  const on = segments ?? { LOW: 2, MODERATE: 4, 'MODERATE-HIGH': 6, HIGH: 8, 'VERY HIGH': 10 }[level] ?? 0;
  return `<span class="level">${barHtml(on)}<span class="word">${h(level)}</span></span>`;
}

// Ten blocks; the level is always also written in words next to it.
export const barHtml = (on) => `<span class="blocks" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;

export const priorityHtml = (p) => `<span class="priority p-${h(p.replace(/\s/g, '-'))}">${h(p)}</span>`;

export function toast(msg) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2400);
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export const nameOf = (student) => h(store.displayName(student));

export function contextSummary(smp, a) {
  const bits = [smp.genre, smp.assignment_type && smp.assignment_type !== smp.genre ? smp.assignment_type : null, smp.subject, smp.timed ? 'timed' : 'untimed'];
  if (a) {
    if (a.inClass) bits.push('in class');
    if (a.researchAllowed) bits.push('research allowed');
    if (a.notesAllowed) bits.push('notes allowed');
    if (a.collaborationAllowed) bits.push('collaboration allowed');
    if (a.aiAllowed) bits.push('AI use permitted');
    if (a.sentenceFrames) bits.push('sentence frames given');
    if (a.modelEssay) bits.push('model essay studied');
  }
  return bits.filter(Boolean).join(' · ');
}

// Renders text with highlighted character ranges. `spans`: [{start, end, cls, title, prefix}]
export function highlightText(text, spans = [], paragraphs = null) {
  const sorted = [...spans].filter((s) => s.end > s.start).sort((a, b) => a.start - b.start || b.end - a.end);
  const paras = paragraphs || text.split(/\n/).reduce((acc, line) => {
    const start = acc.pos;
    acc.pos += line.length + 1;
    if (line.trim()) acc.list.push({ start, end: start + line.length });
    return acc;
  }, { pos: 0, list: [] }).list;
  return paras.map((p) => {
    let html = '';
    let pos = p.start;
    const inside = sorted.filter((s) => s.end > p.start && s.start < p.end);
    let lastEnd = p.start;
    for (const s of inside) {
      const a = Math.max(s.start, lastEnd, p.start);
      const b = Math.min(s.end, p.end);
      if (b <= a) continue;
      html += h(text.slice(pos, a));
      html += s.nomark
        ? `${s.prefix || ''}<span${s.cls ? ` class="${h(s.cls)}"` : ''}${s.title ? ` title="${h(s.title)}"` : ''}>${h(text.slice(a, b))}</span>`
        : `${s.prefix || ''}<mark class="${h(s.cls || '')}"${s.title ? ` title="${h(s.title)}"` : ''}>${h(text.slice(a, b))}</mark>`;
      pos = b;
      lastEnd = b;
    }
    html += h(text.slice(pos, p.end));
    return `<p>${html}</p>`;
  }).join('');
}
