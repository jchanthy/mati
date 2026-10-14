import { Component, inject, signal, computed, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { DetailedSessionSummary, Poll, PollStats, Room } from '../../models/poll.model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-stage',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="stage-container w-screen h-screen min-h-screen max-h-screen flex flex-col justify-center px-3 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 select-none overflow-hidden relative"
      [class.transition-colors]="hasMounted()" [class.duration-300]="hasMounted()"
      [ngClass]="isLight() ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'">
      
      <!-- Background Ambient Glow -->
      @if (isLight()) {
        <div class="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      } @else {
        <div class="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
      }

      <!-- Main Central Presentation Area: Scaled dynamically to TV viewport -->
      <main class="flex-1 min-h-0 flex flex-col justify-center z-10 w-full max-w-[1850px] 2xl:max-w-[2400px] mx-auto overflow-hidden">
        @if (room()?.status === 'completed' || isOverviewMode()) {
          <!-- Complete Grand Finale & Overview Results Screen for Big TV / Projector -->
          <div class="w-full h-full flex flex-col min-h-0 overflow-hidden animate-fadein py-1">
            
            <!-- 1. Header Bar: Room PIN, Title, and Tab Switchers -->
            <div class="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 shrink-0 border-b"
              [ngClass]="isLight() ? 'border-slate-200' : 'border-slate-800/80'">
              
              <!-- Left: Title & Room Badge -->
              <div class="flex items-center gap-3 text-left">
                <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center text-lg sm:text-xl shrink-0 shadow-md"
                  [ngClass]="sessionStats().hasScoredQuestions 
                    ? (isLight() ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40')
                    : (isLight() ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40')">
                  <span>{{ sessionStats().hasScoredQuestions ? '🏆' : '📊' }}</span>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider border font-mono"
                      [ngClass]="isLight() ? 'bg-white text-slate-700 border-slate-200 shadow-2xs' : 'bg-slate-900 text-slate-300 border-slate-700'">
                      PIN: <span [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">{{ roomCode() }}</span>
                    </span>
                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      [ngClass]="sessionStats().hasScoredQuestions 
                        ? (isLight() ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-500/20 text-emerald-300') 
                        : (isLight() ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-500/20 text-indigo-300')">
                      {{ sessionStats().hasScoredQuestions ? '🎯 Quiz Mode Finale' : '📋 Survey Feedback Finale' }}
                    </span>
                  </div>
                  <h1 class="text-lg sm:text-xl md:text-2xl font-black tracking-tight leading-snug"
                    [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                    {{ sessionStats().hasScoredQuestions ? 'ទិដ្ឋភាពទូទៅនៃលទ្ធផលប្រឡង • Quiz Overview Results' : 'ទិដ្ឋភាពទូទៅនៃការស្ទង់មតិ • Survey Overview Results' }}
                  </h1>
                </div>
              </div>

              <!-- Right: Navigation View Tabs -->
              <div class="flex items-center gap-2 shrink-0">
                <div class="p-1 rounded-2xl flex items-center gap-1 border shadow-xs"
                  [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                  @if (sessionStats().hasScoredQuestions) {
                    <button
                      type="button"
                      (click)="setOverviewTab('leaderboard')"
                      [ngClass]="overviewTab() === 'leaderboard' 
                        ? 'bg-amber-500 text-white shadow-xs font-bold' 
                        : (isLight() ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')"
                      class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                      <span>🏆</span>
                      <span>Podium & Leaderboard</span>
                    </button>
                  }
                  <button
                    type="button"
                    (click)="setOverviewTab('breakdown')"
                    [ngClass]="overviewTab() === 'breakdown' 
                      ? (isLight() ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'bg-indigo-600 text-white shadow-xs font-bold') 
                      : (isLight() ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')"
                    class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                    <i class="pi pi-list"></i>
                    <span>All Questions ({{ sessionStats().questionResults.length }})</span>
                  </button>
                  <button
                    type="button"
                    (click)="setOverviewTab('spotlight')"
                    [ngClass]="overviewTab() === 'spotlight' 
                      ? (isLight() ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'bg-indigo-600 text-white shadow-xs font-bold') 
                      : (isLight() ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')"
                    class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                    <i class="pi pi-search"></i>
                    <span>Spotlight Focus</span>
                  </button>
                  <button
                    type="button"
                    (click)="setOverviewTab('insights')"
                    [ngClass]="overviewTab() === 'insights' 
                      ? (isLight() ? 'bg-indigo-600 text-white shadow-xs font-bold' : 'bg-indigo-600 text-white shadow-xs font-bold') 
                      : (isLight() ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200')"
                    class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer">
                    <i class="pi pi-chart-pie"></i>
                    <span>Key Insights</span>
                  </button>
                </div>

                @if (isOverviewMode() && room()?.status !== 'completed') {
                  <button
                    type="button"
                    (click)="toggleOverviewMode()"
                    class="px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
                    <i class="pi pi-arrow-left"></i>
                    <span>Live Poll</span>
                  </button>
                }
              </div>
            </div>

            <!-- 2. Grand 4-KPI Overview Metric Cards -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5 my-3 shrink-0 w-full">
              <!-- Total Questions -->
              <div class="p-3 sm:p-3.5 rounded-2xl border shadow-xs text-center space-y-0.5 transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/90 border-slate-800'">
                <div class="text-xl sm:text-2xl lg:text-3xl font-black font-mono leading-tight"
                  [ngClass]="isLight() ? 'text-slate-900' : 'text-slate-100'">
                  {{ totalQuestionsCount() }}
                </div>
                <div class="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                  [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                  Questions Polled
                </div>
              </div>

              <!-- Audience Votes Cast -->
              <div class="p-3 sm:p-3.5 rounded-2xl border shadow-xs text-center space-y-0.5 transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/90 border-slate-800'">
                <div class="text-xl sm:text-2xl lg:text-3xl font-black font-mono leading-tight text-indigo-600 dark:text-indigo-400">
                  {{ totalVotesCount() }}
                </div>
                <div class="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                  [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                  Total Submissions
                </div>
              </div>

              <!-- Overall Accuracy or Top Consensus -->
              <div class="p-3 sm:p-3.5 rounded-2xl border shadow-xs text-center space-y-0.5 transition-colors"
                [ngClass]="sessionStats().hasScoredQuestions 
                  ? (isLight() ? 'bg-emerald-50/70 border-emerald-300' : 'border-emerald-500/40 bg-emerald-950/20') 
                  : (isLight() ? 'bg-amber-50/70 border-amber-300' : 'border-amber-500/40 bg-amber-950/20')">
                <div class="text-xl sm:text-2xl lg:text-3xl font-black font-mono leading-tight"
                  [ngClass]="sessionStats().hasScoredQuestions 
                    ? (isLight() ? 'text-emerald-700' : 'text-emerald-400') 
                    : (isLight() ? 'text-amber-700' : 'text-amber-400')">
                  {{ sessionStats().hasScoredQuestions ? sessionStats().overallAccuracy + '%' : sessionStats().topConsensusPercentage + '%' }}
                </div>
                <div class="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                  [ngClass]="sessionStats().hasScoredQuestions 
                    ? (isLight() ? 'text-emerald-800' : 'text-emerald-300') 
                    : (isLight() ? 'text-amber-800' : 'text-amber-300')">
                  {{ sessionStats().hasScoredQuestions ? 'Overall Quiz Accuracy' : 'Average Consensus' }}
                </div>
              </div>

              <!-- Completion Status -->
              <div class="p-3 sm:p-3.5 rounded-2xl border shadow-xs text-center space-y-0.5 transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-100' : 'bg-slate-900/90 border-slate-800'">
                <div class="text-xl sm:text-2xl lg:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                  100%
                </div>
                <div class="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                  [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                  Audience Completed
                </div>
              </div>
            </div>

            <!-- 3. Dynamic Tab Content: Scrollable & Responsive View -->
            <div class="flex-1 min-h-0 overflow-y-auto pr-1">
              
              <!-- TAB 0: CONGRATULATION PODIUM & LEADERBOARD -->
              @if (overviewTab() === 'leaderboard') {
                <div class="space-y-6 pb-8 animate-fadein max-w-5xl 2xl:max-w-6xl mx-auto">
                  
                  <!-- Grand Celebration Banner -->
                  <div class="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-center border shadow-lg"
                    [ngClass]="isLight() 
                      ? 'bg-linear-to-r from-amber-50 via-indigo-50 to-amber-50 border-amber-200/80 shadow-amber-100/50' 
                      : 'bg-linear-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border-amber-500/30 shadow-black/40'">
                    
                    <!-- Ambient Glow Sparks -->
                    <div class="absolute -top-10 left-1/4 w-32 h-32 bg-amber-400/20 rounded-full blur-3xl pointer-events-none"></div>
                    <div class="absolute -bottom-10 right-1/4 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>

                    <div class="relative space-y-1.5">
                      <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest border shadow-xs"
                        [ngClass]="isLight() ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-amber-950 text-amber-300 border-amber-700'">
                        <span>👑</span>
                        <span>Quiz Champions & Speed Leaders</span>
                      </div>
                      <h2 class="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight"
                        [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                        🎉 សូមអបអរសាទរអ្នកឈ្នះទាំងអស់គ្នា! • Congratulations!
                      </h2>
                      <p class="text-xs sm:text-sm md:text-base font-medium max-w-2xl mx-auto"
                        [ngClass]="isLight() ? 'text-slate-600' : 'text-slate-300'">
                        ចំណាត់ថ្នាក់ផ្អែកលើចំនួនចម្លើយត្រឹមត្រូវច្រើនជាងគេ និងចំណាយពេលតិចបំផុត • Ranked by most correct answers & fastest completion time.
                      </p>
                    </div>
                  </div>

                  @if ((sessionStats().leaderboard || []).length === 0) {
                    <!-- Empty State -->
                    <div class="p-12 text-center rounded-3xl border space-y-3"
                      [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                      <div class="text-5xl">⏱️</div>
                      <h3 class="text-lg font-bold" [ngClass]="isLight() ? 'text-slate-800' : 'text-slate-200'">
                        No Quiz Submissions Yet
                      </h3>
                      <p class="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                        Participants who answer quiz questions will appear here ranked by score and speed.
                      </p>
                    </div>
                  } @else {
                    <!-- 3-TIER GRAND PODIUM DISPLAY -->
                    <div class="pt-6 sm:pt-10 px-2 sm:px-6">
                      <div class="flex items-end justify-center gap-2 sm:gap-4 md:gap-6 max-w-3xl mx-auto">
                        
                        <!-- 2ND PLACE (SILVER - LEFT) -->
                        @if (leaderboardTop3().second; as second) {
                          <div class="flex-1 flex flex-col items-center animate-fadein text-center max-w-[200px] sm:max-w-[240px]">
                            <!-- Avatar / Badge -->
                            <div class="relative mb-2">
                              <div class="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full flex items-center justify-center font-black text-lg sm:text-xl shadow-lg border-3 border-slate-300"
                                [ngClass]="isLight() ? 'bg-slate-100 text-slate-800' : 'bg-slate-800 text-slate-100'">
                                {{ second.voterName.substring(0, 2).toUpperCase() }}
                              </div>
                              <span class="absolute -bottom-2 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-b from-slate-200 to-slate-400 border-2 border-white shadow-md flex items-center justify-center text-sm font-black text-slate-900">
                                🥈
                              </span>
                            </div>

                            <!-- Name & Metrics -->
                            <div class="w-full space-y-0.5 mb-2 px-1">
                              <div class="font-black text-xs sm:text-sm md:text-base truncate"
                                [ngClass]="isLight() ? 'text-slate-900' : 'text-white'" [title]="second.voterName">
                                {{ second.voterName }}
                              </div>
                              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold font-mono bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                <span>{{ second.correctAnswers }}/{{ sessionStats().totalScoredQuestions }}</span>
                                <span>({{ second.accuracy }}%)</span>
                              </div>
                              <div class="text-[10px] sm:text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                                ⏱️ {{ second.totalTimeSeconds }}s
                              </div>
                            </div>

                            <!-- Pedestal -->
                            <div class="w-full h-36 sm:h-44 md:h-52 rounded-t-3xl border-t-4 border-x border-slate-300 dark:border-slate-700 flex flex-col items-center justify-between py-3 sm:py-4 shadow-xl"
                              [ngClass]="isLight() ? 'bg-linear-to-b from-slate-200 via-slate-100 to-slate-50' : 'bg-linear-to-b from-slate-800 via-slate-850 to-slate-900'">
                              <span class="text-3xl sm:text-4xl md:text-5xl font-black font-mono text-slate-400 dark:text-slate-500">2</span>
                              <span class="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Runner Up</span>
                            </div>
                          </div>
                        } @else {
                          <div class="flex-1 opacity-0 pointer-events-none"></div>
                        }

                        <!-- 1ST PLACE (GOLD - CENTER - HIGHEST) -->
                        @if (leaderboardTop3().first; as first) {
                          <div class="flex-1 flex flex-col items-center animate-fadein text-center max-w-[220px] sm:max-w-[260px] z-10 -mt-6 sm:-mt-8">
                            <!-- Floating Crown -->
                            <div class="text-3xl sm:text-4xl animate-bounce-short mb-1 drop-shadow-md">
                              👑
                            </div>

                            <!-- Avatar / Badge with Gold Glow -->
                            <div class="relative mb-2">
                              <div class="w-18 h-18 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full flex items-center justify-center font-black text-xl sm:text-2xl shadow-2xl border-4 border-amber-400 ring-4 ring-amber-400/30"
                                [ngClass]="isLight() ? 'bg-amber-50 text-amber-950' : 'bg-amber-950 text-amber-100'">
                                {{ first.voterName.substring(0, 2).toUpperCase() }}
                              </div>
                              <span class="absolute -bottom-2 -right-1 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-linear-to-b from-amber-300 to-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-base font-black text-amber-950">
                                🥇
                              </span>
                            </div>

                            <!-- Name & Metrics -->
                            <div class="w-full space-y-0.5 mb-2 px-1">
                              <div class="font-black text-sm sm:text-base md:text-lg truncate text-amber-600 dark:text-amber-400" [title]="first.voterName">
                                {{ first.voterName }}
                              </div>
                              <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                <span>🎯 {{ first.correctAnswers }}/{{ sessionStats().totalScoredQuestions }}</span>
                                <span>({{ first.accuracy }}%)</span>
                              </div>
                              <div class="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                                ⚡ {{ first.totalTimeSeconds }}s ({{ first.avgTimeSeconds }}s/q)
                              </div>
                            </div>

                            <!-- Pedestal -->
                            <div class="w-full h-48 sm:h-56 md:h-64 rounded-t-3xl border-t-4 border-x border-amber-400 dark:border-amber-600 flex flex-col items-center justify-between py-4 sm:py-5 shadow-2xl relative overflow-hidden"
                              [ngClass]="isLight() ? 'bg-linear-to-b from-amber-300 via-amber-200 to-amber-50' : 'bg-linear-to-b from-amber-700/80 via-amber-900/60 to-slate-900'">
                              <div class="absolute inset-0 bg-linear-to-t from-transparent via-white/10 to-transparent pointer-events-none"></div>
                              <span class="text-4xl sm:text-5xl md:text-6xl font-black font-mono text-amber-700 dark:text-amber-300 drop-shadow-xs">1</span>
                              <span class="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-900 dark:text-amber-200">Champion</span>
                            </div>
                          </div>
                        }

                        <!-- 3RD PLACE (BRONZE - RIGHT) -->
                        @if (leaderboardTop3().third; as third) {
                          <div class="flex-1 flex flex-col items-center animate-fadein text-center max-w-[200px] sm:max-w-[240px]">
                            <!-- Avatar / Badge -->
                            <div class="relative mb-2">
                              <div class="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full flex items-center justify-center font-black text-lg sm:text-xl shadow-lg border-3 border-amber-700"
                                [ngClass]="isLight() ? 'bg-orange-50 text-orange-950' : 'bg-orange-950 text-orange-100'">
                                {{ third.voterName.substring(0, 2).toUpperCase() }}
                              </div>
                              <span class="absolute -bottom-2 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-linear-to-b from-amber-600 to-amber-800 border-2 border-white shadow-md flex items-center justify-center text-sm font-black text-white">
                                🥉
                              </span>
                            </div>

                            <!-- Name & Metrics -->
                            <div class="w-full space-y-0.5 mb-2 px-1">
                              <div class="font-black text-xs sm:text-sm md:text-base truncate"
                                [ngClass]="isLight() ? 'text-slate-900' : 'text-white'" [title]="third.voterName">
                                {{ third.voterName }}
                              </div>
                              <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold font-mono bg-orange-100 dark:bg-orange-950/80 text-orange-800 dark:text-orange-300">
                                <span>{{ third.correctAnswers }}/{{ sessionStats().totalScoredQuestions }}</span>
                                <span>({{ third.accuracy }}%)</span>
                              </div>
                              <div class="text-[10px] sm:text-xs font-mono font-semibold text-slate-500 dark:text-slate-400">
                                ⏱️ {{ third.totalTimeSeconds }}s
                              </div>
                            </div>

                            <!-- Pedestal -->
                            <div class="w-full h-28 sm:h-36 md:h-44 rounded-t-3xl border-t-4 border-x border-amber-700 dark:border-amber-800 flex flex-col items-center justify-between py-3 sm:py-4 shadow-xl"
                              [ngClass]="isLight() ? 'bg-linear-to-b from-orange-200 via-orange-100 to-orange-50' : 'bg-linear-to-b from-orange-900/60 via-amber-950/50 to-slate-900'">
                              <span class="text-3xl sm:text-4xl md:text-5xl font-black font-mono text-amber-800 dark:text-amber-500">3</span>
                              <span class="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-amber-800 dark:text-amber-400">3rd Place</span>
                            </div>
                          </div>
                        } @else {
                          <div class="flex-1 opacity-0 pointer-events-none"></div>
                        }

                      </div>
                    </div>

                    <!-- RANKS 4+ LEADERBOARD TABLE -->
                    @if (leaderboardRest().length > 0) {
                      <div class="rounded-3xl border shadow-sm p-4 sm:p-5 space-y-3"
                        [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'">
                        <div class="flex items-center justify-between pb-2 border-b"
                          [ngClass]="isLight() ? 'border-slate-100' : 'border-slate-800'">
                          <div class="flex items-center gap-2">
                            <span class="text-base font-black" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                              Honorable Contenders & Top Finishers
                            </span>
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              Ranks 4 - {{ (sessionStats().leaderboard || []).length }}
                            </span>
                          </div>
                          <span class="text-xs text-slate-400 font-mono">
                            Tie-breaker: Fastest Total Speed
                          </span>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          @for (entry of leaderboardRest(); track entry.voterId) {
                            <div class="p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors"
                              [ngClass]="isLight() ? 'bg-slate-50 border-slate-200/80 hover:bg-slate-100' : 'bg-slate-950/60 border-slate-800 hover:bg-slate-800/50'">
                              <div class="flex items-center gap-2.5 min-w-0">
                                <span class="w-7 h-7 rounded-full font-mono text-xs font-black flex items-center justify-center shrink-0 border"
                                  [ngClass]="isLight() ? 'bg-white border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-700 text-slate-300'">
                                  #{{ entry.rank }}
                                </span>
                                <div class="truncate">
                                  <div class="font-bold text-xs sm:text-sm truncate" [ngClass]="isLight() ? 'text-slate-800' : 'text-slate-200'">
                                    {{ entry.voterName }}
                                  </div>
                                  <div class="text-[10px] text-slate-400 font-mono">
                                    {{ entry.accuracy }}% accuracy
                                  </div>
                                </div>
                              </div>

                              <div class="text-right shrink-0 font-mono">
                                <div class="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                  {{ entry.correctAnswers }}/{{ sessionStats().totalScoredQuestions }}
                                </div>
                                <div class="text-[10px] text-slate-400">
                                  ⏱️ {{ entry.totalTimeSeconds }}s
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  }

                </div>
              }

              <!-- TAB 1: ALL QUESTIONS BREAKDOWN -->
              @if (overviewTab() === 'breakdown') {
                <div class="space-y-3.5 pb-6">
                  
                  <!-- Quick question filter chips -->
                  <div class="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none shrink-0">
                    <button
                      type="button"
                      (click)="overviewFilter.set('all')"
                      [ngClass]="overviewFilter() === 'all' 
                        ? 'bg-indigo-600 text-white shadow-xs font-black' 
                        : (isLight() ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800')"
                      class="px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0">
                      All ({{ sessionStats().questionResults.length }})
                    </button>
                    @for (q of sessionStats().questionResults; track q.pollId; let idx = $index) {
                      <button
                        type="button"
                        (click)="overviewFilter.set(q.pollId)"
                        [ngClass]="overviewFilter() === q.pollId 
                          ? 'bg-indigo-600 text-white shadow-xs font-black' 
                          : (isLight() ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800')"
                        class="px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer shrink-0 flex items-center gap-1">
                        <span>Q{{ q.order || (idx + 1) }}</span>
                        @if (q.correctOptionId !== undefined) {
                          <span class="text-[10px]" [ngClass]="q.correctPercentage >= 50 ? 'text-emerald-400' : 'text-amber-400'">{{ q.correctPercentage }}%</span>
                        }
                      </button>
                    }
                  </div>

                  <!-- Questions Grid (2 columns on large displays, 1 column on smaller) -->
                  <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                    @for (q of filteredQuestionResults(); track q.pollId; let qIdx = $index) {
                      <div class="p-4 sm:p-5 rounded-2xl border shadow-xs space-y-3 transition-colors text-left"
                        [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'">
                        
                        <!-- Question Header -->
                        <div class="flex items-start justify-between gap-3">
                          <div class="flex items-start gap-2.5 min-w-0">
                            <span class="px-2.5 py-1 rounded-xl text-xs font-black font-mono shrink-0 shadow-2xs"
                              [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-indigo-950 text-indigo-300 border border-indigo-800'">
                              Q{{ q.order || (qIdx + 1) }}
                            </span>
                            <h3 class="text-sm sm:text-base font-bold leading-snug break-words"
                              [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                              {{ q.question }}
                            </h3>
                          </div>
                          
                          <div class="shrink-0 flex items-center gap-1.5">
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full border"
                              [ngClass]="isLight() ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'">
                              👥 {{ q.totalVotes }} votes
                            </span>
                          </div>
                        </div>

                        <!-- Result Highlight Pill -->
                        <div class="flex items-center gap-2 flex-wrap text-xs">
                          @if (q.correctOptionId !== undefined) {
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border"
                              [ngClass]="isLight() ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'">
                              <i class="pi pi-check-circle text-xs text-emerald-600 dark:text-emerald-400"></i>
                              <span>Correct: <strong>{{ q.correctOptionText }}</strong></span>
                              <span class="font-mono ml-1">({{ q.correctPercentage }}% accuracy)</span>
                            </span>
                          } @else {
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold border"
                              [ngClass]="isLight() ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-amber-950/40 text-amber-300 border-amber-800'">
                              <i class="pi pi-star text-xs text-amber-500"></i>
                              <span>Top Choice: <strong>{{ q.winningOptionText }}</strong></span>
                              <span class="font-mono ml-1">({{ q.winningPercentage }}% consensus)</span>
                            </span>
                          }
                        </div>

                        <!-- Option Distribution Bars -->
                        <div class="space-y-2 pt-1">
                          @for (opt of q.options; track opt.id; let optIdx = $index) {
                            <div class="p-2.5 rounded-xl border transition-colors space-y-1.5"
                              [ngClass]="{
                                'border-emerald-500/60 bg-emerald-50/50 dark:bg-emerald-950/20 ring-1 ring-emerald-500/40': opt.isCorrect,
                                'border-indigo-400/50 bg-indigo-50/30 dark:bg-indigo-950/20': !opt.isCorrect && opt.id === q.winningOptionId && q.correctOptionId === undefined,
                                'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50': !opt.isCorrect && (opt.id !== q.winningOptionId || q.correctOptionId !== undefined)
                              }">
                              <div class="flex items-center justify-between text-xs font-semibold gap-2">
                                <div class="flex items-center gap-2 min-w-0">
                                  <span class="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0"
                                    [ngClass]="opt.isCorrect 
                                      ? 'bg-emerald-600 text-white' 
                                      : (isLight() ? 'bg-slate-200 text-slate-800' : 'bg-slate-800 text-slate-200')">
                                    {{ getOptionLetter(optIdx) }}
                                  </span>
                                  <span class="truncate" [ngClass]="opt.isCorrect ? 'font-bold text-emerald-950 dark:text-emerald-200' : (isLight() ? 'text-slate-800' : 'text-slate-200')">
                                    {{ opt.text }}
                                  </span>
                                  @if (opt.isCorrect) {
                                    <span class="text-[10px] uppercase font-black px-1.5 py-0.2 rounded-md bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300">
                                      Correct
                                    </span>
                                  }
                                </div>
                                <div class="shrink-0 flex items-center gap-2 font-mono">
                                  <span class="text-xs font-bold" [ngClass]="opt.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : (isLight() ? 'text-slate-900' : 'text-white')">
                                    {{ opt.percentage }}%
                                  </span>
                                  <span class="text-[10px] text-slate-400">
                                    ({{ opt.votes }})
                                  </span>
                                </div>
                              </div>

                              <!-- Progress Bar Fill -->
                              <div class="w-full h-2 rounded-full overflow-hidden" [ngClass]="isLight() ? 'bg-slate-200/80' : 'bg-slate-800'">
                                <div class="h-full rounded-full transition-all duration-500"
                                  [style.width.%]="opt.percentage"
                                  [ngClass]="opt.isCorrect 
                                    ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' 
                                    : (opt.id === q.winningOptionId ? 'bg-indigo-600' : 'bg-slate-400')">
                                </div>
                              </div>
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- TAB 2: SPOTLIGHT FOCUS (SINGLE QUESTION TV MAGNIFICATION) -->
              @if (overviewTab() === 'spotlight') {
                @if (currentSpotlightQuestion(); as spotQ) {
                  <div class="max-w-4xl mx-auto py-2 space-y-4">
                    <!-- Navigation Controller for Spotlight -->
                    <div class="flex items-center justify-between p-3 rounded-2xl border shadow-xs"
                      [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                      <button
                        type="button"
                        (click)="prevSpotlight()"
                        [disabled]="spotlightIndex() <= 0"
                        class="px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        [ngClass]="isLight() ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'">
                        <i class="pi pi-arrow-left"></i>
                        <span>Previous Question</span>
                      </button>

                      <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Spotlight:</span>
                        <span class="font-mono font-black text-sm px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                          Q{{ spotQ.order }} of {{ sessionStats().questionResults.length }}
                        </span>
                      </div>

                      <button
                        type="button"
                        (click)="nextSpotlight()"
                        [disabled]="spotlightIndex() >= sessionStats().questionResults.length - 1"
                        class="px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        [ngClass]="isLight() ? 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'">
                        <span>Next Question</span>
                        <i class="pi pi-arrow-right"></i>
                      </button>
                    </div>

                    <!-- Magnified Question Presentation Card -->
                    <div class="p-6 sm:p-8 rounded-3xl border shadow-xl space-y-5 text-left"
                      [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900/90 border-slate-800 shadow-slate-950'">
                      
                      <div class="flex items-center justify-between gap-3">
                        <span class="px-3 py-1 rounded-xl text-sm font-black font-mono shadow-xs"
                          [ngClass]="isLight() ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-900 text-indigo-200'">
                          Question #{{ spotQ.order }}
                        </span>
                        <span class="text-sm font-bold px-3 py-1 rounded-full border"
                          [ngClass]="isLight() ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'">
                          👥 {{ spotQ.totalVotes }} Total Audience Votes
                        </span>
                      </div>

                      <h2 class="text-xl sm:text-2xl md:text-3xl font-black leading-snug"
                        [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                        {{ spotQ.question }}
                      </h2>

                      <!-- Huge Animated Option Bars -->
                      <div class="space-y-3.5 pt-2">
                        @for (opt of spotQ.options; track opt.id; let optIdx = $index) {
                          <div class="p-4 rounded-2xl border-2 transition-all space-y-2"
                            [ngClass]="opt.isCorrect 
                              ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-500/30' 
                              : (opt.id === spotQ.winningOptionId && spotQ.correctOptionId === undefined
                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
                                : (isLight() ? 'border-slate-200 bg-slate-50/70' : 'border-slate-800 bg-slate-800/40'))">
                            
                            <div class="flex items-center justify-between">
                              <div class="flex items-center gap-3">
                                <span class="w-8 h-8 rounded-xl flex items-center justify-center font-black text-sm shrink-0"
                                  [ngClass]="opt.isCorrect ? 'bg-emerald-600 text-white' : (isLight() ? 'bg-slate-200 text-slate-800' : 'bg-slate-700 text-white')">
                                  {{ getOptionLetter(optIdx) }}
                                </span>
                                <span class="text-base sm:text-lg font-bold"
                                  [ngClass]="opt.isCorrect ? 'text-emerald-950 dark:text-emerald-200' : (isLight() ? 'text-slate-900' : 'text-white')">
                                  {{ opt.text }}
                                </span>
                                @if (opt.isCorrect) {
                                  <span class="px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 flex items-center gap-1">
                                    <i class="pi pi-check"></i> Correct Answer
                                  </span>
                                }
                              </div>

                              <div class="flex items-baseline gap-2 font-mono">
                                <span class="text-xl sm:text-2xl font-black"
                                  [ngClass]="opt.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : (isLight() ? 'text-slate-900' : 'text-white')">
                                  {{ opt.percentage }}%
                                </span>
                                <span class="text-xs text-slate-400">
                                  ({{ opt.votes }} votes)
                                </span>
                              </div>
                            </div>

                            <div class="w-full h-3 rounded-full overflow-hidden" [ngClass]="isLight() ? 'bg-slate-200' : 'bg-slate-700'">
                              <div class="h-full rounded-full transition-all duration-700"
                                [style.width.%]="opt.percentage"
                                [ngClass]="opt.isCorrect 
                                  ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]' 
                                  : (opt.id === spotQ.winningOptionId ? 'bg-indigo-600' : 'bg-slate-400')">
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                }
              }

              <!-- TAB 3: KEY INSIGHTS & STATISTICAL HIGHLIGHTS -->
              @if (overviewTab() === 'insights') {
                <div class="max-w-4xl mx-auto py-2 space-y-4">
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    <!-- Highest Consensus Question -->
                    @if (highestConsensusQuestion(); as hc) {
                      <div class="p-5 rounded-2xl border shadow-xs space-y-2 text-left"
                        [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                        <div class="flex items-center gap-2">
                          <span class="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                            ⭐
                          </span>
                          <div>
                            <div class="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Highest Consensus</div>
                            <div class="text-xs text-slate-400 font-mono">Q{{ hc.order }} • {{ hc.winningPercentage }}% agreement</div>
                          </div>
                        </div>
                        <h4 class="text-sm font-bold" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                          {{ hc.question }}
                        </h4>
                        <div class="text-xs p-2.5 rounded-xl border"
                          [ngClass]="isLight() ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/30 border-amber-800 text-amber-200'">
                          Top response: <strong>{{ hc.winningOptionText }}</strong> with {{ hc.winningPercentage }}% of votes
                        </div>
                      </div>
                    }

                    <!-- Top Accuracy Question (if Quiz) -->
                    @if (highestAccuracyQuestion(); as ha) {
                      <div class="p-5 rounded-2xl border shadow-xs space-y-2 text-left"
                        [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                        <div class="flex items-center gap-2">
                          <span class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm">
                            🎯
                          </span>
                          <div>
                            <div class="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Easiest Question</div>
                            <div class="text-xs text-slate-400 font-mono">Q{{ ha.order }} • {{ ha.correctPercentage }}% correct</div>
                          </div>
                        </div>
                        <h4 class="text-sm font-bold" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                          {{ ha.question }}
                        </h4>
                        <div class="text-xs p-2.5 rounded-xl border"
                          [ngClass]="isLight() ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/30 border-emerald-800 text-emerald-200'">
                          Correct answer: <strong>{{ ha.correctOptionText }}</strong>
                        </div>
                      </div>
                    }

                    <!-- Toughest Question (if Quiz) -->
                    @if (toughestQuestion(); as tq) {
                      <div class="p-5 rounded-2xl border shadow-xs space-y-2 text-left"
                        [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                        <div class="flex items-center gap-2">
                          <span class="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-sm">
                            🧠
                          </span>
                          <div>
                            <div class="text-xs font-bold uppercase tracking-wider text-red-600 dark:text-red-400">Most Challenging Question</div>
                            <div class="text-xs text-slate-400 font-mono">Q{{ tq.order }} • {{ tq.correctPercentage }}% correct</div>
                          </div>
                        </div>
                        <h4 class="text-sm font-bold" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                          {{ tq.question }}
                        </h4>
                        <div class="text-xs p-2.5 rounded-xl border"
                          [ngClass]="isLight() ? 'bg-red-50/70 border-red-200 text-red-900' : 'bg-red-950/30 border-red-800 text-red-200'">
                          Audience struggled most with this question (only {{ tq.correctPercentage }}% selected "{{ tq.correctOptionText }}")
                        </div>
                      </div>
                    }

                    <!-- Audience Engagement Summary -->
                    <div class="p-5 rounded-2xl border shadow-xs space-y-2 text-left"
                      [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'">
                      <div class="flex items-center gap-2">
                        <span class="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm">
                          📈
                        </span>
                        <div>
                          <div class="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Engagement Score</div>
                          <div class="text-xs text-slate-400 font-mono">Room {{ roomCode() }}</div>
                        </div>
                      </div>
                      <h4 class="text-sm font-bold" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                        Active Audience Participation
                      </h4>
                      <p class="text-xs text-slate-500 dark:text-slate-400">
                        Average of <strong>{{ sessionStats().totalQuestions > 0 ? (sessionStats().totalVotes / sessionStats().totalQuestions | number:'1.0-1') : 0 }}</strong> votes per question across {{ totalQuestionsCount() }} questions.
                      </p>
                    </div>

                  </div>
                </div>
              }

            </div>

          </div>
        } @else if (room()?.mode === 'survey') {
          <!-- SLIDO-INSPIRED SURVEY & PRESENTATION JOIN STAGE -->
          <div class="fixed inset-0 z-40 flex flex-col justify-between p-4 sm:p-8 md:p-10 select-none animate-fadein overflow-hidden relative"
            [ngClass]="isLight() ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'">

            <!-- Background Ambient Glow -->
            @if (isLight()) {
              <div class="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
              <div class="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
            } @else {
              <div class="absolute -top-32 -left-32 w-[32rem] h-[32rem] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
              <div class="absolute -bottom-32 -right-32 w-[32rem] h-[32rem] bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
            }

            <!-- 1. Minimalist Top Bar (Back button + Centered Logo) -->
            <div class="relative w-full flex items-center justify-between shrink-0 z-10">
              <!-- Circular Back Button -->
              <button 
                type="button" 
                (click)="goBack()"
                title="Back to controller"
                class="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md hover:scale-105 shrink-0 border"
                [ngClass]="isLight() ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200 shadow-slate-200/50' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800 shadow-black/40'">
                <i class="pi pi-chevron-left text-xs sm:text-sm font-bold"></i>
              </button>

              <!-- Mati Brand Centered Name & Icon Mark -->
              <div class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 pointer-events-none">
                <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs sm:text-sm font-black shadow-md shadow-indigo-600/30">
                  M
                </div>
                <span class="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight font-sans"
                  [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                  mati<span class="text-indigo-600 dark:text-indigo-400">.</span>
                </span>
              </div>

              <!-- Right Spacer (Balance layout) -->
              <div class="w-9 h-9 sm:w-10 sm:h-10"></div>
            </div>

            <!-- 2. Pure Slido Hero Layout: [ Join at / domain / #PIN ] | [ Giant QR Code ] -->
            <div class="flex-1 min-h-0 w-full flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden z-10">
              <div class="w-full max-w-5xl 2xl:max-w-6xl flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-8 md:gap-10 lg:gap-14 px-3 sm:px-6">
                
                <!-- Left Column: Join instructions -->
                <div class="flex-1 min-w-0 max-w-full text-center md:text-right space-y-0.5 sm:space-y-1">
                  <div class="text-lg sm:text-2xl md:text-3xl lg:text-4xl font-medium tracking-normal"
                    [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                    Join at
                  </div>
                  <div class="font-black tracking-tight leading-tight select-all truncate"
                    [ngClass]="[isLight() ? 'text-slate-900' : 'text-white', domainFontSizeClass()]"
                    [title]="joinDomain()">
                    {{ joinDomain() }}
                  </div>
                  <div class="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black font-mono tracking-tight leading-tight pt-0.5 sm:pt-1"
                    [ngClass]="isLight() ? 'text-indigo-600' : 'text-indigo-400'">
                    {{ formattedPin() }}
                  </div>
                </div>

                <!-- Subtle Center Divider Line -->
                <div class="hidden md:block w-px h-44 sm:h-56 md:h-64 lg:h-72 shrink-0"
                  [ngClass]="isLight() ? 'bg-slate-200' : 'bg-slate-800'">
                </div>

                <!-- Right Column: Crisp White Rounded QR Card with Mati Brand Glow -->
                <div class="p-3 sm:p-4 md:p-5 bg-white rounded-3xl sm:rounded-4xl shadow-2xl shrink-0 border ring-4 ring-indigo-500/10"
                  [ngClass]="isLight() ? 'border-slate-200/80 shadow-slate-200/60' : 'border-slate-800 shadow-indigo-950/40'">
                  @if (qrCodeDataUrl()) {
                    <img 
                      [src]="qrCodeDataUrl()" 
                      alt="Scan to join Mati Survey" 
                      class="w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 lg:w-72 lg:h-72 xl:w-80 xl:h-80 max-w-[36vh] max-h-[36vh] object-contain rounded-2xl" />
                  } @else {
                    <div class="w-40 h-40 sm:w-52 sm:h-52 md:w-60 md:h-60 lg:w-72 lg:h-72 xl:w-80 xl:h-80 max-w-[36vh] max-h-[36vh] flex items-center justify-center bg-gray-50 text-gray-400 rounded-2xl">
                      <i class="pi pi-qrcode text-5xl animate-pulse"></i>
                    </div>
                  }
                </div>

              </div>
            </div>

            <!-- 3. Bottom Controls: Slido-style Floating Pill on Left & Results Peeker on Right -->
            <div class="flex items-center justify-between w-full shrink-0 z-10">
              <!-- Slido Floating Pill: Settings & Fullscreen -->
              <div class="flex items-center gap-1.5 p-1.5 px-2.5 rounded-xl text-white shadow-xl backdrop-blur-md border"
                [ngClass]="isLight() ? 'bg-slate-900/90 border-slate-700/50' : 'bg-slate-900/90 border-slate-800'">
                <button 
                  type="button" 
                  (click)="toggleTheme()" 
                  title="Toggle light / dark theme" 
                  class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-slate-300 hover:text-white">
                  <i class="pi pi-cog text-sm"></i>
                </button>
                <button 
                  type="button" 
                  (click)="toggleFullscreen()" 
                  title="Toggle fullscreen" 
                  class="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer text-slate-300 hover:text-white">
                  <i class="pi pi-expand text-sm"></i>
                </button>
              </div>

              <!-- Quick Live Results Button -->
              <div>
                <button 
                  type="button" 
                  (click)="toggleOverviewMode()" 
                  title="View live survey results" 
                  class="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer shadow-xs hover:scale-102"
                  [ngClass]="isLight() ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-800'">
                  <i class="pi pi-chart-bar text-indigo-500"></i>
                  <span>Live Results ({{ totalVotesCount() }})</span>
                </button>
              </div>
            </div>

          </div>
        } @else {
          <!-- Split Stage Layout: Flexible QR Station on Left + Question & Results on Right -->
          <div class="flex flex-col lg:flex-row items-center justify-center gap-4 lg:gap-8 xl:gap-12 w-full h-full max-h-full min-h-0 py-1 sm:py-2">

            <!-- LEFT SIDE: Adaptive Big Scannable QR Station -->
            <div class="w-full lg:w-80 xl:w-96 2xl:w-[28rem] shrink-0 flex flex-col items-center justify-center max-h-full">
              <div class="border rounded-3xl sm:rounded-4xl p-5 sm:p-6 2xl:p-8 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-3 sm:space-y-4 w-full max-w-sm xl:max-w-md 2xl:max-w-lg overflow-hidden transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900/95 border-slate-800'">

                <!-- Responsive QR Code (Adapts smoothly to viewport height) -->
                <div class="p-3 sm:p-4 2xl:p-5 bg-white rounded-2xl sm:rounded-3xl shadow-lg ring-4 ring-indigo-500/15 shrink-0 border border-slate-100">
                  @if (qrCodeDataUrl()) {
                    <img [src]="qrCodeDataUrl()" alt="Scan to join Mati" class="h-[min(34vh,16rem)] w-[min(34vh,16rem)] sm:h-[min(38vh,19rem)] sm:w-[min(38vh,19rem)] 2xl:h-[min(42vh,24rem)] 2xl:w-[min(42vh,24rem)] object-contain" />
                  } @else {
                    <div class="h-[min(34vh,16rem)] w-[min(34vh,16rem)] sm:h-[min(38vh,19rem)] sm:w-[min(38vh,19rem)] 2xl:h-[min(42vh,24rem)] 2xl:w-[min(42vh,24rem)] flex items-center justify-center bg-gray-100 text-gray-400 rounded-2xl">
                      <i class="pi pi-qrcode text-4xl sm:text-5xl animate-pulse"></i>
                    </div>
                  }
                </div>

                <!-- URL & Instructions -->
                <div class="space-y-1.5 w-full shrink-0">
                  <div class="text-xs sm:text-sm 2xl:text-base font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                    [ngClass]="isLight() ? 'text-indigo-600' : 'text-indigo-400'">
                    <i class="pi pi-camera text-xs sm:text-sm"></i>
                    <span>Scan with phone to join</span>
                  </div>
                  <div class="text-xs sm:text-sm 2xl:text-base font-bold font-mono truncate px-3 py-1.5 rounded-xl border shadow-2xs"
                    [ngClass]="isLight() ? 'bg-slate-50 text-slate-800 border-slate-200' : 'bg-slate-950/70 text-slate-200 border-slate-800/80'">
                    {{ joinUrlShort() }}
                  </div>
                </div>

                <!-- Room PIN -->
                <div class="w-full pt-3 border-t shrink-0"
                  [ngClass]="isLight() ? 'border-slate-100' : 'border-slate-800/80'">
                  <div class="text-[10px] sm:text-xs 2xl:text-sm font-black uppercase tracking-widest"
                    [ngClass]="isLight() ? 'text-slate-400' : 'text-slate-400'">Room PIN</div>
                  <div class="text-3xl sm:text-4xl lg:text-5xl 2xl:text-6xl font-black font-mono tracking-widest leading-none mt-1"
                    [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">
                    {{ roomCode() }}
                  </div>
                </div>

                <!-- Live Total Vote Counter in QR Station -->
                @if (pollStats()?.totalVotes) {
                  <div class="w-full pt-2.5 border-t flex items-center justify-center gap-2 text-xs sm:text-sm 2xl:text-base font-bold"
                    [ngClass]="isLight() ? 'border-slate-100 text-slate-600' : 'border-slate-800/80 text-slate-300'">
                    <i class="pi pi-users text-emerald-500 text-sm"></i>
                    <span>{{ pollStats()?.totalVotes }} votes</span>
                  </div>
                }

              </div>
            </div>

            <!-- RIGHT SIDE: Active Question & Live Vote Option Bars -->
            <div class="flex-1 min-h-0 flex flex-col justify-center min-w-0 w-full overflow-hidden my-auto space-y-3 sm:space-y-4">
              @if (pollStats(); as stats) {
                <!-- Question Title Bar -->
                <div class="text-center space-y-1.5 sm:space-y-2 shrink-0">
                  <div class="flex items-center justify-center gap-2 flex-wrap">
                    <span class="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wider uppercase border shadow-2xs"
                      [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'">
                      Question #{{ stats.poll.order }}
                    </span>

                    @if (remainingSeconds() !== null) {
                      @if (remainingSeconds()! > 10) {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono shadow-xs"
                          [ngClass]="isLight() ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'">
                          <i class="pi pi-clock text-[10px]"></i> {{ remainingSeconds() }}s
                        </span>
                      } @else if (remainingSeconds()! <= 10 && remainingSeconds()! > 5) {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono shadow-xs"
                          [ngClass]="isLight() ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'">
                          <i class="pi pi-clock text-[10px]"></i> {{ remainingSeconds() }}s
                        </span>
                      } @else if (remainingSeconds()! <= 5 && remainingSeconds()! > 0) {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono shadow-md animate-pulse"
                          [ngClass]="isLight() ? 'bg-red-50 text-red-700 border-red-300' : 'bg-red-500/30 text-red-300 border-red-500/50'">
                          <i class="pi pi-clock text-[10px]"></i> {{ remainingSeconds() }}s left!
                        </span>
                      } @else if (remainingSeconds() === 0) {
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border font-mono"
                          [ngClass]="isLight() ? 'bg-red-100 text-red-800 border-red-300' : 'bg-red-600/30 text-red-200 border-red-500/60'">
                          <i class="pi pi-times-circle text-[10px]"></i> Time's Up!
                        </span>
                      }
                    }

                    @if (stats.poll.isLocked && !isTimeUp()) {
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border"
                        [ngClass]="isLight() ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/20 text-red-300 border-red-500/30'">
                        <i class="pi pi-lock text-[10px]"></i> Voting Locked
                      </span>
                    }

                    @if (stats.poll.showCorrectAnswer && stats.poll.correctOptionId !== undefined) {
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-600 text-white shadow-sm shadow-emerald-600/30">
                        <i class="pi pi-check-circle text-xs"></i> Answer Revealed
                      </span>
                    }
                  </div>

                  <h1 class="text-base sm:text-lg md:text-xl lg:text-2xl font-bold tracking-normal leading-snug max-w-3xl mx-auto px-2 break-words"
                    [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                    {{ stats.poll.question }}
                  </h1>

                  <!-- Slim TV Stage Progress Bar -->
                  @if (remainingSeconds() !== null && remainingSeconds()! > 0) {
                    <div class="max-w-xs sm:max-w-sm mx-auto h-1.5 w-full rounded-full overflow-hidden mt-1.5"
                      [ngClass]="isLight() ? 'bg-slate-200' : 'bg-slate-800/80'">
                      <div class="h-full transition-all duration-300 ease-linear rounded-full"
                        [style.width.%]="timerPercent()"
                        [ngClass]="{
                          'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]': remainingSeconds()! > 10,
                          'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                          'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]': remainingSeconds()! <= 5
                        }">
                      </div>
                    </div>
                  }
                </div>

                <!-- Hidden Results Overlay Mode -->
                @if (!stats.poll.showResults) {
                  <div class="max-w-lg sm:max-w-xl mx-auto p-5 sm:p-6 rounded-2xl text-center space-y-2.5 sm:space-y-3 border shadow-xl w-full transition-colors my-2"
                    [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-200/40' : 'bg-slate-900/90 border-slate-800 shadow-slate-950/60'">
                    <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto text-lg sm:text-xl animate-soft-pulse shadow-md"
                      [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-600/20 text-indigo-400'">
                      <i class="pi pi-eye-slash"></i>
                    </div>
                    <div class="space-y-1">
                      <h3 class="text-base sm:text-lg font-bold tracking-tight" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                        Voting in progress...
                      </h3>
                      <p class="text-xs sm:text-sm max-w-md mx-auto" [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                        Audience answers are being recorded live. Results will appear on this screen once revealed by host.
                      </p>
                    </div>
                    <div class="pt-1 flex items-center justify-center gap-2 font-bold text-xs sm:text-sm text-indigo-600 dark:text-indigo-400">
                      <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{{ stats.totalVotes }} participant{{ stats.totalVotes === 1 ? '' : 's' }} answered</span>
                    </div>
                  </div>
                } @else {
                  <!-- Fixed Screen Poll Results Options (No Scrolling, Compact) -->
                  <div class="w-full max-w-4xl mx-auto overflow-hidden my-auto grid gap-2 sm:gap-2.5"
                    [ngClass]="stats.poll.options.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-xl'">
                    @for (opt of stats.poll.options; track opt.id; let last = $last) {
                      <div class="p-2 sm:p-2.5 px-3 sm:px-4 rounded-xl border relative overflow-hidden transition-all duration-300 shadow-2xs flex items-center justify-between gap-2.5 min-h-[2.75rem] sm:min-h-[3rem]"
                        [class.sm:col-span-2]="stats.poll.options.length % 2 !== 0 && last"
                        [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                          ? (isLight() ? 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-50/90 shadow-emerald-500/10' : 'border-emerald-500 ring-2 ring-emerald-500/40 bg-emerald-950/70 shadow-emerald-500/20')
                          : (stats.poll.showCorrectAnswer && stats.poll.correctOptionId !== undefined && stats.poll.correctOptionId !== opt.id
                            ? (isLight() ? 'bg-white/60 border-slate-200/60 opacity-60' : 'bg-slate-900/60 border-slate-800/60 opacity-50')
                            : (isLeadingOption(stats, opt.id) && stats.totalVotes > 0
                              ? (isLight() ? 'border-amber-400/90 ring-1 ring-amber-400/30 bg-amber-50/20' : 'border-amber-400/60 ring-1 ring-amber-400/30 bg-slate-900/95') 
                              : (isLight() ? 'bg-white border-slate-200/90 shadow-slate-100' : 'bg-slate-900/90 border-slate-800')))">
                        <!-- Animated Progress bar background -->
                        <div 
                          class="absolute top-0 bottom-0 left-0 transition-all duration-700 ease-out" 
                          [style.width.%]="stats.percentages[opt.id] || 0"
                          [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                            ? (isLight() ? 'bg-emerald-300/40' : 'bg-gradient-to-r from-emerald-500/45 via-emerald-400/30 to-green-500/20')
                            : (isLeadingOption(stats, opt.id) && stats.totalVotes > 0
                              ? (isLight() ? 'bg-amber-300/35' : 'bg-gradient-to-r from-amber-500/35 via-amber-400/25 to-yellow-500/15') 
                              : (isLight() ? 'bg-indigo-100/70' : 'bg-gradient-to-r from-indigo-600/30 via-indigo-500/20 to-blue-500/15'))">
                        </div>

                        <!-- Option Number & Text -->
                        <div class="relative z-10 flex items-center gap-2 sm:gap-2.5 flex-1 min-w-0">
                          <div class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 border shadow-2xs"
                            [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : (isLeadingOption(stats, opt.id) && stats.totalVotes > 0
                                ? (isLight() ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-400/30 text-amber-200 border-amber-400/40') 
                                : (isLight() ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'))">
                            {{ opt.id }}
                          </div>
                          <div class="text-xs sm:text-sm font-semibold leading-snug break-words flex-1"
                            [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                              ? (isLight() ? 'text-emerald-950 font-bold' : 'text-emerald-100 font-bold')
                              : (isLight() ? 'text-slate-800' : 'text-slate-100')">
                            {{ opt.text }}
                          </div>
                          @if (stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id) {
                            <span class="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1 shrink-0 bg-emerald-600 text-white shadow-2xs">
                              <i class="pi pi-check text-[10px]"></i> Correct
                            </span>
                          } @else if (isLeadingOption(stats, opt.id) && stats.totalVotes > 0) {
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 shrink-0 shadow-2xs"
                              [ngClass]="isLight() ? 'bg-amber-100 border border-amber-300 text-amber-800' : 'bg-amber-400/20 border border-amber-400/40 text-amber-300'">
                              🏆
                            </span>
                          }
                        </div>

                        <!-- Percentage & Votes count -->
                        <div class="relative z-10 text-right shrink-0 pl-2 flex flex-col items-end justify-center">
                          <div class="text-base sm:text-lg md:text-xl font-bold font-mono leading-none"
                            [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                              ? (isLight() ? 'text-emerald-800 font-black' : 'text-emerald-300 font-black')
                              : (isLeadingOption(stats, opt.id) && stats.totalVotes > 0
                                ? (isLight() ? 'text-amber-700' : 'text-amber-300') 
                                : (isLight() ? 'text-slate-900' : 'text-white'))">
                            {{ stats.percentages[opt.id] || 0 }}%
                          </div>
                          <div class="text-[10px] sm:text-[11px] font-medium mt-0.5"
                            [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                              ? (isLight() ? 'text-emerald-700 font-semibold' : 'text-emerald-400 font-semibold')
                              : 'text-slate-400 dark:text-slate-500'">
                            {{ stats.votesPerOption[opt.id] || 0 }} votes
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              } @else {
                <!-- Waiting Screen on Right Side -->
                <div class="text-center py-10 sm:py-14 space-y-4 sm:space-y-5 rounded-3xl sm:rounded-4xl p-8 sm:p-12 border shadow-2xl max-w-xl 2xl:max-w-2xl mx-auto w-full transition-colors my-auto"
                  [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800/80'">
                  <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-full border flex items-center justify-center mx-auto text-2xl sm:text-3xl animate-bounce"
                    [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-900 text-indigo-400 border-slate-800'">
                    <i class="pi pi-hourglass"></i>
                  </div>
                  <h2 class="text-2xl sm:text-3xl font-black" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">Waiting for Presenter to launch poll...</h2>
                  <p class="max-w-md mx-auto text-xs sm:text-sm" [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                    Scan the QR code on the left or enter PIN <span class="font-mono font-bold" [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">{{ roomCode() }}</span> to join this session.
                  </p>
                </div>
              }
            </div>

          </div>
        }
      </main>

      <!-- Floating Overview Toggle Pill (Available anytime for presenter) -->
      <div class="absolute bottom-3 right-4 z-50 flex items-center gap-2">
        @if (room()?.status !== 'completed' && room()?.mode !== 'survey') {
          <button
            type="button"
            (click)="toggleOverviewMode()"
            class="px-3.5 py-1.5 rounded-full text-xs font-bold shadow-lg border backdrop-blur-md transition-all cursor-pointer flex items-center gap-1.5"
            [ngClass]="isOverviewMode() 
              ? (isLight() ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-200' : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-950')
              : (isLight() ? 'bg-white/95 text-slate-700 border-slate-200 hover:bg-slate-100 shadow-slate-200' : 'bg-slate-900/95 text-slate-300 border-slate-700 hover:bg-slate-800 shadow-slate-950')">
            <i class="pi" [ngClass]="isOverviewMode() ? 'pi-desktop' : 'pi-chart-bar'"></i>
            <span>{{ isOverviewMode() ? 'Live Stage' : 'Overview Results' }}</span>
          </button>
        }
      </div>
    </div>
  `
})
export class StageComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pollService = inject(MatiPollService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  hasMounted = signal<boolean>(false);
  currentTheme = signal<'dark' | 'light'>(this.resolveInitialStageTheme());

  roomCode = signal<string>('MATI01');
  pollStats = signal<PollStats | null>(null);
  room = signal<Room | null>(null);
  rawPolls = signal<Poll[]>([]);
  polls = computed(() => {
    const list = this.rawPolls();
    const sel = this.room()?.selectedPollIds;
    if (sel && Array.isArray(sel) && sel.length > 0) {
      const filtered = list.filter(p => sel.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return list;
  });
  sessionStats = signal<DetailedSessionSummary>({
    totalQuestions: 0,
    totalVotes: 0,
    totalScoredQuestions: 0,
    overallAccuracy: 0,
    hasScoredQuestions: false,
    topConsensusPercentage: 0,
    questionResults: [],
    leaderboard: []
  });
  qrCodeDataUrl = signal<string>('');
  fullJoinUrl = signal<string>('');
  joinUrlShort = signal<string>('');

  // Projector / TV Theme: light vs dark
  isLight = computed(() => this.currentTheme() === 'light');

  // Overview Results mode and navigation state
  isOverviewMode = signal<boolean>(false);
  overviewTab = signal<'leaderboard' | 'breakdown' | 'spotlight' | 'insights'>('leaderboard');
  spotlightIndex = signal<number>(0);
  overviewFilter = signal<string>('all');

  leaderboardTop3 = computed(() => {
    const list = this.sessionStats().leaderboard || [];
    return {
      first: list[0] || null,
      second: list[1] || null,
      third: list[2] || null
    };
  });

  leaderboardRest = computed(() => {
    const list = this.sessionStats().leaderboard || [];
    return list.slice(3);
  });

  currentSpotlightQuestion = computed(() => {
    const list = this.sessionStats().questionResults;
    if (!list || list.length === 0) return null;
    const idx = Math.max(0, Math.min(this.spotlightIndex(), list.length - 1));
    return list[idx];
  });

  filteredQuestionResults = computed(() => {
    const list = this.sessionStats().questionResults;
    const filter = this.overviewFilter();
    if (filter === 'all') return list;
    return list.filter(q => q.pollId === filter || q.order.toString() === filter);
  });

  highestConsensusQuestion = computed(() => {
    const list = this.sessionStats().questionResults;
    if (!list || list.length === 0) return null;
    return [...list].sort((a, b) => b.winningPercentage - a.winningPercentage)[0];
  });

  highestAccuracyQuestion = computed(() => {
    const list = this.sessionStats().questionResults.filter(q => q.correctOptionId !== undefined);
    if (!list || list.length === 0) return null;
    return [...list].sort((a, b) => b.correctPercentage - a.correctPercentage)[0];
  });

  toughestQuestion = computed(() => {
    const list = this.sessionStats().questionResults.filter(q => q.correctOptionId !== undefined && q.totalVotes > 0);
    if (!list || list.length === 0) return null;
    return [...list].sort((a, b) => a.correctPercentage - b.correctPercentage)[0];
  });

  // Total question and vote counts for completed stage
  totalQuestionsCount = computed(() => Math.max(this.polls().length, this.sessionStats().totalQuestions));
  totalVotesCount = computed(() => this.sessionStats().totalVotes);

  joinDomain = computed(() => {
    if (!this.isBrowser) return 'mati.app';
    return window.location.host;
  });

  domainFontSizeClass = computed(() => {
    const len = this.joinDomain().length;
    if (len > 24) return 'text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl';
    if (len > 18) return 'text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl';
    if (len > 12) return 'text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl';
    return 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl';
  });

  formattedPin = computed(() => {
    const code = (this.roomCode() || '').trim();
    if (!code) return '';
    if (/^\d{6,7}$/.test(code)) {
      return '#' + code.slice(0, 4) + ' ' + code.slice(4);
    }
    return '#' + code;
  });

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

  availableRooms = signal<Room[]>([]);
  autoSyncWithPresenter = signal<boolean>(true);
  recentlySwitchedNotice = signal<string | null>(null);

  private allRoomsSub?: Subscription;
  private broadcastSub?: Subscription;
  private routeParamSub?: Subscription;
  private switchTimeout: any = null;

  private pollSub?: Subscription;
  private roomSub?: Subscription;
  private pollsListSub?: Subscription;

  ngOnInit() {
    this.allRoomsSub = this.pollService.listenToRooms().subscribe(rooms => {
      this.availableRooms.set(rooms);
    });

    this.routeParamSub = this.route.paramMap.subscribe(params => {
      const codeFromRoute = params.get('roomCode');
      if (codeFromRoute) {
        this.switchActiveRoom(codeFromRoute.toUpperCase(), false);
      } else {
        const currentBroadcast = this.pollService.getActiveBroadcastRoom();
        this.switchActiveRoom(currentBroadcast, false);
      }
    });

    this.route.queryParamMap.subscribe(qp => {
      if (qp.get('view') === 'overview' || qp.get('overview') === 'true') {
        this.isOverviewMode.set(true);
        this.fetchSessionSummary(this.roomCode());
      }
    });

    // Auto-sync whenever the presenter switches active group/room in Controller
    this.broadcastSub = this.pollService.listenToActiveBroadcastRoom().subscribe(broadcastCode => {
      if (!broadcastCode) return;
      const target = broadcastCode.toUpperCase();
      if (this.autoSyncWithPresenter() && target !== this.roomCode()) {
        console.info(`[Stage TV] Presenter switched group/room to ${target}. Updating projection stage...`);
        this.switchActiveRoom(target, true);
      }
    });
  }

  ngAfterViewInit() {
    if (this.isBrowser) {
      setTimeout(() => {
        this.hasMounted.set(true);
      }, 250);
    }
  }

  ngOnDestroy() {
    this.allRoomsSub?.unsubscribe();
    this.broadcastSub?.unsubscribe();
    this.routeParamSub?.unsubscribe();
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.stopLocalTimer();
    if (this.switchTimeout) clearTimeout(this.switchTimeout);
  }

  onManualRoomChange(newCode: string) {
    if (!newCode) return;
    this.switchActiveRoom(newCode, false);
    this.pollService.broadcastActiveRoom(newCode);
    this.showSwitchedNotice(`Projection switched to ${newCode}`);
  }

  toggleAutoSync() {
    this.autoSyncWithPresenter.update(v => !v);
    if (this.autoSyncWithPresenter()) {
      const currentBroadcast = this.pollService.getActiveBroadcastRoom();
      if (currentBroadcast && currentBroadcast !== this.roomCode()) {
        this.switchActiveRoom(currentBroadcast, true);
      } else {
        this.showSwitchedNotice('Auto-Sync Enabled: TV will follow presenter');
      }
    } else {
      this.showSwitchedNotice(`Room Locked to ${this.roomCode()}`);
    }
  }

  showSwitchedNotice(msg: string) {
    this.recentlySwitchedNotice.set(msg);
    if (this.switchTimeout) clearTimeout(this.switchTimeout);
    this.switchTimeout = setTimeout(() => {
      this.recentlySwitchedNotice.set(null);
    }, 4000);
  }

  switchActiveRoom(code: string, isFromBroadcast: boolean) {
    const target = (code || 'MATI01').toUpperCase();
    if (target === this.roomCode() && this.roomSub) {
      return;
    }

    // Cleanly cancel previous room listeners and reset previous room state
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.stopLocalTimer();

    this.pollStats.set(null);
    this.room.set(null);
    this.rawPolls.set([]);
    this.sessionStats.set({
      totalQuestions: 0,
      totalVotes: 0,
      totalScoredQuestions: 0,
      overallAccuracy: 0,
      hasScoredQuestions: false,
      topConsensusPercentage: 0,
      questionResults: []
    });
    this.remainingSeconds.set(null);

    // Synchronously resolve and set target room theme so UI does not flash dark mode
    this.currentTheme.set(this.resolveThemeForRoom(target));

    this.roomCode.set(target);
    this.setupUrls(target);
    this.generateQr(target);
    this.listenToPoll(target);
    this.listenToRoom(target);
    this.listenToRoomPolls(target);

    if (isFromBroadcast) {
      this.showSwitchedNotice(`Live Room Switched to ${target}`);
    }
  }

  private resolveInitialStageTheme(): 'dark' | 'light' {
    if (!this.isBrowser) return 'dark';
    try {
      let targetCode = this.route.snapshot?.paramMap?.get('roomCode') || '';
      if (!targetCode && typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const stageIdx = parts.indexOf('stage');
        if (stageIdx !== -1 && parts[stageIdx + 1]) {
          targetCode = parts[stageIdx + 1];
        }
      }
      targetCode = (targetCode || this.pollService.getActiveBroadcastRoom() || 'MATI01').toUpperCase();
      return this.resolveThemeForRoom(targetCode);
    } catch {
      return 'dark';
    }
  }

  private resolveThemeForRoom(code: string): 'dark' | 'light' {
    if (!this.isBrowser) return 'dark';
    try {
      const normalizedCode = (code || 'MATI01').toUpperCase();
      const saved = localStorage.getItem(`mati_stage_theme_${normalizedCode}`);
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
      const cached = this.pollService.getCachedRoom(normalizedCode);
      if (cached?.theme) {
        return cached.theme;
      }
      const last = localStorage.getItem('mati_stage_theme_last');
      if (last === 'light' || last === 'dark') {
        return last;
      }
    } catch {
      // fallback
    }
    return 'dark';
  }

  private listenToRoomPolls(code: string) {
    this.pollsListSub?.unsubscribe();
    this.pollsListSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.rawPolls.set(list);
      if (this.room()?.status === 'completed') {
        this.fetchSessionSummary(code);
      }
    });
  }

  private listenToRoom(code: string) {
    this.roomSub?.unsubscribe();
    this.roomSub = this.pollService.listenToRoom(code).subscribe(roomData => {
      this.room.set(roomData);
      if (roomData?.theme) {
        this.currentTheme.set(roomData.theme);
        if (this.isBrowser) {
          try {
            localStorage.setItem(`mati_stage_theme_${code.toUpperCase()}`, roomData.theme);
            localStorage.setItem('mati_stage_theme_last', roomData.theme);
          } catch {}
        }
      }
      if (roomData?.status === 'completed') {
        this.fetchSessionSummary(code);
      }
    });
  }

  private async fetchSessionSummary(code: string) {
    try {
      const summary = await this.pollService.getSessionSummary(code);
      this.sessionStats.set(summary);
      if (summary.hasScoredQuestions && this.room()?.status === 'completed' && this.overviewTab() === 'breakdown') {
        this.overviewTab.set('leaderboard');
      }
    } catch (err) {
      console.warn('[Stage] Could not fetch session summary:', err);
    }
  }

  private setupUrls(code: string) {
    let origin = 'http://localhost:4200';
    if (this.isBrowser) {
      origin = window.location.origin;
    }
    const full = `${origin}/join/${code}`;
    this.fullJoinUrl.set(full);
    this.joinUrlShort.set(origin.replace(/^https?:\/\//, '') + `/join/${code}`);
  }

  private async generateQr(code: string) {
    if (!this.isBrowser) return;
    try {
      const url = this.fullJoinUrl();
      const qr = await QRCode.toDataURL(url, {
        width: 360,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      });
      this.qrCodeDataUrl.set(qr);
    } catch (e) {
      console.warn('QR code generation error:', e);
    }
  }

  private currentActivePollIdOnStage: string | null = null;

  private listenToPoll(code: string) {
    this.pollSub?.unsubscribe();
    this.pollSub = this.pollService.listenToActivePoll(code).subscribe(stats => {
      this.pollStats.set(stats);
      
      const newPollId = stats?.poll?.id || null;
      if (newPollId !== this.currentActivePollIdOnStage) {
        this.currentActivePollIdOnStage = newPollId;
        // Brand new question: reset timer state immediately so old "Time's Up" never shows!
        this.stopLocalTimer(true);
      }

      if (stats?.timerEndsAt && stats.timerEndsAt > 0) {
        const diff = Math.ceil((stats.timerEndsAt - Date.now()) / 1000);
        if (diff <= 0) {
          this.remainingSeconds.set(0);
          this.stopLocalTimer(false);
        } else {
          this.timerDuration.set(stats.timerDuration || 30);
          this.startLocalTimer(stats.timerEndsAt);
        }
      } else {
        this.stopLocalTimer(true);
      }
    });
  }

  private startLocalTimer(timerEndsAt: number) {
    this.stopLocalTimer(false);
    const updateCountdown = () => {
      const diff = Math.ceil((timerEndsAt - Date.now()) / 1000);
      if (diff <= 0) {
        this.remainingSeconds.set(0);
        this.stopLocalTimer(false);
      } else {
        this.remainingSeconds.set(diff);
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

  isLeadingOption(stats: PollStats, optionId: number): boolean {
    if (!stats || stats.totalVotes === 0) return false;
    let maxVotes = 0;
    for (const opt of stats.poll.options) {
      const v = stats.votesPerOption[opt.id] || 0;
      if (v > maxVotes) maxVotes = v;
    }
    if (maxVotes === 0) return false;
    return (stats.votesPerOption[optionId] || 0) === maxVotes;
  }

  toggleOverviewMode() {
    this.isOverviewMode.update(v => !v);
    if (this.isOverviewMode()) {
      this.fetchSessionSummary(this.roomCode());
    }
  }

  setOverviewTab(tab: 'leaderboard' | 'breakdown' | 'spotlight' | 'insights') {
    this.overviewTab.set(tab);
    this.fetchSessionSummary(this.roomCode());
  }

  setSpotlightIndex(index: number) {
    const total = this.sessionStats().questionResults.length;
    if (total === 0) return;
    this.spotlightIndex.set(Math.max(0, Math.min(index, total - 1)));
  }

  nextSpotlight() {
    const total = this.sessionStats().questionResults.length;
    if (total === 0) return;
    if (this.spotlightIndex() < total - 1) {
      this.spotlightIndex.update(i => i + 1);
    }
  }

  prevSpotlight() {
    if (this.spotlightIndex() > 0) {
      this.spotlightIndex.update(i => i - 1);
    }
  }

  getOptionLetter(idx: number): string {
    return String.fromCharCode(65 + (idx % 26));
  }

  goBack() {
    if (this.isBrowser && window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/control', this.roomCode()]);
    }
  }

  toggleFullscreen() {
    if (!this.isBrowser) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  toggleTheme() {
    const nextTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.currentTheme.set(nextTheme);
    if (this.isBrowser) {
      try {
        localStorage.setItem(`mati_stage_theme_${this.roomCode()}`, nextTheme);
        localStorage.setItem('mati_stage_theme_last', nextTheme);
      } catch {}
    }
  }
}
