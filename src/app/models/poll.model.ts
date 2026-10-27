export interface PollOption {
  id: number;
  text: string;
  isCorrect?: boolean;
}

/**
 * Supported question types (mirrors the most common Moodle quiz types):
 * - multiple_choice: pick exactly one option
 * - multi_select:    pick one or more options (Moodle multichoice with multiple answers)
 * - true_false:      two options, pick one
 * - short_answer:    free text, graded against a list of accepted answers
 * - matching:        match each prompt to one of the available answers
 */
export type PollType = 'multiple_choice' | 'multi_select' | 'true_false' | 'short_answer' | 'matching';

export interface MatchPair {
  id: number;
  prompt: string;
  answer: string;
}

export interface Poll {
  id: string;
  question: string;
  type: PollType;
  order: number;
  isLocked: boolean;
  isSkipped?: boolean;
  showResults: boolean;
  showCorrectAnswer?: boolean;
  options: PollOption[];
  correctOptionId?: number;
  /** All correct option ids (multi_select). correctOptionId mirrors the first one for legacy code. */
  correctOptionIds?: number[];
  /** Accepted text answers (short_answer). */
  acceptedAnswers?: string[];
  /** Whether short answers are compared case-sensitively. */
  caseSensitive?: boolean;
  /** Prompt/answer pairs (matching). options holds the distinct answers shown in the dropdowns. */
  matchPairs?: MatchPair[];
}

export interface Room {
  code: string;
  title: string;
  activePollId: string | null;
  activePoll?: Poll | null;
  status: 'draft' | 'active' | 'closed' | 'completed' | 'inactive';
  mode?: 'live' | 'survey';
  theme?: 'dark' | 'light';
  createdAt: any;
  startDate?: string;
  endDate?: string;
  timerDuration?: number;
  timerEndsAt?: number | null;
  autoAdvance?: boolean;
  stageView?: 'question' | 'leaderboard';
  leaderboardLimit?: 5 | 10 | 'all';
  defaultHideResults?: boolean;
  selectedPollIds?: string[];
  ownerId?: string;
  ownerEmail?: string;
}

export interface Vote {
  voterId: string;
  /** First selected option (kept for single-choice compatibility; 0 when not applicable). */
  optionId: number;
  /** All selected options (multi_select). */
  optionIds?: number[];
  /** Typed answer (short_answer). */
  textAnswer?: string;
  /** Selected answer for each matching prompt, keyed by pair id. */
  matches?: { [pairId: string]: string };
  timestamp: any;
  voterName?: string;
  timeSpentSeconds?: number;
}

export interface PollStats {
  poll: Poll;
  totalVotes: number;
  votesPerOption: { [optionId: number]: number };
  percentages: { [optionId: number]: number };
  timerDuration?: number;
  timerEndsAt?: number | null;
  correctPercentage?: number;
  /** Number of respondents whose whole answer was correct (scored questions only). */
  correctCount?: number;
  /** Aggregated typed answers (short_answer). */
  textResponses?: { text: string; count: number; isCorrect: boolean }[];
  /** Per-prompt breakdown (matching). */
  pairStats?: { pairId: number; prompt: string; answer: string; correct: number; total: number }[];
}

export interface QuestionResultSummary {
  pollId: string;
  type?: PollType;
  /** True when the question has an answer key and counts toward accuracy. */
  isScored?: boolean;
  /** Human readable correct answer (any question type). */
  correctAnswerText?: string;
  textResponses?: { text: string; count: number; isCorrect: boolean }[];
  order: number;
  question: string;
  totalVotes: number;
  correctOptionId?: number;
  correctOptionText?: string;
  correctVotes: number;
  correctPercentage: number;
  winningOptionId: number;
  winningOptionText: string;
  winningPercentage: number;
  options: {
    id: number;
    text: string;
    votes: number;
    percentage: number;
    isCorrect: boolean;
  }[];
}

export interface QuizLeaderboardEntry {
  rank: number;
  voterId: string;
  voterName: string;
  correctAnswers: number;
  totalQuestions: number;
  answeredQuestions?: number;
  accuracy: number;
  totalTimeSeconds: number;
  avgTimeSeconds: number;
}

export interface DetailedSessionSummary {
  totalQuestions: number;
  totalVotes: number;
  totalScoredQuestions: number;
  overallAccuracy: number;
  hasScoredQuestions: boolean;
  topConsensusPercentage: number;
  questionResults: QuestionResultSummary[];
  leaderboard?: QuizLeaderboardEntry[];
}
