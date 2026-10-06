export interface PollOption {
  id: number;
  text: string;
}

export interface Poll {
  id: string;
  question: string;
  type: 'multiple_choice';
  order: number;
  isLocked: boolean;
  showResults: boolean;
  options: PollOption[];
}

export interface Room {
  code: string;
  title: string;
  activePollId: string | null;
  status: 'draft' | 'active' | 'closed' | 'completed';
  mode?: 'live' | 'survey';
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
}

