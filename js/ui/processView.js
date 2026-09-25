// Evidence timeline and composition-process details.

import { escapeHtml as h, fmtClock, fmtTime, fmtNum, plural, fmtDuration } from '../util.js';
import { levelHtml } from './common.js';
import { withUnit } from '../analysis/compare.js';

const W = 900;
const H = 230;
const M = { l: 48, r: 18, t: 24, b: 30 };
let selected = null;

function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

function chart(proc) {
  const rep = proc.rep;
  const pts = rep.events.filter((e) => ['insert', 'paste', 'delete', 'replace', 'snapshot', 'submit'].includes(e.type)).map((e) => ({ t: e.t, w: e.wordsAfter, e }));
  if (!pts.length) return '';
  const t0 = rep.start;
  const t1 = Math.max(rep.end, t0 + 60000);
  const maxW = niceMax(Math.max(...pts.map((p) => p.w)));
  const x = (t) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
  const y = (w) => H - M.b - (w / maxW) * (H - M.t - M.b);
  let d = `M${x(t0)},${y(0)}`;
  for (const p of pts) d += ` H${x(p.t).toFixed(1)} V${y(p.w).toFixed(1)}`;
  d += ` H${x(t1)}`;
  const span = t1 - t0;
  const stepMin = [1, 2, 5, 10, 15, 30, 60, 120, 240, 720, 1440].find((m) => span / (m * 60000) <= 8) || 2880;
  const ticks = [];
  for (let t = Math.ceil(t0 / (stepMin * 60000)) * stepMin * 60000; t <= t1; t += stepMin * 60000) ticks.push(t);
  const long = proc.periods.filter((p) => p.long);
  return `<div class="chart" id="chart">
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Document length over time. ${plural(proc.insertions.length, 'block insertion')} and ${plural(long.length, 'long unrevised writing period')} marked. A text list of the same events follows.">
      ${[0, maxW / 2, maxW].map((v) => `<line class="c-grid" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/><text class="c-axis" x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('')}
      ${ticks.map((t) => `<text class="c-axis" x="${x(t)}" y="${H - 10}" text-anchor="middle">${h(fmtClock(t))}</text>`).join('')}
      <text class="c-axis" x="${M.l - 8}" y="${M.t - 10}" text-anchor="end">words</text>
      ${long.map((p) => `<rect class="c-period" x="${x(p.start)}" y="${M.t}" width="${Math.max(3, x(p.end) - x(p.start))}" height="${H - M.t - M.b}"><title>Long unrevised writing: ${p.words} words</title></rect>`).join('')}
      <path class="c-area" d="${d} V${y(0)} H${x(t0)} Z"/>
      <path class="c-line" d="${d}"/>
      <line class="c-cross" id="cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>
      <rect id="hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent"/>
      ${proc.insertions.filter((i) => !i.internalMove).map((i) => {
        const ev = rep.events[i.id];
        const cx = x(ev.t); const cy = y(ev.wordsAfter);
        return `<g><rect class="c-marker" x="${cx - 6}" y="${cy - 6}" width="12" height="12" transform="rotate(45 ${cx} ${cy})"><title>${i.words} words inserted at ${h(fmtTime(ev.t))}</title></rect>
          <text class="c-label" x="${cx > W * 0.45 ? cx - 12 : cx + 12}" y="${cy - 10}" text-anchor="${cx > W * 0.45 ? 'end' : 'start'}">+${i.words} words in one step</text></g>`;
      }).join('')}
    </svg></div>`;
}

function segLabel(s) {
  if (s.kind === 'paste') return `+${s.words} words: large insertion${s.events[0].internalMove ? ' (own text moved)' : ''}`;
  if (s.kind === 'submitted') return 'submitted';
  if (s.kind === 'revisions') return `revision (+${s.added} / −${s.deleted} characters)`;
  if (s.kind === 'minor edits') return `minor edits (+${s.added} / −${s.deleted} characters)`;
  return `writing: +${s.words} words`;
}

function eventDetail(proc, s) {
  const rep = proc.rep;
  const text = (s.ranges || []).map((r) => rep.finalText.slice(r.start, r.end)).join(' … ').replace(/\s+/g, ' ').trim();
  const deleted = s.events.map((e) => e.deletedText || '').join('').replace(/\s+/g, ' ').trim();
  return `<div class="why" style="margin-top:10px">
    <p style="margin:0"><strong>${h(segLabel(s))}</strong></p>
    <p class="small" style="margin:4px 0">From ${h(fmtTime(s.start))} to ${h(fmtTime(s.end))} (${h(fmtDuration(Math.max(1000, s.end - s.start)))}) · ${plural(s.events.length, 'event')} · word count ${s.wordsBefore ?? '—'} → ${s.wordsAfter}</p>
    ${text ? `<p class="small" style="margin:4px 0"><strong>Text from this activity that remains in the final version:</strong></p><blockquote class="serif" style="margin:4px 0;font-size:15px">${h(text.length > 600 ? `${text.slice(0, 599)}…` : text)}</blockquote>` : '<p class="small muted">None of the text added here remains in the final version.</p>'}
    ${deleted ? `<p class="small" style="margin:4px 0"><strong>Deleted here:</strong> <span class="serif">${h(deleted.length > 200 ? `${deleted.slice(0, 199)}…` : deleted)}</span></p>` : ''}
  </div>`;
}

export function processHtml(result) {
  const proc = result.current.process;
  const pc = result.categories.find((c) => c.id === 'process');
  const ex = result.categories.find((c) => c.id === 'external');
  const rows = result.rows.filter((r) => r.category === 'process' || r.category === 'external');
  const measures = `<div class="table-wrap"><table class="table">
      <thead><tr><th>Measure</th><th class="num">This piece</th><th class="num">Usually</th><th>How unusual</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${h(r.feature.label)}<div class="small muted">${h(r.feature.plain)}</div></td><td class="num">${h(withUnit(r.current, r.feature))}</td><td class="num">${h(withUnit(r.baselineMean, r.feature))}${r.basis === 'reference' ? '<div class="small muted">general reference</div>' : ''}</td><td class="small">${h(r.strength)}</td></tr>`).join('')}</tbody>
    </table></div>`;
  if (!proc) return '<section class="sheet sheet-pad"><h2>Process timeline</h2><p class="muted">No writing-process data was provided for this piece. Add a log from the writing capture page, a revision-history export, or a process report PDF when adding writing.</p></section>';
  const head = `<div class="sheet-head"><h2>Composition process</h2><div class="btn-row"><span class="small">Process</span>${levelHtml(pc.level, pc.segments)}<span class="small">External insertion</span>${levelHtml(ex.level, ex.segments)}</div></div>`;
  if (proc.source === 'report') {
    const m = proc.report.metrics || {};
    return `<section class="sheet">${head}<div class="sheet-pad">
      <p class="small muted" style="margin-top:0">From an imported ${h(proc.report.tool || '')} report (${h(proc.report.fileName || '')}). Reports give summary figures only, so the detailed timeline is not available.</p>
      <ul>${m.writingMinutes != null ? `<li>Writing time: ${fmtNum(m.writingMinutes, 0)} minutes</li>` : ''}${m.sessions != null ? `<li>Sessions: ${m.sessions}</li>` : ''}${m.edits != null ? `<li>Edits: ${m.edits}</li>` : ''}</ul>
      <h3>Insertions listed</h3>
      <ul>${proc.insertions.map((i) => `<li>${i.t ? h(new Date(i.t).toLocaleString()) + ': ' : ''}${i.words} words${i.excerpt ? ` <span class="serif muted">“${h(i.excerpt.slice(0, 160))}${i.excerpt.length > 160 ? '…' : ''}”</span>` : ''}</li>`).join('') || '<li>None</li>'}</ul>
    </div></section><section class="sheet" style="margin-top:16px">${measures}</section>`;
  }
  const segs = proc.segments;
  segs.forEach((s) => { s.words = s.events.reduce((n, e) => n + (e.insertedWords || 0), 0); });
  const maxWords = Math.max(1, ...segs.map((s) => s.words));
  const cls = (s) => ({ paste: 'paste', revisions: 'rev', 'minor edits': 'minor', submitted: 'sub' }[s.kind] || '');
  return `<section class="sheet">${head}
    <div class="sheet-pad">
      ${chart(proc)}
      <div class="legend" style="margin:6px 0 12px"><span><span class="sw" style="background:var(--ink)"></span>Document length</span><span><span class="sw" style="background:var(--mark-soft)"></span>Long unrevised writing period</span><span>◆ Text inserted in one step</span></div>
      <h3>Evidence timeline</h3>
      <ul class="events" aria-label="Writing activity">${segs.map((s, i) => `<li><button data-seg="${i}" aria-pressed="${selected === i}">
        <span>${h(fmtClock(s.start))}</span><span class="b ${cls(s)}" style="width:${s.kind === 'submitted' ? 100 : Math.max(2, (s.words / maxWords) * 100)}%"></span>
        <span>${s.wordsAfter} words</span><span class="k">${h(segLabel(s))}</span></button></li>`).join('')}</ul>
      <div id="seg-detail">${selected != null && segs[selected] ? eventDetail(proc, segs[selected]) : '<p class="small muted">Select an activity to see its time, word-count change and the text it produced.</p>'}</div>
    </div>
  </section>
  <div class="cols" style="margin-top:16px">
    <section class="sheet sheet-pad">
      <h2>Draft growth</h2>
      <p class="small muted">Share of the final text already present at points in the writing session.</p>
      <ul class="compare-list">${proc.growth.map((g) => `<li><span>${Math.round(g.at * 100)}% of the session (${h(fmtClock(g.t))})</span><span class="val">${Math.round(g.share)}%</span></li>`).join('')}</ul>
      <p class="small">First substantial draft (half the final length) already contained <strong>${proc.values.firstDraftShare != null ? Math.round(proc.values.firstDraftShare) : '—'}%</strong> of the final wording.</p>
    </section>
    <section class="sheet sheet-pad">
      <h2>Revision</h2>
      <ul class="compare-list">
        <li><span>Substantive edits (rewording, deleting or adding ideas)</span><span class="val">${proc.edits.substantive}</span></li>
        <li><span>Surface edits (spelling, punctuation, typos)</span><span class="val">${proc.edits.surface}</span></li>
        <li><span>Revision density</span><span class="val">${fmtNum(proc.values.revisionDensity, 1)} per 100 words</span></li>
        <li><span>Active writing time</span><span class="val">${fmtNum(proc.values.activeMinutes, 0)} min</span></li>
        <li><span>Sessions</span><span class="val">${proc.values.sessions}</span></li>
      </ul>
      ${proc.edits.detail.length ? `<details style="margin-top:8px"><summary class="small">Examples of substantive edits</summary><ul class="small">${proc.edits.detail.slice(0, 12).map((d) => `<li>${h(fmtClock(d.t))}: ${h(d.what)}</li>`).join('')}</ul></details>` : ''}
    </section>
  </div>
  <section class="sheet" style="margin-top:16px"><div class="sheet-head"><h2>Process measures</h2><span class="small muted">This piece vs. the student’s earlier writing process</span></div>${measures}</section>`;
}

