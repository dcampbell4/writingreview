// Side-by-side investigation: an earlier sample next to the current piece,
// with highlights that each carry an explanation.

import { extractFeatures } from '../features/index.js';
import { MOVES } from '../features/discourse.js';
import { BASIC_ANALYTIC_VERBS, ADVANCED_ANALYTIC_VERBS, COMMON_WORDS, ACADEMIC_WORDS } from '../text/lexicons.js';
import { highlightText } from './common.js';
import * as store from '../store.js';
import { escapeHtml as h, fmtDate, fmtNum, fmtClock } from '../util.js';

const MODES = [
  ['vocabulary', 'Vocabulary'],
  ['sentences', 'Sentence structure'],
  ['moves', 'Discourse moves'],
  ['abstraction', 'Abstraction & reasoning'],
  ['process', 'Process (current piece)'],
];
let mode = 'vocabulary';
let chosen = new Map();

const percentile = (arr, p) => { if (!arr.length) return 0; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const isSophisticated = (w, rare) => rare.has(w.lower);

function spansFor(kind, feat, result, isCurrent, limits) {
  const doc = feat.doc;
  const spans = [];
  if (kind === 'vocabulary') {
    const rareSet = new Set(feat.details.rareStems.values());
    for (const w of doc.words) {
      if (ADVANCED_ANALYTIC_VERBS.has(w.lower)) spans.push({ start: w.start, end: w.end, cls: 'hl-strong', title: 'Advanced analytical verb' });
      else if (BASIC_ANALYTIC_VERBS.has(w.lower)) spans.push({ start: w.start, end: w.end, cls: 'hl-blue', title: 'Everyday analytical verb (shows, says, explains…)' });
      else if (isCurrent && isSophisticated(w, rareSet) && result.isNewWord(w.text)) spans.push({ start: w.start, end: w.end, cls: 'hl-purple', title: `Not used in any of this student’s earlier samples${ACADEMIC_WORDS.has(w.lower) ? ' (academic word list)' : ''}` });
    }
  } else if (kind === 'sentences') {
    for (const s of doc.sentences) {
      const n = s.words.length;
      const clauses = 1 + (s.text.match(/\b(?:because|although|though|while|whereas|since|unless|which|who|whom|whose|when|where|if)\b/gi) || []).length + (s.text.match(/,\s+(?:and|but|or|so|yet)\s/gi) || []).length;
      if (n > limits.p90 || clauses >= 4) spans.push({ start: s.start, end: s.end, cls: n > limits.p90 * 1.3 || clauses >= 5 ? 'hl-strong' : '', title: `${n} words, about ${clauses} clauses. This student’s sentences are usually up to ${limits.p90} words.` });
    }
  } else if (kind === 'moves') {
    for (const s of feat.discourse.sentences) {
      const m = MOVES[s.move];
      spans.push({ start: s.start, end: s.end, nomark: true, prefix: `<span class="move" title="${h(m.label)}">${h(m.code)}</span>`, title: `${m.label}${s.moves.length > 1 ? ` (also: ${s.moves.slice(1).map((x) => MOVES[x].label.toLowerCase()).join(', ')})` : ''}` });
    }
  } else if (kind === 'abstraction') {
    for (const s of feat.discourse.sentences) {
      if (s.level === 2) spans.push({ start: s.start, end: s.end, cls: 'hl-purple', title: 'Abstract: reasons mainly in concepts (power, ideology, identity…)' });
      else if (s.level === 1) spans.push({ start: s.start, end: s.end, cls: 'hl-blue', title: 'Analytical: interprets evidence or names a technique' });
    }
  } else if (kind === 'process' && isCurrent && feat.process?.source === 'log') {
    const rep = feat.process.rep;
    for (const ins of feat.process.insertions) for (const r of ins.ranges || []) spans.push({ start: r.start, end: r.end, cls: 'hl-purple', title: `${ins.words} words inserted in one step${ins.t ? ` at ${fmtClock(ins.t)}` : ''}` });
    const longIds = new Set();
    feat.process.periods.filter((p) => p.long).forEach((p) => rep.events.forEach((e) => { if (e.t >= p.start && e.t <= p.end) longIds.add(e.id); }));
    let runStart = -1;
    for (let i = 0; i <= rep.chars.length; i++) {
      const ch = rep.chars[i];
      const inLong = ch && longIds.has(ch.ev) && rep.events[ch.ev].type !== 'paste';
      if (inLong && runStart < 0) runStart = i;
      if (!inLong && runStart >= 0) {
        spans.push({ start: runStart, end: i, nomark: true, cls: 'origin-continuous', title: 'Written in a long, uninterrupted stretch with almost no revision' });
        runStart = -1;
      }
    }
  } else if (kind === 'process' && isCurrent && feat.process?.source === 'report') {
    for (const ins of feat.process.insertions) for (const r of ins.ranges || []) spans.push({ start: r.start, end: r.end, cls: 'hl-purple', title: 'Listed as pasted in the imported process report' });
  }
  return spans;
}

function why(kind, cur, base, result, limits) {
  if (kind === 'vocabulary') {
    const nw = result.newVocabulary.slice(0, 18);
    return `<ul>
      <li><strong>Analytical verbs</strong>: earlier (${h(base.details.basicVerbs.concat(base.details.advancedVerbs).slice(0, 8).map((x) => x.word).join(', ') || 'none')}) vs. now (${h(cur.details.basicVerbs.concat(cur.details.advancedVerbs).slice(0, 8).map((x) => x.word).join(', ') || 'none')}).</li>
      <li><strong>Sophisticated words not used in any earlier sample</strong> (academic or long multi-syllable words; names, quotations and taught terms excluded) (${result.newVocabulary.length}): ${h(nw.join(', ') || 'none')}${result.newVocabulary.length > 18 ? '…' : ''}.</li>
      ${result.assignment?.taughtTerms?.length ? `<li>Taught terms excluded from counts: ${h(result.assignment.taughtTerms.join(', '))}.</li>` : ''}
    </ul>`;
  }
  if (kind === 'sentences') {
    const share = (f) => Math.round((f.doc.sentences.filter((s) => s.words.length > limits.p90).length / Math.max(1, f.doc.sentences.length)) * 100);
    return `<ul><li>This student’s sentences are usually up to <strong>${limits.p90}</strong> words (90th percentile across earlier samples).</li>
      <li>Sentences above that: earlier sample <strong>${share(base)}%</strong>, current piece <strong>${share(cur)}%</strong>.</li>
      <li>Mean sentence length: ${fmtNum(base.values.meanSentenceLength, 1)} vs. ${fmtNum(cur.values.meanSentenceLength, 1)} words; clauses per sentence: ${fmtNum(base.values.clauseDensity, 2)} vs. ${fmtNum(cur.values.clauseDensity, 2)}.</li></ul>`;
  }
  if (kind === 'moves') {
    return `<ul><li>Each sentence is tagged with its role: ${Object.values(MOVES).map((m) => `<span class="mono">${h(m.code)}</span> ${h(m.label.toLowerCase())}`).join(', ')}.</li>
      <li>Typical paragraph earlier: <span class="mono">${h(base.discourse.paragraphs.find((p) => p.role === 'body')?.pattern || '—')}</span>; now: <span class="mono">${h(cur.discourse.paragraphs.find((p) => p.role === 'body')?.pattern || '—')}</span>.</li>
      <li>Roles are assigned by transparent cue rules and can be wrong; use them as a guide to read the argument.</li></ul>`;
  }
  if (kind === 'abstraction') {
    return `<ul><li>Abstraction index (0 concrete – 2 abstract): earlier ${fmtNum(base.values.abstractionIndex, 2)}, now ${fmtNum(cur.values.abstractionIndex, 2)}.</li>
      <li>Typical reasoning after evidence: earlier <em>${h(base.discourse.typicalChain || '—')}</em>; now <em>${h(cur.discourse.typicalChain || '—')}</em>.</li></ul>`;
  }
  if (!cur.process) return '<p>No process data for the current piece.</p>';
  return `<ul><li><span class="sw" style="background:var(--mark-3)"></span> Text inserted in one step (paste or bulk insertion).</li>
    <li><span style="text-decoration:underline wavy">wavy underline</span>: written in a long, uninterrupted stretch with almost no revision.</li>
    <li>Unmarked text was composed with the student’s usual pauses and revisions.</li></ul>`;
}

export function renderSideBySide(root, result) {
  const smp = result.sample;
  const items = result.profile.items;
  if (!items.length) { root.innerHTML = '<p class="sheet sheet-pad muted">There are no earlier samples to compare with. Add baseline writing on the student’s profile.</p>'; return; }
  const best = [...items].sort((a, b) => b.weight - a.weight || String(b.sample.timestamp).localeCompare(String(a.sample.timestamp)))[0];
  const chosenId = chosen.get(smp.id) || best.sample.id;
  const baseItem = items.find((x) => x.sample.id === chosenId) || best;
  const cfg = store.config();
  const baseFeat = extractFeatures(baseItem.sample, { taughtTerms: store.assignment(baseItem.sample.assignment_id)?.taughtTerms || [], config: cfg });
  const cur = result.current;
  const lens = items.flatMap((x) => x.features.doc.sentences.map((s) => s.words.length));
  const limits = { p90: Math.max(10, percentile(lens, 0.9)) };

  root.innerHTML = `
    <section class="sheet sheet-pad">
      <div class="btn-row" style="justify-content:space-between">
        <div class="seg" role="group" aria-label="Highlight">${MODES.map(([k, l]) => `<button data-mode="${k}" aria-pressed="${mode === k}">${h(l)}</button>`).join('')}</div>
        <div class="btn-row" style="flex:1 1 240px;min-width:0;justify-content:flex-end"><label for="basesel" class="small">Compare with</label>
          <select id="basesel" style="flex:1 1 0;min-width:0;max-width:360px">${items.map((x) => `<option value="${h(x.sample.id)}" ${x.sample.id === baseItem.sample.id ? 'selected' : ''}>${h(x.sample.title || 'Untitled')} · ${h(fmtDate(x.sample.timestamp))} · weight ${x.weight}</option>`).join('')}</select></div>
      </div>
      <div class="why" style="margin-top:12px"><strong>Why these passages are marked</strong>${why(mode, cur, baseFeat, result, limits)}</div>
      <div class="side-by-side" style="margin-top:16px">
        <div><h3>Previous writing · ${h(baseItem.sample.title || '')}</h3><p class="small muted">${h(baseItem.sample.genre || '')} · ${h(fmtDate(baseItem.sample.timestamp))} · ${baseFeat.wordCount} words${baseItem.reasons.length ? ` · counts less: ${h(baseItem.reasons.join(', '))}` : ''}</p>
          <div class="essay">${highlightText(baseFeat.doc.text, mode === 'process' ? [] : spansFor(mode, baseFeat, result, false, limits), baseFeat.doc.paragraphs)}</div></div>
        <div><h3>Current writing · ${h(smp.title || '')}</h3><p class="small muted">${h(smp.genre || '')} · ${h(fmtDate(smp.timestamp))} · ${cur.wordCount} words</p>
          <div class="essay">${highlightText(cur.doc.text, spansFor(mode, cur, result, true, limits), cur.doc.paragraphs)}</div></div>
      </div>
      <p class="small muted">Hover over (or long-press) a highlighted passage to see why it is marked.</p>
    </section>`;
  root.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; renderSideBySide(root, result); }));
  root.querySelector('#basesel').addEventListener('change', (e) => { chosen.set(smp.id, e.target.value); renderSideBySide(root, result); });
}
