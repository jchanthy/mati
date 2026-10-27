import { Poll, Vote } from '../models/poll.model';

/** A participant's answer to any supported question type. */
export interface PollAnswer {
  optionIds?: number[];
  textAnswer?: string;
  matches?: { [pairId: string]: string };
}

/** Normalizes text for lenient comparison (trim, collapse whitespace, optional case folding). */
export function normalizeAnswerText(value: string, caseSensitive = false): string {
  const collapsed = (value || '').replace(/\s+/g, ' ').trim();
  return caseSensitive ? collapsed : collapsed.toLowerCase();
}

/** Compares a normalized answer with an accepted answer; * matches any run of characters (Moodle wildcard). */
function matchesAcceptedAnswer(accepted: string, givenNormalized: string, caseSensitive: boolean): boolean {
  const key = normalizeAnswerText(accepted, caseSensitive);
  if (!key.includes('*')) return key === givenNormalized;
  const pattern = key.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + pattern + '$').test(givenNormalized);
}

/** Ids of all correct options for option-based questions. */
export function getCorrectOptionIds(poll: Poll): number[] {
  if (poll.correctOptionIds && poll.correctOptionIds.length > 0) return poll.correctOptionIds;
  const flagged = (poll.options || []).filter(o => o.isCorrect).map(o => o.id);
  if (flagged.length > 0) return flagged;
  return poll.correctOptionId !== undefined && poll.correctOptionId !== null ? [poll.correctOptionId] : [];
}

/** True when the question has an answer key (so it counts toward accuracy / leaderboard). */
export function isScoredPoll(poll: Poll | null | undefined): boolean {
  if (!poll) return false;
  switch (poll.type) {
    case 'short_answer':
      return (poll.acceptedAnswers || []).length > 0;
    case 'matching':
      return (poll.matchPairs || []).length > 0;
    default:
      return getCorrectOptionIds(poll).length > 0;
  }
}

/** True when the question needs more than a single tap to answer. */
export function isComplexPoll(poll: Poll | null | undefined): boolean {
  return !!poll && (poll.type === 'multi_select' || poll.type === 'short_answer' || poll.type === 'matching');
}

/** Whether a given option is part of the answer key. */
export function isCorrectOption(poll: Poll, optionId: number): boolean {
  return getCorrectOptionIds(poll).includes(optionId);
}

/** Extracts the answer out of a stored vote. */
export function voteToAnswer(vote: Vote): PollAnswer {
  return {
    optionIds: vote.optionIds && vote.optionIds.length > 0 ? vote.optionIds : (vote.optionId ? [vote.optionId] : []),
    textAnswer: vote.textAnswer,
    matches: vote.matches
  };
}

/**
 * All-or-nothing grading: an answer is correct only when it matches the answer key exactly.
 * Returns false for questions without an answer key.
 */
export function evaluateAnswer(poll: Poll, answer: PollAnswer | null | undefined): boolean {
  if (!answer || !isScoredPoll(poll)) return false;

  switch (poll.type) {
    case 'short_answer': {
      const given = normalizeAnswerText(answer.textAnswer || '', !!poll.caseSensitive);
      if (!given) return false;
      return (poll.acceptedAnswers || []).some(a => matchesAcceptedAnswer(a, given, !!poll.caseSensitive));
    }
    case 'matching': {
      const pairs = poll.matchPairs || [];
      const given = answer.matches || {};
      return pairs.every(p =>
        normalizeAnswerText(given[String(p.id)] || '', false) === normalizeAnswerText(p.answer, false)
      );
    }
    default: {
      const correct = getCorrectOptionIds(poll);
      const selected = Array.from(new Set(answer.optionIds || []));
      return selected.length === correct.length && correct.every(id => selected.includes(id));
    }
  }
}

export function evaluateVote(poll: Poll, vote: Vote): boolean {
  return evaluateAnswer(poll, voteToAnswer(vote));
}

/** Human readable version of the answer key, for banners / reports / CSV. */
export function describeCorrectAnswer(poll: Poll): string {
  switch (poll.type) {
    case 'short_answer':
      return (poll.acceptedAnswers || []).join(' / ');
    case 'matching':
      return (poll.matchPairs || []).map(p => `${p.prompt} → ${p.answer}`).join('; ');
    default: {
      const ids = getCorrectOptionIds(poll);
      return (poll.options || []).filter(o => ids.includes(o.id)).map(o => o.text).join(' + ');
    }
  }
}

/** Short label for UI badges. */
export function pollTypeLabel(type: Poll['type'] | undefined): string {
  switch (type) {
    case 'multi_select': return 'Multiple answers';
    case 'true_false': return 'True / False';
    case 'short_answer': return 'Short answer';
    case 'matching': return 'Matching';
    default: return 'Single choice';
  }
}