export function wireProcess(app, result) {
  const proc = result.current.process;
  if (!proc || proc.source !== 'log') return;
  app.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.seg);
    selected = selected === i ? null : i;
    app.querySelectorAll('[data-seg]').forEach((x) => x.setAttribute('aria-pressed', String(Number(x.dataset.seg) === selected)));
    app.querySelector('#seg-detail').innerHTML = selected != null ? eventDetail(proc, proc.segments[selected]) : '';
  }));
  // Hover crosshair with a tooltip.
  const root = app.querySelector('#chart');
  const svg = root?.querySelector('svg');
  if (!svg) return;
  const rep = proc.rep;
  const pts = rep.events.filter((e) => ['insert', 'paste', 'delete', 'replace', 'snapshot', 'submit'].includes(e.type));
  const t0 = rep.start; const t1 = Math.max(rep.end, t0 + 60000);
  const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; root.appendChild(tip);
  const cross = svg.querySelector('#cross');
  const hit = svg.querySelector('#hit');
  hit.addEventListener('mousemove', (evt) => {
    const box = svg.getBoundingClientRect();
    const vx = ((evt.clientX - box.left) / box.width) * W;
    const t = t0 + ((vx - M.l) / (W - M.l - M.r)) * (t1 - t0);
    let p = pts[0];
    for (const e of pts) if (e.t <= t) p = e; else break;
    const cx = M.l + ((p.t - t0) / (t1 - t0)) * (W - M.l - M.r);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    tip.hidden = false;
    tip.innerHTML = `${h(fmtTime(p.t))} · <strong>${p.wordsAfter}</strong> words<br><span class="muted">${h(p.type)}${p.insertedWords ? `, +${p.insertedWords} words` : ''}${p.deleted ? `, −${p.deleted} characters` : ''}</span>`;
    const rb = root.getBoundingClientRect();
    tip.style.left = `${Math.min((cx / W) * box.width + 12, rb.width - tip.offsetWidth - 4)}px`;
    tip.style.top = '8px';
  });
  hit.addEventListener('mouseleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
}
