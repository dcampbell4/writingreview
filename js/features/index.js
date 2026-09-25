// Computes every feature for one writing sample. Results are cached by the
// sample's text, context and process data, so re-rendering is cheap.

import { analyzeDocument, stem } from '../text/tokenize.js';
import { computeStyle, styleDetails, STYLE_FEATURES, GROUPS } from './stylometry.js';
import { computeDiscourse, DISCOURSE_FEATURES, DISCOURSE_GROUPS } from './discourse.js';
import { computeProcess, PROCESS_FEATURES } from './process.js';

export const ALL_FEATURES = [
  ...STYLE_FEATURES.map((f) => ({ ...f, category: 'style', groupLabel: GROUPS[f.group].label })),
  ...DISCOURSE_FEATURES.map((f) => ({ ...f, groupLabel: DISCOURSE_GROUPS[f.group] })),
  ...PROCESS_FEATURES.map((f) => ({ ...f, group: f.category, groupLabel: f.category === 'process' ? 'Composition process' : 'External insertion' })),
];
export const FEATURE_BY_ID = Object.fromEntries(ALL_FEATURES.map((f) => [f.id, f]));

const cache = new Map();

export function taughtSet(terms = []) {
  const s = new Set();
  for (const t of terms) for (const w of String(t).toLowerCase().split(/[^a-zÀ-ɏ']+/)) if (w.length > 2) { s.add(w); s.add(stem(w)); }
  return s;
}

export function extractFeatures(sample, { taughtTerms = [], config }) {
  const key = `${sample.id}|${sample.text?.length}|${hash(sample.text || '')}|${taughtTerms.join(',')}|${sample.process_data ? hash(JSON.stringify(sample.process_data).slice(0, 5000)) + JSON.stringify(sample.process_data).length : ''}`;
  if (cache.has(key)) return cache.get(key);
  const text = sample.text || '';
  const doc = analyzeDocument(text);
  const taught = taughtSet(taughtTerms);
  const discourse = computeDiscourse(doc);
  const process = computeProcess(sample.process_data, text, config);
  const values = {
    ...computeStyle(doc, { taught }),
    ...discourse.values,
    ...(process?.values || {}),
  };
  const out = { doc, values, details: styleDetails(doc, taught), discourse, process, wordCount: doc.wordCount };
  cache.set(key, out);
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  return out;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
