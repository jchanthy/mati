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
    DialogModule,
    InputTextModule,
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
            @if (room()?.status === 'completed') {
              <span class="w-3 h-3 rounded-full bg-purple-500"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Session Completed (Concluded)</span>
            } @else if (room()?.status === 'draft' || room()?.status === 'closed' || !room()?.activePollId) {
              <span class="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Session Inactive / Ready to Start</span>
            } @else {
              <span class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Live Stage Broadcasting</span>
            }
          </div>
          <div class="flex items-center gap-3 mt-1 flex-wrap">
            <h1 class="text-2xl font-black text-gray-900 dark:text-white">
              Mati Controller: <span class="text-indigo-600 dark:text-indigo-400">{{ roomCode() }}</span>
            </h1>
            <!-- Room Switcher Dropdown -->
            <div class="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              <i class="pi pi-compass text-indigo-600 dark:text-indigo-400 text-xs"></i>
              <select 
                [ngModel]="roomCode()" 
                (ngModelChange)="switchRoom($event)" 
                class="bg-transparent text-xs font-black text-gray-800 dark:text-gray-200 focus:outline-hidden cursor-pointer">
                @for (r of allRooms(); track r.code) {
                  <option [value]="r.code" class="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                    {{ r.code }} - {{ r.title }}
                  </option>
                }
              </select>
            </div>
          </div>
          <p class="text-xs text-gray-500 mt-1">Live orchestrator for questions, lock status, and projection stage visibility.</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          @if (room()?.status === 'completed') {
            <button type="button" (click)="restartSession()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
              <i class="pi pi-play"></i>
              <span>Start Live Session</span>
            </button>
          } @else if (!room()?.activePollId) {
            <button type="button" (click)="startSessionFirstQuestion()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer">
              <i class="pi pi-play"></i>
              <span>Start Session (Q1)</span>
            </button>
          } @else {
            <button type="button" (click)="finishSession()" class="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
              <i class="pi pi-check-circle"></i>
              <span>Finish Session</span>
            </button>
          }

          <button 
            type="button" 
            (click)="showNewRoomDialog = true" 
            class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer">
            <i class="pi pi-plus"></i>
            <span>New Room</span>
          </button>
          <a [routerLink]="['/stage', roomCode()]" target="_blank" class="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
            <i class="pi pi-desktop"></i>
            <span>Stage (TV)</span>
          </a>
          <a [routerLink]="['/vote', roomCode()]" target="_blank" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all">
            <i class="pi pi-mobile"></i>
            <span>Voter</span>
          </a>
          <a routerLink="/dashboard" class="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-bold transition-all">
            Studio
          </a>
        </div>
      </div>

      <!-- Mode Switcher Banner: Live Stage vs Self-Paced Survey -->
      <div class="p-4 sm:p-5 bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
            [ngClass]="room()?.mode === 'survey' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300'">
            <i [class]="room()?.mode === 'survey' ? 'pi pi-list-check' : 'pi pi-desktop'"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-black text-gray-900 dark:text-white">
                {{ room()?.mode === 'survey' ? 'Self-Paced Survey Mode' : 'Presenter-Led Live Stage Mode' }}
              </span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
                [ngClass]="room()?.mode === 'survey' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800' : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'">
                {{ room()?.mode === 'survey' ? 'Survey Active' : 'Live Sync' }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              {{ room()?.mode === 'survey' 
                ? 'Audience can freely browse, choose, and vote on all 30 questions at their own speed on their phones.'
                : 'Audience phones and TV screen are synchronized to the active question you launch.' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0 w-full md:w-auto flex-wrap">
          <!-- Mode switcher buttons -->
          <button 
            type="button" 
            (click)="setRoomMode('live')"
            [ngClass]="room()?.mode !== 'survey' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
            class="flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="pi pi-desktop"></i>
            <span>Live Sync</span>
          </button>
          <button 
            type="button" 
            (click)="setRoomMode('survey')"
            [ngClass]="room()?.mode === 'survey' ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'"
            class="flex-1 md:flex-initial px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="pi pi-list-check"></i>
            <span>Survey</span>
          </button>

          <!-- TV Theme Selector (Dark vs Light) -->
          <div class="flex items-center bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
            <button
              type="button"
              (click)="setStageTheme('dark')"
              [ngClass]="(room()?.theme || 'dark') === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
              class="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Project TV in Dark Mode">
              <i class="pi pi-moon text-xs"></i>
              <span>TV Dark</span>
            </button>
            <button
              type="button"
              (click)="setStageTheme('light')"
              [ngClass]="room()?.theme === 'light' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
              class="px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              title="Project TV in Light Mode">
              <i class="pi pi-sun text-xs"></i>
              <span>TV Light</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Completed Session Alert Banner -->
      @if (room()?.status === 'completed') {
        <div class="p-5 rounded-3xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm animate-fadein">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-purple-600 text-white flex items-center justify-center text-xl shadow-md shadow-purple-600/30">
              🎉
            </div>
            <div>
              <div class="text-sm font-black text-purple-950 dark:text-purple-200">
                Poll Session Completed! (ការស្ទង់មតិបានបញ្ចប់ដោយជោគជ័យ)
              </div>
              <div class="text-xs text-purple-700 dark:text-purple-400">
                Presenter Stage (TV) and audience phones are displaying the celebration and summary screen.
              </div>
            </div>
          </div>
          <button type="button" (click)="restartSession()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0">
            <i class="pi pi-replay"></i> Restart From Q1
          </button>
        </div>
      }

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
              <div class="text-xs text-gray-500">Automatically advance & synchronize countdown on voter phones and TV stage</div>
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

          <!-- Quick One-Shot Timer Bar -->
          <div class="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800 text-xs">
            <div>
              <div class="font-bold text-gray-900 dark:text-white">Live Broadcast Timer</div>
              <div class="text-gray-500 text-[11px]">Sync countdown to participant phones & TV</div>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" (click)="triggerQuestionTimer(15)" class="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-950/60 text-gray-700 dark:text-gray-200 hover:text-indigo-600 font-bold border border-gray-200 dark:border-gray-700 transition-all cursor-pointer">15s</button>
              <button type="button" (click)="triggerQuestionTimer(30)" class="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-950/60 text-gray-700 dark:text-gray-200 hover:text-indigo-600 font-bold border border-gray-200 dark:border-gray-700 transition-all cursor-pointer">30s</button>
              <button type="button" (click)="triggerQuestionTimer(60)" class="px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-indigo-50 dark:bg-gray-800 dark:hover:bg-indigo-950/60 text-gray-700 dark:text-gray-200 hover:text-indigo-600 font-bold border border-gray-200 dark:border-gray-700 transition-all cursor-pointer">60s</button>
              <button type="button" (click)="clearQuestionTimer()" class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 text-red-600 font-bold border border-red-200 dark:border-red-900 transition-all cursor-pointer">Stop</button>
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

      <!-- Slido-Style Question Navigator (Browse, Search, and 1-Click Launch) -->
      <div class="bg-white dark:bg-gray-900 p-6 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
              <i class="pi pi-th-large"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-black text-gray-900 dark:text-white">
                  Question Navigator
                </h2>
                <span class="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                  {{ polls().length }} Questions
                </span>
              </div>
              <p class="text-[11px] text-gray-500">
                Click any question to instantly broadcast it live to the Stage TV and audience phones.
              </p>
            </div>
          </div>

          <!-- Quick Search Filter -->
          <div class="relative w-full sm:w-72">
            <i class="pi pi-search absolute left-3 top-2.5 text-gray-400 text-xs"></i>
            <input 
              type="text" 
              [(ngModel)]="searchQuery" 
              placeholder="Search by question text or #..." 
              class="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500" />
          </div>
        </div>

        <!-- Rapid Number Jump Pills [1] [2] [3] ... [30] -->
        <div class="flex items-center gap-1.5 flex-wrap pb-2 border-b border-gray-100 dark:border-gray-800">
          <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Quick Jump:</span>
          @for (p of polls(); track p.id; let idx = $index) {
            <button 
              type="button" 
              (click)="onSelectQuestion(p.id)"
              [ngClass]="currentPoll()?.id === p.id 
                ? 'bg-indigo-600 text-white font-black shadow-md ring-2 ring-indigo-400' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600'"
              class="w-8 h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer">
              {{ idx + 1 }}
            </button>
          }
        </div>

        <!-- Filtered Question Cards List -->
        <div class="space-y-2.5 max-h-96 overflow-y-auto pr-1">
          @for (p of filteredPolls(); track p.id; let idx = $index) {
            <div 
              class="p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              [ngClass]="currentPoll()?.id === p.id 
                ? 'bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-700 shadow-xs' 
                : 'bg-gray-50/50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'">
              
              <div class="flex items-start gap-3 flex-1 min-w-0">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border"
                  [ngClass]="currentPoll()?.id === p.id 
                    ? 'bg-indigo-600 text-white border-indigo-500' 
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'">
                  #{{ p.order || (idx + 1) }}
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                      {{ p.question }}
                    </span>
                    @if (currentPoll()?.id === p.id) {
                      <span class="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] tracking-wider uppercase border border-emerald-300 dark:border-emerald-800 shrink-0 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Live on Stage
                      </span>
                    }
                  </div>
                  <div class="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                    <span>{{ p.options.length }} choices</span>
                    <span>•</span>
                    <span>{{ p.isLocked ? 'Voting Locked' : 'Voting Open' }}</span>
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                @if (currentPoll()?.id === p.id) {
                  <span class="px-3.5 py-1.5 rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center gap-1">
                    <i class="pi pi-check"></i> Currently Live
                  </span>
                } @else {
                  <button 
                    type="button" 
                    (click)="onSelectQuestion(p.id)"
                    class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
                    <i class="pi pi-play text-[10px]"></i> Launch (▶)
                  </button>
                }
              </div>
            </div>
          } @empty {
            <div class="p-8 text-center text-xs text-gray-400 space-y-1">
              <i class="pi pi-search text-lg text-gray-300 dark:text-gray-600"></i>
              <div>No questions found matching "{{ searchQuery }}".</div>
            </div>
          }
        </div>
      </div>

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
    </div>
  `
})
export class AdminPollControlComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pollService = inject(MatiPollService);
  private messageService = inject(MessageService);

  showNewRoomDialog = false;
  newRoomTitle = '';
  newRoomCode = '';

  roomCode = signal<string>('MATI01');
  allRooms = signal<Room[]>([]);
  polls = signal<Poll[]>([]);
  currentPoll = this.pollService.currentPoll;
  stats = signal<PollStats | null>(null);
  room = signal<Room | null>(null);

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
        const activeCode = (queryCode || this.roomCode() || 'MATI01').toUpperCase();
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

    this.pollSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.roomSub?.unsubscribe();

    this.pollsListSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.polls.set(list);
    });

    this.roomSub = this.pollService.listenToRoom(code).subscribe(roomData => {
      this.room.set(roomData);
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
    const code = await this.pollService.createRoom(this.newRoomTitle, this.newRoomCode || undefined);
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
    this.messageService.add({
      severity: 'success',
      summary: 'Session Completed! 🎉',
      detail: 'Presenter Stage (TV) and voter phones now display the Celebration & Results Finale!'
    });
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
    await this.pollService.setActivePoll(this.roomCode(), pollId);
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
      await this.pollService.setActivePoll(this.roomCode(), list[idx - 1].id);
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
      await this.pollService.setActivePoll(this.roomCode(), list[idx + 1].id);
      if (this.autoAdvanceEnabled) {
        this.resetTimer();
      }
    }
  }
}
