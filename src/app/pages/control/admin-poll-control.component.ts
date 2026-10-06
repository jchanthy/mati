import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MatiPollService } from '../../services/mati-poll.service';
import { Poll, PollStats, Room } from '../../models/poll.model';

@Component({
  selector: 'app-admin-poll-control',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    ButtonModule,
    ToggleSwitchModule,
    TagModule,
    ProgressBarModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="space-y-6 max-w-5xl mx-auto">
      <p-toast></p-toast>

      <!-- Controller Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs">
        <div>
          <div class="flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Live Stage Remote Control</span>
          </div>
          <h1 class="text-2xl font-black text-gray-900 dark:text-white mt-1">
            Mati Controller: Room <span class="text-indigo-600 dark:text-indigo-400">MATI01</span>
          </h1>
          <p class="text-xs text-gray-500">Live orchestrator for questions, lock status, and projection stage visibility.</p>
        </div>

        <div class="flex items-center gap-3">
          <a routerLink="/stage/MATI01" target="_blank" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-all">
            <i class="pi pi-desktop"></i>
            <span>Open Stage (TV)</span>
          </a>
          <a routerLink="/dashboard" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all">
            Back to Studio
          </a>
        </div>
      </div>

      <!-- Quick Remote Controls Row -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Toggle Tally & Lock Controls -->
        <div class="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-5">
          <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div class="text-sm font-bold text-gray-900 dark:text-white">Lock Voting</div>
              <div class="text-xs text-gray-500">Block new answers from participant phones</div>
            </div>
            <p-toggleswitch [(ngModel)]="isLocked" (onChange)="onLockChange()"></p-toggleswitch>
          </div>

          <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div class="text-sm font-bold text-gray-900 dark:text-white">Show Live Results</div>
              <div class="text-xs text-gray-500">Reveal bar charts to audience on the stage</div>
            </div>
            <p-toggleswitch [(ngModel)]="showResults" (onChange)="onShowResultsChange()"></p-toggleswitch>
          </div>

          <!-- Auto Next Question Timer (Slido-enhanced feature) -->
          <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
            <div>
              <div class="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>Auto Next Question</span>
                @if (autoAdvanceEnabled) {
                  <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-black animate-pulse">
                    ⏱ {{ countdownSeconds }}s
                  </span>
                }
              </div>
              <div class="text-xs text-gray-500">Automatically advance to the next question when timer expires</div>
            </div>
            <div class="flex items-center gap-2">
              @if (autoAdvanceEnabled) {
                <select [(ngModel)]="timerDuration" (ngModelChange)="resetTimer()" class="text-xs font-bold rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1">
                  <option [value]="15">15s</option>
                  <option [value]="20">20s</option>
                  <option [value]="30">30s</option>
                  <option [value]="45">45s</option>
                  <option [value]="60">60s</option>
                </select>
              }
              <p-toggleswitch [(ngModel)]="autoAdvanceEnabled" (onChange)="toggleAutoAdvance()"></p-toggleswitch>
            </div>
          </div>

          <div class="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <div class="flex items-center justify-between">
              <div class="text-xs font-bold text-gray-700 dark:text-gray-300">
                Question {{ getCurrentQuestionIndex() }} of {{ polls().length }}
              </div>
              <div class="flex items-center gap-2">
                <button pButton label="Prev" icon="pi pi-arrow-left" class="p-button-outlined p-button-sm rounded-xl" [disabled]="isFirstQuestion()" (click)="prevQuestion()"></button>
                <button pButton label="Next" icon="pi pi-arrow-right" class="p-button-primary p-button-sm rounded-xl" [disabled]="isLastQuestion()" (click)="nextQuestion()"></button>
              </div>
            </div>

            <!-- Direct Jump Selector for 30+ questions -->
            <div class="pt-1">
              <select 
                [ngModel]="currentPoll()?.id" 
                (ngModelChange)="onSelectQuestion($event)" 
                class="w-full p-2 text-xs font-semibold rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500">
                @for (p of polls(); track p.id; let idx = $index) {
                  <option [value]="p.id">
                    #{{ idx + 1 }}: {{ p.question.length > 50 ? (p.question.substring(0, 50) + '...') : p.question }}
                  </option>
                }
              </select>
            </div>
          </div>
        </div>

        <!-- Audience Participation Stat Card -->
        <div class="bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 text-white p-6 rounded-3xl shadow-lg flex flex-col justify-between">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-indigo-300">Audience Engagement</div>
            <div class="mt-4 flex items-baseline gap-3">
              <span class="text-5xl font-black">{{ stats()?.totalVotes || 0 }}</span>
              <span class="text-lg font-medium text-indigo-200">total votes recorded</span>
            </div>
            <p class="text-xs text-indigo-200 mt-2">
              Updates in real-time instantly without page refreshes.
            </p>
          </div>

          <div class="mt-6 pt-4 border-t border-indigo-700/60 flex items-center justify-between text-xs text-indigo-200">
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              State: {{ isLocked ? 'LOCKED' : 'OPEN FOR VOTING' }}
            </span>
            <span>Display: {{ showResults ? 'RESULTS VISIBLE' : 'RESULTS HIDDEN' }}</span>
          </div>
        </div>
      </div>

      <!-- Current Active Question Details & Live Tally Preview -->
      <div class="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100 dark:border-gray-800">
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Active Live Question</div>
            <h2 class="text-xl font-black text-gray-900 dark:text-white mt-0.5">
              {{ currentPoll()?.question || 'No question active' }}
            </h2>
          </div>
          <div class="flex items-center gap-2">
            @if (isLocked) {
              <p-tag severity="danger" value="Voting Closed" icon="pi pi-lock"></p-tag>
            } @else {
              <p-tag severity="success" value="Accepting Votes" icon="pi pi-check-circle"></p-tag>
            }
          </div>
        </div>

        <!-- Live Tally Preview for Teacher -->
        <div class="space-y-4">
          <div class="text-xs font-bold uppercase tracking-wider text-gray-500">Live Breakdown</div>
          @if (currentPoll()) {
            @for (opt of currentPoll()!.options; track opt.id) {
              <div class="space-y-1.5 p-3 rounded-2xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <div class="flex justify-between items-center text-sm font-semibold">
                  <span class="text-gray-800 dark:text-gray-200">
                    <span class="inline-flex w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs items-center justify-center mr-1.5 font-bold">
                      {{ opt.id }}
                    </span>
                    {{ opt.text }}
                  </span>
                  <span class="text-indigo-600 dark:text-indigo-400 font-bold">
                    {{ stats()?.votesPerOption?.[opt.id] || 0 }} votes ({{ stats()?.percentages?.[opt.id] || 0 }}%)
                  </span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 h-2.5 rounded-full overflow-hidden">
                  <div class="bg-indigo-600 h-2.5 rounded-full transition-all duration-500" [style.width.%]="stats()?.percentages?.[opt.id] || 0"></div>
                </div>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `
})
export class AdminPollControlComponent implements OnInit, OnDestroy {
  private pollService = inject(MatiPollService);
  private messageService = inject(MessageService);

  polls = signal<Poll[]>([]);
  currentPoll = this.pollService.currentPoll;
  stats = signal<PollStats | null>(null);

  isLocked = false;
  showResults = true;

  autoAdvanceEnabled = false;
  timerDuration = 20;
  countdownSeconds = 20;
  private timerInterval: any = null;

  private pollSub?: Subscription;
  private pollsListSub?: Subscription;

  ngOnInit() {
    this.pollsListSub = this.pollService.listenToRoomPolls('MATI01').subscribe(list => {
      this.polls.set(list);
    });

    this.pollSub = this.pollService.listenToActivePoll('MATI01').subscribe(pollStats => {
      this.stats.set(pollStats);
      if (pollStats?.poll) {
        this.isLocked = pollStats.poll.isLocked;
        this.showResults = pollStats.poll.showResults;
      }
    });
  }

  ngOnDestroy() {
    this.stopTimer();
    this.pollSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
  }

  toggleAutoAdvance() {
    if (this.autoAdvanceEnabled) {
      this.startTimer();
      this.messageService.add({
        severity: 'info',
        summary: 'Auto Next Enabled',
        detail: `Next question will auto-launch every ${this.timerDuration} seconds.`
      });
    } else {
      this.stopTimer();
      this.messageService.add({
        severity: 'secondary',
        summary: 'Auto Next Disabled',
        detail: 'Manual host control active.'
      });
    }
  }

  resetTimer() {
    this.countdownSeconds = this.timerDuration;
    if (this.autoAdvanceEnabled) {
      this.stopTimer();
      this.startTimer();
    }
  }

  private startTimer() {
    this.stopTimer();
    this.countdownSeconds = this.timerDuration;
    this.timerInterval = setInterval(() => {
      if (this.countdownSeconds > 1) {
        this.countdownSeconds--;
      } else {
        // Time expired: automatically trigger next question
        this.countdownSeconds = this.timerDuration;
        this.autoAdvanceNext();
      }
    }, 1000);
  }

  private stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private async autoAdvanceNext() {
    if (!this.autoAdvanceEnabled) return;
    if (this.isLastQuestion()) {
      this.autoAdvanceEnabled = false;
      this.stopTimer();
      this.messageService.add({
        severity: 'info',
        summary: 'Session Finished',
        detail: 'Completed the last question in the room!'
      });
      return;
    }
    await this.nextQuestion();
    this.messageService.add({
      severity: 'info',
      summary: 'Auto Next Triggered',
      detail: `Advanced to Question ${this.getCurrentQuestionIndex()} of ${this.polls().length}`
    });
  }

  async onLockChange() {
    const poll = this.currentPoll();
    if (!poll) return;
    await this.pollService.toggleLockPoll('MATI01', poll.id, this.isLocked);
    this.messageService.add({
      severity: this.isLocked ? 'warn' : 'info',
      summary: this.isLocked ? 'Voting Locked' : 'Voting Opened',
      detail: this.isLocked ? 'Audience submissions are paused.' : 'Audience can submit votes now.'
    });
  }

  async onShowResultsChange() {
    const poll = this.currentPoll();
    if (!poll) return;
    await this.pollService.toggleShowResults('MATI01', poll.id, this.showResults);
    this.messageService.add({
      severity: 'info',
      summary: this.showResults ? 'Results Revealed' : 'Results Hidden',
      detail: this.showResults ? 'Presenter stage shows bar charts.' : 'Presenter stage hides live results.'
    });
  }

  isFirstQuestion(): boolean {
    const poll = this.currentPoll();
    const list = this.polls();
    if (!poll || list.length === 0) return true;
    return list[0].id === poll.id;
  }

  isLastQuestion(): boolean {
    const poll = this.currentPoll();
    const list = this.polls();
    if (!poll || list.length === 0) return true;
    return list[list.length - 1].id === poll.id;
  }

  getCurrentQuestionIndex(): number {
    const poll = this.currentPoll();
    const list = this.polls();
    if (!poll || list.length === 0) return 0;
    const idx = list.findIndex(p => p.id === poll.id);
    return idx >= 0 ? idx + 1 : 0;
  }

  async onSelectQuestion(pollId: string) {
    if (!pollId) return;
    await this.pollService.setActivePoll('MATI01', pollId);
    if (this.autoAdvanceEnabled) {
      this.resetTimer();
    }
    this.messageService.add({
      severity: 'success',
      summary: 'Question Switched',
      detail: 'Stage updated to selected question.'
    });
  }

  async prevQuestion() {
    const poll = this.currentPoll();
    const list = this.polls();
    if (!poll || list.length === 0) return;
    const idx = list.findIndex(p => p.id === poll.id);
    if (idx > 0) {
      await this.pollService.setActivePoll('MATI01', list[idx - 1].id);
      if (this.autoAdvanceEnabled) {
        this.resetTimer();
      }
    }
  }

  async nextQuestion() {
    const poll = this.currentPoll();
    const list = this.polls();
    if (!poll || list.length === 0) return;
    const idx = list.findIndex(p => p.id === poll.id);
    if (idx >= 0 && idx < list.length - 1) {
      await this.pollService.setActivePoll('MATI01', list[idx + 1].id);
      if (this.autoAdvanceEnabled) {
        this.resetTimer();
      }
    }
  }
}
