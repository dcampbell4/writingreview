// Settings: thresholds and genre weights, all editable.

import * as store from '../store.js';
import { SETTINGS_SCHEMA, DEFAULT_CONFIG } from '../config.js';
import { toast } from './common.js';
import { escapeHtml as h } from '../util.js';

export function renderSettings(app) {
  const cfg = store.config();
  app.innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p>How comparisons are weighted and when a difference counts as moderate, high or very high. Deviations are measured in units of each student’s own variation, not with fixed thresholds such as "more than 25 words".</p></div>
      <div class="btn-row"><button class="btn" data-a="reset">Restore defaults</button><button class="btn btn-primary" data-a="save">Save</button></div></div>
    <div class="cols" id="cfg">${SETTINGS_SCHEMA.map((sec) => `<section class="sheet sheet-pad stack">
      <h2>${h(sec.title)}</h2>
      ${sec.fields.map(([k, label]) => `<div class="field"><label for="f-${sec.section}-${k}">${h(label)} <span class="muted">(default ${DEFAULT_CONFIG[sec.section][k]})</span></label><input type="number" step="any" min="0" id="f-${sec.section}-${k}" data-s="${sec.section}" data-k="${k}" value="${cfg[sec.section][k]}"></div>`).join('')}
    </section>`).join('')}</div>`;
  app.querySelector('[data-a="save"]').addEventListener('click', () => {
    const out = structuredClone(cfg);
    app.querySelectorAll('[data-s]').forEach((i) => { const v = Number(i.value); if (Number.isFinite(v)) out[i.dataset.s][i.dataset.k] = v; });
    store.setSettings(out);
    toast('Settings saved.');
  });
  app.querySelector('[data-a="reset"]').addEventListener('click', () => { store.setSettings(null); renderSettings(app); toast('Defaults restored.'); });
}
