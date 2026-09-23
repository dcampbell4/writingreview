// Reads writing-process *reports* (PDF text or unfamiliar JSON) produced by
// tools such as Google Docs add-ons (Revision History, Process Feedback,
// Draftback, Brisk…). Layouts differ between tools and versions, so parsing is
// deliberately tolerant, and the teacher always reviews and can correct the
// extracted figures before anything is analysed.

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };

const NUM = String.raw`(\d{1,3}(?:,\d{3})+|\d+)`;
const toNum = (s) => Number(String(s).replace(/,/g, ''));

const TIME_PART = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp]\.?[Mm]\.?)?`;
const DATE_PATTERNS = [
  // Sep 22, 2026 at 9:22 AM  /  September 22 2026, 09:22
  new RegExp(String.raw`\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})(?:,?\s*(?:at\s+)?${TIME_PART})?`, 'i'),
  // 22 Sep 2026 09:22
  new RegExp(String.raw`\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)[a-z]*\.?,?\s+(\d{4})(?:,?\s*(?:at\s+)?${TIME_PART})?`, 'i'),
  // 2026-09-22 09:22 / 2026-09-22T09:22:10Z
  new RegExp(String.raw`\b(\d{4})-(\d{2})-(\d{2})(?:[T\s]+${TIME_PART})?`),
  // 9/22/2026, 9:22 AM  or 22/09/2026 09:22
  new RegExp(String.raw`\b(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})(?:,?\s*(?:at\s+)?${TIME_PART})?`),
];
const TIME_ONLY = new RegExp(String.raw`\b${TIME_PART}`);

function clock(h, m, s, ampm) {
  let hh = Number(h);
  if (ampm) {
    const pm = /p/i.test(ampm);
    if (pm && hh < 12) hh += 12;
    if (!pm && hh === 12) hh = 0;
  }
  return [hh, Number(m), Number(s || 0)];
}

// Finds the first date/time in a line. Returns { t, hasTime, index, text } or null.
export function findTimestamp(line, lastDate = null) {
  for (let i = 0; i < DATE_PATTERNS.length; i++) {
    const m = line.match(DATE_PATTERNS[i]);
    if (!m) continue;
    let y; let mo; let d; let tp;
    if (i === 0) { mo = MONTHS[m[1].toLowerCase().slice(0, m[1].toLowerCase().startsWith('sept') ? 4 : 3)]; d = +m[2]; y = +m[3]; tp = m.slice(4); }
    else if (i === 1) { d = +m[1]; mo = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)]; y = +m[3]; tp = m.slice(4); }
    else if (i === 2) { y = +m[1]; mo = +m[2] - 1; d = +m[3]; tp = m.slice(4); }
    else {
      let a = +m[1]; let b = +m[2]; y = +m[3];
      if (y < 100) y += 2000;
      if (a > 12 && b <= 12) [a, b] = [b, a]; // day-first date
      mo = a - 1; d = b; tp = m.slice(4);
    }
    if (mo == null || Number.isNaN(mo) || d < 1 || d > 31) continue;
    const hasTime = tp[0] != null;
    const [hh, mm, ss] = hasTime ? clock(tp[0], tp[1], tp[2], tp[3]) : [0, 0, 0];
    return { t: new Date(y, mo, d, hh, mm, ss).getTime(), hasTime, index: m.index, text: m[0], date: [y, mo, d] };
  }
  const tm = line.match(TIME_ONLY);
  if (tm && lastDate && (tm[4] || /\b\d{1,2}:\d{2}:\d{2}\b/.test(tm[0]) || /\bat\b/i.test(line))) {
    const [hh, mm, ss] = clock(tm[1], tm[2], tm[3], tm[4]);
    const [y, mo, d] = lastDate;
    return { t: new Date(y, mo, d, hh, mm, ss).getTime(), hasTime: true, index: tm.index, text: tm[0], date: lastDate };
  }
  return null;
}

// "2h 13m", "1 hour 5 minutes", "45 min", "01:23:45", "83 minutes" → minutes
export function parseDuration(text) {
  const s = text.toLowerCase();
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b[\s,]*(?:and\s+)?(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/);
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (m) return +m[1] * 60;
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b(?:[\s,]*(\d+)\s*(?:s|sec|secs|second|seconds)\b)?/);
  if (m) return +m[1] + (m[2] ? +m[2] / 60 : 0);
  m = s.match(/(\d+)\s*(?:s|sec|secs|second|seconds)\b/);
  if (m) return +m[1] / 60;
  m = s.match(/\b(\d{1,2}):(\d{2}):(\d{2})\b/);
  if (m) return +m[1] * 60 + +m[2] + +m[3] / 60;
  return null;
}

const LABELS = {
  writingMinutes: /(?:(?:total|active)\s+)?(?:writing|editing|typing|working|work|active)\s+time|time\s+(?:spent|writing|editing|working|on\s+task|in\s+document)|total\s+time|time\s+active|duration/i,
  sessions: /\b(?:writing\s+|editing\s+)?sessions?\b/i,
  edits: /\b(?:total\s+)?(?:edits|revisions|changes|keystrokes)\b/i,
  pasteCount: /\b(?:number\s+of\s+)?(?:pastes|paste\s+events|copy[\s/-]*pastes?|pasted\s+(?:items|segments|events))\b/i,
  pastedChars: /\b(?:characters?|chars?)\s+pasted|pasted\s+(?:characters?|chars?)\b/i,
  pastedWords: /\bwords?\s+pasted|pasted\s+words?\b/i,
  totalWords: /\b(?:total\s+|final\s+)?word\s*count\b|\btotal\s+words\b/i,
};

// Finds a value for a metric label on the same line or the next one.
function valueNear(lines, i, labelRe, kind) {
  const same = lines[i].replace(labelRe, ' ');
  const candidates = [same, lines[i + 1] || ''];
  for (const c of candidates) {
    if (kind === 'duration') {
      const d = parseDuration(c);
      if (d != null) return d;
    } else {
      const m = c.match(new RegExp(String.raw`(?:^|[^\d:/])${NUM}(?![\d:/])`));
      if (m && !/%/.test(c.slice(m.index, m.index + m[0].length + 2))) return toNum(m[1]);
    }
  }
  return null;
}

export function detectTool(text) {
  if (/revision\s*history/i.test(text) && /revisionhistory|writing process visibility|paste/i.test(text)) return 'Revision History';
  if (/process\s*feedback/i.test(text)) return 'Process Feedback';
  if (/draftback/i.test(text)) return 'Draftback';
  if (/brisk/i.test(text)) return 'Brisk Inspect Writing';
  if (/grammarly/i.test(text)) return 'Grammarly Authorship';
  if (/turnitin|clarity/i.test(text)) return 'Turnitin Clarity';
  return 'Tool not recognised';
}

function labelled(lines, re) {
  for (const l of lines) {
    const m = l.match(re);
    if (m && m[1]?.trim()) return m[1].trim();
  }
  return null;
}

const QUOTE_OPEN = /^["\u201C\u2018'«]/;
const METRIC_LINE = new RegExp(Object.values(LABELS).map((r) => r.source).join('|'), 'i');

// Main entry: text (one line per PDF line) → structured report.
export function parseProcessReport(rawText, { fileName = '' } = {}) {
  const lines = rawText.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const text = lines.join('\n');
  const metrics = {};
  const found = {};
  // Table layout: a row of labels followed by a row of values in the same order.
  const VALUE_TOKEN = /\d+(?:\.\d+)?\s*(?:h|hr|hrs|hours?)(?:\s*\d+\s*(?:m|min|mins|minutes?))?|\d+(?:\.\d+)?\s*(?:m|min|mins|minutes?)\b|\d{1,2}:\d{2}(?::\d{2})?|\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?%?/gi;
  lines.forEach((line, i) => {
    const hits = Object.entries(LABELS)
      .map(([key, re]) => { const m = line.match(re); return m ? { key, index: m.index } : null; })
      .filter(Boolean)
      .sort((a, b) => a.index - b.index);
    if (hits.length < 2 || /\d/.test(line.replace(/\b\d+\s*(?:words?|characters?)\b/gi, ''))) return;
    const values = (lines[i + 1] || '').match(VALUE_TOKEN) || [];
    if (values.length !== hits.length) return;
    hits.forEach((hit, k) => {
      if (metrics[hit.key] != null || /%$/.test(values[k])) return;
      const v = hit.key === 'writingMinutes' ? parseDuration(values[k]) : /^[\d,.]+$/.test(values[k]) ? toNum(values[k]) : null;
      if (v != null) { metrics[hit.key] = v; found[hit.key] = `${line} / ${lines[i + 1]}`; }
    });
  });
  lines.forEach((line, i) => {
    for (const [key, re] of Object.entries(LABELS)) {
      if (metrics[key] != null || !re.test(line)) continue;
      const v = valueNear(lines, i, re, key === 'writingMinutes' ? 'duration' : 'number');
      if (v != null) { metrics[key] = v; found[key] = line; }
    }
  });
  // "4 pastes", "3 sessions" phrased the other way round.
  if (metrics.pasteCount == null) { const m = text.match(new RegExp(`${NUM}\\s+(?:paste(?:s|\\s+events)|copy[\\s/-]*pastes)\\b`, 'i')); if (m) metrics.pasteCount = toNum(m[1]); }
  if (metrics.sessions == null) { const m = text.match(new RegExp(`${NUM}\\s+(?:writing\\s+|editing\\s+)?sessions?\\b`, 'i')); if (m) metrics.sessions = toNum(m[1]); }

  // Paste entries: a line mentioning a paste (usually with a time and a size),
  // followed by the quoted excerpt.
  const pastes = [];
  const timestamps = [];
  const SIZE = new RegExp(`${NUM}\\s*(?:characters?|chars?|words?)\\b`, 'i');
  const PASTE_WORD = /\bpast(?:e|ed|es|ing)\b|copy[\s/-]*paste/i;
  let lastDate = null;
  let inPasteSection = false;
  const isHeader = (line, ts) => (ts?.hasTime || SIZE.test(line)) && (PASTE_WORD.test(line) || inPasteSection) && !/\bsession\b/i.test(line);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ts = findTimestamp(line, lastDate);
    if (ts) { lastDate = ts.date; if (ts.hasTime) timestamps.push({ t: ts.t, line }); }
    if (!isHeader(line, ts)) {
      // A heading such as "Pasted content" opens a paste section; any other
      // metric heading or a session line closes it.
      if (PASTE_WORD.test(line) && line.length < 60 && !SIZE.test(line)) inPasteSection = true;
      else if ((METRIC_LINE.test(line) && line.length < 60) || /\bsession\b/i.test(line)) inPasteSection = false;
      continue;
    }
    const chars = line.match(new RegExp(`${NUM}\\s*(?:characters?|chars?)\\b`, 'i'));
    const words = line.match(new RegExp(`${NUM}\\s*words?\\b`, 'i'));
    // The excerpt: quoted text on this line and/or the lines that follow.
    const excerptParts = [];
    const inline = line.match(/["\u201C](.{8,})$/);
    if (inline) excerptParts.push(inline[1]);
    let j = i + 1;
    if (!inline || !/["\u201D]\s*$/.test(line)) {
      for (; j < lines.length && j < i + 80; j++) {
        const next = lines[j];
        const nts = findTimestamp(next, lastDate);
        if (isHeader(next, nts)) break;
        if (METRIC_LINE.test(next) && next.length < 60) break;
        if (/\bsession\b/i.test(next)) break;
        excerptParts.push(next);
        if (/["\u201D\u2019\u00BB]\s*$/.test(next)) { j++; break; }
      }
    }
    const excerpt = excerptParts.join(' ').replace(/^["\u201C\u2018'\u00AB]\s*/, '').replace(/\s*["\u201D\u2019'\u00BB]\s*$/, '').trim();
    pastes.push({
      time: ts?.hasTime ? ts.t : null,
      chars: chars ? toNum(chars[1]) : null,
      words: words ? toNum(words[1]) : null,
      excerpt: excerpt.length >= 8 ? excerpt : '',
      line,
      include: true,
    });
    i = j - 1;
  }

  // Sessions: lines mentioning a session that carry a duration and/or time range.
  const sessions = [];
  for (const line of lines) {
    if (!/\bsession\b/i.test(line) || LABELS.sessions.test(line) && !/\d{1,2}:\d{2}/.test(line)) continue;
    const ts = findTimestamp(line, lastDate);
    const minutes = parseDuration(line.replace(ts?.text || '', ''));
    if (ts || minutes != null) sessions.push({ start: ts?.hasTime ? ts.t : null, minutes, line });
  }

  const student = labelled(lines, /^(?:student|author|owner|name|written by|student name)\s*[:\-–]\s*(.+)$/i);
  const title = labelled(lines, /^(?:document|document title|title|file|assignment)\s*[:\-–]\s*(.+)$/i);
  const times = timestamps.map((x) => x.t).sort((a, b) => a - b);

  return {
    kind: 'process-report',
    tool: detectTool(text),
    fileName,
    student,
    title,
    metrics,
    metricSources: found,
    pastes,
    sessions,
    firstActivity: times[0] ?? null,
    lastActivity: times[times.length - 1] ?? null,
    rawText: text,
  };
}

// Flattens an unfamiliar JSON export into "key: value" lines so the same
// parser can read it.
export function flattenJson(value, prefix = '', out = []) {
  if (value == null) return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flattenJson(v, prefix, out));
  } else if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      const label = k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
      if (v != null && typeof v === 'object') {
        if (/paste/i.test(k) && Array.isArray(v)) {
          v.forEach((p) => {
            if (typeof p === 'string') { out.push('Pasted text:'); out.push(`"${p}"`); return; }
            const time = p.time ?? p.timestamp ?? p.t ?? p.date ?? p.createdAt ?? '';
            const t = typeof time === 'number' ? new Date(time).toISOString() : time;
            const chars = p.chars ?? p.characters ?? p.length ?? p.charCount;
            const text = p.text ?? p.content ?? p.excerpt ?? p.value ?? '';
            out.push(`Paste ${t}${chars != null ? ` ${chars} characters` : ''}`);
            if (text) out.push(`"${text}"`);
          });
        } else flattenJson(v, label, out);
      } else {
        out.push(`${label}: ${v}`);
      }
    }
  } else {
    out.push(prefix ? `${prefix}: ${value}` : String(value));
  }
  return out;
}

// Locates a pasted excerpt in the final text (whitespace/quote-insensitive),
// returning the matching character range or null.
export function locateExcerpt(finalText, excerpt) {
  if (!finalText || !excerpt || excerpt.length < 12) return null;
  const norm = (s) => s.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  const words = [];
  const re = /[A-Za-z0-9\u00C0-\u024F']+/g;
  let m;
  const ft = norm(finalText);
  while ((m = re.exec(ft))) words.push({ w: m[0], start: m.index, end: m.index + m[0].length });
  const ex = (norm(excerpt).match(/[A-Za-z0-9\u00C0-\u024F']+/g) || []);
  if (ex.length < 3) return null;
  const probe = Math.min(6, ex.length);
  for (let i = 0; i + probe <= words.length; i++) {
    let ok = true;
    for (let k = 0; k < probe; k++) if (words[i + k].w !== ex[k]) { ok = false; break; }
    if (!ok) continue;
    // Extend while words keep matching.
    let k = probe;
    while (k < ex.length && i + k < words.length && words[i + k].w === ex[k]) k++;
    return { start: words[i].start, end: words[i + k - 1].end, matchedWords: k, excerptWords: ex.length };
  }
  return null;
}

// Heuristic: lines that look like running prose (for "use the PDF's text").
export function proseFromReport(rawText) {
  return rawText.split('\n').filter((l) => l.length > 60 && !METRIC_LINE.test(l) && !findTimestamp(l)).join('\n');
}
