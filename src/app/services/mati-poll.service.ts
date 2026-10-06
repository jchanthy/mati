import { Injectable, inject, signal, computed, PLATFORM_ID, Optional } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  docData,
  collectionData,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, of, combineLatest, map } from 'rxjs';
import { Room, Poll, Vote, PollStats } from '../models/poll.model';

@Injectable({
  providedIn: 'root'
})
export class MatiPollService {
  private firestore = inject(Firestore, { optional: true });
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  // Local reactive cache fallback / hybrid store for instant demo and offline mode
  private mockRooms$ = new BehaviorSubject<Map<string, Room>>(new Map());
  private mockPolls$ = new BehaviorSubject<Map<string, Poll[]>>(new Map());
  private mockVotes$ = new BehaviorSubject<Map<string, Vote[]>>(new Map());

  // Active state signals
  readonly currentRoom = signal<Room | null>(null);
  readonly currentPoll = signal<Poll | null>(null);
  readonly currentStats = signal<PollStats | null>(null);
  readonly isConnectedToFirebase = signal<boolean>(false);

  constructor() {
    this.initDefaultMockData();
    if (this.firestore) {
      this.isConnectedToFirebase.set(true);
    }
  }

  /**
   * Generates or fetches persistent voter ID from localStorage
   */
  getOrCreateVoterId(): string {
    if (!this.isBrowser) return 'voter_' + Math.random().toString(36).substring(2, 9);
    
    let voterId = localStorage.getItem('mati_voter_id');
    if (!voterId) {
      voterId = 'mati_usr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
      localStorage.setItem('mati_voter_id', voterId);
    }
    return voterId;
  }

