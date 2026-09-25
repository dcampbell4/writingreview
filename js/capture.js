// Writing capture: records insert / delete / replace / paste events in the
// schema described in DESIGN.md §3. Drafts autosave in this browser.

import { diff } from './process/replay.js';
import { countWords } from './text/tokenize.js';

const KEY = 'writing-capture:draft';
const editor = document.getElementById('editor');
const nameEl = document.getElementById('c-name');
const assignEl = document.getElementById('c-assign');
const wordsEl = document.getElementById('c-words');
const eventsEl = document.getElementById('c-events');
const savedEl = document.getElementById('c-saved');

let session = load() || fresh();
let prev = session.text;
let pendingType = null;
editor.value = session.text;
nameEl.value = session.student || '';
assignEl.value = session.assignment || '';
updateStatus();

function fresh() {
  return { startedAt: new Date().toISOString(), events: [{ t: Date.now(), type: 'session-start' }], text: '', student: '', assignment: '' };
}
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}
let saveTimer;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    session.text = editor.value;
    session.student = nameEl.value;
    session.assignment = assignEl.value;
    try { localStorage.setItem(KEY, JSON.stringify(session)); savedEl.textContent = 'Draft saved in this browser'; } catch { savedEl.textContent = 'Could not save draft: download your log before closing'; }
  }, 400);
}
function updateStatus() {
  const n = countWords(editor.value);
  wordsEl.textContent = `${n} word${n === 1 ? '' : 's'}`;
  eventsEl.textContent = `${session.events.length} events recorded`;
}

function push(ev) {
  const events = session.events;
  const last = events[events.length - 1];
  // Merge consecutive keystrokes so the log stays compact.
  if (ev.type === 'insert' && last?.type === 'insert' && ev.pos === last.pos + last.text.length && ev.t - last.t < 2000 && last.text.length < 60) {
    last.text += ev.text; last.t = ev.t; return;
  }
  if (ev.type === 'delete' && last?.type === 'delete' && ev.t - last.t < 2000) {
    if (ev.pos + ev.length === last.pos) { last.pos = ev.pos; last.length += ev.length; last.t = ev.t; return; }
    if (ev.pos === last.pos) { last.length += ev.length; last.t = ev.t; return; }
  }
  events.push(ev);
}

editor.addEventListener('beforeinput', (e) => { pendingType = e.inputType; });
editor.addEventListener('input', () => {
  const now = editor.value;
  const d = diff(prev, now);
  if (d) {
    const t = Date.now();
    const isPaste = pendingType === 'insertFromPaste' || pendingType === 'insertFromDrop' || pendingType === 'insertFromPasteAsQuotation';
    if (isPaste) {
      if (d.removed) push({ t, type: 'delete', pos: d.pos, length: d.removed });
      push({ t, type: 'paste', pos: d.pos, text: d.inserted });
    } else if (d.removed && d.inserted) push({ t, type: 'replace', pos: d.pos, length: d.removed, text: d.inserted });
    else if (d.removed) push({ t, type: 'delete', pos: d.pos, length: d.removed });
    else push({ t, type: 'insert', pos: d.pos, text: d.inserted });
  }
  prev = now;
  pendingType = null;
  updateStatus();
  save();
});
editor.addEventListener('focus', () => { session.events.push({ t: Date.now(), type: 'focus' }); });
editor.addEventListener('blur', () => { session.events.push({ t: Date.now(), type: 'blur' }); save(); });
[nameEl, assignEl].forEach((el) => el.addEventListener('input', save));

function finalLog() {
  const events = [...session.events, { t: Date.now(), type: 'submit' }];
  return {
    schema: 'writing-process-log', version: 1,
    student: nameEl.value || 'Unnamed', assignment: assignEl.value || 'Untitled',
    startedAt: session.startedAt, date: new Date().toISOString(),
    finalText: editor.value, events,
  };
}

document.getElementById('c-finish').addEventListener('click', () => {
  const log = finalLog();
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(log.student || 'writing').replace(/\W+/g, '-')}-writing-log.json`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
});

document.getElementById('c-add').addEventListener('click', async () => {
  const store = await import('./store.js');
  if (store.init() === 'locked') { alert('The review tool on this device is locked with a passphrase. Download the log and import it from the review tool instead.'); return; }
  const log = finalLog();
  const name = log.student.trim();
  let student = store.students().find((s) => s.displayName?.toLowerCase() === name.toLowerCase() || s.id.toLowerCase() === name.toLowerCase());
  if (!student) student = store.saveStudent({ id: store.nextStudentId(), displayName: name, context: {}, notes: '' });
  const id = store.newId('smp');
  store.saveSample({ id, student_id: student.id, assignment_id: null, role: 'current', title: log.assignment, timestamp: log.date, genre: 'Other', subject: '', assignment_type: '', timed: false, text: log.finalText, process_data: { log: { startedAt: log.startedAt, events: log.events } }, include: true, authentic: true });
  location.href = `index.html#/add?sample=${encodeURIComponent(id)}`;
});

document.getElementById('c-reset').addEventListener('click', () => {
  if (!confirm('Clear this draft and its recorded log? Download it first if you need it.')) return;
  session = fresh(); prev = ''; editor.value = '';
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  updateStatus();
});
