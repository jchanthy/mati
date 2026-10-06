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
  showResults: boolean;
  options: PollOption[];
  correctOptionId?: number;
}

export interface Room {
  code: string;
  title: string;
  activePollId: string | null;
  status: 'draft' | 'active' | 'closed' | 'completed';
  mode?: 'live' | 'survey';
  theme?: 'dark' | 'light';
  createdAt: any;
  timerDuration?: number;
  timerEndsAt?: number | null;
}

export interface Vote {
  voterId: string;
  optionId: number;
  timestamp: any;
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

export interface DetailedSessionSummary {
  totalQuestions: number;
  totalVotes: number;
  totalScoredQuestions: number;
  overallAccuracy: number;
  hasScoredQuestions: boolean;
  topConsensusPercentage: number;
  questionResults: QuestionResultSummary[];
}

