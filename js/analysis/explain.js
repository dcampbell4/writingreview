// Legitimate alternative explanations and context adjustments.
// Kept in one place so the wording stays neutral and consistent.

export const ALTERNATIVES = {
  sentence: ['Instruction on sentence variety or combining.', 'Different genre or task demands (e.g. timed vs. polished).', 'Maturation and genuine growth.', 'Editing help from a tutor, parent or peer.', 'Use of grammar or editing tools.'],
  lexical: ['The assignment required specialised vocabulary.', 'The student received instruction on the terminology.', 'Teacher-provided vocabulary lists or sentence frames.', 'Reading of critical sources for this task.', 'Thesaurus or dictionary use.', 'An unfamiliar topic compared with earlier writing.'],
  syntax: ['Explicit instruction on complex sentences or punctuation.', 'Imitation of a model essay studied in class.', 'Editing help or grammar tools.', 'Genuine development over time.'],
  voice: ['Feedback asking the student to change their approach (e.g. avoid first person).', 'Sentence frames or a paragraph template.', 'A different audience or purpose for this task.'],
  mechanics: ['Spellcheck or grammar tools in the writing environment.', 'Careful proofreading for a graded task.', 'Different device or keyboard.'],
  surface: ['Transition words and concession structures are commonly taught.', 'Writing templates or sentence frames.', 'Model essays studied in class.'],
  architecture: ['A new essay structure taught in class (e.g. adding counter-arguments).', 'A model essay or rubric that rewards this structure.', 'Planning with a teacher or tutor.', 'A different task type.'],
  abstraction: ['Recent instruction in theory or critical lenses.', 'Reading secondary sources.', 'Topic invites broader thematic discussion.', 'Genuine development in analytical thinking.'],
  reasoning: ['Instruction on analysis frameworks (technique → effect → context).', 'A model essay studied in class.', 'Discussion of the text in class before writing.'],
  evidence: ['Evidence selected together in class.', 'Research or secondary sources were allowed.', 'A different text or genre with different kinds of evidence.'],
  process: ['Fluent writing on a well-prepared topic.', 'Speech-to-text dictation.', 'Drafting elsewhere (paper, another document, a phone) and typing it up.', 'Prior preparation or a memorised plan.', 'Different writing conditions (e.g. at home vs. in class).'],
  external: ["The student's own notes or earlier writing.", 'Teacher-provided material or quotations.', 'Research sources (should be cited).', 'Collaborative work.', 'Moving text from another document.', 'Writing assistance, including AI tools.'],
};

// Context answers (assignment) and student circumstances that change how much
// a deviation should count. `factor` multiplies the deviation.
export function contextAdjustments(feature, assignment = {}, student = {}) {
  const out = [];
  const g = feature.group;
  const add = (factor, reason) => out.push({ factor, reason });
  if (assignment.sentenceFrames && ['voice', 'surface', 'architecture', 'sentence'].includes(g)) add(0.6, 'Students were given sentence frames for this task.');
  if (assignment.modelEssay && ['architecture', 'reasoning', 'voice', 'surface', 'syntax'].includes(g)) add(0.6, 'A model essay was studied before this task.');
  if (assignment.researchAllowed && ['evidence', 'lexical', 'abstraction'].includes(g)) add(0.75, 'Outside research was permitted.');
  if (assignment.notesAllowed && g === 'external') add(0.7, 'Students could use notes (which may be pasted in).');
  if (assignment.collaborationAllowed && ['process', 'external', 'architecture'].includes(g)) add(0.75, 'Collaboration was permitted.');
  if (assignment.taughtTerms?.length && ['lexical', 'abstraction'].includes(g)) add(0.85, `Terms taught for this task are excluded from vocabulary counts (${assignment.taughtTerms.slice(0, 6).join(', ')}${assignment.taughtTerms.length > 6 ? '…' : ''}).`);
  if (student.dictation && ['process'].includes(g) && ['typingRate', 'longestContinuous', 'continuousShare', 'revisionDensity', 'surfaceEditRate'].includes(feature.id)) add(0.5, 'The student uses dictation / speech-to-text.');
  if (student.draftsElsewhere && ['process', 'external'].includes(g)) add(0.5, 'The student is known to draft elsewhere and paste in.');
  if (student.ell && ['lexical', 'surface', 'mechanics', 'voice'].includes(g)) add(0.7, 'The student is an English language learner.');
  if (student.assistiveTools && ['mechanics', 'lexical', 'process'].includes(g)) add(0.7, 'The student uses assistive writing tools.');
  return out;
}

export const DISCLAIMER = 'An anomaly is not evidence of misconduct. Students can change their writing because of tutoring, instruction, maturation, editing, collaboration, genre, topic familiarity, or other legitimate reasons.';

export const LIMITATIONS = [
  'This tool compares writing with the student’s own earlier samples. It cannot establish who or what produced a text, and it does not estimate whether AI was used.',
  'Style and discourse measures are computed with transparent rules on this device (no AI model). Argument roles such as "claim" or "evidence" are approximations and can be wrong for unusual sentence structures.',
  'Comparisons are only as good as the baseline: few samples, very different genres or short texts make them less reliable.',
  'Process evidence depends on what the writing environment recorded. Imported reports give fewer details than a full writing log, and work done in other documents is invisible.',
];
