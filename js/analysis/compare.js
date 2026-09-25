// Compares every feature of the current piece with the student's own
// genre-weighted history. Produces one comparison per feature; those that are
// unusual become anomalies. Explanations are written for teachers, with the
// underlying statistics kept for the advanced view.

import { ALL_FEATURES } from '../features/index.js';
import { ALTERNATIVES, contextAdjustments } from './explain.js';
import { fmtNum } from '../util.js';

const QUALITY = ['Low', 'Moderate', 'High'];
const lowerQuality = (q) => QUALITY[Math.max(0, QUALITY.indexOf(q) - 1)];

export const withUnit = (v, f) => {
  if (v == null || !Number.isFinite(v)) return '—';
  const u = f.unit || '';
  return `${fmtNum(v, f.digits)}${u ? (u.startsWith('%') ? '' : ' ') + u : ''}`;
};

export function strengthOf(z, cfg) {
  const a = Math.abs(z);
  if (a >= cfg.strength.veryHigh) return 'Very high';
  if (a >= cfg.strength.high) return 'High';
  if (a >= cfg.strength.moderate) return 'Moderate';
  return 'Typical';
}

export function compareAll({ current, profile, cfg, assignment = {}, studentContext = {} }) {
  const rows = [];
  const insufficient = profile.sufficiency.level === 'insufficient';
  for (const f of ALL_FEATURES) {
    const x = current.values[f.id];
    if (x == null || !Number.isFinite(x)) continue;
    const isProcess = f.category === 'process' || f.category === 'external';
    let base = profile.features[f.id];
    let basis = 'student';
    if (isProcess) {
      if (!base || base.n < 2) {
        const ref = cfg.processReference[f.id];
        if (!ref) continue;
        base = { mean: ref.mean, sd: ref.spread, n: 0, points: [], trend: null };
        basis = 'reference';
      }
    } else if (!base || insufficient) {
      rows.push({ feature: f, id: f.id, category: f.category, group: f.group, label: f.label, current: x, compared: false, strength: insufficient ? 'Not compared (insufficient baseline)' : 'No earlier data', z: 0 });
      continue;
    }

    const spread = Math.max(base.sd, cfg.baseline.relativeSpreadFloor * Math.abs(base.mean), f.minSpread);
    const rawZ = (x - base.mean) / spread;
    const directional = (z) => (f.direction === 'up' ? Math.max(0, z) : f.direction === 'down' ? Math.min(0, z) : z);
    let z = directional(rawZ);

    // Longitudinal development: a steady trend that predicts this value.
    let trend = null;
    const t = base.trend;
    if (t && t.r2 >= cfg.trend.minFit && Math.sign(t.slope) === Math.sign(rawZ) && Math.abs(t.slope) * t.n >= spread * 0.5) {
      const zt = directional((x - t.predictedNext) / spread);
      if (Math.abs(zt) < Math.abs(z)) {
        trend = { kind: 'development', predicted: t.predictedNext, before: z, slope: t.slope };
        z = zt;
      }
    } else if (basis === 'student' && base.n >= 3 && Math.abs(z) >= cfg.strength.high && (!t || t.r2 < cfg.trend.minFit)) {
      trend = { kind: 'sudden' };
    }

    // Rare events: an increase built on one or two occurrences is not meaningful.
    const adjustments = contextAdjustments(f, assignment, studentContext);
    const u = f.unit || '';
    const base100 = /per 1,000 words/.test(u) ? 1000 : /per 100 words/.test(u) ? 100 : null;
    const occurrences = base100 ? (x * current.wordCount) / base100 : /% of sentences/.test(u) ? (x * current.doc.sentences.length) / 100 : null;
    if (occurrences != null && rawZ > 0 && occurrences < 3) {
      z *= Math.max(0, occurrences) / 3;
      adjustments.push({ factor: 1, reason: `Only ${Math.round(occurrences)} occurrence${Math.round(occurrences) === 1 ? '' : 's'} in this piece, so the difference counts for less.` });
    }
    const factor = adjustments.reduce((p, a) => p * a.factor, 1);
    z *= factor;

    // Evidence quality: how reliable is this comparison?
    let quality = basis === 'reference' ? 'Low' : ({ strong: 'High', preferred: 'High', minimum: 'Moderate' }[profile.sufficiency.level] || 'Low');
    if (isProcess && basis === 'student') quality = base.n >= 3 ? 'High' : 'Moderate';
    if (isProcess && current.process?.source === 'report') quality = lowerQuality(quality);
    if (f.category === 'discourse' && quality === 'High') quality = 'Moderate';
    if (!isProcess && current.wordCount < 250) quality = lowerQuality(quality);
    if (!isProcess && basis === 'student' && profile.nEff < 2.5) quality = lowerQuality(quality);
    if (f.weak) quality = 'Low';

    const strength = strengthOf(z, cfg);
    const above = rawZ > 0;
    const outsideCount = base.points.length ? base.points.filter((p) => (above ? x > p.v : x < p.v)).length : null;
    const pctChange = Math.abs(base.mean) >= f.minSpread ? ((x - base.mean) / Math.abs(base.mean)) * 100 : null;

    const parts = [];
    parts.push(`${f.label}: ${withUnit(x, f)} in this piece.`);
    if (basis === 'student') {
      parts.push(`Typical for this student: ${withUnit(base.mean, f)} (range ${fmtNum(base.min, f.digits)}–${fmtNum(base.max, f.digits)} across ${base.n} earlier sample${base.n === 1 ? '' : 's'}).`);
      if (outsideCount != null && Math.abs(rawZ) >= 1) parts.push(`It is ${above ? 'higher' : 'lower'} than in ${outsideCount} of ${base.points.length} earlier samples.`);
    } else {
      parts.push(`No earlier process data for this student, so it is compared with a general reference value of about ${withUnit(base.mean, f)}.`);
    }
    if (trend?.kind === 'development') parts.push(`Earlier samples show a steady ${trend.slope > 0 ? 'increase' : 'decrease'} (next value expected around ${withUnit(trend.predicted, f)}), so this looks like continued development rather than a sudden change.`);
    if (trend?.kind === 'sudden') parts.push('Earlier samples were comparatively stable, so this is an abrupt change.');

    rows.push({
      feature: f,
      id: f.id,
      category: f.category,
      group: f.group,
      label: f.label,
      current: x,
      baselineMean: base.mean,
      baselineMin: base.min,
      baselineMax: base.max,
      n: base.n,
      basis,
      compared: true,
      rawZ,
      z,
      deviation: Math.round(z * 100) / 100,
      pctChange,
      outsideCount,
      strength,
      evidence_quality: quality,
      weight: f.weight ?? 1,
      weak: Boolean(f.weak),
      trend,
      adjustments,
      explanation: parts.join(' '),
      alternative_explanations: ALTERNATIVES[f.group] || ALTERNATIVES[f.category] || [],
    });
  }
  return rows;
}

// Anomaly records in the shape described in the specification.
export function toAnomaly(row) {
  return {
    id: `a-${row.id}`,
    category: row.category,
    feature: row.label,
    deviation: row.deviation,
    strength: row.strength,
    evidence_quality: row.evidence_quality,
    explanation: row.explanation,
    alternative_explanations: row.alternative_explanations,
    row,
  };
}
