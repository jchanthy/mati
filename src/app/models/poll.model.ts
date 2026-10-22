export interface PollOption {
  id: number;
  text: string;
  isCorrect?: boolean;
}

export interface Poll {
  id: string;
  question: string;
  type: 'multiple_choice';
  order: number;
  isLocked: boolean;
  isSkipped?: boolean;
  showResults: boolean;
  showCorrectAnswer?: boolean;
  options: PollOption[];
  correctOptionId?: number;
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
  optionId: number;
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
}

export interface QuestionResultSummary {
  pollId: string;
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
