// Small shared helpers.

export const SEVERITIES = ['Low', 'Medium', 'High'];
export const sevRank = (s) => SEVERITIES.indexOf(s);
export const maxSeverity = (list) => list.reduce((m, s) => (sevRank(s) > sevRank(m) ? s : m), null);
export const capSeverity = (s, cap) => (sevRank(s) > sevRank(cap) ? cap : s);

// Maps a measurement onto Low/Medium/High given the Medium and High thresholds.
export function grade(value, medium, high) {
  if (value >= high) return 'High';
  if (value >= medium) return 'Medium';
  return 'Low';
}

export function makeSignal(fields) {
  return {
    evidence: [], baseline: null, alternatives: [], adjustments: [], ranges: [], time: null, eventIds: [],
    rule: '', explanation: '', ...fields,
  };
}

export function fmtTime(ms) {
  if (ms == null) return '';
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function fmtClock(ms) {
  if (ms == null) return '';
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function fmtDate(v) {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function fmtNum(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  return Number(v).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

export function pct(v) {
  return `${Math.round(v * 100)}%`;
}

export function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : pluralWord || word + 's'}`;
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

export function excerpt(text, range, max = 160) {
  const s = text.slice(range.start, range.end).replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
