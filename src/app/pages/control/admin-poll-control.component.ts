import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MatiPollService } from '../../services/mati-poll.service';
import { AuthService } from '../../services/auth.service';
import { DetailedSessionSummary, Poll, PollStats, Room } from '../../models/poll.model';

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
    DialogModule,
    InputTextModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="space-y-4 max-w-7xl mx-auto px-2 sm:px-4">
      <p-toast></p-toast>

      <!-- 1. Sleek Presenter Header Bar -->
      <header class="bg-white dark:bg-gray-900 px-4 sm:px-6 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs flex items-center justify-between gap-3 relative z-30">
        <!-- Left: Back Button + Room Switcher & Title -->
        <div class="flex items-center gap-3 min-w-0">
          <a 
            routerLink="/dashboard" 
            title="Back to Dashboard" 
            class="w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer shrink-0">
            <i class="pi pi-arrow-left text-sm font-bold"></i>
          </a>

          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <h1 class="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate max-w-[200px] sm:max-w-xs md:max-w-sm" [title]="room()?.title || ('Mati #' + roomCode())">
                {{ room()?.title || ('Mati #' + roomCode()) }}
              </h1>
              
              <!-- Room Switcher Badge -->
              <div class="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 shrink-0">
                <span class="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">#{{ roomCode() }}</span>
                <select 
                  [ngModel]="roomCode()" 
                  (ngModelChange)="switchRoom($event)" 
                  class="bg-transparent text-xs font-semibold text-gray-600 dark:text-gray-300 focus:outline-none cursor-pointer">
                  @for (r of availableRooms(); track r.code) {
                    <option [value]="r.code" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                      {{ r.code }} - {{ r.title }}
                    </option>
                  }
                </select>
              </div>

              <!-- Status Badge -->
              @if (room()?.status === 'completed') {
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Concluded
                </span>
              } @else if (room()?.activePollId) {
                <span class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Sync
                </span>
              }
            </div>

            <div class="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
              <span>{{ polls().length }} of {{ allRawPolls().length }} questions active</span>
              <span>•</span>
              <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ stats()?.totalVotes || 0 }} total votes</span>
            </div>
          </div>
        </div>

        <!-- Right: Present, Start/Finish Session, and Options Menu -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Present Stage TV Button -->
          <a 
            [routerLink]="['/stage', roomCode()]" 
            target="_blank" 
            title="Launch Presenter Stage TV"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-all cursor-pointer no-underline">
            <i class="pi pi-desktop text-xs"></i>
            <span>Present</span>
          </a>

          <!-- Session Lifecycle (Start / Finish / Restart) -->
          @if (room()?.status === 'completed') {
            <button 
              type="button" 
              (click)="restartSession()" 
              class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer">
              <i class="pi pi-replay text-xs"></i>
              <span class="hidden sm:inline">Restart</span>
            </button>
          } @else if (!room()?.activePollId) {
            <button 
              type="button" 
              (click)="startSessionFirstQuestion()" 
              class="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer">
              <i class="pi pi-play text-xs"></i>
              <span>Start</span>
            </button>
          } @else {
            <button 
              type="button" 
              (click)="finishSession()" 
              class="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs transition-all cursor-pointer">
              <i class="pi pi-check-circle text-xs"></i>
              <span>Finish</span>
            </button>
          }

          <!-- Options Menu (Collapsed utilities to prevent massive clutter) -->
          <div class="relative">
            <button 
              type="button" 
              (click)="toggleSettingsPanel()" 
              class="p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer"
              title="More Session Options">
              <i class="pi pi-ellipsis-h text-sm"></i>
            </button>

            <!-- Compact Settings Dropdown Popover -->
            @if (showSettingsPanel()) {
              <div 
                (click)="$event.stopPropagation()"
                class="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-3 z-50 space-y-2.5 animate-fadein text-left">
                <div class="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">
                  Session Controls
                </div>

                <!-- Overview Results & Analytics -->
                <a 
                  [routerLink]="['/overview', roomCode()]" 
                  class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold transition-colors no-underline">
                  <i class="pi pi-chart-bar text-indigo-600 dark:text-indigo-400"></i>
                  <span>Overview & Analytics</span>
                </a>

                <!-- Participant Mobile Link -->
                <a 
                  [routerLink]="['/vote', roomCode()]" 
                  target="_blank" 
                  class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-colors no-underline">
                  <i class="pi pi-mobile text-gray-500"></i>
                  <span>Participant Mobile View</span>
                </a>

                <!-- Pick Questions Subset -->
                <button 
                  type="button" 
                  (click)="openPickQuestionsDialog(); toggleSettingsPanel()" 
                  class="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs font-semibold transition-colors cursor-pointer text-left">
                  <i class="pi pi-check-square text-gray-500"></i>
                  <span>Pick Questions ({{ selectedQuestionCount() || allRawPolls().length }}/{{ allRawPolls().length }})</span>
                </button>

                <!-- Mode & TV Theme Options -->
                <div class="pt-2 border-t border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                  <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-600 dark:text-gray-400">Session Mode</span>
                    <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                      <button 
                        type="button" 
                        (click)="setRoomMode('live')"
                        [ngClass]="room()?.mode !== 'survey' ? 'bg-indigo-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer">Live</button>
                      <button 
                        type="button" 
                        (click)="setRoomMode('survey')"
                        [ngClass]="room()?.mode === 'survey' ? 'bg-amber-600 text-white font-bold' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer">Survey</button>
                    </div>
                  </div>

                  <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-600 dark:text-gray-400">TV Theme</span>
                    <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                      <button 
                        type="button" 
                        (click)="setStageTheme('dark')"
                        [ngClass]="(room()?.theme || 'dark') === 'dark' ? 'bg-slate-900 text-white font-bold' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer">🌙 Dark</button>
                      <button 
                        type="button" 
                        (click)="setStageTheme('light')"
                        [ngClass]="room()?.theme === 'light' ? 'bg-white text-indigo-600 font-bold' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer">☀️ Light</button>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- 2. Responsive 2-Column Command Center -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <!-- LEFT COLUMN (Col 7 / 12): Active Question Spotlight -->
        <div class="lg:col-span-7 space-y-4">
          @if (room()?.status === 'completed') {
            <!-- Clean Celebration Card when Completed -->
            <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs space-y-5 animate-fadein text-center">
              <div class="w-14 h-14 rounded-2xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-300 flex items-center justify-center text-2xl mx-auto shadow-2xs">
                🎉
              </div>
              <div>
                <h3 class="text-base font-bold text-gray-900 dark:text-white">Session Completed!</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
                  Stage TV and participant phones are displaying the finale results screen.
                </p>
              </div>

              <!-- 3 Grand KPI Cards -->
              <div class="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
                <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                  <div class="text-lg font-bold font-mono text-gray-900 dark:text-white">{{ polls().length }}</div>
                  <div class="text-[10px] uppercase font-bold text-gray-400">Questions</div>
                </div>
                <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                  <div class="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400">{{ sessionSummary()?.totalVotes || 0 }}</div>
                  <div class="text-[10px] uppercase font-bold text-gray-400">Total Votes</div>
                </div>
                <div class="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-center">
                  <div class="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {{ sessionSummary()?.hasScoredQuestions ? (sessionSummary()?.overallAccuracy + '%') : (sessionSummary()?.topConsensusPercentage + '%') }}
                  </div>
                  <div class="text-[10px] uppercase font-bold text-gray-400">
                    {{ sessionSummary()?.hasScoredQuestions ? 'Accuracy' : 'Consensus' }}
                  </div>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="flex items-center justify-center gap-3 pt-2">
                <a 
                  [routerLink]="['/overview', roomCode()]" 
                  class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 no-underline cursor-pointer">
                  <i class="pi pi-chart-bar text-xs"></i>
                  <span>View Mati Overview</span>
                </a>
                <button 
                  type="button" 
                  (click)="restartSession()" 
                  class="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold text-xs inline-flex items-center gap-1.5 cursor-pointer">
                  <i class="pi pi-replay text-xs"></i>
                  <span>Restart (Q1)</span>
                </button>
              </div>
            </div>
          } @else {
            <!-- Active Question Live Spotlight Card -->
            <div class="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-2xs space-y-5">
              <!-- Top Question Navigation Bar -->
              <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 gap-2">
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono font-bold text-xs">
                    Q {{ getCurrentQuestionIndex() }} / {{ polls().length }}
                  </span>
                  @if (isLocked) {
                    <span class="px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 font-semibold text-[11px] border border-red-200 dark:border-red-800 flex items-center gap-1">
                      <i class="pi pi-lock text-[10px]"></i> Locked
                    </span>
                  } @else {
                    <span class="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px] border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                      <i class="pi pi-check text-[10px]"></i> Voting open
                    </span>
                  }
                </div>

                <!-- Prev / Next Big Buttons -->
                <div class="flex items-center gap-2">
                  <button 
                    type="button"
                    (click)="prevQuestion()" 
                    [disabled]="isFirstQuestion()"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer">
                    <i class="pi pi-arrow-left text-[10px]"></i> Prev
                  </button>
                  <button 
                    type="button"
                    (click)="nextQuestion()" 
                    [disabled]="isLastQuestion()"
                    class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 shadow-sm shadow-indigo-600/20 cursor-pointer">
                    Next <i class="pi pi-arrow-right text-[10px]"></i>
                  </button>
                </div>
              </div>

              <!-- Question Title -->
              <div>
                <h2 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug">
                  {{ currentPoll()?.question || 'No question active' }}
                </h2>
              </div>

              <!-- Live Options Breakdown Bars -->
              <div class="space-y-2.5">
                @if (currentPoll()) {
                  @for (opt of currentPoll()!.options; track opt.id) {
                    <div class="p-3 rounded-xl bg-gray-50/70 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 space-y-1.5 transition-all">
                      <div class="flex justify-between items-center text-xs font-semibold">
                        <span class="text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <span class="w-5 h-5 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-[11px] font-bold flex items-center justify-center border border-gray-200 dark:border-gray-600 shadow-2xs">
                            {{ opt.id }}
                          </span>
                          <span>{{ opt.text }}</span>
                          @if (currentPoll()?.correctOptionId === opt.id) {
                            <i class="pi pi-check-circle text-emerald-600 dark:text-emerald-400 text-xs" title="Correct Option"></i>
                          }
                        </span>
                        <span class="text-indigo-600 dark:text-indigo-400 font-bold font-mono">
                          {{ stats()?.votesPerOption?.[opt.id] || 0 }} ({{ stats()?.percentages?.[opt.id] || 0 }}%)
                        </span>
                      </div>
                      <div class="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                          class="h-2 rounded-full transition-all duration-500" 
                          [ngClass]="currentPoll()?.correctOptionId === opt.id ? 'bg-emerald-500' : 'bg-indigo-600'"
                          [style.width.%]="stats()?.percentages?.[opt.id] || 0">
                        </div>
                      </div>
                    </div>
                  }
                }
              </div>

              <!-- Streamlined Presenter Control Strip (Tactile buttons, no cluttered nested cards) -->
              <div class="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  <!-- Lock / Unlock Voting Button -->
                  <button 
                    type="button" 
                    (click)="isLocked = !isLocked; onLockChange()"
                    [ngClass]="isLocked 
                      ? 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800 hover:bg-red-100' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50'"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                    <i class="pi" [ngClass]="isLocked ? 'pi-lock text-red-600' : 'pi-lock-open text-gray-500'"></i>
                    <span>{{ isLocked ? 'Voting Locked' : 'Lock Voting' }}</span>
                  </button>

                  <!-- Show / Hide Results on Stage Button -->
                  <button 
                    type="button" 
                    (click)="showResults = !showResults; onShowResultsChange()"
                    [ngClass]="showResults 
                      ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50'"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs">
                    <i class="pi" [ngClass]="showResults ? 'pi-chart-bar text-indigo-600 dark:text-indigo-400' : 'pi-eye-slash text-gray-500'"></i>
                    <span>{{ showResults ? 'Results Visible' : 'Hide Results' }}</span>
                  </button>
                </div>

                <!-- Compact Broadcast Timer -->
                <div class="flex items-center gap-1 text-xs">
                  <span class="text-gray-400 font-medium text-[11px]">Timer:</span>
                  <button type="button" (click)="triggerQuestionTimer(30)" class="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 text-gray-700 dark:text-gray-300 font-semibold transition-colors cursor-pointer text-xs">30s</button>
                  <button type="button" (click)="triggerQuestionTimer(60)" class="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 text-gray-700 dark:text-gray-300 font-semibold transition-colors cursor-pointer text-xs">60s</button>
                  @if (autoAdvanceEnabled || countdownSeconds) {
                    <button type="button" (click)="clearQuestionTimer()" class="px-2 py-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 font-bold transition-colors cursor-pointer text-xs">Stop</button>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <!-- RIGHT COLUMN (Col 5 / 12): Clean Question Playlist Deck -->
        <div class="lg:col-span-5 space-y-4">
          <div class="bg-white dark:bg-gray-900 p-5 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-2xs space-y-3">
            <!-- Playlist Header -->
            <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-gray-900 dark:text-white">Questions</h3>
                <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-xs">
                  {{ polls().length }}
                </span>
              </div>
              <button 
                type="button" 
                (click)="showNewPollDialog = true" 
                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer shadow-2xs flex items-center gap-1">
                <i class="pi pi-plus text-xs"></i>
                <span>Add Question</span>
              </button>
            </div>

            <!-- Compact Search Filter -->
            <div class="relative">
              <i class="pi pi-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input 
                type="text" 
                [(ngModel)]="searchQuery" 
                placeholder="Search questions..." 
                class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 transition-all" />
            </div>

            <!-- Clean Scrollable Questions List -->
            <div class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              @for (p of filteredPolls(); track p.id; let idx = $index) {
                <div 
                  class="p-3 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer group"
                  (click)="onSelectQuestion(p.id)"
                  [ngClass]="currentPoll()?.id === p.id 
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-2xs ring-1 ring-indigo-500' 
                    : 'bg-white dark:bg-gray-850 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'">
                  
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <span 
                      class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border"
                      [ngClass]="currentPoll()?.id === p.id 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'">
                      {{ p.order || (idx + 1) }}
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {{ p.question }}
                      </div>
                      <div class="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        {{ p.options.length }} options {{ p.correctOptionId ? '• Scored' : '' }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0" (click)="$event.stopPropagation()">
                    @if (currentPoll()?.id === p.id) {
                      <span class="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-semibold text-[10px] flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live
                      </span>
                    } @else {
                      <button 
                        type="button" 
                        (click)="onSelectQuestion(p.id)"
                        class="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950 group-hover:text-indigo-600 text-gray-700 dark:text-gray-300 rounded-md text-[10px] font-semibold transition-colors cursor-pointer">
                        Present
                      </button>
                    }
                    <button
                      type="button"
                      (click)="deletePoll(p.id)"
                      title="Delete Question"
                      class="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer">
                      <i class="pi pi-trash text-[11px]"></i>
                    </button>
                  </div>
                </div>
              } @empty {
                <div class="p-8 text-center text-xs text-gray-400 space-y-1">
                  <div>No questions matching "{{ searchQuery }}".</div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Create Question Dialog in Controller -->
      <p-dialog [header]="'Add Question to Room ' + roomCode()" [(visible)]="showNewPollDialog" [modal]="true" [style]="{width: '520px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Question</label>
            <input pInputText type="text" [(ngModel)]="newPollQuestion" placeholder="e.g. Which technology stack do you prefer?" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Options (One per line)</label>
            <textarea [(ngModel)]="newPollOptionsRaw" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4" class="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Correct Option Number (Optional, 1-based)</label>
            <input pInputText type="number" [(ngModel)]="newPollCorrectIndex" placeholder="e.g. 1" class="w-full" />
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewPollDialog = false"></button>
          <button pButton label="Save Question" icon="pi pi-check" class="p-button-primary" (click)="createNewPoll()"></button>
        </ng-template>
      </p-dialog>

      <!-- Pick Questions to Vote Dialog (Subset Selector) -->
      <p-dialog 
        [header]="'Pick Questions to Vote (' + roomCode() + ')'" 
        [(visible)]="showPickQuestionsDialog" 
        [modal]="true" 
        [style]="{width: '640px', maxWidth: '95vw'}" 
        class="p-fluid">
        <div class="space-y-4 pt-1">
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>Choose which questions are included in this session.</span>
            <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {{ tempSelectedPollIds().length }} / {{ allRawPolls().length }} Selected
            </span>
          </div>

          <!-- Quick Presets -->
          <div class="flex items-center gap-1.5 flex-wrap p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Presets:</span>
            <button 
              type="button" 
              (click)="presetSelectFirst(5)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:text-indigo-600 cursor-pointer transition-all">
              First 5
            </button>
            <button 
              type="button" 
              (click)="presetSelectFirst(10)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:text-indigo-600 cursor-pointer transition-all">
              First 10
            </button>
            <button 
              type="button" 
              (click)="presetSelectFirst(15)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 font-black cursor-pointer transition-all shadow-2xs">
              First 15
            </button>
            <button 
              type="button" 
              (click)="presetSelectFirst(20)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:text-indigo-600 cursor-pointer transition-all">
              First 20
            </button>
            <button 
              type="button" 
              (click)="presetSelectRandom(15)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 cursor-pointer transition-all">
              🎲 Random 15
            </button>
            <button 
              type="button" 
              (click)="presetSelectAll()" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 cursor-pointer transition-all ml-auto">
              Select All ({{ allRawPolls().length }})
            </button>
            <button 
              type="button" 
              (click)="presetClearAll()" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 cursor-pointer transition-all">
              Clear
            </button>
          </div>

          <!-- Question Checklist -->
          @if (allRawPolls().length === 0) {
            <div class="p-8 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
              <i class="pi pi-question-circle text-2xl text-indigo-400"></i>
              <p>No questions found in room <strong>{{ roomCode() }}</strong> yet.</p>
              <button type="button" (click)="showPickQuestionsDialog = false; showNewPollDialog = true" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                <i class="pi pi-plus"></i> Add First Question
              </button>
            </div>
          } @else {
            <div class="max-h-80 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 dark:border-gray-800 rounded-2xl p-2 bg-white dark:bg-gray-900">
              @for (p of allRawPolls(); track p.id; let idx = $index) {
                <label class="flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer border"
                  [ngClass]="isQuestionSelected(p.id) 
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' 
                    : 'bg-gray-50/40 dark:bg-gray-800/30 border-transparent hover:border-gray-200 dark:hover:border-gray-700'">
                  <input 
                    type="checkbox" 
                    [checked]="isQuestionSelected(p.id)" 
                    (change)="toggleQuestionSelection(p.id)" 
                    class="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-mono font-black"
                        [ngClass]="isQuestionSelected(p.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'">
                        #{{ p.order || (idx + 1) }}
                      </span>
                      <span class="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
                        {{ p.question }}
                      </span>
                    </div>
                    <div class="text-[11px] text-gray-500 mt-0.5">
                      {{ p.options.length }} choices
                      @if (p.correctOptionId !== undefined) {
                        • <span class="text-emerald-600 font-semibold">Scored (Option #{{ p.correctOptionId }})</span>
                      }
                    </div>
                  </div>
                </label>
              }
            </div>
          }
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showPickQuestionsDialog = false"></button>
          <button pButton [label]="'Apply (' + tempSelectedPollIds().length + ' Questions)'" icon="pi pi-check" class="p-button-primary" (click)="savePickedQuestions()"></button>
        </ng-template>
      </p-dialog>

      <!-- Create Room Dialog -->
      <p-dialog header="Create New Mati Room" [(visible)]="showNewRoomDialog" [modal]="true" [style]="{width: '450px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Room Title</label>
            <input pInputText type="text" [(ngModel)]="newRoomTitle" placeholder="e.g. AI & Tech Summit 2026" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Room Code (PIN)</label>
            <input pInputText type="text" [(ngModel)]="newRoomCode" placeholder="Leave blank for auto PIN (e.g. MATI02)" class="w-full uppercase" />
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewRoomDialog = false"></button>
          <button pButton label="Create Room" icon="pi pi-check" class="p-button-primary" [disabled]="!newRoomTitle.trim()" (click)="createNewRoom()"></button>
        </ng-template>
      </p-dialog>

      <!-- Overview Results Dialog -->
      <p-dialog 
        header="Session Overview Results & Performance Analytics" 
        [visible]="showOverviewResultsDialog()" 
        (visibleChange)="showOverviewResultsDialog.set($event)" 
        [modal]="true" 
        [style]="{width: '92vw', maxWidth: '850px'}" 
        class="p-fluid">
        <div class="space-y-4 pt-2">
          <!-- Room Summary Badge & Title -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
            <div>
              <span class="text-xs font-bold text-gray-500 uppercase">Room:</span>
              <span class="font-mono font-bold text-amber-600 dark:text-amber-400 ml-1.5">{{ roomCode() }}</span>
              <span class="text-xs text-gray-400 ml-2">({{ room()?.title || 'Session' }})</span>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
              [ngClass]="sessionSummary()?.hasScoredQuestions ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'">
              {{ sessionSummary()?.hasScoredQuestions ? '🎯 Quiz Mode' : '📋 Survey Mode' }}
            </span>
          </div>

          <!-- 4 Summary KPI Cards -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
              <div class="text-2xl font-black font-mono text-gray-900 dark:text-white">{{ polls().length }}</div>
              <div class="text-[10px] uppercase font-bold text-gray-400">Questions</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
              <div class="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400">{{ sessionSummary()?.totalVotes || 0 }}</div>
              <div class="text-[10px] uppercase font-bold text-gray-400">Total Votes</div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
              <div class="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                {{ sessionSummary()?.hasScoredQuestions ? (sessionSummary()?.overallAccuracy + '%') : (sessionSummary()?.topConsensusPercentage + '%') }}
              </div>
              <div class="text-[10px] uppercase font-bold text-gray-400">
                {{ sessionSummary()?.hasScoredQuestions ? 'Accuracy' : 'Consensus' }}
              </div>
            </div>
            <div class="p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-center">
              <div class="text-2xl font-black font-mono text-purple-600 dark:text-purple-400">
                {{ room()?.status === 'completed' ? '100%' : 'Active' }}
              </div>
              <div class="text-[10px] uppercase font-bold text-gray-400">Status</div>
            </div>
          </div>

          <!-- Question-by-Question Detailed Results List -->
          <div class="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            @for (q of sessionSummary()?.questionResults; track q.pollId; let idx = $index) {
              <div class="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-2 min-w-0">
                    <span class="font-mono font-black text-xs px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
                      Q{{ q.order || (idx + 1) }}
                    </span>
                    <h4 class="text-sm font-bold text-gray-900 dark:text-white leading-snug">{{ q.question }}</h4>
                  </div>
                  <span class="text-xs font-bold text-gray-400 font-mono shrink-0">{{ q.totalVotes }} votes</span>
                </div>

                <div class="flex items-center gap-2 text-xs">
                  @if (q.correctOptionId !== undefined) {
                    <span class="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                      ✓ Correct: {{ q.correctOptionText }} ({{ q.correctPercentage }}% correct)
                    </span>
                  } @else {
                    <span class="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-bold border border-amber-200 dark:border-amber-800">
                      ⭐ Top Choice: {{ q.winningOptionText }} ({{ q.winningPercentage }}% consensus)
                    </span>
                  }
                </div>

                <!-- Option Breakdown Bars -->
                <div class="space-y-1.5 pt-1">
                  @for (opt of q.options; track opt.id) {
                    <div class="p-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 text-xs space-y-1">
                      <div class="flex items-center justify-between">
                        <span class="text-gray-800 dark:text-gray-200 flex items-center gap-1.5" [ngClass]="opt.isCorrect ? 'font-bold text-emerald-700 dark:text-emerald-300' : ''">
                          <span>{{ opt.id }}.</span>
                          <span>{{ opt.text }}</span>
                          @if (opt.isCorrect) {
                            <i class="pi pi-check text-emerald-500 text-[10px]"></i>
                          }
                        </span>
                        <span class="font-mono font-bold" [ngClass]="opt.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'">
                          {{ opt.percentage }}% ({{ opt.votes }})
                        </span>
                      </div>
                      <div class="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div class="h-full rounded-full transition-all duration-300"
                          [style.width.%]="opt.percentage"
                          [ngClass]="opt.isCorrect ? 'bg-emerald-500' : (opt.id === q.winningOptionId ? 'bg-indigo-600' : 'bg-gray-400')">
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        </div>
        <ng-template pTemplate="footer">
          <div class="flex items-center justify-between w-full">
            <div class="flex items-center gap-2">
              <a [routerLink]="['/overview', roomCode()]" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1 transition-colors no-underline shadow-sm shadow-indigo-600/20">
                <i class="pi pi-chart-bar text-xs"></i>
                <span>Open Mati Overview</span>
              </a>
              <a [routerLink]="['/stage', roomCode()]" [queryParams]="{ view: 'overview' }" target="_blank" class="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                <i class="pi pi-desktop text-xs"></i>
                <span>TV Stage</span>
              </a>
            </div>
            <button pButton label="Close" icon="pi pi-times" class="p-button-text" (click)="showOverviewResultsDialog.set(false)"></button>
          </div>
        </ng-template>
      </p-dialog>
    </div>
  `
})
export class AdminPollControlComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pollService = inject(MatiPollService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  currentUser = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;

  showSettingsPanel = signal<boolean>(false);
  showOverviewResultsDialog = signal<boolean>(false);
  sessionSummary = signal<DetailedSessionSummary | null>(null);
  showNewRoomDialog = false;
  newRoomTitle = '';
  newRoomCode = '';

  showNewPollDialog = false;
  newPollQuestion = '';
  newPollOptionsRaw = 'Option 1\nOption 2\nOption 3\nOption 4';
  newPollCorrectIndex: number | null = null;

  roomCode = signal<string>('MATI01');
  allRooms = signal<Room[]>([]);

  availableRooms = computed(() => {
    const list = this.allRooms();
    const user = this.currentUser();
    if (!user || this.isAdmin()) return list;
    const mine = list.filter(r => r.ownerEmail === user.email || r.ownerId === user.uid);
    if (mine.length > 0) return mine;
    return list;
  });

  allRawPolls = signal<Poll[]>([]);
  room = signal<Room | null>(null);

  // Active question list filtered by chosen subset
  polls = computed(() => {
    const raw = this.allRawPolls();
    const sel = this.room()?.selectedPollIds;
    if (sel && Array.isArray(sel) && sel.length > 0) {
      const filtered = raw.filter(p => sel.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return raw;
  });

  selectedQuestionCount = computed(() => {
    const sel = this.room()?.selectedPollIds;
    return sel && sel.length > 0 ? sel.length : 0;
  });

  currentPoll = this.pollService.currentPoll;
  stats = signal<PollStats | null>(null);

  // Pick questions modal state
  showPickQuestionsDialog = false;
  tempSelectedPollIds = signal<string[]>([]);

  isQuestionSelected(pollId: string): boolean {
    return this.tempSelectedPollIds().includes(pollId);
  }

  searchQuery = '';
  filteredPolls = computed(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const list = this.polls();
    if (!q) return list;
    return list.filter((p, idx) => 
      (idx + 1).toString().includes(q) ||
      (p.order && p.order.toString().includes(q)) ||
      p.question.toLowerCase().includes(q)
    );
  });

  isLocked = false;
  showResults = true;

  autoAdvanceEnabled = false;
  timerDuration = 20;
  countdownSeconds = 20;
  private timerInterval: any = null;

  private pollSub?: Subscription;
  private pollsListSub?: Subscription;
  private roomSub?: Subscription;
  private allRoomsSub?: Subscription;
  private routeParamSub?: Subscription;

  ngOnInit() {
    this.allRoomsSub = this.pollService.listenToRooms().subscribe(rooms => {
      this.allRooms.set(rooms);
    });

    this.routeParamSub = this.route.paramMap.subscribe(params => {
      const codeFromRoute = params.get('roomCode');
      if (codeFromRoute && codeFromRoute.toUpperCase() !== this.roomCode()) {
        this.roomCode.set(codeFromRoute.toUpperCase());
        this.subscribeToRoom(this.roomCode());
      } else if (!codeFromRoute) {
        const queryCode = this.route.snapshot.queryParamMap.get('room');
        const broadcastCode = this.pollService.getActiveBroadcastRoom();
        const activeCode = (queryCode || broadcastCode || this.roomCode() || 'MATI01').toUpperCase();
        this.roomCode.set(activeCode);
        this.subscribeToRoom(activeCode);
      } else {
        this.subscribeToRoom(this.roomCode());
      }
    });
  }

  switchRoom(code: string) {
    if (!code) return;
    const targetCode = code.toUpperCase();
    this.roomCode.set(targetCode);
    this.router.navigate(['/dashboard/control', targetCode]);
    this.subscribeToRoom(targetCode);
  }

  private subscribeToRoom(code: string) {
    this.stopTimer();
    this.autoAdvanceEnabled = false;
    this.pollService.broadcastActiveRoom(code, this.currentUser()?.email);

    this.pollSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.roomSub?.unsubscribe();

    this.pollsListSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.allRawPolls.set(list);
    });

    this.roomSub = this.pollService.listenToRoom(code).subscribe(roomData => {
      this.room.set(roomData);
      if (roomData?.status === 'completed') {
        this.refreshSessionSummary();
      }
    });

    this.pollSub = this.pollService.listenToActivePoll(code).subscribe(pollStats => {
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
    this.roomSub?.unsubscribe();
    this.allRoomsSub?.unsubscribe();
    this.routeParamSub?.unsubscribe();
  }

  toggleSettingsPanel() {
    this.showSettingsPanel.update(v => !v);
  }

  // Pick Questions Subset Methods
  openPickQuestionsDialog() {
    const raw = this.allRawPolls();
    const currentSelected = this.room()?.selectedPollIds;
    if (currentSelected && currentSelected.length > 0) {
      const valid = currentSelected.filter(id => raw.some(p => p.id === id));
      this.tempSelectedPollIds.set(valid.length > 0 ? valid : raw.map(p => p.id));
    } else {
      // By default if none specifically chosen, all are selected
      this.tempSelectedPollIds.set(raw.map(p => p.id));
    }
    this.showPickQuestionsDialog = true;
  }

  toggleQuestionSelection(pollId: string) {
    this.tempSelectedPollIds.update(ids => 
      ids.includes(pollId) ? ids.filter(id => id !== pollId) : [...ids, pollId]
    );
  }

  presetSelectFirst(count: number) {
    const subset = this.allRawPolls().slice(0, count).map(p => p.id);
    this.tempSelectedPollIds.set(subset);
  }

  presetSelectRandom(count: number) {
    const ids = this.allRawPolls().map(p => p.id);
    const shuffled = [...ids].sort(() => 0.5 - Math.random());
    this.tempSelectedPollIds.set(shuffled.slice(0, count));
  }

  presetSelectAll() {
    this.tempSelectedPollIds.set(this.allRawPolls().map(p => p.id));
  }

  presetClearAll() {
    this.tempSelectedPollIds.set([]);
  }

  async savePickedQuestions() {
    const raw = this.allRawPolls();
    let pickedList: string[] | null = [...this.tempSelectedPollIds()];

    if (pickedList.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Questions Selected',
        detail: 'Please pick at least 1 question for the session.'
      });
      return;
    }

    // If all are selected, we can store null (meaning all questions active)
    if (pickedList.length === raw.length) {
      pickedList = null;
    }

    await this.pollService.updateRoomSelectedPollIds(this.roomCode(), pickedList);
    this.showPickQuestionsDialog = false;

    // If current active poll is not in picked list, auto switch to first available picked poll
    const currentActive = this.currentPoll();
    const activePollsList = this.polls();
    if (currentActive && !activePollsList.some(p => p.id === currentActive.id)) {
      if (activePollsList.length > 0) {
        await this.onSelectQuestion(activePollsList[0].id);
      }
    }

    this.messageService.add({
      severity: 'success',
      summary: 'Session Questions Updated! 🎯',
      detail: pickedList 
        ? `${pickedList.length} of ${raw.length} questions activated for room ${this.roomCode()}.`
        : `All ${raw.length} questions activated for room ${this.roomCode()}.`
    });
  }

  async setRoomMode(mode: 'live' | 'survey') {
    await this.pollService.setRoomMode(this.roomCode(), mode);
    this.messageService.add({
      severity: 'success',
      summary: mode === 'survey' ? '📋 Survey Mode Activated' : '🎯 Live Sync Mode Activated',
      detail: mode === 'survey'
        ? 'Audience can now freely browse and answer all 30 questions at their own pace!'
        : 'Audience phones are now synchronized to your live active question.'
    });
  }

  async setStageTheme(theme: 'dark' | 'light') {
    await this.pollService.setRoomTheme(this.roomCode(), theme);
    this.messageService.add({
      severity: 'info',
      summary: theme === 'light' ? '☀️ TV Light Mode' : '🌙 TV Dark Mode',
      detail: `Projector / Stage screen switched to ${theme} mode presentation.`
    });
  }

  async createNewRoom() {
    if (!this.newRoomTitle.trim()) return;
    const user = this.currentUser();
    const code = await this.pollService.createRoom(
      this.newRoomTitle,
      this.newRoomCode || undefined,
      user?.uid,
      user?.email || undefined
    );
    this.showNewRoomDialog = false;
    this.newRoomTitle = '';
    this.newRoomCode = '';
    this.messageService.add({
      severity: 'success',
      summary: 'Room Created! 🎉',
      detail: `New room ${code} has been created and is ready!`
    });
    this.switchRoom(code);
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

    const correctId = this.newPollCorrectIndex ? Number(this.newPollCorrectIndex) : undefined;
    await this.pollService.createPoll(this.roomCode(), this.newPollQuestion, opts, correctId);
    this.showNewPollDialog = false;
    this.newPollQuestion = '';
    this.newPollCorrectIndex = null;
    this.messageService.add({
      severity: 'success',
      summary: 'Question Added 🎉',
      detail: `Question added to ${this.roomCode()}!`
    });
  }

  async deletePoll(pollId: string) {
    if (confirm('Are you sure you want to remove this question?')) {
      await this.pollService.deletePoll(this.roomCode(), pollId);
      this.messageService.add({
        severity: 'info',
        summary: 'Question Removed',
        detail: 'Question removed from room.'
      });
    }
  }

  toggleAutoAdvance() {
    if (this.autoAdvanceEnabled) {
      this.pollService.setPollTimer(this.roomCode(), this.timerDuration);
      this.startTimer();
      this.messageService.add({
        severity: 'info',
        summary: 'Auto Next Enabled',
        detail: `Next question will auto-launch every ${this.timerDuration}s with synchronized timer on voter phones & TV.`
      });
    } else {
      this.pollService.setPollTimer(this.roomCode(), null);
      this.stopTimer();
      this.messageService.add({
        severity: 'secondary',
        summary: 'Auto Next Disabled',
        detail: 'Manual host control active.'
      });
    }
  }

  async triggerQuestionTimer(seconds: number) {
    this.countdownSeconds = seconds;
    await this.pollService.setPollTimer(this.roomCode(), seconds);
    this.messageService.add({
      severity: 'info',
      summary: 'Question Timer Broadcasted',
      detail: `Synchronized ${seconds}s countdown sent to voter phones and TV stage.`
    });
  }

  async clearQuestionTimer() {
    if (this.autoAdvanceEnabled) {
      this.autoAdvanceEnabled = false;
      this.stopTimer();
    }
    await this.pollService.setPollTimer(this.roomCode(), null);
    this.messageService.add({
      severity: 'secondary',
      summary: 'Timer Stopped',
      detail: 'Countdown cleared from all participant screens.'
    });
  }

  resetTimer() {
    this.countdownSeconds = this.timerDuration;
    if (this.autoAdvanceEnabled) {
      this.pollService.setPollTimer(this.roomCode(), this.timerDuration);
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
      await this.finishSession();
      return;
    }
    await this.nextQuestion();
    this.messageService.add({
      severity: 'info',
      summary: 'Auto Next Triggered',
      detail: `Advanced to Question ${this.getCurrentQuestionIndex()} of ${this.polls().length}`
    });
  }

  async finishSession() {
    this.autoAdvanceEnabled = false;
    this.stopTimer();
    await this.pollService.completeSession(this.roomCode());
    await this.refreshSessionSummary();
    this.messageService.add({
      severity: 'success',
      summary: 'Session Completed! 🎉',
      detail: 'Presenter Stage (TV) and voter phones now display the Celebration & Results Finale!'
    });
  }

  async refreshSessionSummary() {
    try {
      const summary = await this.pollService.getSessionSummary(this.roomCode());
      this.sessionSummary.set(summary);
    } catch (e) {
      console.warn('[Controller] Could not fetch session summary:', e);
    }
  }

  async openOverviewResultsDialog() {
    await this.refreshSessionSummary();
    this.showOverviewResultsDialog.set(true);
  }

  async restartSession() {
    this.autoAdvanceEnabled = false;
    this.stopTimer();
    await this.pollService.restartSession(this.roomCode());
    this.messageService.add({
      severity: 'info',
      summary: 'Session Started / Restarted',
      detail: 'Activated room and launched Question #1 for audience.'
    });
  }

  async startSessionFirstQuestion() {
    await this.restartSession();
  }

  async onLockChange() {
    const poll = this.currentPoll();
    if (!poll) return;
    await this.pollService.toggleLockPoll(this.roomCode(), poll.id, this.isLocked);
    this.messageService.add({
      severity: this.isLocked ? 'warn' : 'info',
      summary: this.isLocked ? 'Voting Locked' : 'Voting Opened',
      detail: this.isLocked ? 'Audience submissions are paused.' : 'Audience can submit votes now.'
    });
  }

  async onShowResultsChange() {
    const poll = this.currentPoll();
    if (!poll) return;
    await this.pollService.toggleShowResults(this.roomCode(), poll.id, this.showResults);
    this.messageService.add({
      severity: 'info',
      summary: this.showResults ? 'Results Revealed' : 'Results Hidden',
      detail: this.showResults ? 'Presenter stage shows bar charts.' : 'Presenter stage hides live results.'
    });
  }

  isFirstQuestion(): boolean {
    const list = this.polls();
    if (list.length === 0) return true;
    const activeId = this.room()?.activePollId || this.currentPoll()?.id;
    if (!activeId) return false;
    const idx = list.findIndex(p => p.id === activeId);
    return idx <= 0;
  }

  isLastQuestion(): boolean {
    const list = this.polls();
    if (list.length === 0) return true;
    const activeId = this.room()?.activePollId || this.currentPoll()?.id;
    if (!activeId) return false;
    const idx = list.findIndex(p => p.id === activeId);
    return idx !== -1 && idx === list.length - 1;
  }

  getCurrentQuestionIndex(): number {
    const list = this.polls();
    if (list.length === 0) return 0;
    const activeId = this.room()?.activePollId || this.currentPoll()?.id;
    const idx = list.findIndex(p => p.id === activeId);
    return idx >= 0 ? idx + 1 : 0;
  }

  async onSelectQuestion(pollId: string) {
    if (!pollId) return;
    const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
    await this.pollService.setActivePoll(this.roomCode(), pollId, timerSec);
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
    const list = this.polls();
    if (list.length === 0) return;
    const activeId = this.room()?.activePollId || this.currentPoll()?.id;
    const idx = list.findIndex(p => p.id === activeId);
    if (idx > 0) {
      const prevPoll = list[idx - 1];
      const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
      await this.pollService.setActivePoll(this.roomCode(), prevPoll.id, timerSec);
      if (this.autoAdvanceEnabled) {
        this.resetTimer();
      }
    }
  }

  async nextQuestion() {
    const list = this.polls();
    if (list.length === 0) return;
    const activeId = this.room()?.activePollId || this.currentPoll()?.id;
    const idx = list.findIndex(p => p.id === activeId);
    if (idx >= 0 && idx < list.length - 1) {
      const nextPoll = list[idx + 1];
      const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
      await this.pollService.setActivePoll(this.roomCode(), nextPoll.id, timerSec);
      if (this.autoAdvanceEnabled) {
        this.resetTimer();
      }
    } else if (idx === -1 && list.length > 0) {
      const nextPoll = list[0];
      const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
      await this.pollService.setActivePoll(this.roomCode(), nextPoll.id, timerSec);
      if (this.autoAdvanceEnabled) {
        this.resetTimer();
      }
    }
  }
}
