import { Injectable, inject, signal, computed, PLATFORM_ID, Optional } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  Firestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  docData,
  collectionData,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  Unsubscribe,
  deleteField
} from '@angular/fire/firestore';
import { Observable, BehaviorSubject, of, combineLatest, map } from 'rxjs';
import { Room, Poll, Vote, PollStats, DetailedSessionSummary, QuestionResultSummary } from '../models/poll.model';

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
  private activeBroadcastRoom$ = new BehaviorSubject<string>('MATI01');

  // Active state signals
  readonly currentRoom = signal<Room | null>(null);
  readonly currentPoll = signal<Poll | null>(null);
  readonly currentStats = signal<PollStats | null>(null);
  readonly isConnectedToFirebase = signal<boolean>(false);

  constructor() {
    this.initDefaultMockData();
    if (this.isBrowser) {
      const saved = localStorage.getItem('mati_active_room');
      if (saved) {
        this.activeBroadcastRoom$.next(saved.toUpperCase());
      }
    }
    if (this.firestore) {
      this.isConnectedToFirebase.set(true);
      this.ensureDefaultRoomInFirestore('MATI01');
      this.initBroadcastListener();
    }
  }

  private initBroadcastListener(): void {
    if (!this.firestore) return;
    try {
      const bRef = doc(this.firestore, 'rooms/_active_broadcast');
      onSnapshot(bRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data && data['activeRoomCode']) {
            const code = (data['activeRoomCode'] as string).toUpperCase();
            this.activeBroadcastRoom$.next(code);
            if (this.isBrowser) {
              localStorage.setItem('mati_active_room', code);
            }
          }
        }
      }, (err) => {
        console.warn('[Mati] Broadcast listener error:', err);
      });
    } catch (e) {
      console.warn('[Mati] Could not init broadcast listener:', e);
    }
  }

  /**
   * Broadcasts the currently active presenter room to all TV stage screens & clients
   */
  async broadcastActiveRoom(roomCode: string, updatedBy?: string): Promise<void> {
    const code = (roomCode || 'MATI01').toUpperCase().trim();
    if (!code) return;
    this.activeBroadcastRoom$.next(code);
    if (this.isBrowser) {
      localStorage.setItem('mati_active_room', code);
    }
    if (this.firestore) {
      try {
        const payload = {
          activeRoomCode: code,
          updatedAt: serverTimestamp(),
          ...(updatedBy ? { updatedBy } : {})
        };
        await setDoc(doc(this.firestore, 'rooms/_active_broadcast'), payload, { merge: true });
        await setDoc(doc(this.firestore, 'system/broadcast'), payload, { merge: true });
      } catch (err) {
        console.warn('[Mati] broadcastActiveRoom save error:', err);
      }
    }
  }

  /**
   * Real-time observable of current active broadcast room code
   */
  listenToActiveBroadcastRoom(): Observable<string> {
    return this.activeBroadcastRoom$.asObservable();
  }

  getActiveBroadcastRoom(): string {
    return this.activeBroadcastRoom$.getValue();
  }

  /**
   * Ensures default room MATI01 exists in Firestore with its initial active poll
   */
  async ensureDefaultRoomInFirestore(code: string): Promise<void> {
    if (!this.firestore) return;
    try {
      const roomRef = doc(this.firestore, `rooms/${code}`);
      const snap = await getDoc(roomRef);
      if (!snap.exists()) {
        const initialRoom = this.mockRooms$.getValue().get(code);
        if (initialRoom) {
          await setDoc(roomRef, {
            ...initialRoom,
            createdAt: serverTimestamp()
          });

          // Also seed initial polls
          const polls = this.mockPolls$.getValue().get(code) || [];
          for (const p of polls) {
            const pRef = doc(this.firestore, `rooms/${code}/polls/${p.id}`);
            await setDoc(pRef, p);
          }
        }
      } else {
        const roomData = snap.data() as Room;
        // If room exists in Firestore but has no activePollId, set default
        if (!roomData.activePollId) {
          const pollsSnap = await getDocs(collection(this.firestore, `rooms/${code}/polls`));
          if (!pollsSnap.empty) {
            await this.setActivePoll(code, pollsSnap.docs[0].id);
          } else {
            // Seed polls if collection is empty
            const polls = this.mockPolls$.getValue().get(code) || [];
            for (const p of polls) {
              const pRef = doc(this.firestore, `rooms/${code}/polls/${p.id}`);
              await setDoc(pRef, p);
            }
            if (polls.length > 0) {
              await this.setActivePoll(code, polls[0].id);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[Mati] Could not sync initial room to Firestore:', e);
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
  async createRoom(title: string, customCode?: string, ownerId?: string, ownerEmail?: string): Promise<string> {
    const code = (customCode || this.generateRoomCode()).toUpperCase();
    const newRoom: Room = {
      code,
      title: title || 'Mati Live Session',
      activePollId: null,
      status: 'active',
      createdAt: new Date().toISOString(),
      ...(ownerId ? { ownerId } : {}),
      ...(ownerEmail ? { ownerEmail } : {})
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
   * Delete room and its associated state
   */
  async deleteRoom(roomCode: string): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await deleteDoc(roomRef);
      } catch (err) {
        console.warn('[Mati] Firebase deleteRoom error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    rooms.delete(code);
    this.mockRooms$.next(new Map(rooms));
  }

  /**
   * Delete specific poll from a room
   */
  async deletePoll(roomCode: string, pollId: string): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const pollRef = doc(this.firestore, `rooms/${code}/polls/${pollId}`);
        await deleteDoc(pollRef);
      } catch (err) {
        console.warn('[Mati] Firebase deletePoll error:', err);
      }
    }

    const pollsMap = this.mockPolls$.getValue();
    const list = pollsMap.get(code) || [];
    const filtered = list.filter(p => p.id !== pollId);
    pollsMap.set(code, filtered);
    this.mockPolls$.next(new Map(pollsMap));
  }

  /**
   * Step 2: createPoll(roomCode: string, question: string, options: string[])
   * Appends poll to sub-collection.
   */
  async createPoll(roomCode: string, question: string, optionTexts: string[], correctOptionId?: number): Promise<Poll> {
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
      options: optionTexts.map((text, idx) => ({ 
        id: idx + 1, 
        text,
        isCorrect: correctOptionId !== undefined ? (idx + 1 === correctOptionId) : undefined
      })),
      ...(correctOptionId !== undefined ? { correctOptionId } : {})
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
  async createPollsBatch(roomCode: string, questions: { question: string; options: string[]; correctOptionIndex?: number }[]): Promise<number> {
    const code = roomCode.toUpperCase();
    let count = 0;
    for (const q of questions) {
      const correctOptionId = (q.correctOptionIndex !== undefined) ? q.correctOptionIndex + 1 : undefined;
      await this.createPoll(code, q.question, q.options, correctOptionId);
      count++;
    }
    return count;
  }

  /**
   * Step 2: setActivePoll(roomCode: string, pollId: string | null, timerSeconds?: number | null)
   * Sets live question on screen, and atomically sets or clears countdown timer.
   */
  async setActivePoll(roomCode: string, pollId: string | null, timerSeconds?: number | null): Promise<void> {
    const code = roomCode.toUpperCase();
    const hasTimer = timerSeconds !== undefined && timerSeconds !== null && timerSeconds > 0;
    const timerDuration = hasTimer ? timerSeconds : null;
    const timerEndsAt = hasTimer ? Date.now() + (timerSeconds as number) * 1000 : null;

    // Fetch the poll object to embed directly in the room document for 0ms instant load on all clients
    let activePoll: Poll | null = null;
    if (pollId) {
      const localList = this.mockPolls$.getValue().get(code) || [];
      activePoll = localList.find(p => p.id === pollId) || null;
      if (!activePoll && this.firestore) {
        try {
          const pollSnap = await getDoc(doc(this.firestore, `rooms/${code}/polls/${pollId}`));
          if (pollSnap.exists()) {
            activePoll = { id: pollSnap.id, ...pollSnap.data() } as Poll;
          }
        } catch {}
      }
    }

    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, { 
          activePollId: pollId,
          activePoll: activePoll ? {
            id: activePoll.id,
            question: activePoll.question,
            options: activePoll.options,
            isLocked: activePoll.isLocked ?? false,
            showResults: activePoll.showResults ?? true,
            order: activePoll.order ?? 1,
            ...(activePoll.correctOptionId !== undefined ? { correctOptionId: activePoll.correctOptionId } : {})
          } : null,
          status: 'active',
          timerDuration,
          timerEndsAt
        });
      } catch (err) {
        console.warn('[Mati] Firebase setActivePoll error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.activePollId = pollId;
      room.activePoll = activePoll;
      room.status = 'active';
      room.timerDuration = timerDuration ?? undefined;
      room.timerEndsAt = timerEndsAt;
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
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, { 'activePoll.isLocked': isLocked });
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
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, { 'activePoll.showResults': show });
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
   * Sets or clears synchronized countdown timer for the room.
   * When durationSeconds is a positive number, sets timerEndsAt = Date.now() + durationSeconds * 1000.
   * When null or 0, clears the timer.
   */
  async setPollTimer(roomCode: string, durationSeconds: number | null): Promise<void> {
    const code = roomCode.toUpperCase();
    const timerDuration = durationSeconds && durationSeconds > 0 ? durationSeconds : null;
    const timerEndsAt = durationSeconds && durationSeconds > 0 ? Date.now() + durationSeconds * 1000 : null;

    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, {
          timerDuration,
          timerEndsAt
        });
      } catch (err) {
        console.warn('[Mati] Firebase setPollTimer error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.timerDuration = timerDuration ?? undefined;
      room.timerEndsAt = timerEndsAt;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Sets room interaction mode: 'live' (presenter-led sync) or 'survey' (self-paced audience voting).
   */
  async setRoomMode(roomCode: string, mode: 'live' | 'survey'): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, { mode });
      } catch (err) {
        console.warn('[Mati] Firebase setRoomMode error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.mode = mode;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Sets chosen question subset for the room (e.g. pick 15 of 30 questions).
   * Pass null or empty array to include all questions.
   */
  async updateRoomSelectedPollIds(roomCode: string, selectedPollIds: string[] | null): Promise<void> {
    const code = roomCode.toUpperCase();
    const list = selectedPollIds && selectedPollIds.length > 0 ? selectedPollIds : null;

    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, {
          selectedPollIds: list ? list : deleteField()
        });
      } catch (err) {
        console.warn('[Mati] Firebase updateRoomSelectedPollIds error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.selectedPollIds = list || undefined;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Sets room projection stage theme: 'dark' or 'light'.
   */
  async setRoomTheme(roomCode: string, theme: 'dark' | 'light'): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.isBrowser) {
      localStorage.setItem(`mati_stage_theme_${code}`, theme);
      localStorage.setItem('mati_stage_theme_last', theme);
    }

    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, { theme });
      } catch (err) {
        console.warn('[Mati] Firebase setRoomTheme error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.theme = theme;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Synchronously retrieves in-memory or persisted cached room
   */
  getCachedRoom(roomCode: string): Room | null {
    const code = (roomCode || 'MATI01').toUpperCase();
    let room = this.mockRooms$.getValue().get(code) || null;
    if (!room && this.isBrowser) {
      const savedTheme = localStorage.getItem(`mati_stage_theme_${code}`);
      if (savedTheme === 'light' || savedTheme === 'dark') {
        room = {
          code,
          title: `Room ${code}`,
          activePollId: null,
          status: 'active',
          theme: savedTheme as 'dark' | 'light',
          createdAt: new Date().toISOString()
        };
      }
    }
    return room;
  }

  /**
   * Completes the entire live polling session.
   * Sets room status to 'completed' and clears timer.
   */
  async completeSession(roomCode: string): Promise<void> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, {
          status: 'completed',
          timerEndsAt: null,
          timerDuration: null
        });
      } catch (err) {
        console.warn('[Mati] Firebase completeSession error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.status = 'completed';
      room.timerEndsAt = null;
      room.timerDuration = undefined;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Restarts the session from the first question.
   */
  async restartSession(roomCode: string): Promise<void> {
    const code = roomCode.toUpperCase();
    const roomData = await this.getRoom(code);
    const allPolls = await this.getPollsForRoom(code);
    const polls = roomData?.selectedPollIds && roomData.selectedPollIds.length > 0
      ? allPolls.filter(p => roomData.selectedPollIds!.includes(p.id))
      : allPolls;
    const firstPollId = polls.length > 0 ? polls[0].id : null;

    if (this.firestore) {
      try {
        const roomRef = doc(this.firestore, `rooms/${code}`);
        await updateDoc(roomRef, {
          status: 'active',
          activePollId: firstPollId,
          timerEndsAt: null,
          timerDuration: null
        });
      } catch (err) {
        console.warn('[Mati] Firebase restartSession error:', err);
      }
    }

    const rooms = this.mockRooms$.getValue();
    const room = rooms.get(code);
    if (room) {
      room.status = 'active';
      room.activePollId = firstPollId;
      room.timerEndsAt = null;
      room.timerDuration = undefined;
      rooms.set(code, { ...room });
      this.mockRooms$.next(new Map(rooms));
      this.currentRoom.set({ ...room });
    }
  }

  /**
   * Aggregates detailed session summary (total questions, votes, overall accuracy %, question-by-question results)
   */
  async getSessionSummary(roomCode: string): Promise<DetailedSessionSummary> {
    const code = roomCode.toUpperCase();
    const roomData = await this.getRoom(code);
    const allPolls = await this.getPollsForRoom(code);
    const polls = roomData?.selectedPollIds && roomData.selectedPollIds.length > 0
      ? allPolls.filter(p => roomData.selectedPollIds!.includes(p.id))
      : allPolls;
    let totalVotes = 0;
    let totalScoredQuestions = 0;
    let totalScoredVotes = 0;
    let totalCorrectVotes = 0;
    let consensusSum = 0;

    const questionResults: QuestionResultSummary[] = [];
    const votesMap = this.mockVotes$.getValue();

    // Fetch all poll votes concurrently for high speed
    const voteListPerPoll = await Promise.all(
      polls.map(async (p) => {
        if (this.firestore) {
          try {
            const vSnap = await getDocs(collection(this.firestore, `rooms/${code}/polls/${p.id}/votes`));
            return vSnap.docs.map(d => d.data() as Vote);
          } catch (e) {
            return votesMap.get(`${code}_${p.id}`) || [];
          }
        }
        return votesMap.get(`${code}_${p.id}`) || [];
      })
    );

    for (let idx = 0; idx < polls.length; idx++) {
      const p = polls[idx];
      let voteList = voteListPerPoll[idx] || [];

      if (voteList.length === 0 && votesMap.has(`${code}_${p.id}`)) {
        voteList = votesMap.get(`${code}_${p.id}`) || [];
      }

      const qTotalVotes = voteList.length;
      totalVotes += qTotalVotes;

      const optCounts: { [optId: number]: number } = {};
      for (const opt of p.options) optCounts[opt.id] = 0;
      for (const v of voteList) {
        if (optCounts[v.optionId] !== undefined) {
          optCounts[v.optionId]++;
        }
      }

      const correctOptionId = p.correctOptionId;
      const correctOption = correctOptionId ? p.options.find(o => o.id === correctOptionId) : undefined;
      const correctVotes = correctOptionId ? (optCounts[correctOptionId] || 0) : 0;
      const correctPercentage = qTotalVotes > 0 ? Math.round((correctVotes / qTotalVotes) * 100) : 0;

      let winningOpt = p.options[0] || { id: 1, text: '' };
      let maxOptVotes = -1;
      for (const opt of p.options) {
        const c = optCounts[opt.id] || 0;
        if (c > maxOptVotes) {
          maxOptVotes = c;
          winningOpt = opt;
        }
      }
      const winningPercentage = qTotalVotes > 0 ? Math.round((maxOptVotes / qTotalVotes) * 100) : 0;
      consensusSum += winningPercentage;

      if (correctOptionId !== undefined) {
        totalScoredQuestions++;
        totalScoredVotes += qTotalVotes;
        totalCorrectVotes += correctVotes;
      }

      questionResults.push({
        pollId: p.id,
        order: p.order || (idx + 1),
        question: p.question,
        totalVotes: qTotalVotes,
        correctOptionId,
        correctOptionText: correctOption?.text,
        correctVotes,
        correctPercentage,
        winningOptionId: winningOpt.id,
        winningOptionText: winningOpt.text,
        winningPercentage,
        options: p.options.map(opt => ({
          id: opt.id,
          text: opt.text,
          votes: optCounts[opt.id] || 0,
          percentage: qTotalVotes > 0 ? Math.round(((optCounts[opt.id] || 0) / qTotalVotes) * 100) : 0,
          isCorrect: correctOptionId !== undefined ? (opt.id === correctOptionId) : false
        }))
      });
    }

    const overallAccuracy = totalScoredVotes > 0 ? Math.round((totalCorrectVotes / totalScoredVotes) * 100) : 0;
    const topConsensusPercentage = polls.length > 0 ? Math.round(consensusSum / polls.length) : 0;

    return {
      totalQuestions: polls.length,
      totalVotes,
      totalScoredQuestions,
      overallAccuracy,
      hasScoredQuestions: totalScoredQuestions > 0,
      topConsensusPercentage,
      questionResults
    };
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
  listenToActivePoll(roomCode: string, includeVotes: boolean = true): Observable<PollStats | null> {
    const code = roomCode.toUpperCase();

    // RxJS stream listening to Room -> Active Poll -> Votes
    return new Observable<PollStats | null>((subscriber) => {
      let unsubRoom: Unsubscribe | null = null;
      let unsubPoll: Unsubscribe | null = null;
      let unsubVotes: Unsubscribe | null = null;
      let currentActivePollId: string | null = null;
      let latestRoomData: Room | null = null;
      let latestPollData: Poll | null = null;
      let latestVotes: Vote[] = [];

      const emitCurrentStats = () => {
        if (!latestPollData) {
          subscriber.next(null);
          return;
        }
        const stats = this.computeStats(
          latestPollData, 
          latestVotes, 
          latestRoomData?.timerDuration, 
          latestRoomData?.timerEndsAt
        );
        this.currentStats.set(stats);
        subscriber.next(stats);
      };

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
        const stats = this.computeStats(poll, votes, room.timerDuration, room.timerEndsAt);
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
            if (roomSnap.exists()) {
              latestRoomData = roomSnap.data() as Room;
            } else {
              latestRoomData = this.mockRooms$.getValue().get(code) || null;
            }

            const activeId = latestRoomData?.activePollId || null;

            if (!activeId) {
              latestPollData = null;
              latestVotes = [];
              subscriber.next(null);
              if (unsubPoll) unsubPoll();
              if (unsubVotes) unsubVotes();
              return;
            }

            if (activeId !== currentActivePollId) {
              currentActivePollId = activeId;
              if (unsubPoll) unsubPoll();
              if (unsubVotes) unsubVotes();

              // FAST PATH: Check if room document already has embedded activePoll (0ms latency!)
              if (latestRoomData?.activePoll && latestRoomData.activePoll.id === activeId) {
                latestPollData = latestRoomData.activePoll;
                this.currentPoll.set(latestPollData);
                emitCurrentStats();
              } else {
                const localPolls = this.mockPolls$.getValue().get(code) || [];
                const cached = localPolls.find(p => p.id === activeId);
                if (cached) {
                  latestPollData = cached;
                  this.currentPoll.set(cached);
                  emitCurrentStats();
                } else {
                  latestPollData = null;
                }
              }

              const pollRef = doc(this.firestore!, `rooms/${code}/polls/${activeId}`);
              unsubPoll = onSnapshot(pollRef, (pollSnap) => {
                if (pollSnap.exists()) {
                  latestPollData = { id: pollSnap.id, ...pollSnap.data() } as Poll;
                } else if (!latestPollData) {
                  const localPolls = this.mockPolls$.getValue().get(code) || [];
                  latestPollData = localPolls.find(p => p.id === activeId) || null;
                }

                if (latestPollData) {
                  this.currentPoll.set(latestPollData);
                }
                emitCurrentStats();
              }, (err) => {
                console.warn('[Mati] Poll listener error:', err);
              });

              // Listen to votes subcollection ONLY if requested (TV stage & controller)
              if (includeVotes) {
                const votesCol = collection(this.firestore!, `rooms/${code}/polls/${activeId}/votes`);
                unsubVotes = onSnapshot(votesCol, (votesSnap) => {
                  if (!votesSnap.empty) {
                    latestVotes = votesSnap.docs.map(d => d.data() as Vote);
                  } else {
                    latestVotes = this.mockVotes$.getValue().get(`${code}_${activeId}`) || [];
                  }
                  emitCurrentStats();
                }, (err) => {
                  latestVotes = this.mockVotes$.getValue().get(`${code}_${activeId}`) || [];
                  emitCurrentStats();
                });
              } else {
                // Mobile voter: do not flood with thousands of vote snapshots
                latestVotes = [];
                emitCurrentStats();
              }
            } else {
              // Same active poll, update if embedded activePoll changed (e.g. isLocked or showResults)
              if (latestRoomData?.activePoll && latestRoomData.activePoll.id === activeId) {
                latestPollData = { ...latestPollData, ...latestRoomData.activePoll };
                this.currentPoll.set(latestPollData);
              }
              emitCurrentStats();
            }
          }, (err) => {
            console.warn('[Mati] Room listener error, fallback to mock pipeline:', err);
            const localRoom = this.mockRooms$.getValue().get(code);
            latestRoomData = localRoom || null;
            if (localRoom?.activePollId) {
              const localPolls = this.mockPolls$.getValue().get(code) || [];
              latestPollData = localPolls.find(p => p.id === localRoom.activePollId) || null;
              if (latestPollData) {
                latestVotes = this.mockVotes$.getValue().get(`${code}_${latestPollData.id}`) || [];
                emitCurrentStats();
              }
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
        // Emit in-memory polls first for instant UI response
        const initialMock = this.mockPolls$.getValue().get(code) || [];
        if (initialMock.length > 0) {
          subscriber.next(initialMock);
        }

        const pollsCol = collection(this.firestore!, `rooms/${code}/polls`);
        // Listen without requiring complex compound indices
        const unsub = onSnapshot(pollsCol, (snapshot) => {
          const firestoreList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
          const localList = this.mockPolls$.getValue().get(code) || [];

          // Merge by ID to guarantee nothing disappears
          const map = new Map<string, Poll>();
          for (const p of localList) map.set(p.id, p);
          for (const p of firestoreList) map.set(p.id, p);

          const merged = Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
          this.mockPolls$.getValue().set(code, merged);
          subscriber.next(merged);
        }, (err) => {
          console.warn('[Mati] Firestore room polls listener error, falling back to local store:', err);
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
    if (this.firestore) {
      return new Observable<Room | null>((subscriber) => {
        // Emit in-memory cached room first for 0ms instant UI response
        const cached = this.getCachedRoom(code);
        if (cached) {
          subscriber.next(cached);
        }

        const roomRef = doc(this.firestore!, `rooms/${code}`);
        const unsub = onSnapshot(roomRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Room;
            this.mockRooms$.getValue().set(code, data);
            subscriber.next(data);
          } else {
            subscriber.next(this.mockRooms$.getValue().get(code) || null);
          }
        }, (err) => {
          console.warn('[Mati] Firestore listenToRoom error:', err);
          subscriber.next(this.mockRooms$.getValue().get(code) || null);
        });
        return () => unsub();
      });
    }

    return this.mockRooms$.pipe(
      map(mapData => mapData.get(code) || null)
    );
  }

  /**
   * Listen to real-time stats for any poll by ID (useful for self-paced survey mode)
   */
  listenToPollStats(roomCode: string, pollId: string): Observable<PollStats | null> {
    const code = roomCode.toUpperCase();
    if (this.firestore) {
      return new Observable<PollStats | null>((subscriber) => {
        const pollRef = doc(this.firestore!, `rooms/${code}/polls/${pollId}`);
        const votesCol = collection(this.firestore!, `rooms/${code}/polls/${pollId}/votes`);
        
        let pollData: Poll | null = null;
        let votesList: Vote[] = [];

        const emit = () => {
          if (!pollData) {
            const localPolls = this.mockPolls$.getValue().get(code) || [];
            pollData = localPolls.find(p => p.id === pollId) || null;
          }
          if (!pollData) {
            subscriber.next(null);
            return;
          }
          subscriber.next(this.computeStats(pollData, votesList));
        };

        const unsubPoll = onSnapshot(pollRef, (snap) => {
          if (snap.exists()) {
            pollData = { id: snap.id, ...snap.data() } as Poll;
          }
          emit();
        });

        const unsubVotes = onSnapshot(votesCol, (snap) => {
          votesList = snap.docs.map(d => d.data() as Vote);
          emit();
        });

        return () => {
          unsubPoll();
          unsubVotes();
        };
      });
    }

    return combineLatest([this.mockPolls$, this.mockVotes$]).pipe(
      map(([pollsMap, votesMap]) => {
        const list = pollsMap.get(code) || [];
        const poll = list.find(p => p.id === pollId);
        if (!poll) return null;
        const votes = votesMap.get(`${code}_${pollId}`) || [];
        return this.computeStats(poll, votes);
      })
    );
  }

  /**
   * Helper: compute aggregated stats
   */
  computeStats(poll: Poll, votes: Vote[], timerDuration?: number, timerEndsAt?: number | null): PollStats {
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
      percentages,
      timerDuration,
      timerEndsAt
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
    const local = this.mockPolls$.getValue().get(code) || [];
    if (this.firestore) {
      try {
        const snap = await getDocs(collection(this.firestore, `rooms/${code}/polls`));
        if (!snap.empty) {
          const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Poll));
          const map = new Map<string, Poll>();
          for (const p of local) map.set(p.id, p);
          for (const p of list) map.set(p.id, p);
          return Array.from(map.values()).sort((a, b) => (a.order || 0) - (b.order || 0));
        }
      } catch (e) {
        console.warn('[Mati] Could not fetch Firestore polls:', e);
      }
    }
    return local;
  }

  /**
   * Real-time observable of all rooms in Firestore and local store
   */
  listenToRooms(): Observable<Room[]> {
    if (this.firestore) {
      return new Observable<Room[]>((subscriber) => {
        // Emit in-memory fallback first for immediate responsiveness
        const initialMock = Array.from(this.mockRooms$.getValue().values());
        if (initialMock.length > 0) {
          subscriber.next(initialMock);
        }

        const roomsCol = collection(this.firestore!, 'rooms');
        const unsub = onSnapshot(roomsCol, (snapshot) => {
          const firestoreRooms = snapshot.docs.map(d => ({ code: d.id, ...d.data() } as Room));
          const localRooms = Array.from(this.mockRooms$.getValue().values());

          const map = new Map<string, Room>();
          for (const r of localRooms) map.set(r.code, r);
          for (const r of firestoreRooms) map.set(r.code, r);

          const merged = Array.from(map.values());
          subscriber.next(merged);
        }, (err) => {
          console.warn('[Mati] Firestore rooms listener error, fallback to local store:', err);
          subscriber.next(Array.from(this.mockRooms$.getValue().values()));
        });

        return () => unsub();
      });
    }

    return this.mockRooms$.pipe(
      map(m => Array.from(m.values()))
    );
  }

  async listRooms(): Promise<Room[]> {
    const local = Array.from(this.mockRooms$.getValue().values());
    if (this.firestore) {
      try {
        const snap = await getDocs(collection(this.firestore, 'rooms'));
        if (!snap.empty) {
          const firestoreRooms = snap.docs.map(d => ({ code: d.id, ...d.data() } as Room));
          const map = new Map<string, Room>();
          for (const r of local) map.set(r.code, r);
          for (const r of firestoreRooms) map.set(r.code, r);
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn('[Mati] Could not fetch Firestore rooms:', e);
      }
    }
    return local;
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
