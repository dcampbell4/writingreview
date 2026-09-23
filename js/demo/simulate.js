// Deterministic writing simulator used only for the demo data and tests.
// It produces event logs that follow the schema in DESIGN.md §3.

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPOS = ['teh', 'adn', 'thier', 'becuase', 'wich', 'realy', 'somthing', 'whne'];

// Builds a writing session. `plan` is a list of steps:
//   { type: 'type', text, wpm, revise: 0..1, rethink: 0..1 }  typed composition
//   { type: 'paste', text }                                      single paste at the end
//   { type: 'pause', sec }                                       idle time
//   { type: 'edit', find, replace }                              later edit of existing text
export function simulateSession({ start, seed = 1, plan }) {
  const r = rng(seed);
  const events = [];
  let doc = '';
  let t = start;
  const push = (e) => events.push({ t: Math.round(t), ...e });
  push({ type: 'session-start' });

  for (const step of plan) {
    if (step.type === 'pause') { t += step.sec * 1000; continue; }
    if (step.type === 'paste') {
      t += 4000;
      push({ type: 'paste', pos: doc.length, text: step.text });
      doc += step.text;
      continue;
    }
    if (step.type === 'edit') {
      const pos = doc.indexOf(step.find);
      if (pos < 0) continue;
      t += 6000 + r() * 8000;
      push({ type: 'replace', pos, length: step.find.length, text: step.replace });
      doc = doc.slice(0, pos) + step.replace + doc.slice(pos + step.find.length);
      continue;
    }
    // Typed composition: chunks of 1–3 words at roughly `wpm`.
    const tokens = step.text.match(/\S+\s*|\s+/g) || [];
    const msPerWord = 60000 / (step.wpm || 30);
    let pendingFix = null;
    let i = 0;
    while (i < tokens.length) {
      const n = 1 + Math.floor(r() * 3);
      const chunk = tokens.slice(i, i + n).join('');
      i += n;
      t += msPerWord * n * (0.6 + r() * 0.8);
      if (r() < 0.04) t += 8000 + r() * 30000; // thinking pause
      // Occasional typo, deleted immediately.
      if (step.revise && r() < step.revise && /\w/.test(chunk)) {
        const typo = TYPOS[Math.floor(r() * TYPOS.length)] + ' ';
        push({ type: 'insert', pos: doc.length, text: typo });
        doc += typo;
        t += 900 + r() * 1500;
        push({ type: 'delete', pos: doc.length - typo.length, length: typo.length });
        doc = doc.slice(0, -typo.length);
        t += 500;
      }
      // Occasional word choice revisited a few chunks later ("rethink").
      const words = chunk.match(/^([A-Za-z]{4,})(\s*)$/);
      if (!pendingFix && step.rethink && words && r() < step.rethink) {
        const draft = 'good ';
        pendingFix = { pos: doc.length, draft, final: chunk, due: i + 4 + Math.floor(r() * 8) };
        push({ type: 'insert', pos: doc.length, text: draft });
        doc += draft;
        continue;
      }
      push({ type: 'insert', pos: doc.length, text: chunk });
      doc += chunk;
      if (pendingFix && i >= pendingFix.due) {
        t += 3000 + r() * 5000;
        push({ type: 'replace', pos: pendingFix.pos, length: pendingFix.draft.length, text: pendingFix.final });
        doc = doc.slice(0, pendingFix.pos) + pendingFix.final + doc.slice(pendingFix.pos + pendingFix.draft.length);
        pendingFix = null;
      }
    }
    if (pendingFix) {
      t += 3000;
      push({ type: 'replace', pos: pendingFix.pos, length: pendingFix.draft.length, text: pendingFix.final });
      doc = doc.slice(0, pendingFix.pos) + pendingFix.final + doc.slice(pendingFix.pos + pendingFix.draft.length);
    }
  }
  t += 20000;
  push({ type: 'submit' });
  return { log: { schema: 'writing-process-log', version: 1, startedAt: new Date(start).toISOString(), events }, finalText: doc };
}
