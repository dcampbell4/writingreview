// Privacy: local-only storage, IDs instead of names, passphrase encryption,
// export and deletion.

import * as store from '../store.js';
import { toast, download } from './common.js';
import { escapeHtml as h } from '../util.js';

export function renderPrivacy(app) {
  app.innerHTML = `
    <div class="page-head"><div><h1>Privacy</h1><p>Student writing is sensitive. This app is designed so that it never needs to leave your computer.</p></div></div>
    <div class="cols">
      <section class="sheet sheet-pad stack">
        <h2>How data is handled</h2>
        <ul>
          <li>All analysis runs <strong>in this browser</strong>. No student writing is sent to any server or external AI service, and nothing is used for training.</li>
          <li>Data is stored only in this browser’s local storage, on this device. Clearing browser data removes it.</li>
          <li>The app loads no fonts, trackers or scripts from other websites.</li>
          <li>Students are identified by ID. Names are optional and can be hidden everywhere.</li>
        </ul>
        <label class="check"><input type="checkbox" id="hide" ${store.get().hideNames ? 'checked' : ''}> Show student IDs only (hide names)</label>
      </section>
      <section class="sheet sheet-pad stack">
        <h2>Passphrase lock</h2>
        <p class="small">${store.isEncrypted() ? '<strong>On.</strong> Data on this device is encrypted (AES-256). The passphrase is needed each time the app opens.' : 'Off. Anyone using this browser profile could open the data.'}</p>
        <div class="field"><label for="pp">${store.isEncrypted() ? 'Change passphrase' : 'Set a passphrase'}</label><input type="password" id="pp" autocomplete="new-password" placeholder="At least 8 characters"></div>
        <div class="btn-row"><button class="btn btn-primary" data-a="lock">${store.isEncrypted() ? 'Change passphrase' : 'Encrypt with passphrase'}</button>${store.isEncrypted() ? '<button class="btn" data-a="unlockoff">Remove encryption</button><button class="btn" data-a="locknow">Lock now</button>' : ''}</div>
        <p class="small muted">There is no way to recover a forgotten passphrase. Export a backup first.</p>
      </section>
      <section class="sheet sheet-pad stack">
        <h2>Export and import</h2>
        <p class="small">A backup file contains all students, writing and notes${store.isEncrypted() ? ' <strong>unencrypted</strong>' : ''}. Store it securely.</p>
        <div class="btn-row"><button class="btn" data-a="export">Export all data</button><label class="btn" for="imp">Import…</label><input type="file" id="imp" accept=".json" hidden></div>
      </section>
      <section class="sheet sheet-pad stack">
        <h2>Deleting data</h2>
        <p class="small">To delete one student’s entire writing profile, open the student and use <em>Delete entire profile</em>.</p>
        <div class="btn-row"><button class="btn" data-a="demo">Reset to demo class</button><button class="btn" data-a="clear">Delete all data</button></div>
      </section>
    </div>`;
  const $ = (s) => app.querySelector(s);
  $('#hide').addEventListener('change', (e) => { store.setHideNames(e.target.checked); toast('Saved.'); });
  $('[data-a="lock"]').addEventListener('click', async () => {
    const pp = $('#pp').value;
    if (pp.length < 8) { toast('Use at least 8 characters.'); return; }
    await store.setPassphrase(pp);
    toast('Encrypted.');
    renderPrivacy(app);
  });
  $('[data-a="unlockoff"]')?.addEventListener('click', async () => { if (!confirm('Store data unencrypted on this device?')) return; await store.setPassphrase(''); renderPrivacy(app); });
  $('[data-a="locknow"]')?.addEventListener('click', () => { store.lockNow(); location.reload(); });
  $('[data-a="export"]').addEventListener('click', () => download(`writing-profiles-${new Date().toISOString().slice(0, 10)}.json`, store.exportAll()));
  $('#imp').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try { store.importAll(JSON.parse(await f.text())); toast('Imported.'); } catch (err) { alert(`Import failed: ${err.message}`); }
  });
  $('[data-a="demo"]').addEventListener('click', () => { if (confirm('Replace everything with the fictional demo class?')) { store.resetDemo(); toast('Demo class restored.'); } });
  $('[data-a="clear"]').addEventListener('click', () => { if (confirm('Delete ALL students, writing, notes and settings from this browser? Export first if you need a copy.')) { store.clearAll(); toast('All data deleted.'); location.hash = '#/'; } });
}
