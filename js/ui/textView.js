// Renders the final text with highlights. Modes:
//   'signal'  - ranges of the selected signal (and faint marks for other active signals)
//   'origin'  - where each character came from: typed, pasted, moved, inserted later
//   'segment' - text produced by the selected timeline activity

import { escapeHtml as h } from '../util.js';
import { paragraphProcess } from '../process/metrics.js';

function flags(length, ranges) {
  const a = new Uint8Array(length);
  for (const r of ranges || []) for (let i = Math.max(0, r.start); i < Math.min(length, r.end); i++) a[i] = 1;
  return a;
}

export function docHtml(result, { mode, selectedSignal, segRanges }) {
  const { text, doc, replay: rep } = result;
  const n = text.length;
  let classAt;
  if (mode === 'origin' && rep?.matchesSubmission) {
    classAt = (i) => {
      const ch = rep.chars[i];
      if (!ch) return '';
      const ev = rep.events[ch.ev];
      if (ev.type === 'paste') return ev.internalMove ? 'origin-move' : 'origin-paste';
      return ch.mid ? 'origin-mid' : '';
    };
  } else if (mode === 'segment') {
    const f = flags(n, segRanges);
    classAt = (i) => (f[i] ? 'mark sel' : '');
  } else {
    const sel = result.signals.find((s) => s.id === selectedSignal);
    const selF = flags(n, sel?.ranges);
    const soft = flags(n, sel ? [] : result.signals.filter((s) => s.status !== 'dismissed' && s.severity !== 'Low').flatMap((s) => (s.ranges || []).filter((r) => r.end - r.start <= 120)));
    classAt = (i) => (selF[i] ? 'mark sel' : soft[i] ? 'mark' : '');
  }

  const pp = rep?.matchesSubmission ? paragraphProcess(rep, doc) : null;
  let firstSel = true;
  const paras = doc.paragraphs.map((p, pi) => {
    let html = '';
    let run = '';
    let cls = null;
    const flush = () => {
      if (!run) return;
      if (!cls) html += h(run);
      else if (cls.startsWith('mark')) {
        const c = cls.replace('mark', '').trim();
        const id = c === 'sel' && firstSel ? ' id="first-highlight"' : '';
        if (c === 'sel') firstSel = false;
        html += `<mark${c ? ` class="${c}"` : ''}${id}>${h(run)}</mark>`;
      } else html += `<span class="${cls}">${h(run)}</span>`;
      run = '';
    };
    for (let i = p.start; i < p.end; i++) {
      const c = classAt(i) || null;
      if (c !== cls) { flush(); cls = c; }
      run += text[i];
    }
    flush();
    const info = pp?.[pi];
    const meta = info
      ? `<span class="edits" title="Edits per 100 words during writing">${info.pastedShare > 0.5 ? 'pasted' : `${Math.round(info.density * 10) / 10} ed/100w`}</span>`
      : '';
    return `<div class="doc-para"><div class="doc-para-num">¶${pi + 1}${meta}</div><div>${html}</div></div>`;
  });
  return paras.join('');
}

export function legendHtml(mode, hasOrigin) {
  if (mode === 'origin') {
    if (!hasOrigin) return '<span class="muted">Text origin is available only when the writing log matches the submitted text.</span>';
    return `<div class="legend">
      <span><i class="swatch" style="background:var(--surface)"></i>Typed</span>
      <span><i class="swatch" style="background:var(--paste-bg)"></i>Pasted</span>
      <span><i class="swatch" style="background:var(--surface-2)"></i>Moved own text</span>
      <span><i class="swatch" style="background:var(--surface);border-bottom:2px dotted var(--text-3)"></i>Inserted into earlier text (revision)</span>
    </div>`;
  }
  if (mode === 'segment') return '<div class="legend"><span><i class="swatch" style="background:var(--mark-sel)"></i>Text from the selected activity that remains in the final version</span></div>';
  return `<div class="legend">
    <span><i class="swatch" style="background:var(--mark-sel)"></i>Selected signal</span>
    <span><i class="swatch" style="background:var(--mark-soft)"></i>Short matches from medium/high signals (shown when no signal is selected)</span>
  </div>`;
}
