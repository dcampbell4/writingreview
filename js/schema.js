// Writing-process event schema (see DESIGN.md §3): validation and normalisation.

import { parseProcessReport, flattenJson } from './import/processReport.js';

export const EVENT_TYPES = ['insert', 'paste', 'delete', 'replace', 'snapshot', 'focus', 'blur', 'submit', 'session-start', 'session-end'];
export const TEXT_CHANGING = new Set(['insert', 'paste', 'delete', 'replace', 'snapshot']);

export function toMillis(t) {
  if (typeof t === 'number') return t;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

// Returns { log, problems } where log.events are sorted, numbered and typed.
export function normalizeLog(raw) {
  const problems = [];
  if (!raw) return { log: null, problems };
  const list = Array.isArray(raw) ? raw : raw.events;
  if (!Array.isArray(list)) {
    problems.push('The log has no "events" array.');
    return { log: null, problems };
  }
  const events = [];
  list.forEach((e, i) => {
    const t = toMillis(e.t ?? e.time ?? e.timestamp);
    const type = String(e.type || '').toLowerCase();
    if (t === null) return problems.push(`Event ${i + 1}: missing or invalid time.`);
    if (!EVENT_TYPES.includes(type)) return problems.push(`Event ${i + 1}: unknown type "${e.type}".`);
    const ev = { t, type, source: i };
    if (type === 'insert' || type === 'paste' || type === 'replace') {
      if (typeof e.text !== 'string') return problems.push(`Event ${i + 1}: "${type}" needs text.`);
      ev.text = e.text;
    }
    if (type === 'snapshot') {
      if (typeof e.text !== 'string') return problems.push(`Event ${i + 1}: snapshot needs text.`);
      ev.text = e.text;
    }
    if (type === 'insert' || type === 'paste' || type === 'delete' || type === 'replace') {
      ev.pos = Number(e.pos);
      if (!Number.isInteger(ev.pos) || ev.pos < 0) return problems.push(`Event ${i + 1}: invalid position.`);
    }
    if (type === 'delete' || type === 'replace') {
      ev.length = Number(e.length);
      if (!Number.isInteger(ev.length) || ev.length < 0) return problems.push(`Event ${i + 1}: invalid length.`);
    }
    events.push(ev);
  });
  events.sort((a, b) => a.t - b.t || a.source - b.source);
  events.forEach((e, i) => { e.id = i; });
  return { log: { startedAt: toMillis(raw.startedAt) ?? events[0]?.t ?? null, events }, problems };
}

const TIME_KEYS = ['t', 'time', 'timestamp', 'date', 'datetime', 'createdAt', 'created', 'modifiedTime', 'modified', 'updatedAt', 'savedAt'];
const TEXT_KEYS = ['text', 'content', 'body', 'snapshot', 'documentText', 'plainText'];
const pick = (obj, keys) => { for (const k of keys) if (obj[k] != null) return obj[k]; return undefined; };

// Finds an array of revisions/snapshots ({time, text}) anywhere near the top level.
function findRevisionArray(data) {
  const candidates = Array.isArray(data) ? [data] : Object.values(data).filter(Array.isArray);
  for (const arr of candidates) {
    const good = arr.filter((x) => x && typeof x === 'object' && pick(x, TIME_KEYS) != null && typeof pick(x, TEXT_KEYS) === 'string');
    if (good.length >= 2 && good.length >= arr.length * 0.8) return good;
  }
  return null;
}

// Accepts: an exported bundle, a writing-process log (this app's format),
// a list of revisions/snapshots, or another tool's report (read like a PDF report).
export function parseImport(json, { fileName = '' } = {}) {
  let data = json;
  if (typeof json === 'string') {
    const cleaned = json.replace(/^\uFEFF/, '').trim();
    try {
      data = JSON.parse(cleaned);
    } catch (err) {
      throw new Error(`This file is not valid JSON (${err.message}). If it is a PDF report, choose the PDF instead.`);
    }
  }
  if (data == null || typeof data !== 'object') throw new Error('This JSON file does not contain an object or list.');
  if (!Array.isArray(data) && (data.submissions || data.students || data.samples)) return { kind: 'bundle', data };

  const base = Array.isArray(data) ? {} : data;
  const meta = {
    studentName: base.student || base.studentName || base.author || base.owner || base.name || null,
    assignment: base.assignment || base.title || base.documentTitle || base.document || null,
  };
  const events = Array.isArray(data) ? data : data.events || data.log?.events;
  if (Array.isArray(events) && events.some((e) => e && EVENT_TYPES.includes(String(e.type || '').toLowerCase()))) {
    return {
      kind: 'submission',
      data: {
        ...meta,
        studentName: meta.studentName || 'Unknown student',
        assignment: meta.assignment || 'Untitled assignment',
        date: base.date || new Date(toMillis(base.startedAt) || Date.now()).toISOString(),
        finalText: base.finalText || null,
        log: data.log || { startedAt: base.startedAt, events },
      },
    };
  }
  const revisions = findRevisionArray(data);
  if (revisions) {
    const snapshots = revisions.map((r) => ({ t: pick(r, TIME_KEYS), type: 'snapshot', text: pick(r, TEXT_KEYS) }));
    return {
      kind: 'submission',
      data: {
        ...meta,
        studentName: meta.studentName || 'Unknown student',
        assignment: meta.assignment || 'Untitled assignment',
        date: new Date(toMillis(snapshots[snapshots.length - 1].t) || Date.now()).toISOString(),
        finalText: null,
        log: { events: snapshots },
        note: `Read ${snapshots.length} saved versions (snapshots).`,
      },
    };
  }
  // Anything else: treat it as another tool's process report.
  const report = parseProcessReport(flattenJson(data).join('\n'), { fileName });
  if (!Object.keys(report.metrics).length && !report.pastes.length) {
    const keys = Array.isArray(data) ? `a list of ${data.length} items` : `the fields ${Object.keys(data).slice(0, 8).join(', ')}`;
    throw new Error(`The file was read, but it contains ${keys}, and no writing events, saved versions or process figures were recognised. Please share an example so support can be added.`);
  }
  return { kind: 'report', data: { ...report, studentName: meta.studentName || report.student, assignment: meta.assignment || report.title } };
}
