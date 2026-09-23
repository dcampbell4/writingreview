// Settings: every threshold is editable; plus data export/import and demo reset.

import * as store from '../store.js';
import { CONFIG_SCHEMA, DEFAULT_CONFIG } from '../config.js';
import { invalidate, download, readFile, toast } from './common.js';
import { parseImport } from '../schema.js';
import { escapeHtml as h } from '../util.js';

export function renderSettings(app) {
  const cfg = store.getConfig();
  app.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1>
      <p>All detection thresholds are listed here. Changes apply to every analysis in this browser. The rule used for each flag is shown alongside it on the submission page.</p></div>
      <div class="btn-row"><button class="btn" data-action="defaults">Restore defaults</button><button class="btn btn-primary" data-action="save">Save settings</button></div>
    </div>
    ${store.isPersistent() ? '' : '<p class="notice">This browser is not allowing storage, so changes will be lost when the page closes. Use Export to keep a copy.</p>'}
    <form id="cfg" class="grid-2">
      ${CONFIG_SCHEMA.map((sec) => `<section class="card card-pad">
        <h2>${h(sec.title)}</h2>
        <div style="margin-top:10px">
        ${sec.fields.map(([key, label]) => {
          const val = cfg[sec.section][key];
          const def = DEFAULT_CONFIG[sec.section][key];
          return `<div class="field"><label for="f-${sec.section}-${key}">${h(label)} <span class="muted">(default ${def})</span></label>
            <input type="number" step="any" min="0" id="f-${sec.section}-${key}" name="${sec.section}.${key}" value="${val}"></div>`;
        }).join('')}
        </div>
        ${sec.section === 'summary' ? `
          <label class="check" style="margin-top:12px"><input type="checkbox" name="summary.requireHighForReview" ${cfg.summary.requireHighForReview ? 'checked' : ''}> "Review recommended" needs at least one High signal</label>
          <label class="check" style="margin-top:8px"><input type="checkbox" name="summary.requireProcessOrBaseline" ${cfg.summary.requireProcessOrBaseline ? 'checked' : ''}> "Review recommended" needs a Process or Baseline signal (textual style alone is never enough)</label>` : ''}
      </section>`).join('')}
    </form>

    <section class="card card-pad" style="margin-top:16px">
      <h2>Data</h2>
      <p class="muted small">Everything is stored only in this browser. Export regularly if you want a backup or to move to another computer.</p>
      <div class="btn-row" style="margin-top:10px">
        <button class="btn" data-action="export">Export all data (JSON)</button>
        <label class="btn" for="import-file" style="color:var(--text)">Import data…</label>
        <input type="file" id="import-file" accept=".json,application/json" hidden>
        <button class="btn" data-action="demo">Reset demo data</button>
        <button class="btn btn-ghost" data-action="clear">Clear all data</button>
      </div>
    </section>`;

  const collect = () => {
    const out = structuredClone(cfg);
    app.querySelectorAll('#cfg input[type="number"]').forEach((inp) => {
      const [sec, key] = inp.name.split('.');
      const v = Number(inp.value);
      if (Number.isFinite(v)) out[sec][key] = v;
    });
    out.summary.requireHighForReview = app.querySelector('[name="summary.requireHighForReview"]').checked;
    out.summary.requireProcessOrBaseline = app.querySelector('[name="summary.requireProcessOrBaseline"]').checked;
    return out;
  };
  app.querySelector('[data-action="save"]').addEventListener('click', () => { store.setConfig(collect()); invalidate(); toast('Settings saved.'); });
  app.querySelector('[data-action="defaults"]').addEventListener('click', () => { store.resetConfig(); invalidate(); renderSettings(app); toast('Defaults restored.'); });
  app.querySelector('[data-action="export"]').addEventListener('click', () => download(`writing-review-export-${new Date().toISOString().slice(0, 10)}.json`, store.exportBundle()));
  app.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = parseImport(await readFile(file));
      if (parsed.kind !== 'bundle') throw new Error('This is a single submission log. Use "Add submission" to import it.');
      store.importBundle(parsed.data);
      invalidate();
      toast('Data imported.');
    } catch (err) { alert(`Import failed: ${err.message}`); }
  });
  app.querySelector('[data-action="demo"]').addEventListener('click', () => {
    if (!confirm('Replace all students, samples and submissions with the demo data?')) return;
    store.resetDemo(); invalidate(); toast('Demo data restored.');
  });
  app.querySelector('[data-action="clear"]').addEventListener('click', () => {
    if (!confirm('Delete all students, samples, submissions and notes from this browser? Export first if you want a copy.')) return;
    store.clearAll(); invalidate(); toast('All data cleared.');
  });
}
