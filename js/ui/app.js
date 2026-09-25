// Entry point: unlock (if the store is encrypted), then route.

import * as store from '../store.js';
import { escapeHtml as h } from '../util.js';
import { renderClass } from './classView.js';
import { renderStudents, renderStudent } from './studentView.js';
import { renderPiece } from './pieceView.js';
import { renderConference } from './conferenceView.js';
import { renderReport } from './reportView.js';
import { renderAdd } from './addView.js';
import { renderAssignments, renderAssignment } from './assignmentView.js';
import { renderSettings } from './settingsView.js';
import { renderPrivacy } from './privacyView.js';
import { renderAbout } from './aboutView.js';

const app = document.getElementById('app');

const routes = [
  [/^#?\/?$/, 'class', () => renderClass(app)],
  [/^#\/students$/, 'students', () => renderStudents(app)],
  [/^#\/student\/([^/?]+)$/, 'students', (id) => renderStudent(app, id)],
  [/^#\/piece\/([^/?]+)(?:\?tab=(\w+))?$/, 'class', (id, tab) => renderPiece(app, id, tab)],
  [/^#\/conference\/([^/?]+)$/, 'class', (id) => renderConference(app, id)],
  [/^#\/report\/([^/?]+)$/, 'class', (id) => renderReport(app, id)],
  [/^#\/add(?:\?(.*))?$/, 'add', (q) => renderAdd(app, new URLSearchParams(q || ''))],
  [/^#\/assignments$/, 'assignments', () => renderAssignments(app)],
  [/^#\/assignment\/([^/?]+)$/, 'assignments', (id) => renderAssignment(app, id)],
  [/^#\/settings$/, 'settings', () => renderSettings(app)],
  [/^#\/privacy$/, 'privacy', () => renderPrivacy(app)],
  [/^#\/about$/, 'about', () => renderAbout(app)],
];

function route() {
  const hash = location.hash || '#/';
  for (const [re, nav, render] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    document.querySelectorAll('[data-nav]').forEach((a) => { if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    try {
      render(...m.slice(1).map((x) => (x == null ? x : decodeURIComponent(x))));
    } catch (err) {
      console.error(err);
      app.innerHTML = `<p class="notice">Something went wrong on this page: ${h(err.message)}</p>`;
    }
    return;
  }
  location.hash = '#/';
}

function showUnlock() {
  app.innerHTML = `
    <div class="sheet sheet-pad" style="max-width:460px;margin:40px auto">
      <h1>Locked</h1>
      <p class="muted">Student writing on this device is encrypted. Enter the passphrase to open it.</p>
      <form id="unlock" class="stack">
        <div class="field"><label for="pp">Passphrase</label><input type="password" id="pp" autocomplete="current-password" required></div>
        <p class="notice" id="err" hidden>That passphrase did not work.</p>
        <button class="btn btn-primary">Unlock</button>
      </form>
    </div>`;
  app.querySelector('#unlock').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await store.unlock(app.querySelector('#pp').value);
    if (ok) start(); else app.querySelector('#err').hidden = false;
  });
}

function start() {
  window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
  route();
}

if (store.init() === 'locked') showUnlock(); else start();
