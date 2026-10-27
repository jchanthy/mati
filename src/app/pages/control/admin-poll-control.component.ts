import { Component, inject, signal, computed, OnInit, OnDestroy, HostListener } from '@angular/core';
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
import { QuestionImporter, ParsedQuestion } from '../../utils/moodle-xml-parser';
import { describeCorrectAnswer, isCorrectOption, isScoredPoll, pollTypeLabel } from '../../utils/poll-answer';

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
  host: {
    '(document:click)': 'showSettingsPanel.set(false)'
  },
  template: `
    <div class="space-y-4 max-w-7xl mx-auto px-2 sm:px-4">

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

              <!-- Mode Switcher Pill in Topbar -->
              <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
                <button 
                  type="button" 
                  (click)="setRoomMode('live')"
                  [ngClass]="room()?.mode !== 'survey' ? 'bg-indigo-600 text-white font-bold shadow-2xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'"
                  class="px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer">Live</button>
                <button 
                  type="button" 
                  (click)="setRoomMode('survey')"
                  [ngClass]="room()?.mode === 'survey' ? 'bg-amber-600 text-white font-bold shadow-2xs' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'"
                  class="px-2 py-0.5 rounded text-[11px] transition-all cursor-pointer">Survey</button>
              </div>

              <!-- Status Badge -->
              @if (room()?.status === 'completed') {
                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
                  Concluded
                </span>
              } @else if (room()?.mode === 'survey') {
                <span class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  TV QR Broadcast
                </span>
              } @else if (room()?.activePollId) {
                <span class="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live Sync
                </span>
              }
            </div>

            <div class="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
              @if (skippedCount() > 0) {
                <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ playablePolls().length }}/{{ polls().length }} questions on stage ({{ skippedCount() }} skipped)</span>
              } @else {
                <span>{{ polls().length }} of {{ allRawPolls().length }} questions active</span>
              }
              <span>•</span>
              <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{ stats()?.totalVotes || 0 }} total votes</span>
            </div>
          </div>
        </div>

        <!-- Right: Present, Start/Finish Session, and Options Menu -->
        <div class="flex items-center gap-2 shrink-0">
          <!-- Present Stage TV Button with Multi-Monitor Auto-Detection -->
          <button 
            type="button" 
            (click)="openPresentDialog()" 
            title="Choose display or projector to present Stage TV"
            class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/20 transition-all cursor-pointer border-0">
            <i class="pi pi-desktop text-xs"></i>
            <span>Present</span>
          </button>

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
              (click)="toggleSettingsPanel(); $event.stopPropagation()" 
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
                  (click)="showSettingsPanel.set(false)"
                  class="flex items-center gap-2.5 p-2 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-gray-700 dark:text-gray-200 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-semibold transition-colors no-underline">
                  <i class="pi pi-chart-bar text-indigo-600 dark:text-indigo-400"></i>
                  <span>Overview & Analytics</span>
                </a>

                <!-- Participant Mobile Link -->
                <a 
                  [routerLink]="['/vote', roomCode()]" 
                  target="_blank" 
                  (click)="showSettingsPanel.set(false)"
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



                  <!-- Hide Results by Default (Slido Mode) Toggle -->
                  <div class="flex items-center justify-between pt-1">
                    <span class="font-medium text-gray-600 dark:text-gray-400 flex items-center gap-1">
                      <i class="pi pi-eye-slash text-xs text-indigo-500"></i> Default Hide Results
                    </span>
                    <button 
                      type="button" 
                      (click)="toggleDefaultHideResults()"
                      [ngClass]="room()?.defaultHideResults !== false ? 'bg-indigo-600 text-white font-bold' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
                      class="px-2.5 py-0.5 rounded text-[11px] transition-all cursor-pointer">
                      {{ room()?.defaultHideResults !== false ? 'ON (Slido)' : 'OFF' }}
                    </button>
                  </div>

                  <!-- 1-Click Action: Hide Results on All Questions -->
                  <div class="pt-2">
                    <button 
                      type="button" 
                      (click)="hideAllResultsNow()"
                      class="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold transition-all cursor-pointer border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                      <i class="pi pi-eye-slash text-xs"></i>
                      <span>Hide Results on All Questions</span>
                    </button>
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

              <!-- Top Quiz Champions & Speed Leaders Strip in Controller -->
              @if (sessionSummary()?.hasScoredQuestions && (sessionSummary()?.leaderboard || []).length > 0) {
                <div class="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-2.5 text-left max-w-md mx-auto">
                  <div class="flex items-center justify-between gap-2 flex-wrap">
                    <span class="text-xs font-bold text-gray-700 dark:text-gray-200">🏆 Quiz Leaderboard</span>
                    <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[10px] font-bold">
                      <button
                        type="button"
                        (click)="setLeaderboardLimit(5)"
                        [ngClass]="room()?.leaderboardLimit === 5 ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded cursor-pointer transition-colors">
                        Top 5
                      </button>
                      <button
                        type="button"
                        (click)="setLeaderboardLimit(10)"
                        [ngClass]="room()?.leaderboardLimit === 10 ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded cursor-pointer transition-colors">
                        Top 10
                      </button>
                      <button
                        type="button"
                        (click)="setLeaderboardLimit('all')"
                        [ngClass]="(!room()?.leaderboardLimit || room()?.leaderboardLimit === 'all') ? 'bg-indigo-600 text-white' : 'text-gray-600 dark:text-gray-400'"
                        class="px-2 py-0.5 rounded cursor-pointer transition-colors">
                        All
                      </button>
                    </div>
                  </div>

                  <!-- Podium Top 1, 2, 3 -->
                  <div class="space-y-1.5">
                    @for (winner of (sessionSummary()?.leaderboard || []).slice(0, 3); track winner.voterId) {
                      <div class="flex items-center justify-between px-3 py-2 rounded-xl border text-xs"
                        [ngClass]="winner.rank === 1 ? 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-gray-50 dark:bg-gray-800/60 border-gray-100 dark:border-gray-700'">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="text-base">{{ winner.rank === 1 ? '🥇' : (winner.rank === 2 ? '🥈' : '🥉') }}</span>
                          <span class="font-bold text-gray-900 dark:text-white truncate">{{ winner.voterName }}</span>
                        </div>
                        <div class="flex items-center gap-2 font-mono text-[11px] text-gray-600 dark:text-gray-300">
                          <span class="text-emerald-600 dark:text-emerald-400 font-bold">{{ winner.correctAnswers }}/{{ sessionSummary()?.totalScoredQuestions }}</span>
                          <span>•</span>
                          <span>⏱️ {{ winner.totalTimeSeconds }}s</span>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- Ranks 4 to 5 / 10 / All -->
                  @if (controllerRestLeaderboard().length > 0) {
                    <div class="pt-1 space-y-1">
                      <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-1">
                        @if (room()?.leaderboardLimit === 5) {
                          Ranks 4 – 5 (Top 5)
                        } @else if (room()?.leaderboardLimit === 10) {
                          Ranks 4 – 10 (Top 10)
                        } @else {
                          Ranks 4 – {{ (sessionSummary()?.leaderboard || []).length }} (All)
                        }
                      </div>
                      <div class="space-y-1 max-h-48 overflow-y-auto pr-0.5">
                        @for (entry of controllerRestLeaderboard(); track entry.voterId) {
                          <div class="flex items-center justify-between px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 text-xs">
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                                #{{ entry.rank }}
                              </span>
                              <span class="font-semibold text-gray-800 dark:text-gray-200 truncate">{{ entry.voterName }}</span>
                            </div>
                            <div class="flex items-center gap-2 font-mono text-[11px] text-gray-500">
                              <span class="text-emerald-600 dark:text-emerald-400 font-bold">{{ entry.correctAnswers }}/{{ sessionSummary()?.totalScoredQuestions }}</span>
                              <span>•</span>
                              <span>⏱️ {{ entry.totalTimeSeconds }}s</span>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }

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
          } @else if (polls().length === 0) {
            <!-- Empty State when room has no questions -->
            <div class="bg-white dark:bg-gray-900 p-8 sm:p-10 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-2xs space-y-4 text-center animate-fadein">
              <div class="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-2xl shadow-2xs">
                <i class="pi pi-inbox"></i>
              </div>
              <div class="space-y-1.5 max-w-sm mx-auto">
                <h3 class="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
                  No Questions in Room {{ roomCode() }}
                </h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  You can create a new question manually or import existing questions from a CSV spreadsheet or Moodle XML file.
                </p>
              </div>
              <div class="flex items-center justify-center gap-2.5 pt-2">
                <button 
                  type="button" 
                  (click)="showNewPollDialog = true" 
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer transition-all">
                  <i class="pi pi-plus text-xs"></i>
                  <span>Add First Question</span>
                </button>
                <button 
                  type="button" 
                  (click)="openImportDialog()" 
                  class="px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 shadow-2xs cursor-pointer transition-all">
                  <i class="pi pi-upload text-xs"></i>
                  <span>Import Questions (CSV / XML)</span>
                </button>
              </div>
            </div>
          } @else {
            <!-- Active Question Live Spotlight Card -->
            <div class="bg-white dark:bg-gray-900 p-5 sm:p-6 rounded-2xl border border-gray-200/90 dark:border-gray-800 shadow-2xs space-y-5">
              <!-- Top Question Navigation Bar -->
              <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 gap-2">
                <!-- Left: Question Index, Voting Status, and Show Answer -->
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-400 font-mono font-bold text-xs">
                    Q {{ getCurrentQuestionIndex() }} / {{ playablePolls().length }}
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

                <!-- Right: Dedicated Prev / Next Navigation Controls (Always adjacent and stable) -->
                <div class="flex items-center gap-1.5 shrink-0">
                  <button 
                    type="button"
                    (click)="prevQuestion()" 
                    [disabled]="isFirstQuestion()"
                    class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1 cursor-pointer">
                    <i class="pi pi-arrow-left text-[10px]"></i> Prev
                  </button>

                  @if (!isLastQuestion()) {
                    <button 
                      type="button"
                      (click)="nextQuestion()" 
                      class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1 shadow-sm shadow-indigo-600/20 cursor-pointer">
                      Next <i class="pi pi-arrow-right text-[10px]"></i>
                    </button>
                  } @else {
                    <button 
                      type="button"
                      (click)="finishSession()" 
                      class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center gap-1 shadow-sm shadow-amber-500/20 cursor-pointer animate-pulse">
                      🏁 Finish &amp; Podium
                    </button>
                  }
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
                  @if (currentPoll()!.type === 'short_answer') {
                    <div class="space-y-1.5">
                      @for (r of stats()?.textResponses || []; track r.text) {
                        <div class="p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs font-semibold"
                          [ngClass]="showCorrectAnswer && r.isCorrect
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 text-emerald-900 dark:text-emerald-100'
                            : 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200'">
                          <span class="break-words">{{ r.text }}</span>
                          <span class="font-mono font-bold shrink-0">{{ r.count }}×</span>
                        </div>
                      } @empty {
                        <div class="text-xs text-gray-500 text-center py-2">No answers yet</div>
                      }
                      @if (isScored(currentPoll())) {
                        <div class="text-[11px] text-gray-500">Accepted: <strong>{{ correctText(currentPoll()) }}</strong></div>
                      }
                    </div>
                  } @else if (currentPoll()!.type === 'matching') {
                    <div class="space-y-1.5">
                      @for (ps of stats()?.pairStats || []; track ps.pairId) {
                        <div class="p-2.5 rounded-xl border bg-gray-50/70 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
                          <span class="break-words">{{ ps.prompt }} → <strong class="text-emerald-700 dark:text-emerald-300">{{ ps.answer }}</strong></span>
                          <span class="font-mono font-bold shrink-0">{{ pairPercent(ps) }}% ({{ ps.correct }}/{{ ps.total }})</span>
                        </div>
                      }
                    </div>
                  } @else {
                  @for (opt of currentPoll()!.options; track opt.id) {
                    <div 
                      class="p-3 rounded-xl border space-y-1.5 transition-all"
                      [ngClass]="showCorrectAnswer && isCorrectOpt(currentPoll(), opt.id) 
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/50 border-emerald-500 dark:border-emerald-600 ring-2 ring-emerald-500/30' 
                        : 'bg-gray-50/70 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800'">
                      <div class="flex justify-between items-center text-xs font-semibold">
                        <span class="text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <span 
                            class="w-5 h-5 rounded-md text-[11px] font-bold flex items-center justify-center border shadow-2xs"
                            [ngClass]="showCorrectAnswer && isCorrectOpt(currentPoll(), opt.id)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600'">
                            {{ opt.id }}
                          </span>
                          <span [ngClass]="showCorrectAnswer && isCorrectOpt(currentPoll(), opt.id) ? 'font-bold text-emerald-900 dark:text-emerald-100' : ''">
                            {{ opt.text }}
                          </span>
                          @if (isCorrectOpt(currentPoll(), opt.id)) {
                            @if (showCorrectAnswer) {
                              <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-600 text-white flex items-center gap-1 shadow-2xs">
                                <i class="pi pi-check text-[9px]"></i> Correct Answer
                              </span>
                            } @else {
                              <i class="pi pi-check-circle text-emerald-600 dark:text-emerald-400 text-xs" title="Correct Option (Hidden from audience)"></i>
                            }
                          }
                        </span>
                        <span class="font-bold font-mono" [ngClass]="showCorrectAnswer && isCorrectOpt(currentPoll(), opt.id) ? 'text-emerald-700 dark:text-emerald-300' : 'text-indigo-600 dark:text-indigo-400'">
                          {{ stats()?.votesPerOption?.[opt.id] || 0 }} ({{ stats()?.percentages?.[opt.id] || 0 }}%)
                        </span>
                      </div>
                      <div class="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                        <div 
                          class="h-2 rounded-full transition-all duration-500" 
                          [ngClass]="(showCorrectAnswer && isCorrectOpt(currentPoll(), opt.id)) || isCorrectOpt(currentPoll(), opt.id) ? 'bg-emerald-500' : 'bg-indigo-600'"
                          [style.width.%]="stats()?.percentages?.[opt.id] || 0">
                        </div>
                      </div>
                    </div>
                  }
                  }
                }
              </div>

              <!-- Slido-Style Presenter Control Strip (2 Clean, Dedicated Rows) -->
              <div class="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                
                <!-- ROW 1: Audience & Stage Presentation Controls -->
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-2 flex-wrap">
                    <!-- Lock / Unlock Voting Button -->
                    <button 
                      type="button" 
                      (click)="isLocked = !isLocked; onLockChange()"
                      [ngClass]="isLocked 
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 hover:bg-red-100' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50'"
                      class="h-9 px-3.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-2xs">
                      <i class="pi" [ngClass]="isLocked ? 'pi-lock text-red-600' : 'pi-lock-open text-gray-500'"></i>
                      <span>{{ isLocked ? 'Voting Locked' : 'Lock Voting' }}</span>
                    </button>

                    <!-- Show / Hide Results on Stage Button -->
                    <button 
                      type="button" 
                      (click)="showResults = !showResults; onShowResultsChange()"
                      [ngClass]="showResults 
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-100' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50'"
                      class="h-9 px-3.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-2xs">
                      <i class="pi" [ngClass]="showResults ? 'pi-chart-bar text-indigo-600 dark:text-indigo-400' : 'pi-eye-slash text-gray-500'"></i>
                      <span>{{ showResults ? 'Results Visible' : 'Hide Results' }}</span>
                    </button>

                    <!-- Toggle TV Stage View: Question vs Leaderboard / Podium -->
                    <button 
                      type="button" 
                      (click)="toggleStageView()"
                      [ngClass]="room()?.stageView === 'leaderboard'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-400 dark:border-amber-700 hover:bg-amber-100 ring-2 ring-amber-400/30' 
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-gray-50'"
                      class="h-9 px-3.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-2xs"
                      title="Toggle whether TV shows Question or Live Leaderboard / Podium">
                      <i class="pi" [ngClass]="room()?.stageView === 'leaderboard' ? 'pi-trophy text-amber-500' : 'pi-desktop text-gray-500'"></i>
                      <span>{{ room()?.stageView === 'leaderboard' ? 'TV: Showing Podium' : 'TV: Show Podium' }}</span>
                    </button>

                    <!-- Show / Hide Correct Answer (Presenter Action) -->
                    @if (isScored(currentPoll())) {
                      <button 
                        type="button" 
                        (click)="toggleCorrectAnswer()"
                        [ngClass]="showCorrectAnswer 
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-400 dark:border-emerald-700 hover:bg-emerald-100 ring-2 ring-emerald-500/30' 
                          : 'bg-white dark:bg-gray-800 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50'"
                        class="h-9 px-3.5 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-2xs">
                        <i class="pi" [ngClass]="showCorrectAnswer ? 'pi-check-circle text-emerald-600' : 'pi-eye text-emerald-600'"></i>
                        <span>{{ showCorrectAnswer ? 'Answer Revealed' : 'Reveal Answer' }}</span>
                      </button>
                    }
                  </div>

                  <!-- Skip / Hide Current Question Button -->
                  @if (currentPoll(); as activeP) {
                    <button
                      type="button"
                      (click)="toggleSkipQuestion(activeP)"
                      title="Skip and hide this question from participants"
                      class="h-9 px-3.5 rounded-xl text-xs font-semibold border bg-white dark:bg-gray-800 text-gray-500 hover:text-amber-700 dark:text-gray-400 dark:hover:text-amber-300 border-gray-200 dark:border-gray-700 hover:border-amber-300 inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer shadow-2xs">
                      <i class="pi pi-forward text-xs"></i>
                      <span>Skip</span>
                    </button>
                  }
                </div>

                <!-- ROW 2: Timer Suite & Question Advancement Bar -->
                <div class="flex items-center justify-between flex-wrap gap-2.5 p-2 px-3 rounded-xl bg-gray-50/90 dark:bg-gray-800/60 border border-gray-200/80 dark:border-gray-700/80">
                  <!-- Left: Timer presets & Countdown -->
                  <div class="flex items-center gap-2 flex-wrap">
                    @if (autoAdvanceEnabled || isTimerActive()) {
                      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs"
                        [ngClass]="countdownSeconds <= 5 
                          ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 animate-pulse border border-red-300 dark:border-red-800' 
                          : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'">
                        <i class="pi pi-clock text-[10px]"></i>
                        <span>{{ countdownSeconds }}s remaining</span>
                      </div>
                    } @else {
                      <span class="text-gray-500 dark:text-gray-400 font-semibold text-xs flex items-center gap-1 whitespace-nowrap">
                        <i class="pi pi-clock text-xs text-indigo-500"></i> Timer:
                      </span>
                    }

                    <!-- Preset Pills -->
                    <div class="inline-flex items-center gap-1">
                      @for (sec of [15, 20, 30, 45, 60]; track sec) {
                        <button 
                          type="button" 
                          (click)="startAutoAdvanceTimer(sec)" 
                          [class.bg-indigo-600]="autoAdvanceEnabled && timerDuration === sec"
                          [class.text-white]="autoAdvanceEnabled && timerDuration === sec"
                          [class.font-bold]="autoAdvanceEnabled && timerDuration === sec"
                          class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border"
                          [ngClass]="autoAdvanceEnabled && timerDuration === sec 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs' 
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-600 hover:text-indigo-600 hover:border-indigo-300'">
                          {{ sec }}s
                        </button>
                      }
                    </div>

                    <!-- Stop Timer Button -->
                    @if (autoAdvanceEnabled || isTimerActive()) {
                      <button 
                        type="button" 
                        (click)="clearQuestionTimer()" 
                        title="Stop timer and auto-advance" 
                        class="px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 hover:bg-red-100 border border-red-200 dark:border-red-800 font-bold transition-colors cursor-pointer text-xs flex items-center gap-1">
                        <i class="pi pi-times text-[9px]"></i>
                        <span>Stop</span>
                      </button>
                    }
                  </div>

                  <!-- Right: Auto-Advance & Next Action -->
                  <div class="flex items-center gap-2">
                    <!-- Auto-Next Switch Pill -->
                    <button
                      type="button"
                      (click)="toggleAutoAdvance()"
                      title="Automatically continue to next question when timer runs out"
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 border whitespace-nowrap"
                      [ngClass]="autoAdvanceEnabled 
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold' 
                        : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:text-gray-800'">
                      <i class="pi" [ngClass]="autoAdvanceEnabled ? 'pi-bolt text-emerald-600' : 'pi-sync text-gray-400'"></i>
                      <span>Auto-Next {{ autoAdvanceEnabled ? 'ON' : 'OFF' }}</span>
                    </button>

                    <!-- Quick Next / Finish Button -->
                    @if (!isLastQuestion()) {
                      <button 
                        type="button" 
                        (click)="nextQuestion()" 
                        class="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 cursor-pointer whitespace-nowrap">
                        <span>Next</span>
                        <i class="pi pi-arrow-right text-[10px]"></i>
                      </button>
                    } @else {
                      <button 
                        type="button" 
                        (click)="finishSession()" 
                        class="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-all flex items-center gap-1.5 shadow-sm shadow-amber-500/20 cursor-pointer whitespace-nowrap animate-pulse">
                        <span>🏁 Finish &amp; Podium</span>
                      </button>
                    }
                  </div>
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
                @if (skippedCount() > 0) {
                  <span class="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-bold text-xs border border-indigo-200 dark:border-indigo-800"
                    title="{{ playablePolls().length }} of {{ polls().length }} questions will show on TV stage">
                    {{ playablePolls().length }}/{{ polls().length }} on TV
                  </span>
                  <span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300">
                    {{ skippedCount() }} skipped
                  </span>
                } @else {
                  <span class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold text-xs">
                    {{ polls().length }}
                  </span>
                }
              </div>
              <div class="flex items-center gap-1.5">
                <button 
                  type="button" 
                  (click)="openImportDialog()" 
                  title="Import questions from CSV or Moodle XML"
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all cursor-pointer shadow-2xs flex items-center gap-1 border border-gray-200 dark:border-gray-700">
                  <i class="pi pi-upload text-xs"></i>
                  <span>Import</span>
                </button>
                <button 
                  type="button" 
                  (click)="showNewPollDialog = true" 
                  class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all cursor-pointer shadow-2xs flex items-center gap-1">
                  <i class="pi pi-plus text-xs"></i>
                  <span>Add Question</span>
                </button>
              </div>
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

            <!-- Bulk actions -->
            <div class="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" class="w-3.5 h-3.5 accent-indigo-600"
                  [checked]="filteredPolls().length > 0 && bulkSelected().size === filteredPolls().length"
                  (change)="toggleBulkAll()" />
                <span>{{ bulkSelected().size > 0 ? bulkSelected().size + ' selected' : 'Select all' }}</span>
              </label>
              @if (bulkSelected().size > 0) {
                <button type="button" (click)="deleteSelected()"
                  class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950 text-red-600 font-semibold flex items-center gap-1 cursor-pointer">
                  <i class="pi pi-trash text-[10px]"></i>
                  <span>Delete selected</span>
                </button>
              }
            </div>

            <!-- Clean Scrollable Questions List -->
            <div class="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              @for (p of filteredPolls(); track p.id; let idx = $index) {
                <div 
                  class="p-3 rounded-xl border transition-all space-y-2 cursor-pointer group"
                  (click)="onSelectQuestion(p.id)"
                  [ngClass]="currentPoll()?.id === p.id 
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-500 shadow-2xs ring-1 ring-indigo-500' 
                    : (p.isSkipped 
                      ? 'bg-gray-50/80 dark:bg-gray-900/40 border-dashed border-gray-200 dark:border-gray-800 opacity-65' 
                      : 'bg-white dark:bg-gray-850 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700')">
                  
                  <!-- Top row: Checkbox, Question Number, Full Question Title, and Live/Present Pill -->
                  <div class="flex items-start justify-between gap-2.5">
                    <div class="flex items-start gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        class="w-3.5 h-3.5 mt-1 shrink-0 cursor-pointer accent-indigo-600"
                        [checked]="bulkSelected().has(p.id)"
                        (click)="$event.stopPropagation()"
                        (change)="toggleBulk(p.id)" />
                      <span 
                        class="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border"
                        [ngClass]="currentPoll()?.id === p.id 
                          ? 'bg-indigo-600 text-white border-indigo-600' 
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'">
                        {{ idx + 1 }}
                      </span>
                      <div class="text-xs font-bold leading-snug line-clamp-2 break-words min-w-0 flex-1"
                        [ngClass]="p.isSkipped ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'">
                        {{ p.question }}
                      </div>
                    </div>

                    <div class="shrink-0 flex items-center gap-1" (click)="$event.stopPropagation()">
                      @if (p.isSkipped) {
                        <button
                          type="button"
                          (click)="toggleSkipQuestion(p)"
                          title="Click to unskip and show to participants"
                          class="px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-semibold text-[10px] flex items-center gap-1 cursor-pointer transition-colors">
                          <i class="pi pi-eye-slash text-[9px]"></i>
                          <span>Skipped</span>
                        </button>
                      } @else if (currentPoll()?.id === p.id) {
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
                    </div>
                  </div>

                  <!-- Bottom row: Metadata on left + Action icons on right -->
                  <div class="flex items-center justify-between gap-2 pl-8">
                    <div class="text-[11px] text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                      <span>{{ typeLabel(p) }}{{ (p.options || []).length ? ' · ' + (p.options || []).length + ' options' : '' }}{{ isScored(p) ? ' • Scored' : '' }}</span>
                      @if (p.isLocked) {
                        <span class="text-[10px] font-semibold text-red-600 dark:text-red-400">• Locked</span>
                      }
                    </div>

                    <div class="flex items-center gap-1 shrink-0" (click)="$event.stopPropagation()">
                      <button
                        type="button"
                        (click)="toggleSkipQuestion(p)"
                        [title]="p.isSkipped ? 'Unskip / Show question to participants' : 'Skip / Hide question from participants'"
                        [ngClass]="p.isSkipped ? 'text-amber-600 bg-amber-50 dark:bg-amber-950/60' : 'text-gray-400 hover:text-amber-600'"
                        class="p-1 rounded transition-colors cursor-pointer">
                        <i class="pi text-[11px]" [ngClass]="p.isSkipped ? 'pi-eye' : 'pi-eye-slash'"></i>
                      </button>
                      <button
                        type="button"
                        (click)="moveQuestion(p.id, -1)"
                        [disabled]="idx === 0 || !!searchQuery.trim()"
                        title="Move Up"
                        class="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer">
                        <i class="pi pi-arrow-up text-[11px]"></i>
                      </button>
                      <button
                        type="button"
                        (click)="moveQuestion(p.id, 1)"
                        [disabled]="idx === filteredPolls().length - 1 || !!searchQuery.trim()"
                        title="Move Down"
                        class="p-1 text-gray-400 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors cursor-pointer">
                        <i class="pi pi-arrow-down text-[11px]"></i>
                      </button>
                      <button
                        type="button"
                        (click)="duplicateQuestion(p.id)"
                        title="Duplicate Question"
                        class="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors cursor-pointer">
                        <i class="pi pi-copy text-[11px]"></i>
                      </button>
                      <button
                        type="button"
                        (click)="openEditPoll(p)"
                        title="Edit Question"
                        class="p-1 text-gray-400 hover:text-indigo-600 rounded transition-colors cursor-pointer">
                        <i class="pi pi-pencil text-[11px]"></i>
                      </button>
                      <button
                        type="button"
                        (click)="deletePoll(p.id)"
                        title="Delete Question"
                        class="p-1 text-gray-400 hover:text-red-600 rounded transition-colors cursor-pointer">
                        <i class="pi pi-trash text-[11px]"></i>
                      </button>
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="p-6 text-center text-xs text-gray-400 space-y-3 bg-gray-50/50 dark:bg-gray-800/30 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 my-1">
                  <div>No questions matching "{{ searchQuery }}".</div>
                  @if (polls().length === 0) {
                    <div class="flex items-center justify-center gap-2 pt-1">
                      <button type="button" (click)="openImportDialog()" class="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold inline-flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 cursor-pointer">
                        <i class="pi pi-upload text-xs"></i> Import Questions
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Create Question Dialog in Controller -->
      <p-dialog [header]="editingPollId ? 'Edit Question (' + roomCode() + ')' : 'Add Question to Room ' + roomCode()" [(visible)]="showNewPollDialog" (onHide)="resetPollForm()" [modal]="true" [style]="{width: '520px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Question</label>
            <input pInputText type="text" [(ngModel)]="newPollQuestion" placeholder="e.g. Which technology stack do you prefer?" class="w-full" />
          </div>
          @if (editingPollType === 'short_answer' || editingPollType === 'matching') {
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Only the question text can be edited for this question type. The answer key imported from Moodle is kept as is.
            </p>
          } @else {
          @if (editingPollType === 'multi_select') {
            <p class="text-xs text-gray-500 dark:text-gray-400">
              Multiple-answer question: the correct options are kept by position. Edit the wording of each option, one per line.
            </p>
          }
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Options (One per line)</label>
            <textarea [(ngModel)]="newPollOptionsRaw" rows="4" placeholder="Option 1&#10;Option 2&#10;Option 3&#10;Option 4" class="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
          @if (editingPollType !== 'multi_select') {
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Correct Option Number (Optional, 1-based)</label>
            <input pInputText type="number" [(ngModel)]="newPollCorrectIndex" placeholder="e.g. 1" class="w-full" />
          </div>
          }
          }
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewPollDialog = false"></button>
          <button pButton [label]="editingPollId ? 'Update Question' : 'Save Question'" icon="pi pi-check" class="p-button-primary" (click)="createNewPoll()"></button>
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

          <!-- Question Pick Input & Controls -->
          <div class="flex items-center gap-2 flex-wrap p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <!-- Input section -->
            <div class="flex items-center gap-1.5">
              <label class="text-xs font-bold text-gray-700 dark:text-gray-300 whitespace-nowrap">Pick:</label>
              <input 
                type="text" 
                [(ngModel)]="customPickInput" 
                (keyup.enter)="applyPickFromInput()" 
                placeholder="Count (15 or 1-20)" 
                class="w-28 sm:w-32 px-2.5 py-1.5 text-xs font-bold text-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-gray-900 dark:text-white shadow-2xs" />
            </div>

            <!-- Action buttons -->
            <div class="flex items-center gap-1.5">
              <button 
                type="button" 
                (click)="applyPickFromInput()" 
                title="Pick first N questions or specified range" 
                class="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-all cursor-pointer flex items-center gap-1">
                <i class="pi pi-check text-[10px]"></i>
                <span>Pick</span>
              </button>
              <button 
                type="button" 
                (click)="applyPickRandom()" 
                title="Pick random questions using input count" 
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 cursor-pointer transition-all flex items-center gap-1">
                <span>🎲 Random</span>
              </button>
            </div>

            <!-- Quick count pills -->
            <div class="hidden sm:flex items-center gap-1 pl-1 border-l border-gray-200 dark:border-gray-700">
              <span class="text-[10px] uppercase font-bold text-gray-400">Quick:</span>
              @for (q of [5, 10, 15, 20, 30]; track q) {
                @if (allRawPolls().length >= q) {
                  <button 
                    type="button" 
                    (click)="setPickCount(q)" 
                    [class.ring-2]="customPickInput === q.toString()"
                    [class.ring-indigo-500]="customPickInput === q.toString()"
                    class="px-2 py-0.5 rounded text-[11px] font-semibold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:border-indigo-400 text-gray-700 dark:text-gray-300 hover:text-indigo-600 cursor-pointer transition-all">
                    {{ q }}
                  </button>
                }
              }
            </div>

            <!-- Select All / Clear on the right -->
            <div class="flex items-center gap-1.5 ml-auto">
              <button 
                type="button" 
                (click)="presetSelectAll()" 
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 cursor-pointer transition-all">
                Select All ({{ allRawPolls().length }})
              </button>
              <button 
                type="button" 
                (click)="presetClearAll()" 
                class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 cursor-pointer transition-all">
                Clear
              </button>
            </div>
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
                      {{ typeLabel(p) }}{{ p.options.length ? ' · ' + p.options.length + ' choices' : '' }}
                      @if (isScored(p)) {
                        • <span class="text-emerald-600 font-semibold">Scored</span>
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
                  @if (q.isScored) {
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
                  @for (r of q.textResponses || []; track r.text) {
                    <div class="p-2 rounded-lg border text-xs flex items-center justify-between gap-2"
                      [ngClass]="r.isCorrect ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold' : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-200'">
                      <span class="break-words">{{ r.text }}</span>
                      <span class="font-mono font-bold shrink-0">{{ r.count }}×</span>
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

      <!-- Import Questions Dialog (CSV & Moodle XML) -->
      <p-dialog header="Import Questions (CSV / Moodle XML)" [(visible)]="showImportDialog" [modal]="true" [style]="{width: '740px'}" [closable]="!isImporting" class="p-fluid">
        <div class="space-y-4 pt-2">
          <!-- Live Import Progress Bar -->
          @if (isImporting) {
            <div class="p-4 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl border-2 border-emerald-400 dark:border-emerald-600 shadow-sm space-y-2.5">
              <div class="flex items-center justify-between text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-100">
                <span class="flex items-center gap-2">
                  <i class="pi pi-spin pi-spinner text-emerald-600 dark:text-emerald-400 text-sm"></i>
                  <span>Importing questions... ({{ importCurrent }} of {{ importTotal }})</span>
                </span>
                <span class="font-mono text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">{{ importProgressPercent }}%</span>
              </div>
              <div class="w-full bg-emerald-200/70 dark:bg-emerald-900/60 rounded-full h-3.5 overflow-hidden p-0.5 shadow-inner">
                <div 
                  class="bg-linear-to-r from-emerald-500 via-teal-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-xs"
                  [style.width.%]="importProgressPercent"></div>
              </div>
              <div class="flex items-center justify-between text-[11px] text-emerald-700 dark:text-emerald-300 font-medium pt-0.5">
                <span>Saving to room <strong class="font-bold underline decoration-emerald-400">{{ roomCode() }}</strong></span>
                <span>Please do not close this window</span>
              </div>
            </div>
          }
          <!-- Information Banner -->
          <div class="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200 space-y-2">
            <div class="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
              <i class="pi pi-file-excel text-sm"></i>
              <span>Supported Formats: CSV, TSV, or Moodle XML</span>
            </div>
            <p class="leading-relaxed">
              Upload a <strong>CSV spreadsheet</strong> or a <strong>Moodle XML</strong> export file. Mati automatically detects questions, answer options (2 to 8 choices), and marks correct answers.
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button 
                type="button" 
                (click)="downloadCsvTemplate()" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer">
                <i class="pi pi-download"></i>
                <span>Download CSV Template</span>
              </button>
              <button 
                type="button" 
                (click)="loadSampleCsv()" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 transition-all cursor-pointer">
                <i class="pi pi-file-edit"></i>
                <span>Load Sample CSV</span>
              </button>
              <button 
                type="button" 
                (click)="loadSampleXml()" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 transition-all cursor-pointer">
                <i class="pi pi-code"></i>
                <span>Load Sample XML</span>
              </button>
            </div>
          </div>

          <!-- File Upload Zone -->
          <div class="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-5 text-center hover:border-indigo-500 transition-colors bg-gray-50/50 dark:bg-gray-900/50">
            <input type="file" #fileInput (change)="onFileSelected($event)" accept=".csv,.tsv,.xml,text/csv,text/xml,application/xml" class="hidden" />
            <div class="space-y-1.5 cursor-pointer" (click)="fileInput.click()">
              <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-lg">
                <i class="pi pi-cloud-upload"></i>
              </div>
              <div class="text-sm font-bold text-gray-800 dark:text-gray-200">
                Click to browse CSV or XML file
              </div>
              <div class="text-xs text-gray-500">
                Supports .csv, .tsv, .xml • UTF-8 Unicode &amp; Khmer font supported
              </div>
              @if (uploadedFileName()) {
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                  <i class="pi pi-file"></i>
                  <span>{{ uploadedFileName() }}</span>
                </div>
              }
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">Raw Content (CSV or XML)</label>
              @if (parsedQuestions.length > 0) {
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  [ngClass]="detectedFormat() === 'csv' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300'">
                  <i [class]="detectedFormat() === 'csv' ? 'pi pi-table' : 'pi pi-code'"></i>
                  <span>{{ detectedFormat() === 'csv' ? 'CSV Format Detected' : 'Moodle XML Detected' }}</span>
                </span>
              }
            </div>
            <textarea [(ngModel)]="xmlContent" (ngModelChange)="onXmlContentChange()" rows="5" placeholder="Paste CSV or Moodle XML content here..." class="w-full p-3 font-mono text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>

          @if (importSkipped().length > 0) {
            <div class="p-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
              <div class="font-bold flex items-center gap-1.5">
                <i class="pi pi-exclamation-triangle"></i>
                <span>{{ importSkippedTotal() }} question(s) skipped — type not supported yet</span>
              </div>
              <div>
                @for (s of importSkipped(); track s.type; let last = $last) {
                  <span class="font-mono">{{ s.type }} ×{{ s.count }}</span>@if (!last) {<span>, </span>}
                }
              </div>
            </div>
          }

          <!-- Parsed Preview -->
          @if (parsedQuestions.length > 0) {
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span class="flex items-center gap-1.5">
                  <i class="pi pi-check-circle"></i>
                  <span>Ready to import {{ parsedQuestions.length }} question(s)</span>
                </span>
                <span class="text-gray-500 dark:text-gray-400 font-normal">
                  Target Room: <strong class="text-indigo-600 dark:text-indigo-400 font-bold">{{ roomCode() }}</strong>
                </span>
              </div>
              <div class="max-h-52 overflow-y-auto space-y-2 pr-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2 bg-gray-50/60 dark:bg-gray-900/60">
                @for (q of parsedQuestions; track q.question; let idx = $index) {
                  <div class="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs shadow-xs">
                    <div class="font-bold text-gray-900 dark:text-white flex items-start gap-1.5">
                      <span class="text-indigo-600 dark:text-indigo-400 font-black">{{ idx + 1 }}.</span>
                      <span class="flex-1">{{ q.question }}</span>
                      <span class="shrink-0 px-1.5 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wide">{{ parsedTypeLabel(q) }}</span>
                    </div>
                    @if (q.pollType === 'short_answer') {
                      <div class="text-gray-500 mt-2 flex flex-wrap gap-1.5">
                        @for (a of q.acceptedAnswers || []; track a) {
                          <span class="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700">{{ a }}</span>
                        }
                      </div>
                    } @else if (q.pollType === 'matching') {
                      <div class="text-gray-600 dark:text-gray-300 mt-2 space-y-0.5">
                        @for (m of q.matchPairs || []; track m.prompt) {
                          <div>{{ m.prompt }} <span class="text-emerald-700 dark:text-emerald-300 font-semibold">→ {{ m.answer }}</span></div>
                        }
                      </div>
                    } @else {
                    <div class="text-gray-500 mt-2 flex flex-wrap gap-1.5">
                      @for (opt of q.options; track opt; let optIdx = $index) {
                        <span class="px-2 py-0.5 rounded-md flex items-center gap-1"
                          [ngClass]="isParsedCorrect(q, optIdx) ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'">
                          @if (isParsedCorrect(q, optIdx)) {
                            <i class="pi pi-check text-[10px]"></i>
                          }
                          <span>{{ opt }}</span>
                        </span>
                      }
                    </div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" [disabled]="isImporting" (click)="showImportDialog = false"></button>
          <button pButton 
            [label]="isImporting ? ('Importing ' + importCurrent + ' / ' + importTotal + ' (' + importProgressPercent + '%)') : ('Import ' + parsedQuestions.length + ' Questions')" 
            [icon]="isImporting ? 'pi pi-spin pi-spinner' : 'pi pi-check'" 
            class="p-button-primary" 
            [disabled]="parsedQuestions.length === 0 || isImporting" 
            (click)="importParsedQuestions()">
          </button>
        </ng-template>
      </p-dialog>

      <!-- Present to Display / Projector Dialog -->
      <p-dialog 
        header="Present to Screen / Projector" 
        [(visible)]="showPresentDialog" 
        [modal]="true" 
        [style]="{width: '640px', maxWidth: '95vw'}" 
        class="p-fluid">
        <div class="space-y-4 pt-2">
          
          <!-- Header explanation -->
          <div class="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100 dark:border-slate-800">
            <span>Room PIN: <strong class="text-indigo-600 dark:text-indigo-400 font-black">{{ roomCode() }}</strong></span>
            <span>Stage Live View</span>
          </div>

          <!-- Section 1: Detected Displays via Window Management API -->
          @if (detectedScreens.length > 0) {
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span class="flex items-center gap-1.5">
                  <i class="pi pi-desktop text-indigo-600"></i>
                  <span>Connected Displays ({{ detectedScreens.length }})</span>
                </span>
                <span class="text-emerald-600 text-[11px] font-semibold flex items-center gap-1">
                  <i class="pi pi-check-circle"></i> Auto-detection active
                </span>
              </div>

              <div class="space-y-2">
                @for (scr of detectedScreens; track scr.label || $index; let idx = $index) {
                  <div class="p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    [ngClass]="!scr.isPrimary ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'">
                    
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        [ngClass]="!scr.isPrimary ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200'">
                        <i [class]="!scr.isPrimary ? 'pi pi-video' : 'pi pi-desktop'"></i>
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                          <span class="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {{ scr.label || ('Screen ' + (idx + 1)) }}
                          </span>
                          @if (!scr.isPrimary) {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                              Recommended for TV / Projector
                            </span>
                          } @else {
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                              Primary (Laptop)
                            </span>
                          }
                        </div>
                        <div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Resolution: {{ scr.width }} × {{ scr.height }}
                          @if (scr.isInternal !== undefined) {
                            • {{ scr.isInternal ? 'Built-in Screen' : 'External Screen / TV' }}
                          }
                        </div>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      (click)="launchOnScreen(scr)"
                      class="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                      [ngClass]="!scr.isPrimary ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30' : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200'">
                      <i class="pi pi-external-link text-xs"></i>
                      <span>{{ !scr.isPrimary ? 'Present on Screen ' + (idx + 1) : 'Present Here' }}</span>
                    </button>

                  </div>
                }
              </div>
            </div>
          } @else {
            <!-- Request Permission Card -->
            <div class="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 space-y-3">
              <div class="flex items-start gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg shrink-0">
                  <i class="pi pi-desktop"></i>
                </div>
                <div class="text-xs space-y-1">
                  <div class="font-bold text-indigo-950 dark:text-indigo-100 text-sm">
                    Detect Second Monitor or Projector
                  </div>
                  <p class="text-indigo-800/80 dark:text-indigo-300/80 leading-relaxed">
                    Browser needs permission once to detect your connected monitors. Click below and select <strong>"Allow"</strong> when prompted.
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2 pt-1">
                <button 
                  type="button" 
                  (click)="detectConnectedScreens(true)"
                  [disabled]="isDetectingScreens"
                  class="py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all">
                  <i [class]="isDetectingScreens ? 'pi pi-spin pi-spinner' : 'pi pi-search'" class="text-xs"></i>
                  <span>{{ isDetectingScreens ? 'Detecting Displays...' : 'Detect Displays & Ask Permission' }}</span>
                </button>
              </div>
            </div>
          }

          <!-- Section 2: Quick Launch Options (Works everywhere without permission) -->
          <div class="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div class="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Quick Launch Options
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <!-- Send to Extended Screen (Right) -->
              <button 
                type="button" 
                (click)="launchOnExtendedRight()"
                class="p-3.5 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 hover:bg-emerald-100/70 dark:hover:bg-emerald-900/40 text-left transition-all cursor-pointer group">
                <div class="flex items-center gap-2 font-bold text-xs text-emerald-800 dark:text-emerald-300">
                  <i class="pi pi-arrow-right text-emerald-600 text-sm group-hover:translate-x-1 transition-transform"></i>
                  <span>Send to 2nd Screen (Right)</span>
                </div>
                <p class="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-1 leading-snug">
                  Uses Windows Extend mode coordinates to place Stage directly on your external monitor.
                </p>
              </button>

              <!-- Open Popout Window -->
              <button 
                type="button" 
                (click)="launchPopoutWindow()"
                class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/80 text-left transition-all cursor-pointer">
                <div class="flex items-center gap-2 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <i class="pi pi-window-maximize text-indigo-600 text-sm"></i>
                  <span>Open Popout Window</span>
                </div>
                <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Clean presenter window. Drag it to your TV/projector and press <kbd class="px-1 py-0.5 bg-slate-200 dark:bg-slate-700 rounded text-[10px]">F11</kbd> for fullscreen.
                </p>
              </button>
            </div>
          </div>

        </div>

        <ng-template pTemplate="footer">
          <div class="w-full flex items-center justify-between">
            <span class="text-[11px] text-slate-400 flex items-center gap-1">
              <i class="pi pi-info-circle"></i> Press F11 on the stage screen for borderless presentation
            </span>
            <button pButton label="Close" icon="pi pi-times" class="p-button-text" (click)="showPresentDialog = false"></button>
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

  @HostListener('window:keydown', ['$event'])
  handleKeyboardRemote(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    // Don't intercept when user is typing in dialogs or search inputs
    if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || this.showNewPollDialog || this.showImportDialog || this.showPickQuestionsDialog || this.showNewRoomDialog || this.showPresentDialog) {
      return;
    }

    // Presentation Clicker Next keys: PageDown, ArrowRight, ArrowDown, Space, 'N'
    if (e.key === 'PageDown' || e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      if (this.isLastQuestion()) {
        this.finishSession();
      } else {
        this.nextQuestion();
      }
    }
    // Presentation Clicker Prev keys: PageUp, ArrowLeft, ArrowUp, Backspace, 'P'
    else if (e.key === 'PageUp' || e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace' || e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      this.prevQuestion();
    }
    // Presentation Clicker Blank / Black screen: 'B' or '.'
    else if (e.key === 'b' || e.key === 'B' || e.key === '.') {
      const poll = this.currentPoll();
      if (poll) {
        this.showResults = !this.showResults;
        this.onShowResultsChange();
      }
    }
  }

  showImportDialog = false;
  isImporting = false;
  importCurrent = 0;
  importTotal = 0;
  importProgressPercent = 0;
  xmlContent = '';
  parsedQuestions: ParsedQuestion[] = [];
  uploadedFileName = signal<string | null>(null);
  detectedFormat = signal<'csv' | 'xml' | null>(null);
  /** Moodle question types found in the file that MATI cannot import yet. */
  importSkipped = signal<{ type: string; count: number }[]>([]);
  importSkippedTotal = computed(() => this.importSkipped().reduce((sum, s) => sum + s.count, 0));

  openImportDialog() {
    this.showImportDialog = true;
    this.xmlContent = '';
    this.parsedQuestions = [];
    this.uploadedFileName.set(null);
    this.detectedFormat.set(null);
    this.importSkipped.set([]);
  }

  onFileSelected(event: any) {
    const file = event.target?.files?.[0];
    if (!file) return;
    this.uploadedFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.xmlContent = (e.target?.result as string) || '';
      this.onXmlContentChange();
    };
    reader.readAsText(file, 'utf-8');
  }

  onXmlContentChange() {
    if (!this.xmlContent.trim()) {
      this.parsedQuestions = [];
      this.importSkipped.set([]);
      return;
    }
    try {
      const result = QuestionImporter.parse(this.xmlContent, this.uploadedFileName() || undefined);
      this.detectedFormat.set(result.format);
      this.parsedQuestions = result.questions;
      this.importSkipped.set(result.skipped || []);
    } catch (err: any) {
      this.parsedQuestions = [];
      this.importSkipped.set([]);
    }
  }

  loadSampleCsv() {
    this.uploadedFileName.set('sample_questions.csv');
    this.xmlContent = `"Question","Option A","Option B","Option C","Option D","Correct Answer"
