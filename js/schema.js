// Writing-process event schema (see DESIGN.md §3): validation and normalisation.

export const EVENT_TYPES = ['insert', 'paste', 'delete', 'replace', 'snapshot', 'focus', 'blur', 'submit', 'session-start', 'session-end'];
export const TEXT_CHANGING = new Set(['insert', 'paste', 'delete', 'replace', 'snapshot']);

export function toMillis(t) {
  if (typeof t === 'number') return t;
  const ms = Date.parse(t);
  return Number.isNaN(ms) ? null : ms;
}

// Returns { log, problems } where log.events are sorted, numbered and typed.
export function normalizeLog(raw) {
  const problems = [];
  if (!raw) return { log: null, problems };
  const list = Array.isArray(raw) ? raw : raw.events;
  if (!Array.isArray(list)) {
    problems.push('The log has no "events" array.');
    return { log: null, problems };
  }
  const events = [];
  list.forEach((e, i) => {
    const t = toMillis(e.t ?? e.time ?? e.timestamp);
    const type = String(e.type || '').toLowerCase();
    if (t === null) return problems.push(`Event ${i + 1}: missing or invalid time.`);
    if (!EVENT_TYPES.includes(type)) return problems.push(`Event ${i + 1}: unknown type "${e.type}".`);
    const ev = { t, type, source: i };
    if (type === 'insert' || type === 'paste' || type === 'replace') {
      if (typeof e.text !== 'string') return problems.push(`Event ${i + 1}: "${type}" needs text.`);
      ev.text = e.text;
    }
    if (type === 'snapshot') {
      if (typeof e.text !== 'string') return problems.push(`Event ${i + 1}: snapshot needs text.`);
      ev.text = e.text;
    }
    if (type === 'insert' || type === 'paste' || type === 'delete' || type === 'replace') {
      ev.pos = Number(e.pos);
      if (!Number.isInteger(ev.pos) || ev.pos < 0) return problems.push(`Event ${i + 1}: invalid position.`);
    }
    if (type === 'delete' || type === 'replace') {
      ev.length = Number(e.length);
      if (!Number.isInteger(ev.length) || ev.length < 0) return problems.push(`Event ${i + 1}: invalid length.`);
    }
    events.push(ev);
  });
  events.sort((a, b) => a.t - b.t || a.source - b.source);
  events.forEach((e, i) => { e.id = i; });
  return { log: { startedAt: toMillis(raw.startedAt) ?? events[0]?.t ?? null, events }, problems };
}

// Accepts either a single submission object or a bundle { students, samples, submissions }.
export function parseImport(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (data.submissions || data.students || data.samples) return { kind: 'bundle', data };
  if (data.events || data.log) {
    return {
      kind: 'submission',
      data: {
        studentName: data.student || data.studentName || 'Unknown student',
        assignment: data.assignment || 'Untitled assignment',
        date: data.date || new Date(toMillis(data.startedAt) || Date.now()).toISOString(),
        finalText: data.finalText || null,
        log: data.log || { startedAt: data.startedAt, events: data.events },
      },
    };
  }
  throw new Error('Unrecognised file. Expected a writing-process log or an exported bundle.');
}
