// Local, private storage. Everything stays in this browser (localStorage).
// Optionally the whole store is encrypted with a teacher passphrase
// (AES-GCM, key derived with PBKDF2); without the passphrase it cannot be read.

import { mergeConfig } from './config.js';
import { buildDemo } from './demo/demoData.js';
import { countWords } from './text/tokenize.js';

const KEY = 'writing-profiles:v2';
let state = null;
let cryptoKey = null; // present while unlocked
let salt = null;
let persistent = true;
const listeners = new Set();

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, saltBytes) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

function readRaw() {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
function writeRaw(v) {
  try { localStorage.setItem(KEY, v); persistent = true; } catch { persistent = false; }
}

let saving = Promise.resolve();
function save() {
  listeners.forEach((fn) => fn());
  const json = JSON.stringify(state);
  if (!cryptoKey) { writeRaw(json); return; }
  saving = saving.then(async () => {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, enc.encode(json));
    writeRaw(JSON.stringify({ encrypted: true, salt: b64(salt), iv: b64(iv), data: b64(data) }));
  });
}

export const onChange = (fn) => listeners.add(fn);
export const isPersistent = () => persistent;
export const isEncrypted = () => Boolean(cryptoKey);

// Returns 'ready' or 'locked'.
export function init() {
  const raw = readRaw();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.encrypted) return 'locked';
      state = parsed;
    } catch { state = null; }
  }
  if (!state) { state = fresh(true); save(); }
  return 'ready';
}

export async function unlock(passphrase) {
  const parsed = JSON.parse(readRaw());
  salt = unb64(parsed.salt);
  const key = await deriveKey(passphrase, salt);
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(parsed.iv) }, key, unb64(parsed.data));
    state = JSON.parse(dec.decode(plain));
    cryptoKey = key;
    return true;
  } catch {
    return false;
  }
}

export async function setPassphrase(passphrase) {
  if (!passphrase) { cryptoKey = null; salt = null; save(); return; }
  salt = crypto.getRandomValues(new Uint8Array(16));
  cryptoKey = await deriveKey(passphrase, salt);
  save();
  await saving;
}

export function lockNow() { cryptoKey = null; state = null; }

function fresh(withDemo) {
  const base = withDemo ? buildDemo() : { students: [], assignments: [], samples: [] };
  return { version: 2, ...base, annotations: {}, notes: {}, settings: null, hideNames: false, demo: withDemo };
}

export const get = () => state;
export const config = () => mergeConfig(state.settings);
export function setSettings(s) { state.settings = s; save(); }
export function setHideNames(v) { state.hideNames = v; save(); }

export const students = () => state.students;
export const student = (id) => state.students.find((s) => s.id === id);
export const assignments = () => state.assignments;
export const assignment = (id) => state.assignments.find((a) => a.id === id);
export const samples = () => state.samples;
export const sample = (id) => state.samples.find((s) => s.id === id);
export const samplesOf = (studentId) => state.samples.filter((s) => s.student_id === studentId);
export const currentSamples = () => state.samples.filter((s) => s.role === 'current');

export function displayName(s) {
  if (!s) return 'Unknown';
  return state.hideNames || !s.displayName ? s.id : `${s.displayName}`;
}

// Baseline for analysing `sample`: the student's included authentic samples,
// other than the sample itself, written no later than it.
export function baselineFor(smp) {
  return state.samples.filter((s) => s.student_id === smp.student_id && s.id !== smp.id && s.role === 'baseline' && s.include !== false && s.authentic !== false && (!smp.timestamp || !s.timestamp || s.timestamp <= smp.timestamp));
}

function upsert(collection, item) {
  const list = state[collection];
  const i = list.findIndex((x) => x.id === item.id);
  if (i >= 0) list[i] = { ...list[i], ...item }; else list.push(item);
  save();
  return list[i >= 0 ? i : list.length - 1];
}

export const saveStudent = (s) => upsert('students', s);
export const saveAssignment = (a) => upsert('assignments', a);
export function saveSample(s) {
  return upsert('samples', { ...s, word_count: countWords(s.text || '') });
}

export function nextStudentId() {
  const nums = state.students.map((s) => Number(String(s.id).replace(/\D/g, ''))).filter(Number.isFinite);
  return `S-${String((nums.length ? Math.max(...nums) : 1000) + 1).padStart(4, '0')}`;
}
export const newId = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export function deleteSample(id) {
  state.samples = state.samples.filter((s) => s.id !== id);
  delete state.annotations[id];
  delete state.notes[id];
  save();
}

// Removes a student's entire writing profile: samples, notes and annotations.
export function deleteStudent(id) {
  const ids = new Set(state.samples.filter((s) => s.student_id === id).map((s) => s.id));
  state.samples = state.samples.filter((s) => s.student_id !== id);
  ids.forEach((sid) => { delete state.annotations[sid]; delete state.notes[sid]; });
  state.students = state.students.filter((s) => s.id !== id);
  save();
}

export function annotations(sampleId) { return state.annotations[sampleId] || {}; }
export function annotate(sampleId, key, patch) {
  const all = (state.annotations[sampleId] ||= {});
  all[key] = { ...(all[key] || { status: 'open', note: '' }), ...patch, updatedAt: new Date().toISOString() };
  save();
}
export const note = (sampleId) => state.notes[sampleId] || '';
export function setNote(sampleId, text) { state.notes[sampleId] = text; save(); }

export function exportAll() { return JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2); }
export function importAll(data) {
  if (!Array.isArray(data.samples) || !Array.isArray(data.students)) throw new Error('This is not an export from this app.');
  for (const k of ['students', 'assignments', 'samples']) for (const item of data[k] || []) upsert(k, item);
  Object.assign(state.annotations, data.annotations || {});
  Object.assign(state.notes, data.notes || {});
  save();
}
export function resetDemo() { const keep = state?.settings ?? null; state = fresh(true); state.settings = keep; save(); }
export function clearAll() { const keep = state?.settings ?? null; state = fresh(false); state.settings = keep; save(); }
