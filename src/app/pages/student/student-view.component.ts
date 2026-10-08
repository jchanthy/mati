import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';

import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { DetailedSessionSummary, Poll, PollStats, Room } from '../../models/poll.model';


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
          @if (room()?.status === 'completed') {
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
              <i class="pi pi-check-circle text-[9px]"></i> Session Ended
            </span>
          } @else if (room()?.mode === 'survey') {
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
              <i class="pi pi-list-check text-[9px]"></i> Survey Mode
            </span>
          } @else if (room()?.status === 'draft' || room()?.status === 'closed' || !room()?.activePollId) {
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Standby
            </span>
          } @else {
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live Stage
            </span>
          }
          <div class="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold">
            PIN: {{ roomCode() }}
          </div>
        </div>
      </header>

      <!-- Content Area -->
      <main class="p-4 sm:p-5 flex-1 flex flex-col justify-start overflow-y-auto">
        @if (room()?.status === 'completed') {
          <!-- Slido-Style Trophy Celebration Card -->
          <div class="w-full space-y-4 my-auto animate-fadein pb-4">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 text-center shadow-lg relative overflow-hidden">
              <!-- Soft festive background confetti dots -->
              <div class="absolute -top-12 -left-12 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>
              <div class="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

              <!-- Big Golden Trophy Icon with Rank Badge -->
              <div class="relative w-28 h-28 mx-auto flex items-center justify-center mb-3">
                <!-- SVG Trophy identical to Slido styling -->
                <svg viewBox="0 0 120 120" class="w-24 h-24 drop-shadow-md">
                  <!-- Base / Stand -->
                  <path d="M42 104 h36 v5 h-36 z" fill="#D97706" />
                  <path d="M48 94 h24 v10 h-24 z" fill="#F59E0B" />
                  <path d="M54 78 h12 v16 h-12 z" fill="#FBBF24" />
                  <!-- Handles -->
                  <path d="M34 38 C18 38 18 64 36 66 L38 58 C26 56 26 44 36 44 Z" fill="#F59E0B" />
                  <path d="M86 38 C102 38 102 64 84 66 L82 58 C94 56 94 44 84 44 Z" fill="#F59E0B" />
                  <!-- Cup Body -->
                  <path d="M36 28 h48 c0 32 -10 52 -24 52 c-14 0 -24 -20 -24 -52 z" fill="#FBBF24" />
                  <path d="M36 28 h48 v8 h-48 z" fill="#F59E0B" opacity="0.4" />
                  <!-- Center Medal on Cup -->
                  <circle cx="60" cy="50" r="14" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="2" />
                  <text x="60" y="55" font-size="13" font-weight="900" text-anchor="middle" fill="#475569" font-family="sans-serif">1</text>
                </svg>
              </div>

              <!-- Main Heading & Name -->
              <div class="space-y-1">
                <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  You finished 1<sup>st</sup>
                </h2>
                <p class="text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300">
                  Well done, {{ participantName() }}!
                </p>
              </div>

              <!-- Primary Stats Table (Clean Slido Style) -->
              <div class="max-w-xs mx-auto py-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                @if (studentScoredQuestionsCount() > 0) {
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Correct answers:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base">
                      {{ studentCorrectAnswersCount() }}/{{ studentScoredQuestionsCount() }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Your Accuracy:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base">
                      {{ studentAccuracyPercent() }}%
                    </span>
                  </div>
                }
                <div class="flex items-center justify-between pt-1">
                  <span class="text-slate-500 dark:text-slate-400 font-medium">Participation:</span>
                  <span class="text-slate-900 dark:text-white font-mono font-bold text-base">
                    {{ progressPercent() }}% ({{ answeredCount() }}/{{ polls().length }})
                  </span>
                </div>
              </div>

              <!-- Slido Top Participant Badges / Leaderboard Cards -->
              <div class="space-y-2 pt-1 max-w-xs mx-auto">
                <!-- User's entry -->
                <div class="flex items-center justify-between px-4 py-3 rounded-2xl bg-sky-700 text-white font-bold text-sm shadow-md">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <span class="w-6 h-6 rounded-full bg-white text-sky-800 text-xs font-black flex items-center justify-center shrink-0">
                      1
                    </span>
                    <span class="truncate">{{ participantName() }} (me)</span>
                  </div>
                  <div class="font-mono text-xs text-sky-100 shrink-0">
                    @if (studentScoredQuestionsCount() > 0) {
                      {{ studentCorrectAnswersCount() }}/{{ studentScoredQuestionsCount() }}
                    } @else {
                      {{ answeredCount() }}/{{ polls().length }}
                    }
                  </div>
                </div>

                @if (sessionStats().totalVotes > answeredCount()) {
                  <div class="flex items-center justify-between px-4 py-3 rounded-2xl bg-sky-800/90 text-white font-bold text-sm">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span class="w-6 h-6 rounded-full bg-white/20 text-white text-xs font-black flex items-center justify-center shrink-0">
                        2
                      </span>
                      <span class="truncate">Audience Group</span>
                    </div>
                    <div class="font-mono text-xs text-sky-200 shrink-0">
                      {{ sessionStats().overallAccuracy }}% accuracy
                    </div>
                  </div>
                }
              </div>

              <!-- Collapsible "View Answers" button -->
              <div class="pt-5">
                <button
                  type="button"
                  (click)="toggleViewAnswers()"
                  class="inline-flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 transition-colors cursor-pointer py-1 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                  <span>{{ showAnswersBreakdown() ? 'Hide answers' : 'View answers' }}</span>
                  <i class="pi" [ngClass]="showAnswersBreakdown() ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
                </button>
              </div>

              <!-- Detailed Answers Accordion List -->
              @if (showAnswersBreakdown()) {
                <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-left animate-fadein">
                  @for (p of polls(); track p.id; let idx = $index) {
                    <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-start gap-2 flex-1 min-w-0">
                          <span class="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            #{{ idx + 1 }}
                          </span>
                          <span class="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {{ p.question }}
                          </span>
                        </div>
                        @if (p.correctOptionId !== undefined) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase shrink-0 border"
                            [ngClass]="getVotedOptionFor(p.id) === p.correctOptionId ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800' : 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800'">
                            {{ getVotedOptionFor(p.id) === p.correctOptionId ? '✓ Correct' : '✗ Incorrect' }}
                          </span>
                        }
                      </div>

                      <!-- Options List Review -->
                      <div class="space-y-1 pt-1">
                        @for (opt of p.options; track opt.id) {
                          <div class="text-[11px] p-2 rounded-xl flex items-center justify-between border"
                            [ngClass]="{
                              'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold': p.correctOptionId === opt.id,
                              'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200 font-medium': getVotedOptionFor(p.id) === opt.id && p.correctOptionId !== opt.id && p.correctOptionId !== undefined,
                              'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 text-indigo-900 dark:text-indigo-200 font-bold': p.correctOptionId === undefined && getVotedOptionFor(p.id) === opt.id,
                              'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400': (p.correctOptionId !== opt.id || p.correctOptionId === undefined) && getVotedOptionFor(p.id) !== opt.id
                            }">
                            <div class="flex items-center gap-1.5 min-w-0">
                              <span class="font-bold">{{ opt.id }}.</span>
                              <span class="truncate">{{ opt.text }}</span>
                            </div>
                            <div class="flex items-center gap-1 shrink-0 font-bold">
                              @if (getVotedOptionFor(p.id) === opt.id) {
                                <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">Your choice</span>
                              }
                              @if (p.correctOptionId === opt.id) {
                                <i class="pi pi-check text-emerald-600 dark:text-emerald-400"></i>
                              }
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        } @else if (room()?.mode === 'survey') {
          <!-- SELF-PACED SURVEY MODE VIEW (Choose & vote any question) -->
          <div class="space-y-4 my-auto w-full">
            <!-- Survey Progress Bar -->
            <div class="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2 shadow-xs">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <i class="pi pi-check-circle text-emerald-500"></i>
                  <span>Survey Progress: {{ answeredCount() }} of {{ polls().length }}</span>
                </span>
                <span class="font-mono text-indigo-600 dark:text-indigo-400">{{ progressPercent() }}%</span>
              </div>
              <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full transition-all duration-300"
                  [style.width.%]="progressPercent()">
                </div>
              </div>
            </div>

            <!-- Quick Number Selector Pills [1] [2] ... [30] -->
            <div class="space-y-1.5">
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-1">
                Jump to Question:
              </div>
              <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                @for (p of polls(); track p.id; let idx = $index) {
                  <button
                    type="button"
                    (click)="selectSurveyPoll(p.id)"
                    [ngClass]="[
                      selectedSurveyPollId() === p.id ? 'ring-2 ring-indigo-500 font-black' : '',
                      hasVotedFor(p.id) 
                        ? 'bg-emerald-500 text-white shadow-xs' 
                        : (selectedSurveyPollId() === p.id ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300')
                    ]"
                    class="shrink-0 w-9 h-9 rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer">
                    @if (hasVotedFor(p.id)) {
                      <i class="pi pi-check text-[10px] mr-0.5"></i>
                    }
                    <span>{{ idx + 1 }}</span>
                  </button>
                }
              </div>
            </div>

            <!-- Active Selected Question Card -->
            @if (activeSurveyPoll(); as sPoll) {
              <div class="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm animate-fadein">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    Question #{{ getSurveyIndex(sPoll.id) + 1 }} of {{ polls().length }}
                  </span>
                  @if (hasVotedFor(sPoll.id)) {
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1">
                      <i class="pi pi-check text-[10px]"></i> Answered
                    </span>
                  } @else {
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      Unanswered
                    </span>
                  }
                </div>

                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {{ sPoll.question }}
                </h2>

                <!-- Options -->
                <div class="space-y-2.5">
                  @for (opt of sPoll.options; track opt.id) {
                    <button
                      type="button"
                      (click)="voteSurvey(sPoll.id, opt.id)"
                      [disabled]="isSubmitting()"
                      [ngClass]="getVotedOptionFor(sPoll.id) === opt.id 
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-sm ring-1 ring-indigo-500' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'"
                      class="w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 active:scale-98 cursor-pointer">
                      <div class="flex items-center gap-3 flex-1 min-w-0">
                        <span class="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                          [ngClass]="getVotedOptionFor(sPoll.id) === opt.id 
                            ? 'bg-indigo-600 text-white' 
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'">
                          {{ opt.id }}
                        </span>
                        <span class="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {{ opt.text }}
                        </span>
                      </div>

                      @if (getVotedOptionFor(sPoll.id) === opt.id) {
                        <i class="pi pi-check-circle text-indigo-600 dark:text-indigo-400 text-base shrink-0"></i>
                      }
                    </button>
                  }
                </div>

                @if (hasVotedFor(sPoll.id)) {
                  <div class="text-center pt-1">
                    <button type="button" (click)="changeSurveyVote(sPoll.id)" class="text-xs text-slate-400 hover:text-indigo-600 underline font-medium cursor-pointer">
                      Change my answer for this question
                    </button>
                  </div>
                }

                <!-- Question Navigation Prev / Next -->
                <div class="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    (click)="prevSurveyQuestion()"
                    [disabled]="isFirstSurveyQuestion()"
                    class="px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
                    ← Prev
                  </button>
                  <button
                    type="button"
                    (click)="nextSurveyQuestion()"
                    [disabled]="isLastSurveyQuestion()"
                    class="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 cursor-pointer">
                    Next →
                  </button>
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- PRESENTER-LED SYNCHRONIZED LIVE MODE VIEW -->
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

              <!-- Live Audience Results Breakdown on Voter Phone -->
              <div class="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-800/60 space-y-2 text-left">
                <div class="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Live Audience Tally</span>
                  <span>{{ stats.totalVotes }} votes</span>
                </div>
                @for (opt of stats.poll.options; track opt.id) {
                  <div class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold">
                      <span [ngClass]="selectedOptionId() === opt.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300'">
                        {{ opt.text }} {{ selectedOptionId() === opt.id ? '✓ (Your Vote)' : '' }}
                      </span>
                      <span class="font-mono text-slate-500">{{ stats.percentages[opt.id] || 0 }}%</span>
                    </div>
                    <div class="h-2 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-500"
                        [style.width.%]="stats.percentages[opt.id] || 0"
                        [ngClass]="selectedOptionId() === opt.id ? 'bg-indigo-600' : 'bg-slate-400 dark:bg-slate-600'">
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @else if (isTimeUp()) {
            <!-- Time's Up Screen with Live Results Breakdown -->
            <div class="p-6 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-3xl text-center space-y-3">
              <div class="w-12 h-12 rounded-full bg-red-500/20 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto text-xl">
                <i class="pi pi-clock"></i>
              </div>
              <h3 class="text-base font-bold text-red-900 dark:text-red-200">Time's Up!</h3>
              <p class="text-xs text-red-700 dark:text-red-400">
                Voting has concluded for this question. Look up at the presenter's screen!
              </p>

              <!-- Live Breakdown for Voter -->
              <div class="mt-4 pt-3 border-t border-red-200/60 dark:border-red-800/60 space-y-2 text-left">
                <div class="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Audience Results</span>
                  <span>{{ stats.totalVotes }} votes</span>
                </div>
                @for (opt of stats.poll.options; track opt.id) {
                  <div class="space-y-1">
                    <div class="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <span>{{ opt.text }}</span>
                      <span class="font-mono text-slate-500">{{ stats.percentages[opt.id] || 0 }}%</span>
                    </div>
                    <div class="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-500 bg-red-500"
                        [style.width.%]="stats.percentages[opt.id] || 0">
                      </div>
                    </div>
                  </div>
                }
              </div>
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
          <!-- Waiting Screen (No active question launched yet or host hasn't started) -->
          <div class="text-center py-12 space-y-4 my-auto">
            <div class="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-2xl animate-pulse shadow-lg shadow-indigo-500/10 border border-indigo-100 dark:border-indigo-900">
              <i class="pi pi-hourglass"></i>
            </div>
            <div class="space-y-1">
              @if (!room() || room()?.status === 'draft' || !room()?.activePollId) {
                <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                  Ready & Connected
                </span>
                <h2 class="text-lg font-black text-slate-900 dark:text-white pt-1">Waiting for session to start...</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  You are connected to room <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{{ roomCode() }}</span>. Please wait for the presenter to launch the first question!
                </p>
              } @else {
                <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Live Sync
                </span>
                <h2 class="text-lg font-black text-slate-900 dark:text-white pt-1">Waiting for next question...</h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  You are connected to room <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">{{ roomCode() }}</span>. When the presenter launches a question, it will appear here instantly!
                </p>
              }
            </div>
          </div>
        }
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
  room = signal<Room | null>(null);
  polls = signal<Poll[]>([]);
  activeTab = signal<'live' | 'survey'>('live');
  selectedSurveyPollId = signal<string | null>(null);
  votedOptionsMap = signal<{ [pollId: string]: number }>({});

  voterId = signal<string>('');
  voterIdShort = signal<string>('');
  participantName = signal<string>('Participant');
  showAnswersBreakdown = signal<boolean>(false);
  sessionStats = signal<DetailedSessionSummary>({
    totalQuestions: 0,
    totalVotes: 0,
    totalScoredQuestions: 0,
    overallAccuracy: 0,
    hasScoredQuestions: false,
    topConsensusPercentage: 0,
    questionResults: []
  });
  hasVoted = signal<boolean>(false);
  selectedOptionId = signal<number | null>(null);
  isSubmitting = signal<boolean>(false);

  toggleViewAnswers() {
    this.showAnswersBreakdown.update(v => !v);
  }

  // Survey and overall computed values
  answeredCount = computed(() => {
    const map = this.votedOptionsMap();
    const code = this.roomCode();
    let count = 0;
    for (const p of this.polls()) {
      if (map[p.id] !== undefined || this.pollService.getVotedOption(code, p.id) !== null) {
        count++;
      }
    }
    return count;
  });
  progressPercent = computed(() => {
    const total = this.polls().length;
    if (total === 0) return 0;
    return Math.round((this.answeredCount() / total) * 100);
  });
  activeSurveyPoll = computed(() => {
    const list = this.polls();
    if (list.length === 0) return null;
    const id = this.selectedSurveyPollId();
    return (id ? list.find(p => p.id === id) : null) || list[0];
  });

  // Personal performance computed values
  studentScoredQuestionsCount = computed(() => {
    return this.polls().filter(p => p.correctOptionId !== undefined).length;
  });

  studentCorrectAnswersCount = computed(() => {
    const map = this.votedOptionsMap();
    const code = this.roomCode();
    let correct = 0;
    for (const p of this.polls()) {
      const voted = map[p.id] !== undefined ? map[p.id] : this.pollService.getVotedOption(code, p.id);
      if (p.correctOptionId !== undefined && voted === p.correctOptionId) {
        correct++;
      }
    }
    return correct;
  });

  studentAccuracyPercent = computed(() => {
    const scoredTotal = this.studentScoredQuestionsCount();
    if (scoredTotal === 0) return 0;
    return Math.round((this.studentCorrectAnswersCount() / scoredTotal) * 100);
  });

  // Synchronized countdown timer
  remainingSeconds = signal<number | null>(null);
  timerDuration = signal<number | null>(null);
  private timerInterval: any = null;
  private questionShownAt = signal<number>(0);

  /**
   * isTimeUp computation:
   * 1. If poll is explicitly locked by presenter, time is immediately up.
   * 2. If timer is active, ensure mobile voter has at least 8 seconds of minimum display time
   *    from when the question first rendered on their phone, preventing immediate lockout due to network lag.
   * 3. Provide a 3-second grace period (diff <= -3) after 0s to compensate for client clock skew.
   */
  isTimeUp = computed(() => {
    const stats = this.pollStats();
    if (stats?.poll?.isLocked) return true;

    const rem = this.remainingSeconds();
    if (rem === null) return false;

    // Minimum display guarantee: at least 8s after appearing on mobile screen
    const shownAt = this.questionShownAt();
    if (shownAt > 0 && Date.now() - shownAt < 8000) {
      return false;
    }

    // Grace period of 3 seconds past countdown 0
    return rem <= -3;
  });

  timerPercent = computed(() => {
    const rem = this.remainingSeconds();
    const dur = this.timerDuration();
    if (rem === null || !dur || dur <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((Math.max(0, rem) / dur) * 100)));
  });

  private pollSub?: Subscription;
  private roomSub?: Subscription;
  private pollsListSub?: Subscription;
  private currentActivePollIdOnStudent: string | null = null;

  ngOnInit() {
    const vid = this.pollService.getOrCreateVoterId();
    this.voterId.set(vid);
    this.voterIdShort.set(vid.substring(0, 16) + '...');
    const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('mati_voter_name') : null;
    if (savedName) {
      this.participantName.set(savedName);
    } else {
      this.participantName.set('Participant #' + vid.slice(-4));
    }

    this.route.paramMap.subscribe(params => {
      const codeFromRoute = params.get('roomCode');
      const targetCode = (codeFromRoute || this.pollService.getActiveBroadcastRoom() || 'MATI01').toUpperCase();
      this.switchStudentRoom(targetCode);
    });
  }

  private switchStudentRoom(code: string) {
    if (code === this.roomCode() && this.roomSub) return;
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.stopLocalTimer();

    this.pollStats.set(null);
    this.room.set(null);
    this.hasVoted.set(false);
    this.selectedOptionId.set(null);
    this.remainingSeconds.set(null);

    this.roomCode.set(code);
    this.listenToPoll(code);
    this.listenToRoom(code);
    this.listenToRoomPolls(code);
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.stopLocalTimer();
  }

  setTab(tab: 'live' | 'survey') {
    this.activeTab.set(tab);
  }

  selectSurveyPoll(pollId: string) {
    this.selectedSurveyPollId.set(pollId);
  }

  hasVotedFor(pollId: string): boolean {
    return this.getVotedOptionFor(pollId) !== null;
  }

  getVotedOptionFor(pollId: string): number | null {
    const fromMap = this.votedOptionsMap()[pollId];
    if (fromMap !== undefined) return fromMap;
    return this.pollService.getVotedOption(this.roomCode(), pollId);
  }

  getSurveyIndex(pollId: string): number {
    return this.polls().findIndex(p => p.id === pollId);
  }

  isFirstSurveyQuestion(): boolean {
    const current = this.activeSurveyPoll();
    if (!current || this.polls().length === 0) return true;
    return this.polls()[0].id === current.id;
  }

  isLastSurveyQuestion(): boolean {
    const current = this.activeSurveyPoll();
    const list = this.polls();
    if (!current || list.length === 0) return true;
    return list[list.length - 1].id === current.id;
  }

  prevSurveyQuestion() {
    const current = this.activeSurveyPoll();
    if (!current) return;
    const idx = this.getSurveyIndex(current.id);
    if (idx > 0) {
      this.selectedSurveyPollId.set(this.polls()[idx - 1].id);
    }
  }

  nextSurveyQuestion() {
    const current = this.activeSurveyPoll();
    const list = this.polls();
    if (!current) return;
    const idx = this.getSurveyIndex(current.id);
    if (idx < list.length - 1) {
      this.selectedSurveyPollId.set(list[idx + 1].id);
    }
  }

  async voteSurvey(pollId: string, optionId: number) {
    if (this.isSubmitting()) return;
    this.isSubmitting.set(true);
    try {
      await this.pollService.submitVote(this.roomCode(), pollId, this.voterId(), optionId);
      const currentMap = { ...this.votedOptionsMap() };
      currentMap[pollId] = optionId;
      this.votedOptionsMap.set(currentMap);
      
      // Auto-advance to next question if available
      const list = this.polls();
      const idx = this.getSurveyIndex(pollId);
      if (idx < list.length - 1) {
        setTimeout(() => {
          this.selectedSurveyPollId.set(list[idx + 1].id);
        }, 300);
      }
    } finally {
      this.isSubmitting.set(false);
    }
  }

  changeSurveyVote(pollId: string) {
    const currentMap = { ...this.votedOptionsMap() };
    delete currentMap[pollId];
    this.votedOptionsMap.set(currentMap);
  }

  private listenToRoomPolls(code: string) {
    this.pollsListSub?.unsubscribe();
    this.pollsListSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.polls.set(list);
      if (!this.selectedSurveyPollId() && list.length > 0) {
        this.selectedSurveyPollId.set(list[0].id);
      }
      this.refreshVotedOptions(code, list);
    });
  }

  private refreshVotedOptions(code: string, polls: Poll[]) {
    const map: { [pollId: string]: number } = { ...this.votedOptionsMap() };
    for (const p of polls) {
      const opt = this.pollService.getVotedOption(code, p.id);
      if (opt !== null) {
        map[p.id] = opt;
      }
    }
    this.votedOptionsMap.set(map);
  }

  private listenToRoom(code: string) {
    this.roomSub?.unsubscribe();
    this.roomSub = this.pollService.listenToRoom(code).subscribe(roomData => {
      this.room.set(roomData);
      if (roomData?.status === 'completed') {
        this.refreshVotedOptions(code, this.polls());
        this.pollService.getSessionSummary(code).then(summary => {
          this.sessionStats.set(summary);
        });
      }
      if (roomData?.mode === 'survey') {
        this.activeTab.set('survey');
      } else {
        this.activeTab.set('live');
      }
    });
  }

  private listenToPoll(code: string) {
    this.pollSub?.unsubscribe();
    // Pass false to includeVotes so phone does NOT subscribe to 1000s of vote documents
    this.pollSub = this.pollService.listenToActivePoll(code, false).subscribe(stats => {
      this.pollStats.set(stats);
      if (stats?.poll) {
        const votedOpt = this.pollService.getVotedOption(code, stats.poll.id);
        if (votedOpt !== null) {
          this.hasVoted.set(true);
          this.selectedOptionId.set(votedOpt);
          this.votedOptionsMap.update(m => ({ ...m, [stats.poll.id]: votedOpt }));
        } else {
          const inMap = this.votedOptionsMap()[stats.poll.id];
          if (inMap !== undefined) {
            this.hasVoted.set(true);
            this.selectedOptionId.set(inMap);
          } else {
            this.hasVoted.set(false);
            this.selectedOptionId.set(null);
          }
        }

        // Track when question is newly displayed to voter
        const newPollId = stats?.poll?.id || null;
        if (newPollId !== this.currentActivePollIdOnStudent) {
          this.currentActivePollIdOnStudent = newPollId;
          this.questionShownAt.set(Date.now());
          this.stopLocalTimer(true);
        }

        if (stats.timerEndsAt && stats.timerEndsAt > 0) {
          const diff = Math.ceil((stats.timerEndsAt - Date.now()) / 1000);
          if (diff < -3) {
            this.remainingSeconds.set(0);
            this.stopLocalTimer(false);
          } else {
            this.timerDuration.set(stats.timerDuration || 30);
            this.startLocalTimer(stats.timerEndsAt);
          }
        } else {
          this.stopLocalTimer(true);
        }
      } else {
        this.currentActivePollIdOnStudent = null;
        this.questionShownAt.set(0);
        this.stopLocalTimer(true);
      }
    });
  }

  private startLocalTimer(timerEndsAt: number) {
    this.stopLocalTimer(false);
    const updateCountdown = () => {
      const diff = Math.ceil((timerEndsAt - Date.now()) / 1000);
      if (diff < -3) {
        this.remainingSeconds.set(0);
        this.stopLocalTimer(false);
      } else {
        // Keep actual value down to -3 for grace period, displayed as max(0, diff) in UI
        this.remainingSeconds.set(Math.max(0, diff));
      }
    };
    updateCountdown();
    this.timerInterval = setInterval(updateCountdown, 500);
  }

  private stopLocalTimer(clearRemaining: boolean = true) {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    if (clearRemaining) {
      this.remainingSeconds.set(null);
    }
  }

  async vote(optionId: number) {
    const stats = this.pollStats();
    if (!stats || stats.poll.isLocked || this.isTimeUp() || this.isSubmitting()) return;

    // OPTIMISTIC UPDATE: Immediate feedback on mobile screen
    this.selectedOptionId.set(optionId);
    this.hasVoted.set(true);
    this.votedOptionsMap.update(m => ({ ...m, [stats.poll.id]: optionId }));

    this.isSubmitting.set(true);
    try {
      await this.pollService.submitVote(
        this.roomCode(),
        stats.poll.id,
        this.voterId(),
        optionId
      );
    } catch (err) {
      console.error('[StudentView] Failed to submit vote:', err);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  changeVote() {
    this.hasVoted.set(false);
    this.selectedOptionId.set(null);
    const pollId = this.pollStats()?.poll.id;
    if (pollId) {
      this.votedOptionsMap.update(m => {
        const copy = { ...m };
        delete copy[pollId];
        return copy;
      });
    }
  }
}
