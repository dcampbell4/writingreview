// Discourse map of the current piece next to the student's typical structure.

import { MOVES } from '../features/discourse.js';
import { withUnit } from '../analysis/compare.js';
import { escapeHtml as h } from '../util.js';
import { levelHtml } from './common.js';

function mapHtml(discourse, title) {
  let claimN = 0;
  const paras = discourse.paragraphs.map((p) => {
    const steps = p.sequence.map((m) => {
      if (m === 'claim') { claimN++; return `CLAIM ${claimN}`; }
      return MOVES[m].label.toUpperCase();
    });
    return `<div class="map-para"><div class="role">Paragraph ${p.index + 1} · ${h(p.role)}</div><div class="map-steps">${steps.map(h).join('\n ↓\n')}</div></div>`;
  });
  return `<div><h3 style="margin-bottom:10px">${h(title)}</h3>${paras.join('')}
    <p class="small"><strong>Typical reasoning after evidence:</strong> ${h(discourse.typicalChain || '—')}</p>
    <p class="small"><strong>Conclusion:</strong> ${h(discourse.conclusionStrategy || '—')}</p>
    <p class="small"><strong>Kinds of evidence discussed:</strong> ${h(Object.keys(discourse.evidenceTypes).join(', ') || 'none identified')}</p></div>`;
}

export function argumentMapHtml(result) {
  const cat = result.categories.find((c) => c.id === 'discourse');
  const items = result.profile.items;
  const ref = [...items].sort((a, b) => b.weight - a.weight || String(b.sample.timestamp).localeCompare(String(a.sample.timestamp)))[0];
  const rows = result.rows.filter((r) => r.category === 'discourse');
  return `
    <section class="sheet">
      <div class="sheet-head"><h2>Argument architecture</h2>${levelHtml(cat.level, cat.segments)}</div>
      <div class="sheet-pad">
        <p class="small muted" style="margin-top:0">Each paragraph is reduced to the sequence of moves it makes. Moves are identified by transparent cue rules (e.g. a quotation or page reference = evidence; "This suggests…" = explanation; "Some readers might argue…" = counterpoint), so treat the map as a reading aid.</p>
        <div class="argmap">
          ${ref ? mapHtml(ref.features.discourse, `Earlier: ${ref.sample.title || 'most similar sample'}`) : '<div class="muted">No earlier sample to compare.</div>'}
          ${mapHtml(result.current.discourse, 'Current piece')}
        </div>
      </div>
    </section>
    <section class="sheet" style="margin-top:16px">
      <div class="sheet-head"><h2>Discourse measures</h2><span class="small muted">This piece vs. the student’s weighted history</span></div>
      <div class="table-wrap"><table class="table">
        <thead><tr><th>Measure</th><th class="num">This piece</th><th class="num">Usually</th><th>How unusual</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td>${h(r.feature.label)}<div class="small muted">${h(r.feature.groupLabel)} · ${h(r.feature.plain)}</div></td>
          <td class="num">${h(withUnit(r.current, r.feature))}</td><td class="num">${r.compared ? h(withUnit(r.baselineMean, r.feature)) : '—'}</td>
          <td class="small">${h(r.strength)}${r.trend?.kind === 'development' ? ' (steady development)' : ''}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>`;
}