"What is the primary benefit of live audience polling?","Immediate comprehension check & real-time feedback","Midterm final exam scoring","Replacing instructors entirely","Passive listening","A"
"Which language is primarily used for styling modern web applications?","CSS","Python","SQL","C++","CSS"
"Is Mati designed for interactive classroom engagement?","True","False","","","True"`;
    this.onXmlContentChange();
  }

  downloadCsvTemplate() {
    const templateContent = `"Question","Option A","Option B","Option C","Option D","Correct Answer"\r\n` +
      `"What is the capital of Cambodia?","Phnom Penh","Siem Reap","Battambang","Kampot","A"\r\n` +
      `"Which technology powers real-time updates?","WebSockets / Cloud Firestore","Floppy Disks","Printed Paper","Static HTML","A"\r\n`;

    const blob = new Blob(["\uFEFF" + templateContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'mati_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  loadSampleXml() {
    this.uploadedFileName.set('sample_moodle.xml');
    this.xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>Question 1</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>What is the primary benefit of real-time polling during a live lecture?</p>]]></text>
    </questiontext>
    <answer fraction="100">
      <text>Immediate understanding check &amp; high audience retention</text>
    </answer>
    <answer fraction="0">
      <text>Grading formal midterm exams</text>
    </answer>
    <answer fraction="0">
      <text>Replacing all instructor explanations</text>
    </answer>
  </question>
</quiz>`;
    this.onXmlContentChange();
  }

  async importParsedQuestions() {
    if (this.parsedQuestions.length === 0 || this.isImporting) return;
    this.isImporting = true;
    this.importCurrent = 0;
    this.importTotal = this.parsedQuestions.length;
    this.importProgressPercent = 0;
    try {
      await this.pollService.createPollsBatch(
        this.roomCode(), 
        this.parsedQuestions,
        (current, total) => {
          this.importCurrent = current;
          this.importTotal = total;
          this.importProgressPercent = Math.min(100, Math.round((current / total) * 100));
        }
      );
      this.importProgressPercent = 100;
      await new Promise(res => setTimeout(res, 350));
      this.showImportDialog = false;
      this.xmlContent = '';
      this.parsedQuestions = [];
    } catch (err: any) {
      console.error('[Import] Failed:', err);
    } finally {
      this.isImporting = false;
      this.importCurrent = 0;
      this.importTotal = 0;
      this.importProgressPercent = 0;
    }
  }

  showPresentDialog = false;
  detectedScreens: any[] = [];
  hasScreenApi = false;
  screenPermissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' = 'prompt';
  isDetectingScreens = false;

  async openPresentDialog() {
    this.showPresentDialog = true;
    await this.detectConnectedScreens(false);
  }

  async detectConnectedScreens(requestPermission = false) {
    if (typeof window === 'undefined') return;

    if (!('getScreenDetails' in window)) {
      this.hasScreenApi = false;
      this.screenPermissionState = 'unsupported';
      return;
    }

    this.hasScreenApi = true;
    this.isDetectingScreens = true;

    if ('permissions' in navigator && (navigator.permissions as any).query) {
      try {
        const status = await (navigator.permissions as any).query({ name: 'window-management' });
        this.screenPermissionState = status.state;
      } catch {
        try {
          const status = await (navigator.permissions as any).query({ name: 'window-placement' });
          this.screenPermissionState = status.state;
        } catch {
          this.screenPermissionState = 'prompt';
        }
      }
    }

    if (this.screenPermissionState === 'granted' || requestPermission) {
      try {
        const screenDetails = await (window as any).getScreenDetails();
        this.detectedScreens = screenDetails.screens || [];
        this.screenPermissionState = 'granted';
      } catch (err: any) {
        if (err.name === 'NotAllowedError') {
          this.screenPermissionState = 'denied';
        } else {
          console.warn('[Presenter] getScreenDetails error:', err);
        }
      } finally {
        this.isDetectingScreens = false;
      }
    } else {
      this.isDetectingScreens = false;
    }
  }

  launchOnScreen(targetScreen?: any) {
    const url = `/stage/${this.roomCode()}`;
    if (targetScreen) {
      const features = [
        `left=${targetScreen.availLeft}`,
        `top=${targetScreen.availTop}`,
        `width=${targetScreen.availWidth}`,
        `height=${targetScreen.availHeight}`,
        'menubar=no',
        'toolbar=no',
        'location=no',
        'status=no',
        'resizable=yes',
        'scrollbars=yes'
      ].join(',');
      const popup = window.open(url, `mati_stage_${this.roomCode()}`, features);
      if (popup) {
        popup.focus();
        this.showPresentDialog = false;
        return;
      }
    }
    window.open(url, '_blank');
    this.showPresentDialog = false;
  }

  launchOnExtendedRight() {
    const url = `/stage/${this.roomCode()}`;
    const screenWidth = typeof window !== 'undefined' ? (window.screen.availWidth || window.screen.width || 1920) : 1920;
    const screenHeight = typeof window !== 'undefined' ? (window.screen.availHeight || window.screen.height || 1080) : 1080;
    const features = [
      `left=${screenWidth + 20}`,
      `top=0`,
      `width=${screenWidth}`,
      `height=${screenHeight}`,
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no',
      'resizable=yes',
      'scrollbars=yes'
    ].join(',');
    const popup = window.open(url, `mati_stage_${this.roomCode()}`, features);
    if (popup) {
      popup.focus();
    } else {
      window.open(url, '_blank');
    }
    this.showPresentDialog = false;
  }

  launchPopoutWindow() {
    const url = `/stage/${this.roomCode()}`;
    const features = 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes';
    const popup = window.open(url, `mati_stage_${this.roomCode()}`, features);
    if (popup) {
      popup.focus();
    } else {
      window.open(url, '_blank');
    }
    this.showPresentDialog = false;
  }

  // Backwards compatibility
  async presentOnSecondMonitor() {
    await this.openPresentDialog();
  }

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
  editingPollId: string | null = null;
  /** Type of the question being edited (answer key editing depends on it). */
  editingPollType: Poll['type'] | null = null;

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

  // Non-skipped questions used for Next/Prev navigation and live count
  playablePolls = computed(() => this.polls().filter(p => !p.isSkipped));
  skippedCount = computed(() => this.polls().filter(p => p.isSkipped).length);

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

  bulkSelected = signal<Set<string>>(new Set());
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
  showResults = false;
  showCorrectAnswer = false;

  autoAdvanceEnabled = false;
  timerDuration = 20;
  countdownSeconds = 20;
  timerEndsAt: number | null = null;
  private isAdvancingQuestion = false;
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
      if (roomData?.timerEndsAt && roomData.timerEndsAt > this.pollService.now()) {
        this.timerEndsAt = roomData.timerEndsAt;
        if (roomData.timerDuration) this.timerDuration = roomData.timerDuration;
        if (roomData.autoAdvance !== undefined) {
          this.autoAdvanceEnabled = roomData.autoAdvance;
        }
        if (!this.timerInterval && this.autoAdvanceEnabled) {
          this.startTimerTicker();
        }
      }
    });

    this.pollSub = this.pollService.listenToActivePoll(code).subscribe(pollStats => {
      this.stats.set(pollStats);
      if (pollStats?.poll) {
        this.isLocked = pollStats.poll.isLocked;
        this.showResults = pollStats.poll.showResults;
        this.showCorrectAnswer = pollStats.poll.showCorrectAnswer ?? false;
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

  customPickInput = '15';

  setPickCount(count: number) {
    this.customPickInput = count.toString();
    this.presetSelectFirst(count);
  }

  applyPickFromInput() {
    const raw = this.allRawPolls();
    if (raw.length === 0) return;
    const str = (this.customPickInput || '').trim();
    if (!str) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Enter a value',
        detail: 'Please enter question count (e.g. 15) or range (e.g. 1-20).'
      });
      return;
    }

    // Check if range: e.g. "1-20", "1 to 20", "1..20"
    const rangeMatch = str.match(/^(\d+)\s*(?:-|to|\.\.)\s*(\d+)$/i);
    if (rangeMatch) {
      const start = Math.max(1, parseInt(rangeMatch[1], 10));
      const end = Math.min(raw.length, parseInt(rangeMatch[2], 10));
      if (start <= end) {
        const slice = raw.slice(start - 1, end).map(p => p.id);
        this.tempSelectedPollIds.set(slice);
        this.messageService.add({
          severity: 'info',
          summary: 'Range Selected',
          detail: `Selected ${slice.length} questions (Q${start} to Q${end}).`
        });
        return;
      }
    }

    // Check if comma-separated: e.g. "1, 3, 5, 8"
    if (str.includes(',')) {
      const parts = str.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n >= 1 && n <= raw.length);
      if (parts.length > 0) {
        const uniqueIndices = Array.from(new Set(parts));
        const picked = uniqueIndices.map(idx => raw[idx - 1]?.id).filter(Boolean);
        this.tempSelectedPollIds.set(picked);
        this.messageService.add({
          severity: 'info',
          summary: 'Custom Questions Selected',
          detail: `Selected ${picked.length} specific questions.`
        });
        return;
      }
    }

    // Otherwise single number count: e.g. "15"
    const count = parseInt(str, 10);
    if (!isNaN(count) && count > 0) {
      this.presetSelectFirst(count);
      this.messageService.add({
        severity: 'info',
        summary: 'Questions Selected',
        detail: `Selected first ${Math.min(count, raw.length)} questions.`
      });
    } else {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Input',
        detail: 'Please enter a valid number (e.g. 15) or range (e.g. 1-20).'
      });
    }
  }

  applyPickRandom() {
    const raw = this.allRawPolls();
    if (raw.length === 0) return;
    const str = (this.customPickInput || '').trim();
    let count = 15;
    const rangeMatch = str.match(/^(\d+)\s*(?:-|to|\.\.)\s*(\d+)$/i);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      count = Math.abs(end - start) + 1;
    } else {
      const parsed = parseInt(str, 10);
      if (!isNaN(parsed) && parsed > 0) {
        count = parsed;
      }
    }

    this.presetSelectRandom(count);
    this.messageService.add({
      severity: 'info',
      summary: 'Random Pick',
      detail: `Randomly selected ${Math.min(count, raw.length)} questions.`
    });
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

  controllerRestLeaderboard = computed(() => {
    const list = this.sessionSummary()?.leaderboard || [];
    const limit = this.room()?.leaderboardLimit || 'all';
    if (limit === 5) return list.slice(3, 5);
    if (limit === 10) return list.slice(3, 10);
    return list.slice(3);
  });

  async setLeaderboardLimit(limit: 5 | 10 | 'all') {
    await this.pollService.setRoomLeaderboardLimit(this.roomCode(), limit);
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

    // Short answer / matching keep their imported answer key; only the wording changes
    if (this.editingPollId && (this.editingPollType === 'short_answer' || this.editingPollType === 'matching')) {
      await this.pollService.updatePoll(this.roomCode(), this.editingPollId, this.newPollQuestion.trim(), []);
      this.showNewPollDialog = false;
      this.resetPollForm();
      this.messageService.add({
        severity: 'success',
        summary: 'Question Updated ✅',
        detail: 'Changes saved.'
      });
      return;
    }

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
    if (correctId !== undefined && (correctId < 1 || correctId > opts.length)) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid correct option',
        detail: `Correct option must be between 1 and ${opts.length}.`
      });
      return;
    }

    if (this.editingPollId) {
      await this.pollService.updatePoll(this.roomCode(), this.editingPollId, this.newPollQuestion.trim(), opts, correctId);
      this.showNewPollDialog = false;
      this.resetPollForm();
      this.messageService.add({
        severity: 'success',
        summary: 'Question Updated ✅',
        detail: 'Changes saved.'
      });
      return;
    }

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

  openEditPoll(p: Poll) {
    this.editingPollId = p.id;
    this.editingPollType = p.type || 'multiple_choice';
    this.newPollQuestion = p.question;
    this.newPollOptionsRaw = p.options.map(o => o.text).join('\n');
    this.newPollCorrectIndex = p.correctOptionId ?? null;
    this.showNewPollDialog = true;
  }

  isScored(poll: Poll | null | undefined): boolean {
    return isScoredPoll(poll);
  }

  isCorrectOpt(poll: Poll | null | undefined, optionId: number): boolean {
    return !!poll && isCorrectOption(poll, optionId);
  }

  correctText(poll: Poll | null | undefined): string {
    return poll ? describeCorrectAnswer(poll) : '';
  }

  typeLabel(poll: Poll): string {
    return pollTypeLabel(poll.type);
  }

  pairPercent(pair: { correct: number; total: number }): number {
    return pair.total > 0 ? Math.round((pair.correct / pair.total) * 100) : 0;
  }

  isParsedCorrect(q: ParsedQuestion, optionIndex: number): boolean {
    return q.correctOptionIndices && q.correctOptionIndices.length > 0
      ? q.correctOptionIndices.includes(optionIndex)
      : optionIndex === q.correctOptionIndex;
  }

  parsedTypeLabel(q: ParsedQuestion): string {
    return pollTypeLabel(q.pollType);
  }

  resetPollForm() {
    this.editingPollId = null;
    this.editingPollType = null;
    this.newPollQuestion = '';
    this.newPollOptionsRaw = 'Option 1\nOption 2\nOption 3\nOption 4';
    this.newPollCorrectIndex = null;
  }

  async moveQuestion(pollId: string, dir: -1 | 1) {
    const visible = this.filteredPolls();
    const i = visible.findIndex(p => p.id === pollId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visible.length) return;
    const ids = this.allRawPolls().map(p => p.id);
    const a = ids.indexOf(visible[i].id);
    const b = ids.indexOf(visible[j].id);
    if (a < 0 || b < 0) return;
    [ids[a], ids[b]] = [ids[b], ids[a]];
    await this.pollService.reorderPolls(this.roomCode(), ids);
  }

  async duplicateQuestion(pollId: string) {
    await this.pollService.duplicatePoll(this.roomCode(), pollId);
    this.messageService.add({
      severity: 'success',
      summary: 'Question Duplicated',
      detail: 'A copy was added at the end of the list.'
    });
  }

  toggleBulk(pollId: string) {
    const next = new Set(this.bulkSelected());
    if (next.has(pollId)) next.delete(pollId); else next.add(pollId);
    this.bulkSelected.set(next);
  }

  toggleBulkAll() {
    const visible = this.filteredPolls();
    this.bulkSelected.set(
      this.bulkSelected().size === visible.length ? new Set() : new Set(visible.map(p => p.id))
    );
  }

  async deleteSelected() {
    const ids = [...this.bulkSelected()];
    if (!ids.length) return;
    if (!confirm(`Delete ${ids.length} selected question(s)? This cannot be undone.`)) return;
    await this.pollService.deletePolls(this.roomCode(), ids);
    this.bulkSelected.set(new Set());
    this.messageService.add({
      severity: 'info',
      summary: 'Questions Removed',
      detail: `${ids.length} question(s) removed.`
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

  startAutoAdvanceTimer(seconds: number) {
    this.timerDuration = seconds;
    this.autoAdvanceEnabled = true;
    this.countdownSeconds = seconds;
    this.timerEndsAt = this.pollService.now() + seconds * 1000;
    this.pollService.setPollTimer(this.roomCode(), seconds, true);
    this.startTimerTicker();
    this.messageService.add({
      severity: 'success',
      summary: `Auto-Next Timer Active (${seconds}s)`,
      detail: `Questions will automatically advance every ${seconds}s until the final question.`
    });
  }

  isTimerActive(): boolean {
    return this.countdownSeconds > 0 && this.timerEndsAt !== null && this.pollService.now() < this.timerEndsAt;
  }

  toggleAutoAdvance() {
    this.autoAdvanceEnabled = !this.autoAdvanceEnabled;
    if (this.autoAdvanceEnabled) {
      this.startAutoAdvanceTimer(this.timerDuration || 20);
    } else {
      this.clearQuestionTimer();
    }
  }

  async triggerQuestionTimer(seconds: number) {
    this.startAutoAdvanceTimer(seconds);
  }

  async clearQuestionTimer() {
    this.autoAdvanceEnabled = false;
    this.timerEndsAt = null;
    this.countdownSeconds = 0;
    this.isAdvancingQuestion = false;
    this.stopTimer();
    await this.pollService.setPollTimer(this.roomCode(), null, false);
    this.messageService.add({
      severity: 'secondary',
      summary: 'Timer Stopped',
      detail: 'Countdown and auto-advance cleared from all screens.'
    });
  }

  resetTimer(syncToServer: boolean = true) {
    this.countdownSeconds = this.timerDuration;
    if (this.autoAdvanceEnabled) {
      this.timerEndsAt = this.pollService.now() + this.timerDuration * 1000;
      if (syncToServer) {
        this.pollService.setPollTimer(this.roomCode(), this.timerDuration, true);
      }
      this.startTimerTicker();
    }
  }

  private startTimerTicker() {
    this.stopTimer();
    this.isAdvancingQuestion = false;

    this.timerInterval = setInterval(() => {
      if (!this.timerEndsAt) {
        this.stopTimer();
        return;
      }

      const diff = Math.ceil((this.timerEndsAt - this.pollService.now()) / 1000);
      if (diff > 0) {
        this.countdownSeconds = diff;
      } else {
        this.countdownSeconds = 0;
        this.stopTimer();

        if (this.autoAdvanceEnabled && !this.isAdvancingQuestion) {
          this.isAdvancingQuestion = true;
          this.autoAdvanceNext();
        }
      }
    }, 500);
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
      await this.pollService.setPollTimer(this.roomCode(), null, false);
      await this.finishSession();
      this.isAdvancingQuestion = false;
      return;
    }
    try {
      await this.nextQuestion();
      this.messageService.add({
        severity: 'info',
        summary: 'Auto-Advanced to Next Question',
        detail: `Now displaying Question ${this.getCurrentQuestionIndex()} of ${this.polls().length}.`
      });
    } finally {
      this.isAdvancingQuestion = false;
    }
  }

  async toggleDefaultHideResults() {
    const current = this.room()?.defaultHideResults !== false;
    const nextVal = !current;
    await this.pollService.setRoomDefaultHideResults(this.roomCode(), nextVal);
    this.messageService.add({
      severity: 'info',
      summary: nextVal ? 'Default Hide Results: ON (Slido Mode)' : 'Default Hide Results: OFF',
      detail: nextVal 
        ? 'Questions will start with results hidden until you click Results Visible.' 
        : 'Questions will show results by default.'
    });
  }

  async hideAllResultsNow() {
    await this.pollService.setAllPollsShowResults(this.roomCode(), false);
    this.showResults = false;
    this.showSettingsPanel.set(false);
    this.messageService.add({
      severity: 'success',
      summary: 'All Questions Set to Hide Results! 🔒',
      detail: 'Live bars and percentages on all questions are now hidden like Slido until revealed.'
    });
  }

  async toggleStageView() {
    const current = this.room()?.stageView || 'question';
    const next = current === 'leaderboard' ? 'question' : 'leaderboard';
    await this.pollService.setRoomStageView(this.roomCode(), next);
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

  async toggleCorrectAnswer() {
    const poll = this.currentPoll();
    if (!poll) return;
    this.showCorrectAnswer = !this.showCorrectAnswer;
    await this.pollService.toggleShowCorrectAnswer(this.roomCode(), poll.id, this.showCorrectAnswer);
    this.messageService.add({
      severity: this.showCorrectAnswer ? 'success' : 'info',
      summary: this.showCorrectAnswer ? 'Correct Answer Revealed! 🎯' : 'Answer Hidden',
      detail: this.showCorrectAnswer 
        ? 'TV Stage and audience screens now highlight the correct answer.' 
        : 'Correct answer highlight turned off.'
    });
  }

  async toggleSkipQuestion(poll: Poll) {
    const nextSkipped = !poll.isSkipped;
    await this.pollService.toggleSkipPoll(this.roomCode(), poll.id, nextSkipped);
    this.messageService.add({
      severity: nextSkipped ? 'warn' : 'info',
      summary: nextSkipped ? 'Question Skipped' : 'Question Restored',
      detail: nextSkipped
        ? 'Hidden from participants and skipped during Next/Prev.'
        : 'Question is visible to participants again.'
    });
  }

  isFirstQuestion(): boolean {
    const list = this.playablePolls();
    if (list.length === 0) return true;
    const activeId = this.currentPoll()?.id || this.room()?.activePollId;
    if (!activeId) return false;
    const idx = list.findIndex(p => p.id === activeId);
    return idx <= 0;
  }

  isLastQuestion(): boolean {
    const list = this.playablePolls();
    if (list.length === 0) return true;
    const activeId = this.currentPoll()?.id || this.room()?.activePollId;
    if (!activeId) return false;
    const idx = list.findIndex(p => p.id === activeId);
    return idx !== -1 && idx === list.length - 1;
  }

  getCurrentQuestionIndex(): number {
    const list = this.playablePolls();
    if (list.length === 0) return 0;
    const activeId = this.currentPoll()?.id || this.room()?.activePollId;
    const idx = list.findIndex(p => p.id === activeId);
    return idx >= 0 ? idx + 1 : 0;
  }

  async onSelectQuestion(pollId: string) {
    if (!pollId) return;
    const target = this.polls().find(p => p.id === pollId);
    if (target?.isSkipped) {
      await this.pollService.toggleSkipPoll(this.roomCode(), pollId, false);
    }
    this.showCorrectAnswer = false;
    if (this.room()?.defaultHideResults !== false) { this.showResults = false; }
    const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
    if (this.autoAdvanceEnabled) {
      this.resetTimer(false);
    }
    await this.pollService.setActivePoll(this.roomCode(), pollId, timerSec);
    this.messageService.add({
      severity: 'success',
      summary: 'Question Switched',
      detail: 'Stage updated to selected question.'
    });
  }

  async prevQuestion() {
    const list = this.playablePolls();
    if (list.length === 0) return;
    const activeId = this.currentPoll()?.id || this.room()?.activePollId;
    const idx = list.findIndex(p => p.id === activeId);
    if (idx > 0) {
      this.showCorrectAnswer = false;
      const prevPoll = list[idx - 1];
      const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
      if (this.autoAdvanceEnabled) {
        this.resetTimer(false);
      }
      await this.pollService.setActivePoll(this.roomCode(), prevPoll.id, timerSec);
    }
  }

  async nextQuestion() {
    const list = this.playablePolls();
    if (list.length === 0) return;
    const activeId = this.currentPoll()?.id || this.room()?.activePollId;
    const idx = list.findIndex(p => p.id === activeId);
    if (idx >= 0 && idx < list.length - 1) {
      this.showCorrectAnswer = false;
      const nextPoll = list[idx + 1];
      const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
      if (this.autoAdvanceEnabled) {
        this.resetTimer(false);
      }
      await this.pollService.setActivePoll(this.roomCode(), nextPoll.id, timerSec);
    } else if (idx === -1 && list.length > 0) {
      this.showCorrectAnswer = false;
      const nextPoll = list[0];
      const timerSec = this.autoAdvanceEnabled ? this.timerDuration : null;
      if (this.autoAdvanceEnabled) {
        this.resetTimer(false);
      }
      await this.pollService.setActivePoll(this.roomCode(), nextPoll.id, timerSec);
    }
  }
}
