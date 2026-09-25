// The student's longitudinal writing profile: which earlier samples count, how
// much each counts (genre matching), how much baseline there is, and how each
// feature has been changing over time.

import { ALL_FEATURES } from '../features/index.js';

export function similarityWeight(base, current, cfg) {
  const g = cfg.genreWeights;
  let w = g.differentGenre;
  if (base.subject && current.subject && base.subject.toLowerCase() === current.subject.toLowerCase()) w = Math.max(w, g.sameSubject);
  if (base.genre && current.genre && base.genre === current.genre) w = Math.max(w, g.sameGenre);
  if (base.assignment_type && current.assignment_type && base.assignment_type.toLowerCase() === current.assignment_type.toLowerCase()) w = Math.max(w, g.sameAssignmentType);
  const reasons = [];
  if (Boolean(base.timed) !== Boolean(current.timed)) { w = Math.min(w, g.timedVsPolished); reasons.push(base.timed ? 'timed vs. untimed' : 'untimed vs. timed'); }
  if ((base.word_count || 0) < cfg.baseline.minWords) { w *= 0.5; reasons.push('short sample'); }
  return { weight: Math.round(w * 100) / 100, reasons };
}

export function sufficiency(n, genres, cfg) {
  const b = cfg.baseline;
  if (n < b.minimumSamples) return { level: 'insufficient', label: 'Insufficient baseline', message: `Insufficient baseline for reliable authorship comparison (${n} of the ${b.minimumSamples} samples needed).` };
  if (n >= b.strongSamples && genres >= 2) return { level: 'strong', label: 'Strong longitudinal profile', message: `${n} samples across ${genres} kinds of writing.` };
  if (n >= b.preferredSamples) return { level: 'preferred', label: 'Good baseline', message: `${n} samples.` };
  return { level: 'minimum', label: 'Minimum baseline', message: `${n} samples: comparisons are possible but less reliable than with 5–10.` };
}

const wmean = (xs) => { const W = xs.reduce((s, x) => s + x.w, 0); return W ? xs.reduce((s, x) => s + x.w * x.v, 0) / W : 0; };
const wsd = (xs, m) => {
  const W = xs.reduce((s, x) => s + x.w, 0);
  if (xs.length < 2 || !W) return 0;
  const v = xs.reduce((s, x) => s + x.w * (x.v - m) ** 2, 0) / W;
  return Math.sqrt(v * (xs.length / (xs.length - 1)));
};

// Least-squares trend of a feature across dated samples (index order).
export function trendOf(points) {
  const n = points.length;
  if (n < 2) return null;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.v);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (!sxx) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy ? (sxy * sxy) / (sxx * syy) : 0;
  return { slope, intercept, r2, predictedNext: intercept + slope * n, n };
}

/**
 * baseline: [{ sample, features }] (the student's included baseline samples)
 * current: the sample under investigation (for genre weighting)
 */
export function buildProfile(baseline, current, cfg) {
  const items = baseline
    .map(({ sample, features }) => ({ sample, features, ...similarityWeight(sample, current, cfg) }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => String(a.sample.timestamp).localeCompare(String(b.sample.timestamp)));
  const n = items.length;
  const W = items.reduce((s, x) => s + x.weight, 0);
  const W2 = items.reduce((s, x) => s + x.weight ** 2, 0);
  const nEff = W2 ? (W * W) / W2 : 0;
  const genres = new Set(items.map((x) => x.sample.genre || 'unspecified')).size;
  const suff = sufficiency(n, genres, cfg);

  const features = {};
  for (const f of ALL_FEATURES) {
    const pts = items.map((x) => ({ v: x.features.values[f.id], w: x.weight, date: x.sample.timestamp, id: x.sample.id })).filter((p) => p.v != null && Number.isFinite(p.v));
    if (!pts.length) continue;
    const m = wmean(pts);
    const s = wsd(pts, m);
    const vals = pts.map((p) => p.v);
    features[f.id] = {
      mean: m, sd: s, min: Math.min(...vals), max: Math.max(...vals), n: pts.length, points: pts,
      trend: pts.length >= cfg.trend.minSamples ? trendOf(pts) : null,
    };
  }
  const processSamples = items.filter((x) => x.features.process).length;
  return { items, n, nEff, genres, sufficiency: suff, features, processSamples };
}
