// Entry point: hash router. Each view renders into #app and wires its own events.

import * as store from '../store.js';
import { renderDashboard } from './dashboard.js';
import { renderSubmission, renderReport } from './submissionView.js';
import { renderStudents, renderStudent } from './students.js';
import { renderSettings } from './settings.js';
import { renderNewSubmission } from './newSubmission.js';
import { renderAbout } from './about.js';

const app = document.getElementById('app');

const routes = [
  [/^#?\/?$/, 'dashboard', () => renderDashboard(app)],
  [/^#\/submission\/([^/]+)$/, 'dashboard', (id) => renderSubmission(app, decodeURIComponent(id))],
  [/^#\/report\/([^/]+)$/, 'dashboard', (id) => renderReport(app, decodeURIComponent(id))],
  [/^#\/students$/, 'students', () => renderStudents(app)],
  [/^#\/student\/([^/]+)$/, 'students', (id) => renderStudent(app, decodeURIComponent(id))],
  [/^#\/new$/, 'new', () => renderNewSubmission(app)],
  [/^#\/settings$/, 'settings', () => renderSettings(app)],
  [/^#\/about$/, 'about', () => renderAbout(app)],
];

function route() {
  const hash = location.hash || '#/';
  for (const [re, nav, render] of routes) {
    const m = hash.match(re);
    if (!m) continue;
    document.querySelectorAll('[data-nav]').forEach((a) => {
      if (a.dataset.nav === nav) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    try {
      render(...m.slice(1));
    } catch (err) {
      console.error(err);
      app.innerHTML = `<p class="notice">Something went wrong while rendering this page: ${err.message}</p>`;
    }
    return;
  }
  location.hash = '#/';
}

store.init();
window.addEventListener('hashchange', () => { route(); window.scrollTo(0, 0); });
route();
