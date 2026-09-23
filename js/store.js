// Local persistence. Everything is stored in this browser only (localStorage);
// nothing is sent anywhere. Teachers can export/import a JSON bundle.

import { mergeConfig } from './config.js';
import { buildDemo } from './demo/demoData.js';

const KEY = 'writing-review:v1';

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let state = read();
let persistent = true;

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    persistent = true;
  } catch {
    persistent = false; // private mode or storage full: keep working in memory
  }
}

export function init() {
  if (!state) {
    state = { ...buildDemo(), annotations: {}, config: null, submissionNotes: {}, demo: true };
    save();
  }
  return state;
}

export const isPersistent = () => persistent;
export const getState = () => state;
export const getConfig = () => mergeConfig(state.config);
export function setConfig(cfg) { state.config = cfg; save(); }
export function resetConfig() { state.config = null; save(); }

export const students = () => state.students;
export const student = (id) => state.students.find((s) => s.id === id);
export const samplesFor = (studentId) => state.samples.filter((s) => s.studentId === studentId);
export const submissions = () => state.submissions;
export const submission = (id) => state.submissions.find((s) => s.id === id);

export function upsert(collection, item) {
  const list = state[collection];
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item);
  save();
  return item;
}

export function remove(collection, id) {
  state[collection] = state[collection].filter((x) => x.id !== id);
  if (collection === 'students') {
    state.samples = state.samples.filter((s) => s.studentId !== id);
    state.submissions = state.submissions.filter((s) => s.studentId !== id);
  }
  save();
}

export function annotationsFor(submissionId) {
  return state.annotations[submissionId] || {};
}

export function annotate(submissionId, signalId, patch) {
  const all = (state.annotations[submissionId] ||= {});
  all[signalId] = { ...(all[signalId] || { status: 'open', note: '' }), ...patch, updatedAt: new Date().toISOString() };
  save();
}

export function submissionNote(id) { return state.submissionNotes?.[id] || ''; }
export function setSubmissionNote(id, note) { (state.submissionNotes ||= {})[id] = note; save(); }

export function findOrCreateStudent(name) {
  const existing = state.students.find((s) => s.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (existing) return existing;
  return upsert('students', { id: `stu-${Date.now().toString(36)}`, name: name.trim(), context: {}, notes: '' });
}

export function exportBundle() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
}

export function importBundle(data) {
  for (const key of ['students', 'samples', 'submissions']) {
    for (const item of data[key] || []) upsert(key, item);
  }
  if (data.annotations) state.annotations = { ...state.annotations, ...data.annotations };
  save();
}

export function resetDemo() {
  state = { ...buildDemo(), annotations: {}, config: state?.config ?? null, submissionNotes: {}, demo: true };
  save();
}

export function clearAll() {
  state = { students: [], samples: [], submissions: [], annotations: {}, config: state?.config ?? null, submissionNotes: {}, demo: false };
  save();
}
