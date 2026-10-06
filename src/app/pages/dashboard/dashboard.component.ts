import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MatiPollService } from '../../services/mati-poll.service';
import { Room, Poll } from '../../models/poll.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="space-y-6">
      <p-toast></p-toast>

      <!-- Welcome Banner -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-8 shadow-xl">
        <div class="relative z-10 max-w-3xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 backdrop-blur-md border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-4">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Mati Live Audience Engine
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Mati (មតិ) Studio Dashboard
          </h1>
          <p class="mt-2 text-indigo-100 text-sm sm:text-base leading-relaxed">
            Create real-time audience polls, display live projection charts, and control interactive classroom sessions effortlessly.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button 
              type="button" 
              (click)="showNewRoomDialog = true" 
              class="banner-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all border border-indigo-500 active:scale-95 cursor-pointer">
              <i class="pi pi-plus"></i>
              <span>Create New Room</span>
            </button>

            <button 
              type="button" 
              (click)="showNewPollDialog = true" 
              class="banner-ghost-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white border border-white/30 backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer">
              <i class="pi pi-question-circle"></i>
              <span>Add Question to MATI01</span>
            </button>

            <a 
              routerLink="/dashboard/control" 
              class="banner-ghost-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white border border-white/30 backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer">
              <i class="pi pi-sliders-h"></i>
              <span>Open Live Controller</span>
            </a>
          </div>
        </div>
        <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl">
            <i class="pi pi-desktop"></i>
          </div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Active Room</div>
            <div class="text-2xl font-extrabold text-gray-900 dark:text-white">MATI01</div>
            <div class="text-xs text-emerald-600 font-medium">Status: Active & Listening</div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl">
            <i class="pi pi-chart-bar"></i>
          </div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Total Polls</div>
            <div class="text-2xl font-extrabold text-gray-900 dark:text-white">{{ polls().length }}</div>
            <div class="text-xs text-gray-500">In MATI01 session</div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl">
            <i class="pi pi-users"></i>
          </div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Audience Links</div>
            <div class="flex items-center gap-2 mt-1">
              <a routerLink="/stage/MATI01" target="_blank" class="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                <i class="pi pi-external-link text-[10px]"></i> Stage View
              </a>
              <span class="text-gray-300">•</span>
              <a routerLink="/join/MATI01" target="_blank" class="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                <i class="pi pi-external-link text-[10px]"></i> Mobile View
              </a>
            </div>
            <div class="text-[11px] text-gray-400 mt-1">Click to launch in new tab</div>
          </div>
        </div>
      </div>

      <!-- Polls Management List -->
      <div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Active Room Polls: MATI01</h2>
            <p class="text-xs text-gray-500">Select which question to project live onto the presenter stage.</p>
          </div>
          <button pButton label="New Question" icon="pi pi-plus" class="p-button-outlined p-button-sm rounded-xl" (click)="showNewPollDialog = true"></button>
        </div>

        <div class="space-y-4">
          @for (poll of polls(); track poll.id; let idx = $index) {
            <div class="p-5 rounded-2xl border transition-all" [ngClass]="currentRoom()?.activePollId === poll.id ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300'">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold flex items-center justify-center text-gray-600 dark:text-gray-300">
                      {{ idx + 1 }}
                    </span>
                    <h3 class="text-base font-bold text-gray-900 dark:text-white">
                      {{ poll.question }}
                    </h3>
                    @if (currentRoom()?.activePollId === poll.id) {
                      <p-tag severity="info" value="LIVE ON STAGE" icon="pi pi-broadcast"></p-tag>
                    }
                    @if (poll.isLocked) {
                      <p-tag severity="danger" value="VOTING LOCKED" icon="pi pi-lock"></p-tag>
                    }
                  </div>
                  <div class="flex flex-wrap gap-2 pt-2">
                    @for (opt of poll.options; track opt.id) {
                      <span class="text-xs px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                        {{ opt.id }}. {{ opt.text }}
                      </span>
                    }
                  </div>
                </div>

                <div class="flex items-center gap-2 self-end md:self-center shrink-0">
                  @if (currentRoom()?.activePollId !== poll.id) {
                    <button pButton label="Make Live" icon="pi pi-play" class="p-button-sm p-button-success rounded-xl" (click)="setAsLive(poll.id)"></button>
                  } @else {
                    <a routerLink="/dashboard/control" pButton label="Remote Control" icon="pi pi-sliders-h" class="p-button-sm p-button-primary rounded-xl"></a>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="text-center py-12 text-gray-400">
              <i class="pi pi-inbox text-4xl mb-2"></i>
              <p>No questions yet in this room. Click "New Question" to create one.</p>
            </div>
          }
        </div>
      </div>

      <!-- Create Room Dialog -->
      <p-dialog header="Create New Mati Room" [(visible)]="showNewRoomDialog" [modal]="true" [style]="{width: '450px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Room Title</label>
            <input pInputText type="text" [(ngModel)]="newRoomTitle" placeholder="e.g. AI & Web Summit 2026" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Room Code (PIN)</label>
            <input pInputText type="text" [(ngModel)]="newRoomCode" placeholder="Leave blank for auto PIN (e.g. MATI02)" class="w-full uppercase" />
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewRoomDialog = false"></button>
          <button pButton label="Create Room" icon="pi pi-check" class="p-button-primary" (click)="createNewRoom()"></button>
        </ng-template>
      </p-dialog>

      <!-- Create Poll Dialog -->
      <p-dialog header="Create Question for MATI01" [(visible)]="showNewPollDialog" [modal]="true" [style]="{width: '550px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Question</label>
            <input pInputText type="text" [(ngModel)]="newPollQuestion" placeholder="e.g. Which framework is your favorite?" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Options (One per line)</label>
            <textarea [(ngModel)]="newPollOptionsRaw" rows="4" placeholder="Angular 19&#10;React 19&#10;Vue 3&#10;Svelte 5" class="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewPollDialog = false"></button>
          <button pButton label="Save Question" icon="pi pi-check" class="p-button-primary" (click)="createNewPoll()"></button>
        </ng-template>
      </p-dialog>
    </div>
  `
})
export class DashboardComponent implements OnInit {
  private pollService = inject(MatiPollService);
  private messageService = inject(MessageService);

  polls = signal<Poll[]>([]);
  currentRoom = this.pollService.currentRoom;

  showNewRoomDialog = false;
  showNewPollDialog = false;

  newRoomTitle = '';
  newRoomCode = '';
  newPollQuestion = '';
  newPollOptionsRaw = 'Angular 19\nReact 19\nVue 3\nSvelte 5';

  ngOnInit() {
    this.pollService.listenToRoomPolls('MATI01').subscribe(list => {
      this.polls.set(list);
    });
  }

  async setAsLive(pollId: string) {
    await this.pollService.setActivePoll('MATI01', pollId);
    this.messageService.add({
      severity: 'success',
      summary: 'Poll Activated',
      detail: 'Question is now live on the presenter stage!'
    });
  }

  async createNewRoom() {
    if (!this.newRoomTitle.trim()) return;
    const code = await this.pollService.createRoom(this.newRoomTitle, this.newRoomCode || undefined);
    this.showNewRoomDialog = false;
    this.newRoomTitle = '';
    this.newRoomCode = '';
    this.messageService.add({
      severity: 'success',
      summary: 'Room Created',
      detail: `Room ${code} is ready!`
    });
  }

  async createNewPoll() {
    if (!this.newPollQuestion.trim()) return;
    const opts = this.newPollOptionsRaw
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (opts.length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'At least 2 options needed',
        detail: 'Please provide at least 2 answer choices.'
      });
      return;
    }

    await this.pollService.createPoll('MATI01', this.newPollQuestion, opts);
    this.showNewPollDialog = false;
    this.newPollQuestion = '';
    this.messageService.add({
      severity: 'success',
      summary: 'Question Created',
      detail: 'Question added to MATI01!'
    });
  }
}
