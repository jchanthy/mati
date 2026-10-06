import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { PollStats } from '../../models/poll.model';

@Component({
  selector: 'app-student-view',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between max-w-md mx-auto shadow-2xl relative">
      <!-- Mobile Top Bar -->
      <header class="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 z-20">
        <div class="flex items-center gap-2">
          <div class="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-extrabold text-sm shadow-md shadow-indigo-600/30">
            ម
          </div>
          <div>
            <div class="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">Mati (មតិ)</div>
            <div class="text-[10px] text-slate-500 font-medium">Audience Response</div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <div class="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold">
            PIN: {{ roomCode() }}
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="p-5 flex-1 flex flex-col justify-center">
        @if (pollStats(); as stats) {
          <!-- Synchronized Countdown Timer Bar -->
          @if (remainingSeconds() !== null) {
            <div class="mb-4 overflow-hidden rounded-2xl border transition-all duration-300"
              [ngClass]="{
                'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800': remainingSeconds()! > 10,
                'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800': remainingSeconds()! <= 5 && remainingSeconds()! > 0,
                'bg-slate-100 dark:bg-slate-900 border-slate-300 dark:border-slate-700': remainingSeconds() === 0
              }">
              <div class="p-3 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full"
                    [ngClass]="{
                      'bg-emerald-500 animate-pulse': remainingSeconds()! > 10,
                      'bg-amber-500 animate-pulse': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                      'bg-red-500 animate-ping': remainingSeconds()! <= 5 && remainingSeconds()! > 0,
                      'bg-slate-400': remainingSeconds() === 0
                    }"></span>
                  <span class="text-xs font-black uppercase tracking-wider"
                    [ngClass]="{
                      'text-emerald-700 dark:text-emerald-300': remainingSeconds()! > 10,
                      'text-amber-700 dark:text-amber-300': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                      'text-red-700 dark:text-red-300': remainingSeconds()! <= 5 && remainingSeconds()! > 0,
                      'text-slate-600 dark:text-slate-400': remainingSeconds() === 0
                    }">
                    @if (remainingSeconds() === 0) {
                      Time's Up!
                    } @else if (remainingSeconds()! <= 5) {
                      Hurry, Ending Soon!
                    } @else {
                      Time Remaining
                    }
                  </span>
                </div>

                <div class="font-mono text-sm font-black px-2.5 py-0.5 rounded-lg"
                  [ngClass]="{
                    'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200': remainingSeconds()! > 10,
                    'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                    'bg-red-100 dark:bg-red-900/60 text-red-800 dark:text-red-200 animate-pulse': remainingSeconds()! <= 5 && remainingSeconds()! > 0,
                    'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400': remainingSeconds() === 0
                  }">
                  ⏱ {{ remainingSeconds() }}s
                </div>
              </div>

              <!-- Depleting Progress Bar -->
              @if (remainingSeconds()! > 0) {
                <div class="h-1.5 w-full bg-slate-200 dark:bg-slate-800">
                  <div class="h-full transition-all duration-300 ease-linear"
                    [style.width.%]="timerPercent()"
                    [ngClass]="{
                      'bg-emerald-500': remainingSeconds()! > 10,
                      'bg-amber-500': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                      'bg-red-500': remainingSeconds()! <= 5
                    }">
                  </div>
                </div>
              }
            </div>
          }

          <!-- Question Header Card -->
          <div class="mb-6 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs uppercase font-extrabold tracking-wider text-indigo-600 dark:text-indigo-400">
                Question #{{ stats.poll.order }}
              </span>
              @if (stats.poll.isLocked || isTimeUp()) {
                <span class="text-[11px] font-bold text-red-500 bg-red-50 dark:bg-red-950/50 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800 flex items-center gap-1">
                  <i class="pi pi-lock text-[10px]"></i> {{ isTimeUp() ? "Time's Up" : "Locked" }}
                </span>
              } @else {
                <span class="text-[11px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                  <i class="pi pi-bolt text-[10px]"></i> Live Now
                </span>
              }
            </div>

            <h1 class="text-xl font-bold leading-snug text-slate-900 dark:text-white">
              {{ stats.poll.question }}
            </h1>
          </div>

          <!-- If already voted -->
          @if (hasVoted()) {
            <div class="p-6 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-3xl text-center space-y-4 shadow-sm animate-fadein">
              <div class="w-16 h-16 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-2xl shadow-lg shadow-emerald-500/30">
                <i class="pi pi-check"></i>
              </div>
              <div>
                <h3 class="text-lg font-black text-emerald-900 dark:text-emerald-200">
                  Vote Recorded!
                </h3>
                <p class="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                  @if (remainingSeconds() !== null && remainingSeconds()! > 0) {
                    Next question in <span class="font-bold font-mono">{{ remainingSeconds() }}s</span>. Look up at the screen!
                  } @else {
                    Your voice has been counted in Mati live session.
                  }
                </p>
              </div>

              <div class="p-3 bg-white dark:bg-slate-900 rounded-2xl border border-emerald-100 dark:border-emerald-900 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Selected choice: <span class="text-indigo-600 dark:text-indigo-400 font-bold">#{{ selectedOptionId() }}</span>
              </div>

              @if (!stats.poll.isLocked && !isTimeUp()) {
                <button type="button" (click)="changeVote()" class="text-xs text-slate-500 hover:text-indigo-600 underline font-medium">
                  Change my answer
                </button>
              }
            </div>
          } @else if (isTimeUp()) {
            <!-- Time's Up Screen -->
            <div class="p-8 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-3xl text-center space-y-3">
              <div class="w-12 h-12 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-xl">
                <i class="pi pi-clock"></i>
              </div>
              <h3 class="text-base font-bold text-red-900 dark:text-red-200">Time's Up!</h3>
              <p class="text-xs text-red-700 dark:text-red-400">
                Voting has concluded for this question. Look up at the presenter's screen!
              </p>
            </div>
          } @else if (stats.poll.isLocked) {
            <!-- Poll Locked Screen -->
            <div class="p-8 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl text-center space-y-3">
              <div class="w-12 h-12 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-xl">
                <i class="pi pi-lock"></i>
              </div>
              <h3 class="text-base font-bold text-amber-900 dark:text-amber-200">Voting Closed</h3>
              <p class="text-xs text-amber-700 dark:text-amber-400">
                The presenter has locked responses for this question. Look up at the screen!
              </p>
            </div>
          } @else {
            <!-- Interactive Choice Cards (Touch Friendly) -->
            <div class="space-y-3">
              @for (opt of stats.poll.options; track opt.id) {
                <button
                  type="button"
                  (click)="vote(opt.id)"
                  [disabled]="isSubmitting() || isTimeUp()"
                  class="w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 active:scale-98 shadow-xs
                    bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-500 hover:shadow-md cursor-pointer">
                  <span class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-sm shrink-0 border border-slate-200 dark:border-slate-700">
                    {{ opt.id }}
                  </span>
                  <span class="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">
                    {{ opt.text }}
                  </span>
                  <i class="pi pi-chevron-right text-xs text-slate-400"></i>
                </button>
              }
            </div>
          }
        } @else {
          <!-- Waiting Screen -->
          <div class="text-center py-12 space-y-4">
            <div class="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-2xl animate-pulse">
              <i class="pi pi-hourglass"></i>
            </div>
            <h2 class="text-lg font-bold text-slate-900 dark:text-white">Waiting for next question...</h2>
            <p class="text-xs text-slate-500 max-w-xs mx-auto">
              You are connected to room <span class="font-bold text-indigo-600 font-mono">{{ roomCode() }}</span>. When the presenter launches a question, it will appear here instantly!
            </p>
          </div>
        }
      </main>

      <!-- Voter ID Footer -->
      <footer class="p-4 bg-white/50 dark:bg-slate-900/50 border-t border-slate-200/80 dark:border-slate-800/80 text-center">
        <div class="text-[10px] text-slate-400 font-mono flex items-center justify-center gap-2">
          <span>Voter ID: {{ voterIdShort() }}</span>
          <span>•</span>
          <span class="text-emerald-500 font-semibold flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connected
          </span>
        </div>
      </footer>
    </div>
  `
})
export class StudentViewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private pollService = inject(MatiPollService);

  roomCode = signal<string>('MATI01');
  pollStats = signal<PollStats | null>(null);
  voterId = signal<string>('');
  voterIdShort = signal<string>('');
  hasVoted = signal<boolean>(false);
  selectedOptionId = signal<number | null>(null);
  isSubmitting = signal<boolean>(false);

  // Synchronized countdown timer
  remainingSeconds = signal<number | null>(null);
  timerDuration = signal<number | null>(null);
  private timerInterval: any = null;

  isTimeUp = computed(() => this.remainingSeconds() !== null && this.remainingSeconds()! <= 0);
  timerPercent = computed(() => {
    const rem = this.remainingSeconds();
    const dur = this.timerDuration();
    if (rem === null || !dur || dur <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((rem / dur) * 100)));
  });

  private pollSub?: Subscription;

  ngOnInit() {
    const vid = this.pollService.getOrCreateVoterId();
    this.voterId.set(vid);
    this.voterIdShort.set(vid.substring(0, 16) + '...');

    this.route.paramMap.subscribe(params => {
      const code = (params.get('roomCode') || 'MATI01').toUpperCase();
      this.roomCode.set(code);
      this.listenToPoll(code);
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.stopLocalTimer();
  }

  private listenToPoll(code: string) {
    this.pollSub?.unsubscribe();
    this.pollSub = this.pollService.listenToActivePoll(code).subscribe(stats => {
      this.pollStats.set(stats);
      if (stats?.poll) {
        const votedOpt = this.pollService.getVotedOption(code, stats.poll.id);
        if (votedOpt !== null) {
          this.hasVoted.set(true);
          this.selectedOptionId.set(votedOpt);
        } else {
          this.hasVoted.set(false);
          this.selectedOptionId.set(null);
        }

        // Synchronize timer with stage and server
        if (stats.timerEndsAt && stats.timerEndsAt > 0) {
          this.timerDuration.set(stats.timerDuration || 30);
          this.startLocalTimer(stats.timerEndsAt);
        } else {
          this.stopLocalTimer();
        }
      } else {
        this.stopLocalTimer();
      }
    });
  }

  private startLocalTimer(timerEndsAt: number) {
    this.stopLocalTimer();
    const updateCountdown = () => {
      const diff = Math.ceil((timerEndsAt - Date.now()) / 1000);
      if (diff <= 0) {
        this.remainingSeconds.set(0);
        this.stopLocalTimer();
      } else {
        this.remainingSeconds.set(diff);
      }
    };
    updateCountdown();
    this.timerInterval = setInterval(updateCountdown, 500);
  }

  private stopLocalTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (this.remainingSeconds() !== 0) {
      this.remainingSeconds.set(null);
    }
  }

  async vote(optionId: number) {
    const stats = this.pollStats();
    if (!stats || stats.poll.isLocked || this.isTimeUp() || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    try {
      await this.pollService.submitVote(
        this.roomCode(),
        stats.poll.id,
        this.voterId(),
        optionId
      );
      this.selectedOptionId.set(optionId);
      this.hasVoted.set(true);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  changeVote() {
    this.hasVoted.set(false);
  }
}
