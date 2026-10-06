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
  status: 'draft' | 'active' | 'closed';
  createdAt: any;
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
}
