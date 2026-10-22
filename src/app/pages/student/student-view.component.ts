import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService, normalizeRoomCode } from '../../services/mati-poll.service';
import { DetailedSessionSummary, Poll, PollStats, Room } from '../../models/poll.model';


@Component({
  selector: 'app-student-view',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
          @if (!showEnterCodeCard()) {
            @if (room()?.status === 'completed') {
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                <i class="pi pi-check-circle text-[9px]"></i> Ended
              </span>
            } @else if (room()?.mode === 'survey') {
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-800 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                <i class="pi pi-list-check text-[9px]"></i> Survey
              </span>
            } @else if (room()?.status === 'draft' || room()?.status === 'closed' || !room()?.activePollId) {
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Standby
              </span>
            } @else {
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live
              </span>
            }
          }
          <button
            type="button"
            (click)="openNameModal()"
            title="Click to set or change your name"
            class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer max-w-[130px]">
            <i class="pi pi-user text-[10px] text-indigo-600 dark:text-indigo-400 shrink-0"></i>
            <span class="truncate">{{ hasCustomName() ? participantName() : 'Set Name' }}</span>
            <i class="pi pi-pencil text-[9px] opacity-70 shrink-0"></i>
          </button>
          <button 
            type="button" 
            (click)="openChangeRoomModal()" 
            title="Click to enter or change event PIN"
            class="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
            <span>#{{ roomCode() }}</span>
            <i class="pi pi-pencil text-[9px] opacity-70"></i>
          </button>
        </div>
      </header>

      <!-- Content Area -->
      <main class="p-4 sm:p-5 flex-1 flex flex-col justify-start overflow-y-auto">
        @if (showEnterCodeCard()) {
          <!-- Slido-Style Participant Join Card -->
          <div class="my-auto py-6 space-y-6 animate-fadein text-center">
            <div class="space-y-2">
              <div class="w-16 h-16 rounded-3xl bg-indigo-600 flex items-center justify-center text-white text-3xl font-black mx-auto shadow-xl shadow-indigo-600/30">
                ម
              </div>
              <h2 class="text-2xl font-black text-slate-900 dark:text-white">
                Join an Event
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Enter the code shown on the screen (e.g. <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">#482915</span>)
              </p>
            </div>

            <div class="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl space-y-4">
              <div class="text-left space-y-1.5">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  Your Name (shown on Leaderboard)
                </label>
                <div class="relative">
                  <i class="pi pi-user absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 text-sm"></i>
                  <input
                    type="text"
                    [ngModel]="inputParticipantName()"
                    (ngModelChange)="inputParticipantName.set($event)"
                    (keyup.enter)="submitJoinCode()"
                    placeholder="Enter your name..."
                    class="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-2xl text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 placeholder:font-normal" />
                </div>
              </div>

              <div class="text-left space-y-1.5">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
                  Event PIN Code
                </label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500 font-bold font-mono text-xl">#</span>
                  <input
                    type="text"
                    [ngModel]="inputJoinCode()"
                    (ngModelChange)="inputJoinCode.set($event)"
                    (keyup.enter)="submitJoinCode()"
                    placeholder="e.g. 482915"
                    class="w-full pl-10 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:border-indigo-500 rounded-2xl text-slate-900 dark:text-white font-mono font-black text-xl uppercase tracking-wider outline-none focus:ring-4 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400 placeholder:normal-case placeholder:font-normal placeholder:text-base text-center" />
                </div>
              </div>

              <button
                type="button"
                (click)="submitJoinCode()"
                class="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-black text-base rounded-2xl shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-2">
                <span>Join Event</span>
                <i class="pi pi-arrow-right"></i>
              </button>

              @if (activeRooms().length > 0) {
                <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-left">
                  <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Active Sessions ({{ activeRooms().length }})</span>
                  </div>
                  <div class="space-y-1.5 max-h-48 overflow-y-auto">
                    @for (ar of activeRooms(); track ar.code) {
                      <button
                        type="button"
                        (click)="joinQuick(ar.code)"
                        class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer">
                        <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                          {{ ar.title || ('Mati #' + ar.code) }}
                        </span>
                        <span class="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                          #{{ ar.code }}
                        </span>
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
        } @else {
        <!-- Prompt participant to set their name if they haven't set one yet -->
        @if (!hasCustomName() && !dismissedNameBanner()) {
          <div class="mb-4 p-3.5 bg-indigo-50/90 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 rounded-2xl shadow-xs space-y-2.5 animate-fadein">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2 text-xs font-bold text-indigo-950 dark:text-indigo-200">
                <span class="text-base">👋</span>
                <span>Set your name for the Top Leaderboard!</span>
              </div>
              <button
                type="button"
                (click)="dismissedNameBanner.set(true)"
                title="Dismiss"
                class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer">
                <i class="pi pi-times text-[10px]"></i>
              </button>
            </div>
            <div class="flex items-center gap-2">
              <input
                type="text"
                [ngModel]="inputParticipantName()"
                (ngModelChange)="inputParticipantName.set($event)"
                (keyup.enter)="saveParticipantName()"
                placeholder="Enter your name..."
                class="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
              <button
                type="button"
                (click)="saveParticipantName()"
                [disabled]="!inputParticipantName().trim()"
                class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0">
                Save
              </button>
            </div>
          </div>
        }
        @if (room()?.status === 'inactive' || room()?.status === 'closed') {
          <!-- Session Inactive Screen for Participant Mobile -->
          <div class="w-full my-auto py-10 animate-fadein">
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-7 text-center shadow-lg space-y-4">
              <div class="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto text-2xl border border-slate-200 dark:border-slate-700">
                <i class="pi pi-pause-circle"></i>
              </div>
              <div class="space-y-1.5">
                <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  Session Inactive • #{{ roomCode() }}
                </span>
                <h2 class="text-lg font-black text-slate-900 dark:text-white pt-1">
                  This Mati session is currently paused
                </h2>
                <p class="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Room <span class="font-mono font-bold text-indigo-600 dark:text-indigo-400">#{{ roomCode() }}</span> is marked as inactive by the host. Questions will appear automatically as soon as the session is activated!
                </p>
              </div>
              <div class="pt-2">
                <button
                  type="button"
                  (click)="openChangeRoomModal()"
                  class="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                  Switch Room Code
                </button>
              </div>
            </div>
          </div>
        } @else if (room()?.status === 'completed' || (room()?.mode === 'survey' && showSurveyCompletedOverview())) {
          <!-- Complete Session & Results Overview Screen for Participant Mobile -->
          <div class="w-full space-y-4 my-auto animate-fadein pb-4">
            
            <!-- 1. Top Card: Differentiated for Quiz vs Survey -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-7 text-center shadow-lg relative overflow-hidden">
              <!-- Soft festive background confetti dots -->
              <div class="absolute -top-12 -left-12 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl pointer-events-none"></div>
              <div class="absolute -bottom-12 -right-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

              @if (studentScoredQuestionsCount() > 0) {
                <!-- QUIZ MODE: Celebratory Podium Icon & Rank Badge -->
                <div class="relative w-28 h-28 mx-auto flex items-center justify-center mb-3">
                  @if (myRank() === 1) {
                    <!-- 1st Place Trophy -->
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
                      <circle cx="60" cy="50" r="14" fill="#FEF3C7" stroke="#F59E0B" stroke-width="2" />
                      <text x="60" y="55" font-size="13" font-weight="900" text-anchor="middle" fill="#92400E" font-family="sans-serif">1</text>
                    </svg>
                  } @else if (myRank() === 2) {
                    <!-- 2nd Place Silver Medal -->
                    <div class="w-20 h-20 rounded-full bg-linear-to-b from-slate-200 to-slate-400 p-1 shadow-lg ring-4 ring-slate-300/40 flex items-center justify-center">
                      <div class="w-full h-full rounded-full bg-slate-100 dark:bg-slate-800 flex flex-col items-center justify-center border-2 border-slate-300">
                        <span class="text-2xl">🥈</span>
                        <span class="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">2nd</span>
                      </div>
                    </div>
                  } @else if (myRank() === 3) {
                    <!-- 3rd Place Bronze Medal -->
                    <div class="w-20 h-20 rounded-full bg-linear-to-b from-amber-600 to-amber-800 p-1 shadow-lg ring-4 ring-amber-600/30 flex items-center justify-center">
                      <div class="w-full h-full rounded-full bg-amber-50 dark:bg-slate-800 flex flex-col items-center justify-center border-2 border-amber-600">
                        <span class="text-2xl">🥉</span>
                        <span class="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">3rd</span>
                      </div>
                    </div>
                  } @else {
                    <!-- Top Participant Badge -->
                    <div class="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border-2 border-indigo-200 dark:border-indigo-800 flex flex-col items-center justify-center shadow-md">
                      <span class="text-2xl">🎖️</span>
                      <span class="text-xs font-black font-mono">#{{ myRank() }}</span>
                    </div>
                  }
                </div>

                <!-- Main Heading & Name -->
                <div class="space-y-1">
                  <div class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    <span>🎉 សូមអបអរសាទរ! Congratulations</span>
                  </div>
                  <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                    @if (myRank() === 1) {
                      You Won 1<sup>st</sup> Place! 🥇
                    } @else if (myRank() === 2) {
                      You Finished 2<sup>nd</sup> Place! 🥈
                    } @else if (myRank() === 3) {
                      You Finished 3<sup>rd</sup> Place! 🥉
                    } @else {
                      You Finished #{{ myRank() }}! 🎯
                    }
                  </h2>
                  <div class="flex items-center justify-center gap-1.5 text-sm sm:text-base font-bold text-slate-700 dark:text-slate-300">
                    <span>Well done, {{ participantName() }}!</span>
                    <button
                      type="button"
                      (click)="openNameModal()"
                      title="Edit your display name"
                      class="p-1 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer inline-flex items-center">
                      <i class="pi pi-pencil text-xs"></i>
                    </button>
                  </div>
                </div>

                <!-- Primary Stats Table -->
                <div class="max-w-xs mx-auto py-3.5 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Correct answers:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                      {{ studentCorrectAnswersCount() }}/{{ studentScoredQuestionsCount() }}
                    </span>
                  </div>
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Your Accuracy:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base">
                      {{ studentAccuracyPercent() }}%
                    </span>
                  </div>
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Total Time Spent:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base text-indigo-600 dark:text-indigo-400">
                      ⏱️ {{ myTotalTime() }}s
                    </span>
                  </div>
                  <div class="flex items-center justify-between pt-1">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Participation:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base">
                      {{ progressPercent() }}% ({{ answeredCount() }}/{{ polls().length }})
                    </span>
                  </div>
                </div>

                <!-- Real Class Leaderboard Cards -->
                <div class="space-y-2.5 pt-2 max-w-sm mx-auto text-left">
                  <div class="flex items-center justify-between px-1 gap-2 flex-wrap">
                    <span class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      🏆 Class Leaderboard
                    </span>
                    <div class="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[10px] font-bold">
                      <button
                        type="button"
                        (click)="studentLeaderboardLimit.set(5)"
                        [ngClass]="effectiveLeaderboardLimit() === 5 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'"
                        class="px-2 py-0.5 rounded cursor-pointer transition-colors">
                        Top 5
                      </button>
                      <button
                        type="button"
                        (click)="studentLeaderboardLimit.set(10)"
                        [ngClass]="effectiveLeaderboardLimit() === 10 ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'"
                        class="px-2 py-0.5 rounded cursor-pointer transition-colors">
                        Top 10
                      </button>
                      <button
                        type="button"
                        (click)="studentLeaderboardLimit.set('all')"
                        [ngClass]="effectiveLeaderboardLimit() === 'all' ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400'"
                        class="px-2 py-0.5 rounded cursor-pointer transition-colors">
                        All
                      </button>
                    </div>
                  </div>

                  <!-- Top 1, 2, 3 -->
                  @for (entry of displayedTop3Leaderboard(); track entry.voterId) {
                    <div class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl border transition-all text-sm"
                      [ngClass]="entry.voterId === voterId() 
                        ? 'bg-indigo-600 text-white font-bold shadow-md border-indigo-700 ring-2 ring-indigo-400/50' 
                        : (entry.rank === 1 
                          ? 'bg-amber-500/10 border-amber-300 dark:border-amber-700/60 text-slate-900 dark:text-white' 
                          : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200')">
                      
                      <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0"
                          [ngClass]="entry.voterId === voterId()
                            ? 'bg-white text-indigo-700 shadow-xs'
                            : (entry.rank === 1 ? 'bg-amber-400 text-amber-950' : (entry.rank === 2 ? 'bg-slate-300 text-slate-900' : 'bg-amber-600 text-white'))">
                          {{ entry.rank === 1 ? '🥇' : (entry.rank === 2 ? '🥈' : '🥉') }}
                        </span>
                        <div class="truncate">
                          <span class="font-bold">{{ entry.voterName }}</span>
                          @if (entry.voterId === voterId()) {
                            <span class="ml-1 text-[10px] opacity-90 px-1.5 py-0.5 bg-white/25 rounded-md">you</span>
                          }
                        </div>
                      </div>

                      <div class="flex items-center gap-2 shrink-0 font-mono text-xs"
                        [ngClass]="entry.voterId === voterId() ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'">
                        <span class="font-bold" [ngClass]="entry.voterId === voterId() ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'">
                          {{ entry.correctAnswers }}/{{ studentScoredQuestionsCount() }}
                        </span>
                        <span>•</span>
                        <span>⏱️ {{ entry.totalTimeSeconds }}s</span>
                      </div>
                    </div>
                  }

                  <!-- Ranks 4 to 5 / 10 / All -->
                  @if (displayedRestLeaderboard().length > 0) {
                    <div class="pt-1.5 space-y-1.5">
                      <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
                        @if (effectiveLeaderboardLimit() === 5) {
                          Ranks 4 – 5
                        } @else if (effectiveLeaderboardLimit() === 10) {
                          Ranks 4 – 10
                        } @else {
                          Ranks 4 – {{ (sessionStats().leaderboard || []).length }} (All)
                        }
                      </div>
                      @for (entry of displayedRestLeaderboard(); track entry.voterId) {
                        <div class="flex items-center justify-between px-3.5 py-2 rounded-xl border transition-all text-xs"
                          [ngClass]="entry.voterId === voterId() 
                            ? 'bg-indigo-600 text-white font-bold shadow-md border-indigo-700 ring-2 ring-indigo-400/50' 
                            : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'">
                          <div class="flex items-center gap-2.5 min-w-0">
                            <span class="w-5 h-5 rounded-full text-[11px] font-black font-mono flex items-center justify-center shrink-0"
                              [ngClass]="entry.voterId === voterId()
                                ? 'bg-white text-indigo-700'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'">
                              {{ entry.rank }}
                            </span>
                            <div class="truncate">
                              <span class="font-bold">{{ entry.voterName }}</span>
                              @if (entry.voterId === voterId()) {
                                <span class="ml-1 text-[10px] opacity-90 px-1.5 py-0.5 bg-white/25 rounded-md">you</span>
                              }
                            </div>
                          </div>
                          <div class="flex items-center gap-2 shrink-0 font-mono text-[11px]"
                            [ngClass]="entry.voterId === voterId() ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'">
                            <span class="font-bold" [ngClass]="entry.voterId === voterId() ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'">
                              {{ entry.correctAnswers }}/{{ studentScoredQuestionsCount() }}
                            </span>
                            <span>•</span>
                            <span>⏱️ {{ entry.totalTimeSeconds }}s</span>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              } @else {
                <!-- SURVEY MODE: Celebration Icon & Card -->
                <div class="w-20 h-20 rounded-3xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 shadow-md border border-emerald-200 dark:border-emerald-800">
                  <span>📋</span>
                </div>

                <!-- Main Heading & Name -->
                <div class="space-y-1">
                  <span class="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    🎉 ការស្ទង់មតិបានបញ្ចប់ • Survey Completed
                  </span>
                  <h2 class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight pt-1">
                    Thank you, {{ participantName() }}!
                  </h2>
                  <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Your responses have been successfully recorded for room <span class="font-mono font-bold text-amber-600 dark:text-amber-400">{{ roomCode() }}</span>.
                  </p>
                </div>

                <!-- Survey Participation Stats -->
                <div class="max-w-xs mx-auto py-4 space-y-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Questions Answered:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base text-emerald-600 dark:text-emerald-400">
                      {{ answeredCount() }}/{{ polls().length }} ({{ progressPercent() }}%)
                    </span>
                  </div>
                  <div class="flex items-center justify-between pt-1">
                    <span class="text-slate-500 dark:text-slate-400 font-medium">Total Submissions:</span>
                    <span class="text-slate-900 dark:text-white font-mono font-bold text-base">
                      {{ sessionStats().totalVotes }}
                    </span>
                  </div>
                </div>

                @if (room()?.mode === 'survey' && room()?.status !== 'completed') {
                  <div class="pt-1">
                    <button
                      type="button"
                      (click)="toggleSurveyCompletedOverview()"
                      class="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all cursor-pointer">
                      ← Back to Survey Questions
                    </button>
                  </div>
                }
              }

              <!-- 2. Dual Tab Selector: "My Answers" vs "Class Results Overview" -->
              <div class="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div class="p-1 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center gap-1 max-w-xs mx-auto">
                  <button
                    type="button"
                    (click)="setStudentResultTab('my_answers')"
                    [ngClass]="studentResultTab() === 'my_answers' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400'"
                    class="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer">
                    {{ studentScoredQuestionsCount() > 0 ? 'My Answers' : 'My Responses' }}
                  </button>
                  <button
                    type="button"
                    (click)="setStudentResultTab('class_overview')"
                    [ngClass]="studentResultTab() === 'class_overview' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-600 dark:text-slate-400'"
                    class="flex-1 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer">
                    Class Results
                  </button>
                </div>
              </div>

              <!-- TAB 1: MY INDIVIDUAL RESPONSES -->
              @if (studentResultTab() === 'my_answers') {
                <div class="mt-4 space-y-3 text-left animate-fadein">
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
                        } @else if (hasVotedFor(p.id)) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shrink-0">
                            Answered
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

              <!-- TAB 2: CLASS RESULTS OVERVIEW (AGGREGATE DISTRIBUTION) -->
              @if (studentResultTab() === 'class_overview') {
                <div class="mt-4 space-y-3.5 text-left animate-fadein">
                  @for (q of sessionStats().questionResults; track q.pollId; let qIdx = $index) {
                    <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-start gap-2 flex-1 min-w-0">
                          <span class="text-xs font-black text-indigo-600 dark:text-indigo-400 font-mono">
                            Q{{ q.order || (qIdx + 1) }}
                          </span>
                          <span class="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                            {{ q.question }}
                          </span>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">
                          👥 {{ q.totalVotes }} votes
                        </span>
                      </div>

                      <!-- Options with Distribution Bars -->
                      <div class="space-y-1.5 pt-1">
                        @for (opt of q.options; track opt.id; let optIdx = $index) {
                          <div class="p-2 rounded-xl border bg-white dark:bg-slate-900 text-xs space-y-1"
                            [ngClass]="{
                              'border-emerald-500/70 bg-emerald-50/50 dark:bg-emerald-950/20': opt.isCorrect,
                              'border-indigo-400/60 bg-indigo-50/30 dark:bg-indigo-950/20': !opt.isCorrect && getVotedOptionFor(q.pollId) === opt.id,
                              'border-slate-200 dark:border-slate-800': !opt.isCorrect && getVotedOptionFor(q.pollId) !== opt.id
                            }">
                            <div class="flex items-center justify-between gap-1">
                              <div class="flex items-center gap-1.5 min-w-0">
                                <span class="font-bold text-slate-500">{{ opt.id }}.</span>
                                <span class="truncate font-medium text-slate-800 dark:text-slate-200" [ngClass]="opt.isCorrect ? 'font-bold text-emerald-900 dark:text-emerald-200' : ''">
                                  {{ opt.text }}
                                </span>
                                @if (getVotedOptionFor(q.pollId) === opt.id) {
                                  <span class="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 shrink-0 font-bold">You</span>
                                }
                                @if (opt.isCorrect) {
                                  <i class="pi pi-check text-emerald-600 dark:text-emerald-400 text-[10px] shrink-0"></i>
                                }
                              </div>
                              <span class="font-mono font-bold text-xs shrink-0" [ngClass]="opt.isCorrect ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'">
                                {{ opt.percentage }}%
                              </span>
                            </div>

                            <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div class="h-full rounded-full transition-all duration-300"
                                [style.width.%]="opt.percentage"
                                [ngClass]="opt.isCorrect ? 'bg-emerald-500' : (getVotedOptionFor(q.pollId) === opt.id ? 'bg-indigo-600' : 'bg-slate-400')">
                              </div>
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

            <!-- All Answered Quick Action Banner -->
            @if (answeredCount() === polls().length && polls().length > 0) {
              <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2 shadow-xs animate-fadein">
                <div class="flex items-center gap-2">
                  <span class="text-xl">🎉</span>
                  <div>
                    <h4 class="text-xs font-bold text-emerald-900 dark:text-emerald-200">All questions answered!</h4>
                    <p class="text-[11px] text-emerald-700 dark:text-emerald-400">View overall survey results & feedback.</p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="toggleSurveyCompletedOverview()"
                  class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 transition-all cursor-pointer shadow-xs">
                  View Overview
                </button>
              </div>
            }

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
                  @if (sPoll.isLocked) {
                    <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                      <i class="pi pi-lock text-[10px]"></i> Voting Locked
                    </span>
                  } @else if (hasVotedFor(sPoll.id)) {
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
                      (click)="!sPoll.isLocked && voteSurvey(sPoll.id, opt.id)"
                      [disabled]="isSubmitting() || sPoll.isLocked"
                      [ngClass]="getVotedOptionFor(sPoll.id) === opt.id 
                        ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 shadow-sm ring-1 ring-indigo-500' 
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'"
                      class="w-full text-left p-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 active:scale-98 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
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

                @if (hasVotedFor(sPoll.id) && !sPoll.isLocked) {
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
                  @if (isLastSurveyQuestion()) {
                    <button
                      type="button"
                      (click)="toggleSurveyCompletedOverview()"
                      class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-xs">
                      <span>View Results</span>
                      <i class="pi pi-check text-[10px]"></i>
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="nextSurveyQuestion()"
                      class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all cursor-pointer">
                      Next →
                    </button>
                  }
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

              <!-- Correct Answer Result Banner (Live Quiz Mode) -->
              @if (stats.poll.showCorrectAnswer && stats.poll.correctOptionId !== undefined) {
                <div class="p-3.5 rounded-2xl border text-center space-y-1 animate-fadein shadow-xs"
                  [ngClass]="selectedOptionId() === stats.poll.correctOptionId 
                    ? 'bg-emerald-100 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200' 
                    : 'bg-red-100 dark:bg-red-950/70 border-red-300 dark:border-red-700 text-red-900 dark:text-red-200'">
                  <div class="text-sm font-black flex items-center justify-center gap-1.5">
                    @if (selectedOptionId() === stats.poll.correctOptionId) {
                      <span>🎉 Correct Answer!</span>
                    } @else {
                      <span>❌ Incorrect</span>
                    }
                  </div>
                  <p class="text-xs opacity-90">
                    Correct choice: <span class="font-bold underline">#{{ stats.poll.correctOptionId }}</span>
                  </p>
                </div>
              }

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
                      <span class="flex items-center gap-1.5"
                        [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                          : (selectedOptionId() === opt.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-700 dark:text-slate-300')">
                        <span>{{ opt.text }}</span>
                        @if (selectedOptionId() === opt.id) {
                          <span class="text-[9px] uppercase px-1 rounded bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold">You</span>
                        }
                        @if (stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id) {
                          <span class="text-[9px] uppercase px-1.5 py-0.2 rounded bg-emerald-600 text-white font-black">✓ Correct</span>
                        }
                      </span>
                      <span class="font-mono text-slate-500">{{ stats.percentages[opt.id] || 0 }}%</span>
                    </div>
                    <div class="h-2 w-full bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all duration-500"
                        [style.width.%]="stats.percentages[opt.id] || 0"
                        [ngClass]="stats.poll.showCorrectAnswer && stats.poll.correctOptionId === opt.id
                          ? 'bg-emerald-500'
                          : (selectedOptionId() === opt.id ? 'bg-indigo-600' : 'bg-slate-400 dark:bg-slate-600')">
                      </div>
                    </div>
                  </div>
                }
              </div>
            </div>
          } @else if (stats.poll.isLocked) {
            <!-- Poll Locked Screen -->
            <div class="p-6 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-3xl text-center space-y-3 animate-fadein">
              <div class="w-12 h-12 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto text-xl">
                <i class="pi pi-lock"></i>
              </div>
              <h3 class="text-base font-bold text-amber-900 dark:text-amber-200">Voting Closed</h3>
              <p class="text-xs text-amber-700 dark:text-amber-400">
                The presenter has locked responses for this question. Look up at the screen!
              </p>

              @if (stats.poll.showResults) {
                <div class="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-800/60 space-y-2 text-left">
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
                        <div class="h-full rounded-full transition-all duration-500 bg-amber-500"
                          [style.width.%]="stats.percentages[opt.id] || 0">
                        </div>
                      </div>
                    </div>
                  }
                </div>
              }
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
      }
      </main>

      <!-- Set / Edit Participant Name Modal -->
      @if (showNameModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadein">
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">Set Your Name</h3>
                <p class="text-[11px] text-slate-500">Shown on the class leaderboard when you win</p>
              </div>
              <button
                type="button"
                (click)="showNameModal.set(false)"
                class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer">
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            <div class="relative">
              <i class="pi pi-user absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500 text-sm"></i>
              <input
                type="text"
                [ngModel]="inputParticipantName()"
                (ngModelChange)="inputParticipantName.set($event)"
                (keyup.enter)="saveParticipantName()"
                placeholder="Enter your name..."
                class="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            <button
              type="button"
              (click)="saveParticipantName()"
              [disabled]="!inputParticipantName().trim()"
              class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer">
              Save Name
            </button>
          </div>
        </div>
      }

      <!-- Switch Room Modal -->
      @if (showChangeRoomModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadein">
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-base font-black text-slate-900 dark:text-white">Switch Event / Room</h3>
                <p class="text-[11px] text-slate-500">Enter code from presenter's screen</p>
              </div>
              <button 
                type="button" 
                (click)="showChangeRoomModal.set(false)" 
                class="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center cursor-pointer">
                <i class="pi pi-times text-xs"></i>
              </button>
            </div>

            <div class="relative">
              <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500 font-bold font-mono text-base">#</span>
              <input
                type="text"
                [ngModel]="inputJoinCode()"
                (ngModelChange)="inputJoinCode.set($event)"
                (keyup.enter)="submitJoinCode()"
                placeholder="e.g. 482915"
                class="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-sm uppercase outline-none focus:ring-2 focus:ring-indigo-500 text-center" />
            </div>

            <button
              type="button"
              (click)="submitJoinCode()"
              class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer">
              Connect to Room
            </button>

            @if (activeRooms().length > 0) {
              <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Sessions ({{ activeRooms().length }})
                </div>
                <div class="space-y-1.5 max-h-40 overflow-y-auto">
                  @for (ar of activeRooms(); track ar.code) {
                    <button
                      type="button"
                      (click)="joinQuick(ar.code)"
                      class="w-full px-3 py-2 rounded-xl border flex items-center justify-between gap-2 text-left transition-colors cursor-pointer"
                      [ngClass]="ar.code === roomCode()
                        ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/50'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 bg-slate-50 dark:bg-slate-800/50'">
                      <span class="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                        {{ ar.title || ('Mati #' + ar.code) }}
                      </span>
                      <span class="text-xs font-mono font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                        #{{ ar.code }}
                      </span>
                    </button>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

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
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private pollService = inject(MatiPollService);

  showEnterCodeCard = signal<boolean>(false);
  showChangeRoomModal = signal<boolean>(false);
  showNameModal = signal<boolean>(false);
  dismissedNameBanner = signal<boolean>(false);
  hasCustomName = signal<boolean>(false);
  inputParticipantName = signal<string>('');
  inputJoinCode = signal<string>('');
  activeBroadcastRoom = signal<string | null>(null);
  studentLeaderboardLimit = signal<5 | 10 | 'all' | null>(null);

  effectiveLeaderboardLimit = computed<5 | 10 | 'all'>(() => {
    const localOverride = this.studentLeaderboardLimit();
    if (localOverride !== null) return localOverride;
    const roomLimit = this.room()?.leaderboardLimit;
    if (roomLimit === 5 || roomLimit === 10 || roomLimit === 'all') return roomLimit;
    return 'all';
  });

  displayedTop3Leaderboard = computed(() => {
    const list = this.sessionStats().leaderboard || [];
    return list.slice(0, 3);
  });

  displayedRestLeaderboard = computed(() => {
    const list = this.sessionStats().leaderboard || [];
    const limit = this.effectiveLeaderboardLimit();
    if (limit === 5) return list.slice(3, 5);
    if (limit === 10) return list.slice(3, 10);
    return list.slice(3);
  });

  roomCode = signal<string>('MATI01');
  pollStats = signal<PollStats | null>(null);
  room = signal<Room | null>(null);
  rawPolls = signal<Poll[]>([]);
  polls = computed(() => {
    const list = this.rawPolls().filter(p => !p.isSkipped);
    const sel = this.room()?.selectedPollIds;
    if (sel && Array.isArray(sel) && sel.length > 0) {
      const filtered = list.filter(p => sel.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return list;
  });
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
    questionResults: [],
    leaderboard: []
  });
  hasVoted = signal<boolean>(false);
  selectedOptionId = signal<number | null>(null);
  isSubmitting = signal<boolean>(false);

  studentResultTab = signal<'my_answers' | 'class_overview'>('my_answers');
  showSurveyCompletedOverview = signal<boolean>(false);

  toggleViewAnswers() {
    this.showAnswersBreakdown.update(v => !v);
  }

  toggleSurveyCompletedOverview() {
    this.showSurveyCompletedOverview.update(v => !v);
    if (this.showSurveyCompletedOverview()) {
      this.pollService.getSessionSummary(this.roomCode()).then(summary => {
        this.sessionStats.set(summary);
      });
    }
  }

  setStudentResultTab(tab: 'my_answers' | 'class_overview') {
    this.studentResultTab.set(tab);
    if (tab === 'class_overview') {
      this.pollService.getSessionSummary(this.roomCode()).then(summary => {
        this.sessionStats.set(summary);
      });
    }
  }

  getOptionLetter(idx: number): string {
    return String.fromCharCode(65 + (idx % 26));
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

  myLeaderboardEntry = computed(() => {
    const list = this.sessionStats().leaderboard || [];
    return list.find(e => e.voterId === this.voterId()) || null;
  });

  myRank = computed(() => {
    return this.myLeaderboardEntry()?.rank || 1;
  });

  myTotalTime = computed(() => {
    return this.myLeaderboardEntry()?.totalTimeSeconds || 0;
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
  private allRoomsSub?: Subscription;
  private currentActivePollIdOnStudent: string | null = null;

  allRooms = signal<Room[]>([]);
  activeRooms = computed(() =>
    this.allRooms().filter(
      r => r.code && !r.code.startsWith('_') && r.status !== 'inactive' && r.status !== 'closed' && r.status !== 'completed'
    )
  );

  openNameModal() {
    this.inputParticipantName.set(this.hasCustomName() ? this.participantName() : '');
    this.showNameModal.set(true);
  }

  async saveParticipantName() {
    const cleanName = this.inputParticipantName().trim();
    if (!cleanName) return;
    this.participantName.set(cleanName);
    this.hasCustomName.set(true);
    this.showNameModal.set(false);
    this.dismissedNameBanner.set(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mati_voter_name', cleanName);
    }
    if (this.roomCode() && this.voterId()) {
      await this.pollService.updateVoterNameInRoom(this.roomCode(), this.voterId(), cleanName);
      if (this.room()?.status === 'completed' || this.showSurveyCompletedOverview()) {
        const summary = await this.pollService.getSessionSummary(this.roomCode());
        this.sessionStats.set(summary);
      }
    }
  }

  openChangeRoomModal() {
    this.inputJoinCode.set(this.roomCode());
    this.showChangeRoomModal.set(true);
  }

  submitJoinCode() {
    const customName = this.inputParticipantName().trim();
    if (customName) {
      this.participantName.set(customName);
      this.hasCustomName.set(true);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mati_voter_name', customName);
      }
    }
    const raw = this.inputJoinCode();
    const clean = normalizeRoomCode(raw);
    if (clean) {
      this.showEnterCodeCard.set(false);
      this.showChangeRoomModal.set(false);
      this.router.navigate(['/join', clean]);
      this.switchStudentRoom(clean);
    }
  }

  joinQuick(code: string) {
    this.inputJoinCode.set(code);
    this.submitJoinCode();
  }

  ngOnInit() {
    const vid = this.pollService.getOrCreateVoterId();
    this.voterId.set(vid);
    this.voterIdShort.set(vid.substring(0, 16) + '...');
    const savedName = typeof localStorage !== 'undefined' ? localStorage.getItem('mati_voter_name') : null;
    if (savedName && savedName.trim()) {
      this.participantName.set(savedName.trim());
      this.inputParticipantName.set(savedName.trim());
      this.hasCustomName.set(true);
    } else {
      this.participantName.set('Participant #' + vid.slice(-4));
      this.hasCustomName.set(false);
    }

    this.allRoomsSub = this.pollService.listenToRooms().subscribe(rooms => {
      this.allRooms.set(rooms);
    });

    this.route.paramMap.subscribe(params => {
      let raw = params.get('roomCode');
      if (!raw && typeof window !== 'undefined' && window.location.hash) {
        raw = window.location.hash;
      }
      if (raw) {
        const clean = normalizeRoomCode(raw);
        this.showEnterCodeCard.set(false);
        this.switchStudentRoom(clean);
      } else {
        const broadcast = this.pollService.getActiveBroadcastRoom();
        this.activeBroadcastRoom.set(broadcast);
        this.showEnterCodeCard.set(true);
      }
    });
  }

  private switchStudentRoom(code: string) {
    const clean = normalizeRoomCode(code);
    if (clean === this.roomCode() && this.roomSub) return;
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.stopLocalTimer();

    this.pollStats.set(null);
    this.room.set(null);
    this.hasVoted.set(false);
    this.selectedOptionId.set(null);
    this.remainingSeconds.set(null);

    this.roomCode.set(clean);
    this.listenToPoll(clean);
    this.listenToRoom(clean);
    this.listenToRoomPolls(clean);
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.allRoomsSub?.unsubscribe();
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
      const timeSpentSeconds = 5.0;
      await this.pollService.submitVote(
        this.roomCode(), 
        pollId, 
        this.voterId(), 
        optionId,
        this.participantName(),
        timeSpentSeconds
      );
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
      this.rawPolls.set(list);
      const activeList = this.polls();
      if (!this.selectedSurveyPollId() && activeList.length > 0) {
        this.selectedSurveyPollId.set(activeList[0].id);
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
          const diff = Math.ceil((stats.timerEndsAt - this.pollService.now()) / 1000);
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
      const diff = Math.ceil((timerEndsAt - this.pollService.now()) / 1000);
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

    const elapsedMs = this.questionShownAt() > 0 ? (Date.now() - this.questionShownAt()) : 5000;
    const timeSpentSeconds = Math.max(1, Math.round(elapsedMs / 100) / 10);

    this.isSubmitting.set(true);
    try {
      await this.pollService.submitVote(
        this.roomCode(),
        stats.poll.id,
        this.voterId(),
        optionId,
        this.participantName(),
        timeSpentSeconds
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
