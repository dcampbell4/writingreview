// Writing timeline (DESIGN.md §6): a chart of document length over time with
// flagged events marked, plus a readable event log. Selecting an event
// highlights the final text it produced.

import { activitySegments } from '../process/replay.js';
import { escapeHtml as h, fmtClock, fmtTime, plural } from '../util.js';

const W = 900;
const H = 220;
const M = { l: 46, r: 18, t: 22, b: 30 };

function niceMax(v) {
  if (v <= 0) return 10;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

export function segmentsFor(result) {
  const segs = activitySegments(result.replay);
  segs.forEach((s) => { s.words = s.events.reduce((n, e) => n + (e.insertedWords || 0), 0); });
  return segs;
}

export function timelineHtml(result, { selectedSeg = null, selectedSignal = null } = {}) {
  const rep = result.replay;
  const pts = rep.events.filter((e) => ['insert', 'paste', 'delete', 'replace', 'snapshot', 'submit'].includes(e.type)).map((e) => ({ t: e.t, w: e.wordsAfter, e }));
  if (!pts.length) return null;
  const t0 = rep.start;
  const t1 = Math.max(rep.end, t0 + 60000);
  const maxW = niceMax(Math.max(...pts.map((p) => p.w)));
  const x = (t) => M.l + ((t - t0) / (t1 - t0)) * (W - M.l - M.r);
  const y = (w) => H - M.b - (w / maxW) * (H - M.t - M.b);

  let d = `M${x(t0)},${y(0)}`;
  for (const p of pts) d += ` H${x(p.t).toFixed(1)} V${y(p.w).toFixed(1)}`;
  d += ` H${x(t1)}`;
  const area = `${d} V${y(0)} H${x(t0)} Z`;

  const yTicks = [0, maxW / 2, maxW];
  const span = t1 - t0;
  const stepMin = [1, 2, 5, 10, 15, 30, 60, 120].find((m) => span / (m * 60000) <= 8) || 240;
  const xTicks = [];
  const first = Math.ceil(t0 / (stepMin * 60000)) * stepMin * 60000;
  for (let t = first; t <= t1; t += stepMin * 60000) xTicks.push(t);

  const segs = segmentsFor(result);
  const sel = selectedSeg != null ? segs[selectedSeg] : null;
  const flagged = result.signals.filter((s) => s.category === 'process' && s.time && s.status !== 'dismissed' && s.detector !== 'paste' && s.detector !== 'low-revision' && s.detector !== 'late-polishing');
  const pastes = result.signals.filter((s) => s.detector === 'paste' && s.status !== 'dismissed');
  const selSig = selectedSignal ? result.signals.find((s) => s.id === selectedSignal) : null;

  const svg = `
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Document length over time. ${plural(pastes.length, 'paste event')} marked.">
    ${yTicks.map((v) => `<line class="tl-grid" x1="${M.l}" x2="${W - M.r}" y1="${y(v)}" y2="${y(v)}"/><text class="tl-axis" x="${M.l - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v)}</text>`).join('')}
    ${xTicks.map((t) => `<text class="tl-axis" x="${x(t)}" y="${H - 10}" text-anchor="middle">${fmtClock(t)}</text>`).join('')}
    <text class="tl-axis" x="${M.l - 8}" y="${M.t - 10}" text-anchor="end">words</text>
    ${sel ? `<rect class="tl-sel" x="${x(sel.start) - 4}" y="${M.t}" width="${Math.max(8, x(sel.end) - x(sel.start) + 8)}" height="${H - M.t - M.b}"/>` : ''}
    ${selSig?.time && selSig.detector !== 'paste' ? `<rect class="tl-band" x="${x(selSig.time.start)}" y="${M.t}" width="${Math.max(4, x(selSig.time.end) - x(selSig.time.start))}" height="${H - M.t - M.b}"/>` : ''}
    ${flagged.filter((s) => s !== selSig).map((s) => `<rect class="tl-band" opacity="0.45" x="${x(s.time.start)}" y="${M.t}" width="${Math.max(4, x(s.time.end) - x(s.time.start))}" height="${H - M.t - M.b}"><title>${h(s.name)}</title></rect>`).join('')}
    <path class="tl-area" d="${area}"/>
    <path class="tl-line" d="${d}"/>
    <line class="tl-cross" id="tl-cross" x1="0" x2="0" y1="${M.t}" y2="${H - M.b}" visibility="hidden"/>
    <circle class="tl-dot" id="tl-dot" r="4.5" cx="0" cy="0" visibility="hidden"/>
    <rect id="tl-hit" x="${M.l}" y="${M.t}" width="${W - M.l - M.r}" height="${H - M.t - M.b}" fill="transparent"/>
    ${pastes.map((s) => {
      const ev = rep.events[s.eventIds[0]];
      const cx = x(ev.t);
      const cy = y(ev.wordsAfter);
      const r = 7;
      return `<g data-signal="${h(s.id)}" class="tl-paste" tabindex="0" role="button" aria-label="${h(s.name)} at ${h(fmtTime(ev.t))}">
        <path class="tl-marker" d="M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z"/>
        <text class="tl-marker-label" x="${cx > W * 0.4 ? cx - 10 : cx + 10}" y="${cy - 10}" text-anchor="${cx > W * 0.4 ? 'end' : 'start'}">+${ev.insertedWords} words (paste)</text>
      </g>`;
    }).join('')}
  </svg>`;

  const maxAdded = Math.max(1, ...segs.map((s) => s.words));
  const label = (s) => {
    if (s.kind === 'paste') return `<span class="kind flag">+${s.words} words (paste${s.events[0].internalMove ? ', own text moved' : ''})</span>`;
    if (s.kind === 'submitted') return '<span class="kind">submitted</span>';
    if (s.kind === 'revisions') return `<span class="kind">revisions (+${s.added} / −${s.deleted} characters)</span>`;
    if (s.kind === 'minor edits') return `<span class="kind">minor edits (+${s.added} / −${s.deleted} characters)</span>`;
    return `<span class="kind">+${s.words} words typed · ${plural(s.events.length, 'event')}</span>`;
  };
  const barClass = (s) => ({ paste: 'paste', revisions: 'revisions', 'minor edits': 'minor', submitted: 'submitted' }[s.kind] || '');
  const log = `<ul class="eventlog" aria-label="Writing activity">
    ${segs.map((s, i) => `<li><button type="button" data-seg="${i}" aria-pressed="${selectedSeg === i}" title="${h(fmtTime(s.start))}–${h(fmtTime(s.end))}">
      <span>${h(fmtClock(s.start))}</span>
      <span class="bar ${barClass(s)}" style="width:${s.kind === 'submitted' ? 100 : Math.max(2, (s.words / maxAdded) * 100)}%"></span>
      <span class="words">${s.wordsAfter} words</span>
      ${label(s)}
    </button></li>`).join('')}
  </ul>`;

  return { svg, log, segs, scale: { x, y, t0, t1 }, pts };
}

// Hover crosshair + tooltip, and click-to-select.
export function wireTimeline(root, tl, { onSegment, onSignal }) {
  const svg = root.querySelector('svg');
  if (!svg) return;
  const hit = svg.querySelector('#tl-hit');
  const cross = svg.querySelector('#tl-cross');
  const dot = svg.querySelector('#tl-dot');
  let tip = root.querySelector('.tooltip');
  if (!tip) { tip = document.createElement('div'); tip.className = 'tooltip'; tip.hidden = true; root.appendChild(tip); }

  const toT = (evt) => {
    const box = svg.getBoundingClientRect();
    const vx = ((evt.clientX - box.left) / box.width) * W;
    return tl.scale.t0 + ((vx - M.l) / (W - M.l - M.r)) * (tl.scale.t1 - tl.scale.t0);
  };
  const nearest = (t) => {
    let best = tl.pts[0];
    for (const p of tl.pts) if (p.t <= t) best = p; else break;
    return best;
  };
  const describe = (e) => ({ insert: 'typing', paste: 'paste', delete: 'deletion', replace: 'replacement', snapshot: 'snapshot', submit: 'submitted' }[e.type] || e.type);

  hit.addEventListener('mousemove', (evt) => {
    const p = nearest(toT(evt));
    const cx = tl.scale.x(p.t);
    const cy = tl.scale.y(p.w);
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); dot.setAttribute('visibility', 'visible');
    const box = svg.getBoundingClientRect();
    const rootBox = root.getBoundingClientRect();
    tip.hidden = false;
    tip.innerHTML = `${h(fmtTime(p.t))} · <strong>${p.w}</strong> words<br><span class="muted">${h(describe(p.e))}${p.e.insertedWords ? `, +${p.e.insertedWords} words` : ''}${p.e.deleted ? `, −${p.e.deleted} chars` : ''}</span>`;
    const px = (cx / W) * box.width + (box.left - rootBox.left);
    const py = (cy / H) * box.height + (box.top - rootBox.top);
    tip.style.left = `${Math.min(px + 12, rootBox.width - tip.offsetWidth - 4)}px`;
    tip.style.top = `${Math.max(0, py - 48)}px`;
  });
  hit.addEventListener('mouseleave', () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
  });
  hit.addEventListener('click', (evt) => {
    const t = toT(evt);
    const i = tl.segs.findIndex((s) => t >= s.start - 30000 && t <= s.end + 30000);
    if (i >= 0) onSegment(i);
  });
  svg.querySelectorAll('.tl-paste').forEach((g) => {
    const go = () => onSignal(g.dataset.signal);
    g.addEventListener('click', go);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  root.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => onSegment(Number(b.dataset.seg))));
}