  /**
   * Step 2: createRoom(title: string)
   * Generates 6-character room PIN (e.g. MATI01 or MATI99) and initializes room doc.
   */
  async createRoom(title: string, customCode?: string): Promise<string> {
    const code = (customCode || this.generateRoomCode()).toUpperCase();
    const newRoom: Room = {
      code,
      title: title || 'Mati Live Session',
      activePollId: null,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await setDoc(roomRef, {
          ...newRoom,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.warn('[Mati] Firebase save error, falling back to local state:', err);
      }
    }

    // Update in-memory fallback
    const rooms = this.mockRooms$.getValue();
    rooms.set(code, newRoom);
    this.mockRooms$.next(new Map(rooms));

    return code;
  }

  /**
   * Step 2: createPoll(roomCode: string, question: string, options: string[])
   * Appends poll to sub-collection.
   */
  async createPoll(roomCode: string, question: string, optionTexts: string[]): Promise<Poll> {
    const code = roomCode.toUpperCase();
    const pollId = 'poll_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    
    // Determine order
    const existing = await this.getPollsForRoom(code);
    const order = existing.length + 1;

    const newPoll: Poll = {
      id: pollId,
      question,
      type: 'multiple_choice',
      order,
      isLocked: false,
      showResults: true,
      options: optionTexts.map((text, idx) => ({ id: idx + 1, text }))
    };

    if (this.firestore) {
      try {
        const pollRef = doc(this.firestore, `rooms/${code}/polls/${pollId}`);
        await setDoc(pollRef, newPoll);
      } catch (err) {
        console.warn('[Mati] Firebase createPoll error:', err);
      }
    }

    // Update local state
    const currentPolls = this.mockPolls$.getValue();
    const list = currentPolls.get(code) || [];
    list.push(newPoll);
    currentPolls.set(code, [...list]);
    this.mockPolls$.next(new Map(currentPolls));

    // If no active poll in room, automatically activate this poll
    const room = await this.getRoom(code);
    if (room && !room.activePollId) {
      await this.setActivePoll(code, pollId);
    }

    return newPoll;
  }

  /**
   * Batch append multiple parsed questions to a room.
   */
  async createPollsBatch(roomCode: string, questions: { question: string; options: string[] }[]): Promise<number> {
    const code = roomCode.toUpperCase();
    let count = 0;
    for (const q of questions) {
      await this.createPoll(code, q.question, q.options);
      count++;
    }
    return count;
  }

  /**
   * Step 2: setActivePoll(roomCode: string, pollId: string | null)
   * Sets live question on screen.
   */
  async setActivePoll(roomCode: string, pollId: string | null): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, { activePollId: pollId });
      } catch (err) {
        console.warn('[Mati] Firebase setActivePoll error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.activePollId = pollId;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Step 2: toggleLockPoll(roomCode: string, pollId: string, isLocked: boolean)
   * Opens/closes voting.
   */
  async toggleLockPoll(roomCode: string, pollId: string, isLocked: boolean): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const pollRef = doc(this.firestore, `rooms/${code}/polls/${pollId}`);
        await updateDoc(pollRef, { isLocked });
      } catch (err) {
        console.warn('[Mati] Firebase toggleLockPoll error:', err);
      }
    }

    const pollsMap = this.mockPolls$.getValue();
    const list = pollsMap.get(code) || [];
    const poll = list.find(p => p.id === pollId);
    if (poll) {
      poll.isLocked = isLocked;
      pollsMap.set(code, [...list]);
      this.mockPolls$.next(new Map(pollsMap));
      if (this.currentPoll()?.id === pollId) {
        this.currentPoll.set({ ...poll });
      }
    }
  }

  /**
   * Step 2: toggleShowResults(roomCode: string, pollId: string, show: boolean)
   * Toggles bar chart visibility on stage.
   */
  async toggleShowResults(roomCode: string, pollId: string, show: boolean): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const pollRef = doc(this.firestore, `rooms/${code}/polls/${pollId}`);
        await updateDoc(pollRef, { showResults: show });
      } catch (err) {
        console.warn('[Mati] Firebase toggleShowResults error:', err);
      }
    }

    const pollsMap = this.mockPolls$.getValue();
    const list = pollsMap.get(code) || [];
    const poll = list.find(p => p.id === pollId);
    if (poll) {
      poll.showResults = show;
      pollsMap.set(code, [...list]);
      this.mockPolls$.next(new Map(pollsMap));
      if (this.currentPoll()?.id === pollId) {
        this.currentPoll.set({ ...poll });
      }
    }
  }

  /**
   * Step 2: submitVote(roomCode: string, pollId: string, voterId: string, optionId: number)
   * Records vote in sub-collection atomically.
   */
  async submitVote(roomCode: string, pollId: string, voterId: string, optionId: number): Promise<void> {
    const code = roomCode.toUpperCase();
    const voteKey = `${code}_${pollId}`;
    const newVote: Vote = {
      voterId,
      optionId,
      timestamp: new Date().toISOString()
    };

    if (this.firestore) {
      try {
        const voteRef = doc(this.firestore, `rooms/${code}/polls/${pollId}/votes/${voterId}`);
        await setDoc(voteRef, {
          ...newVote,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.warn('[Mati] Firebase submitVote error:', err);
      }
    }

    // Atomic update in local reactive votes store (1 voter = 1 vote per poll)
    const votesMap = this.mockVotes$.getValue();
    const currentList = votesMap.get(voteKey) || [];
    const filtered = currentList.filter(v => v.voterId !== voterId);
    filtered.push(newVote);
    votesMap.set(voteKey, filtered);
    this.mockVotes$.next(new Map(votesMap));

    // Save voter record in localStorage for quick client check
    if (this.isBrowser) {
      localStorage.setItem(`mati_voted_${code}_${pollId}`, optionId.toString());
    }
  }

  /**
   * Checks if voter has already voted on a specific poll
   */
  getVotedOption(roomCode: string, pollId: string): number | null {
    if (!this.isBrowser) return null;
    const val = localStorage.getItem(`mati_voted_${roomCode.toUpperCase()}_${pollId}`);
    return val ? parseInt(val, 10) : null;
  }

  /**
   * Step 2: listenToActivePoll(roomCode: string)
   * Real-time observable returning poll metadata and aggregated option vote counts.
   */
  listenToActivePoll(roomCode: string): Observable<PollStats | null> {
    const code = roomCode.toUpperCase();

    // RxJS stream listening to Room -> Active Poll -> Votes
    return new Observable<PollStats | null>((subscriber) => {
      let unsubRoom: Unsubscribe | null = null;
      let unsubPoll: Unsubscribe | null = null;
      let unsubVotes: Unsubscribe | null = null;
      let currentActivePollId: string | null = null;

      // Local subscription fallback
      const localSub = combineLatest([
        this.mockRooms$,
        this.mockPolls$,
        this.mockVotes$
      ]).subscribe(([rooms, pollsMap, votesMap]) => {
        const room = rooms.get(code);
        if (!room || !room.activePollId) {
          if (!this.firestore) subscriber.next(null);
          return;
        }

        const pollList = pollsMap.get(code) || [];
        const poll = pollList.find(p => p.id === room.activePollId);
        if (!poll) {
          if (!this.firestore) subscriber.next(null);
          return;
        }

        const voteKey = `${code}_${poll.id}`;
        const votes = votesMap.get(voteKey) || [];
        const stats = this.computeStats(poll, votes);
        if (!this.firestore) {
          this.currentPoll.set(poll);
          this.currentStats.set(stats);
          subscriber.next(stats);
        }
      });

      // If Firestore is available, hook up realtime snapshots
      if (this.firestore) {
        try {
          const roomRef = doc(this.firestore, `rooms/${code}`);
          unsubRoom = onSnapshot(roomRef, (roomSnap) => {
            if (!roomSnap.exists()) {
              // fallback to mock
              const localRoom = this.mockRooms$.getValue().get(code);
              if (!localRoom) {
                subscriber.next(null);
                return;
              }
            }
            const roomData = roomSnap.data() as Room;
            const activeId = roomData?.activePollId;

            if (!activeId) {
              subscriber.next(null);
              if (unsubPoll) unsubPoll();
              if (unsubVotes) unsubVotes();
              return;
            }

            if (activeId !== currentActivePollId) {
              currentActivePollId = activeId;
              if (unsubPoll) unsubPoll();
              if (unsubVotes) unsubVotes();

              const pollRef = doc(this.firestore!, `rooms/${code}/polls/${activeId}`);
              unsubPoll = onSnapshot(pollRef, (pollSnap) => {
                if (!pollSnap.exists()) return;
                const pollData = { id: pollSnap.id, ...pollSnap.data() } as Poll;
                this.currentPoll.set(pollData);

                // Listen to votes subcollection
                const votesCol = collection(this.firestore!, `rooms/${code}/polls/${activeId}/votes`);
                unsubVotes = onSnapshot(votesCol, (votesSnap) => {
                  const votes: Vote[] = votesSnap.docs.map(d => d.data() as Vote);
                  const stats = this.computeStats(pollData, votes);
                  this.currentStats.set(stats);
                  subscriber.next(stats);
                });
              });
            }
          });
        } catch (e) {
          console.warn('[Mati] Firestore real-time listener error, using local pipeline:', e);
        }
      }

      return () => {
        localSub.unsubscribe();
        if (unsubRoom) unsubRoom();
        if (unsubPoll) unsubPoll();
        if (unsubVotes) unsubVotes();
      };
    });
  }

  /**
   * Listen to all polls in a room
   */
  listenToRoomPolls(roomCode: string): Observable<Poll[]> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      return new Observable<Poll[]>((subscriber) => {
        const pollsCol = collection(this.firestore!, `rooms/${code}/polls`);
        const q = query(pollsCol, orderBy('order', 'asc'));
        const unsub = onSnapshot(q, (snapshot) => {
          if (!snapshot.empty) {
            const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
            subscriber.next(list);
          } else {
            subscriber.next(this.mockPolls$.getValue().get(code) || []);
          }
        }, (err) => {
          console.warn('[Mati] Firestore room polls listener error:', err);
          subscriber.next(this.mockPolls$.getValue().get(code) || []);
        });
        return () => unsub();
      });
    }

    return this.mockPolls$.pipe(
      map(mapData => mapData.get(code) || [])
    );
  }

  /**
   * Listen to room metadata
   */
  listenToRoom(roomCode: string): Observable<Room | null> {
    const code = roomCode.toUpperCase();
    return this.mockRooms$.pipe(
      map(mapData => mapData.get(code) || null)
    );
  }

  /**
   * Helper: compute aggregated stats
   */
  computeStats(poll: Poll, votes: Vote[]): PollStats {
    const totalVotes = votes.length;
    const votesPerOption: { [optionId: number]: number } = {};
    const percentages: { [optionId: number]: number } = {};

    poll.options.forEach(opt => {
      votesPerOption[opt.id] = 0;
      percentages[opt.id] = 0;
    });

    votes.forEach(vote => {
      if (votesPerOption[vote.optionId] !== undefined) {
        votesPerOption[vote.optionId]++;
      }
    });

    poll.options.forEach(opt => {
      const count = votesPerOption[opt.id];
      percentages[opt.id] = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
    });

    return {
      poll,
      totalVotes,
      votesPerOption,
      percentages
    };
  }

  async getRoom(roomCode: string): Promise<Room | null> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const snap = await getDoc(doc(this.firestore, `rooms/${code}`));
        if (snap.exists()) return snap.data() as Room;
      } catch (e) {
        // Fallback below
      }
    }
    return this.mockRooms$.getValue().get(code) || null;
  }

  async getPollsForRoom(roomCode: string): Promise<Poll[]> {
    const code = roomCode.toUpperCase();
    return this.mockPolls$.getValue().get(code) || [];
  }

  async listRooms(): Promise<Room[]> {
    return Array.from(this.mockRooms$.getValue().values());
  }

  private generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = 'MATI';
    for (let i = 0; i < 2; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Seed default room and sample questions for instant usability
   */
  private initDefaultMockData(): void {
    const defaultCode = 'MATI01';
    const initialRoom: Room = {
      code: defaultCode,
      title: 'Cambodia Tech Summit 2026 - Live Poll',
      activePollId: 'poll_demo_1',
      status: 'active',
      createdAt: new Date().toISOString()
    };

    const initialPolls: Poll[] = [
      {
        id: 'poll_demo_1',
        question: 'តើបច្ចេកវិទ្យា AI ណាដែលអ្នកចាប់អារម្មណ៍ជាងគេក្នុងឆ្នាំនេះ? (Which AI technology interests you most this year?)',
        type: 'multiple_choice',
        order: 1,
        isLocked: false,
        showResults: true,
        options: [
          { id: 1, text: 'Agentic AI Workflows (ភ្នាក់ងារឆ្លាតវៃ)' },
          { id: 2, text: 'Real-time Multimodal Models (រូបភាព និង សំឡេង)' },
          { id: 3, text: 'Local On-Device SLMs (ដំណើរការលើទូរស័ព្ទ)' },
          { id: 4, text: 'Code Generation & Pair Programming (ការសរសេរកូដ)' }
        ]
      },
      {
        id: 'poll_demo_2',
        question: 'How do you rate real-time interactive audience engagement platforms?',
        type: 'multiple_choice',
        order: 2,
        isLocked: false,
        showResults: true,
        options: [
          { id: 1, text: 'Essential for modern lectures & conferences' },
          { id: 2, text: 'Very helpful to keep audience awake' },
          { id: 3, text: 'Nice to have occasionally' },
          { id: 4, text: 'Need more gamification features' }
        ]
      }
    ];

    const initialVotes: Vote[] = [
      { voterId: 'voter_alpha', optionId: 1, timestamp: new Date().toISOString() },
      { voterId: 'voter_beta', optionId: 1, timestamp: new Date().toISOString() },
      { voterId: 'voter_gamma', optionId: 2, timestamp: new Date().toISOString() },
      { voterId: 'voter_delta', optionId: 4, timestamp: new Date().toISOString() },
      { voterId: 'voter_epsilon', optionId: 1, timestamp: new Date().toISOString() }
    ];

    const roomsMap = new Map<string, Room>();
    roomsMap.set(defaultCode, initialRoom);
    this.mockRooms$.next(roomsMap);

    const pollsMap = new Map<string, Poll[]>();
    pollsMap.set(defaultCode, initialPolls);
    this.mockPolls$.next(pollsMap);

    const votesMap = new Map<string, Vote[]>();
    votesMap.set(`${defaultCode}_poll_demo_1`, initialVotes);
    this.mockVotes$.next(votesMap);

    this.currentRoom.set(initialRoom);
    this.currentPoll.set(initialPolls[0]);
    this.currentStats.set(this.computeStats(initialPolls[0], initialVotes));
  }
}
