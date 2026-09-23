// Process detectors. Each looks at one aspect of how the text developed and
// returns zero or more signals with the evidence that produced them.

import { makeSignal, grade, fmtTime, fmtDuration, fmtNum, pct, plural } from '../util.js';
import { typedBursts, stretches, paragraphProcess, typingWpm, sustainedWpm, typedRevisionRatio, largestTypedWindow } from './metrics.js';
import { mergeRanges, wordsInRanges } from './replay.js';
import { quotedRanges, countWords } from '../text/tokenize.js';
import { sophistication } from '../text/features.js';

const rangesOf = (events) => mergeRanges(events.flatMap((e) => e.ranges || []));

export const processDetectors = [
  {
    id: 'paste',
    category: 'process',
    name: 'Paste event',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config, baseline } = ctx;
      const c = config.paste;
      const out = [];
      const quotes = quotedRanges(rep.finalText);
      for (const e of rep.events) {
        if (e.type !== 'paste' || e.insertedWords < c.minWords) continue;
        const surviving = e.survivingWords;
        const quotedChars = e.ranges.reduce((n, r) => n + quotes.reduce((m, q) => m + Math.max(0, Math.min(r.end, q.end) - Math.max(r.start, q.start)), 0), 0);
        const quoteShare = e.surviving ? quotedChars / e.surviving : 0;
        const large = e.insertedWords >= c.largeWords;
        const adjustments = [];
        let severity = grade(e.insertedWords, c.mediumWords, c.highWords);
        if (e.internalMove) {
          severity = 'Low';
          adjustments.push('Matches text the student deleted earlier in this document (probably moving their own writing), so severity is set to Low.');
        } else if (quoteShare >= c.quoteShareDowngrade) {
          severity = 'Low';
          adjustments.push(`${pct(quoteShare)} of the pasted text is inside quotation marks (probably quoted evidence), so severity is set to Low.`);
        } else if (surviving < c.minWords) {
          severity = 'Low';
          adjustments.push('Most of the pasted text was later removed or rewritten.');
        }
        const typical = baseline?.process?.largestInsertionWords;
        out.push(makeSignal({
          id: `paste-${e.id}`,
          detector: 'paste',
          category: 'process',
          name: large ? 'Large insertion (paste)' : 'Paste event',
          severity,
          finding: `${e.insertedWords} words appeared in a single paste at ${fmtTime(e.t)}${surviving !== e.insertedWords ? `; ${surviving} remain in the final text` : ''}.`,
          evidence: [
            { label: 'Time', value: fmtTime(e.t) },
            { label: 'Words pasted', value: e.insertedWords },
            { label: 'Words remaining in final text', value: `${surviving} (${pct(surviving / Math.max(1, countWords(rep.finalText)))} of the final text)` },
            { label: 'Share inside quotation marks', value: pct(quoteShare) },
            ...(e.internalMove ? [{ label: 'Internal move', value: 'Yes: matches earlier deleted text' }] : []),
          ],
          baseline: typical != null ? `This student's largest insertion in earlier logged work: ${typical} words.` : null,
          explanation: 'A substantial amount of text entered the document in one step, so how that passage was drafted is not visible in the log.',
          alternatives: [
            'Drafted in another document, notes app or on paper, then pasted in.',
            'Moved or restructured their own text.',
            'Pasted a quotation or source material to cite.',
            'Collaborative or teacher-approved drafting tool.',
          ],
          rule: `Counted from ${c.minWords} words; Medium at ${c.mediumWords}; High at ${c.highWords} words.`,
          adjustments,
          ranges: e.ranges,
          time: { start: e.t, end: e.t },
          eventIds: [e.id],
          tags: ['insertion'],
        }));
      }
      return out;
    },
  },

  {
    id: 'large-insertion',
    category: 'process',
    name: 'Large insertion',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config, baseline } = ctx;
      const c = config.insertion;
      const typical = baseline?.process?.largestTypedWindowWords;
      const threshold = typical ? Math.min(c.mediumWords, Math.max(40, typical * c.baselineMediumRatio)) : c.mediumWords;
      return typedBursts(rep, c.windowSec, threshold).map((b) => {
        const ratio = typical ? b.words / typical : null;
        const severity = ratio ? grade(ratio, c.baselineMediumRatio, c.baselineHighRatio) : grade(b.words, c.mediumWords, c.highWords);
        const ranges = rangesOf(b.events);
        return makeSignal({
          id: `large-insertion-${b.events[0].id}`,
          detector: 'large-insertion',
          category: 'process',
          name: 'Large insertion',
          severity,
          finding: `${b.words} words were typed within ${fmtDuration(Math.max(1000, b.end - b.start))} (${fmtTime(b.start)}–${fmtTime(b.end)}).`,
          evidence: [
            { label: 'Window', value: `${fmtTime(b.start)} – ${fmtTime(b.end)}` },
            { label: 'Words added', value: b.words },
            { label: 'Editing events in window', value: b.events.length },
          ],
          baseline: typical ? `Student's typical largest typed insertion in ${c.windowSec} s: ${typical} words (this is ${fmtNum(ratio, 1)}×).` : null,
          explanation: 'Much more text was added in a short period than is usual for typing.',
          alternatives: ['Speech-to-text dictation.', 'Typing from a handwritten or memorised draft.', 'Unusually fast typist.', 'Editor auto-complete or text expansion.'],
          rule: typical
            ? `Relative to the student's baseline: Medium at ${c.baselineMediumRatio}×, High at ${c.baselineHighRatio}×.`
            : `Medium at ${c.mediumWords} words within ${c.windowSec} s; High at ${c.highWords}.`,
          ranges,
          time: { start: b.start, end: b.end },
          eventIds: b.events.map((e) => e.id),
          tags: ['insertion', 'speed'],
        });
      });
    },
  },

  {
    id: 'continuous-composition',
    category: 'process',
    name: 'Continuous composition',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config, baseline } = ctx;
      const c = config.continuous;
      return stretches(rep, config.general.idleGapSec)
        .filter((s) => s.words >= c.minWords && s.deleted / Math.max(1, s.inserted) <= c.maxRevisionRatio)
        .map((s) => {
          const ratio = s.deleted / Math.max(1, s.inserted);
          return makeSignal({
            id: `continuous-${s.events[0].id}`,
            detector: 'continuous-composition',
            category: 'process',
            name: 'Continuous composition',
            severity: s.words >= c.highWords ? 'Medium' : 'Low',
            finding: `${s.words} words were typed in one stretch (${fmtDuration(s.end - s.start)}) with ${pct(ratio)} of characters deleted.`,
            evidence: [
              { label: 'Stretch', value: `${fmtTime(s.start)} – ${fmtTime(s.end)}` },
              { label: 'Words typed', value: s.words },
              { label: 'Characters deleted / inserted', value: `${s.deleted} / ${s.inserted}` },
            ],
            baseline: baseline?.process?.typedRevisionRatio != null ? `Student's usual revision ratio while typing: ${pct(baseline.process.typedRevisionRatio)}.` : null,
            explanation: 'A long passage was written straight through with almost no corrections or changes.',
            alternatives: ['Copying from a handwritten draft or outline.', 'Very fluent writer on a familiar topic.', 'Timed writing where revision was discouraged.'],
            rule: `At least ${c.minWords} words with at most ${pct(c.maxRevisionRatio)} deleted; Medium at ${c.highWords} words. Never High on its own.`,
            ranges: rangesOf(s.events),
            time: { start: s.start, end: s.end },
            eventIds: s.events.map((e) => e.id),
          });
        });
    },
  },

  {
    id: 'low-revision',
    category: 'process',
    name: 'Low revision rate',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config, baseline } = ctx;
      const c = config.revision;
      const words = countWords(rep.finalText);
      if (words < c.minWords) return [];
      const ratio = rep.revisionRatio;
      const reference = baseline?.process?.revisionRatio ?? c.referenceRatio;
      const share = reference ? ratio / reference : 1;
      if (share > c.mediumShare) return [];
      const severity = share <= c.highShare ? 'High' : 'Medium';
      return [makeSignal({
        id: 'low-revision',
        detector: 'low-revision',
        category: 'process',
        name: 'Low revision rate',
        severity,
        finding: `${pct(ratio)} of inserted characters were later deleted, ${fmtNum(share * 100, 0)}% of the ${baseline?.process ? "student's usual" : 'reference'} rate.`,
        evidence: [
          { label: 'Characters inserted', value: rep.totals.insertedChars },
          { label: 'Characters deleted', value: rep.totals.deletedChars },
          { label: 'Revision ratio (all text)', value: pct(ratio) },
          { label: 'Revision ratio (typed text only)', value: pct(typedRevisionRatio(rep)) },
        ],
        baseline: baseline?.process ? `Student's usual revision ratio: ${pct(baseline.process.revisionRatio)} (from ${plural(baseline.process.count, 'earlier log')}).` : `No process baseline; compared with a reference ratio of ${pct(c.referenceRatio)}.`,
        explanation: 'The finished text shows much less deleting and rewriting than usual.',
        alternatives: ['Revision happened in another document or on paper.', 'Confident writer on a familiar topic.', 'Short time available for the task.'],
        rule: `Medium below ${pct(c.mediumShare)} of the baseline/reference ratio; High below ${pct(c.highShare)}.`,
        ranges: [],
        time: { start: rep.start, end: rep.end },
      })];
    },
  },

  {
    id: 'linear-drafting',
    category: 'process',
    name: 'Linear drafting',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config } = ctx;
      const c = config.linear;
      const paras = paragraphProcess(rep, ctx.processDoc);
      const typedParas = paras.filter((p) => p.pastedShare < 0.5);
      const totalWords = typedParas.reduce((n, p) => n + p.words, 0);
      const untouched = typedParas.filter((p) => p.words >= c.minParagraphWords && p.edits === 0 && p.midEdits === 0);
      const untouchedWords = untouched.reduce((n, p) => n + p.words, 0);
      const share = totalWords ? untouchedWords / totalWords : 0;
      if (!untouched.length || share < c.mediumShare) return [];
      return [makeSignal({
        id: 'linear-drafting',
        detector: 'linear-drafting',
        category: 'process',
        name: 'Linear drafting',
        severity: share >= c.highShare ? 'High' : 'Medium',
        finding: `${plural(untouched.length, 'typed paragraph')} (${pct(share)} of typed text) were written start to finish with no corrections or later changes.`,
        evidence: untouched.map((p) => ({ label: `Paragraph ${p.index + 1}`, value: `${p.words} words, 0 edits, typed ${fmtTime(p.firstT)}–${fmtTime(p.lastT)}` })),
        explanation: 'These passages appear in polished form, with no visible intermediate development.',
        alternatives: ['Typed from a handwritten or memorised draft.', 'Strong, fluent writer.', 'Revision done mentally before typing.'],
        rule: `Paragraphs of ${c.minParagraphWords}+ words with zero edits; Medium at ${pct(c.mediumShare)} of typed text, High at ${pct(c.highShare)}. Pasted paragraphs are reported under Paste events.`,
        ranges: untouched.map((p) => ({ start: p.start, end: p.end })),
        time: { start: Math.min(...untouched.map((p) => p.firstT)), end: Math.max(...untouched.map((p) => p.lastT)) },
      })];
    },
  },

  {
    id: 'writing-speed',
    category: 'process',
    name: 'Writing-speed anomaly',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config, baseline } = ctx;
      const c = config.speed;
      const peak = sustainedWpm(rep, c.windowSec);
      const avg = typingWpm(rep);
      const base = baseline?.process?.sustainedWpm;
      let severity = null;
      let rule;
      if (base) {
        const ratio = peak / base;
        if (ratio >= c.baselineMediumRatio) severity = grade(ratio, c.baselineMediumRatio, c.baselineHighRatio);
        rule = `Relative to the student's baseline peak speed: Medium at ${c.baselineMediumRatio}×, High at ${c.baselineHighRatio}×.`;
      } else {
        if (peak >= c.plausibleWpm) severity = grade(peak, c.plausibleWpm, c.highWpm);
        rule = `Sustained typed speed over ${c.windowSec} s: Medium at ${c.plausibleWpm} wpm, High at ${c.highWpm} wpm.`;
      }
      if (!severity) return [];
      const words = largestTypedWindow(rep, c.windowSec);
      const burst = typedBursts(rep, c.windowSec, Math.max(1, words))[0];
      return [makeSignal({
        id: 'writing-speed',
        detector: 'writing-speed',
        category: 'process',
        name: 'Writing-speed anomaly',
        severity,
        finding: `Peak typed speed of ${fmtNum(peak, 0)} words per minute over ${c.windowSec} s (average ${fmtNum(avg, 0)} wpm while active).`,
        evidence: [
          { label: 'Peak sustained speed', value: `${fmtNum(peak, 0)} wpm` },
          { label: 'Average while active', value: `${fmtNum(avg, 0)} wpm` },
          { label: 'Active writing time', value: fmtDuration(rep.activeMs) },
        ],
        baseline: base ? `Student's usual peak speed: ${fmtNum(base, 0)} wpm.` : null,
        explanation: 'Text was typed faster than is usual for this student or for sustained composition.',
        alternatives: ['Speech-to-text dictation.', 'Copying from a handwritten draft (transcribing is faster than composing).', 'Very fast typist.'],
        rule,
        ranges: burst ? rangesOf(burst.events) : [],
        time: burst ? { start: burst.start, end: burst.end } : null,
        eventIds: burst ? burst.events.map((e) => e.id) : [],
        tags: ['speed'],
      })];
    },
  },

  {
    id: 'revision-discontinuity',
    category: 'process',
    name: 'Revision discontinuity',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config } = ctx;
      const c = config.discontinuity;
      const paras = paragraphProcess(rep, ctx.processDoc).filter((p) => p.pastedShare < 0.5 && p.quotedShare < 0.6);
      const revised = paras.filter((p) => p.density >= c.revisedDensity && p.words >= 20);
      const untouched = paras.filter((p) => p.density <= c.unrevisedDensity && p.words >= c.minWords);
      if (!revised.length || !untouched.length) return [];
      const words = untouched.reduce((n, p) => n + p.words, 0);
      return [makeSignal({
        id: 'revision-discontinuity',
        detector: 'revision-discontinuity',
        category: 'process',
        name: 'Revision discontinuity',
        severity: words >= c.highWords ? 'Medium' : 'Low',
        finding: `${plural(revised.length, 'paragraph')} ${revised.length === 1 ? 'was' : 'were'} heavily revised, while ${plural(untouched.length, 'paragraph')} (${words} words) ${untouched.length === 1 ? 'was' : 'were'} almost untouched.`,
        evidence: [
          ...revised.map((p) => ({ label: `Paragraph ${p.index + 1} (revised)`, value: `${fmtNum(p.density, 1)} edits per 100 words` })),
          ...untouched.map((p) => ({ label: `Paragraph ${p.index + 1} (untouched)`, value: `${fmtNum(p.density, 1)} edits per 100 words, ${p.words} words` })),
        ],
        explanation: 'Some sections went through visible development while others appeared almost fully formed.',
        alternatives: ['Some sections were easier or planned in advance.', 'The student drafted part of the essay elsewhere.', 'Introductions are often revised more than body paragraphs.'],
        rule: `Revised at ${c.revisedDensity}+ edits per 100 words; untouched at ${c.unrevisedDensity} or fewer, with ${c.minWords}+ words. Medium at ${c.highWords}+ untouched words; never High on its own.`,
        ranges: untouched.map((p) => ({ start: p.start, end: p.end })),
      })];
    },
  },

  {
    id: 'late-polishing',
    category: 'process',
    name: 'Late polishing',
    requires: ['log'],
    run(ctx) {
      const { replay: rep, config } = ctx;
      const c = config.latePolish;
      const textEvents = rep.textEvents;
      if (textEvents.length < 5) return [];
      const cut = rep.start + (rep.end - rep.start) * (1 - c.lateShare);
      const late = textEvents.filter((e) => e.t >= cut && e.ranges.length);
      const early = textEvents.filter((e) => e.t < cut && e.ranges.length);
      const lateRanges = mergeRanges(late.flatMap((e) => e.ranges));
      const earlyRanges = mergeRanges(early.flatMap((e) => e.ranges));
      const lateWords = wordsInRanges(rep.finalText, lateRanges);
      if (lateWords < c.minWords || !earlyRanges.length) return [];
      const lateText = lateRanges.map((r) => rep.finalText.slice(r.start, r.end)).join(' ');
      const earlyText = earlyRanges.map((r) => rep.finalText.slice(r.start, r.end)).join(' ');
      const sl = sophistication(lateText);
      const se = sophistication(earlyText);
      const ratio = (sl + 0.02) / (se + 0.02); // smoothed so tiny early rates don't explode
      if (ratio < c.mediumRatio) return [];
      return [makeSignal({
        id: 'late-polishing',
        detector: 'late-polishing',
        category: 'process',
        name: 'Late polishing',
        severity: grade(ratio, c.mediumRatio, c.highRatio),
        finding: `${lateWords} words of the final text were added in the last ${pct(c.lateShare)} of the session, with a higher share of long words than earlier text (${fmtNum(sl * 100, 1)}% vs. ${fmtNum(se * 100, 1)}%).`,
        evidence: [
          { label: 'Late period', value: `after ${fmtTime(cut)}` },
          { label: 'Words added late', value: lateWords },
          { label: 'Words of 3+ syllables (late text)', value: `${fmtNum(sl * 100, 1)}%` },
          { label: 'Words of 3+ syllables (earlier text)', value: `${fmtNum(se * 100, 1)}%` },
        ],
        explanation: 'Noticeably more sophisticated language entered the document near the end of the writing process.',
        alternatives: ['Deliberate final vocabulary upgrade during proofreading.', 'Feedback received late in the process.', 'Conclusion or analysis sections naturally use more abstract language.'],
        rule: `Words added in the final ${pct(c.lateShare)} of the session (${c.minWords}+ words). Ratio of long-word rates (late ÷ earlier, each +2% smoothing): Medium at ${c.mediumRatio}×, High at ${c.highRatio}×.`,
        ranges: lateRanges,
        time: { start: cut, end: rep.end },
        eventIds: late.map((e) => e.id),
      })];
    },
  },
];

