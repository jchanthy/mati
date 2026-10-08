import { Component, inject, signal, computed, OnInit, AfterViewInit, OnDestroy, PLATFORM_ID } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { DetailedSessionSummary, Poll, PollStats, Room } from '../../models/poll.model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-stage',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="stage-container min-h-screen h-screen max-h-screen flex flex-col justify-between p-3 sm:p-5 lg:p-6 select-none overflow-hidden relative"
      [class.transition-colors]="hasMounted()" [class.duration-300]="hasMounted()"
      [ngClass]="isLight() ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-white'">
      
      <!-- Background Ambient Glow -->
      @if (isLight()) {
        <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
      } @else {
        <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
      }

      <!-- Top Bar -->
      <header class="flex items-center justify-between gap-3 z-10 pb-2.5 sm:pb-3 shrink-0 border-b"
        [class.transition-colors]="hasMounted()" [class.duration-300]="hasMounted()"
        [ngClass]="isLight() ? 'border-slate-200' : 'border-slate-800/80'">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white text-lg sm:text-xl font-black shadow-lg shadow-indigo-500/30">
            ម
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl sm:text-2xl font-black tracking-tight leading-none"
                [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">Mati</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest border"
                [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950 text-indigo-400 border-indigo-800'">
                Presenter Stage
              </span>
              @if (room()?.mode === 'survey') {
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1 shadow-sm border"
                  [ngClass]="isLight() ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950/80 text-amber-300 border-amber-800'">
                  <i class="pi pi-list-check text-[10px]"></i> Survey Mode
                </span>
              }
            </div>
          </div>
        </div>

        <!-- Header Right: Live Stage Status Widget & Room Switcher -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Transient Switch Notification -->
          @if (recentlySwitchedNotice()) {
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md animate-pulse">
              <i class="pi pi-sync"></i>
              <span>{{ recentlySwitchedNotice() }}</span>
            </span>
          }

          <!-- Room Switcher Dropdown (Allows TV operator to switch group directly) -->
          @if (availableRooms().length > 1) {
            <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border backdrop-blur-md shadow-2xs transition-colors duration-300"
              [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'">
              <i class="pi pi-compass text-indigo-500 text-xs"></i>
              <select 
                [ngModel]="roomCode()" 
                (ngModelChange)="onManualRoomChange($event)" 
                class="bg-transparent text-xs font-black focus:outline-hidden cursor-pointer"
                [ngClass]="isLight() ? 'text-slate-800' : 'text-slate-200'"
                title="Switch presentation group / room">
                @for (r of availableRooms(); track r.code) {
                  <option [value]="r.code" class="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
                    {{ r.code }} - {{ r.title }}
                  </option>
                }
              </select>
            </div>
          }

          <!-- Auto-Sync With Controller Toggle Pill -->
          <button
            type="button"
            (click)="toggleAutoSync()"
            [title]="autoSyncWithPresenter() ? 'Live Auto-Sync Active: TV automatically updates when presenter switches room/group.' : 'Auto-Sync Paused: TV locked to this room.'"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shadow-2xs"
            [ngClass]="autoSyncWithPresenter() 
              ? (isLight() ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-950/60 text-emerald-300 border-emerald-800') 
              : (isLight() ? 'bg-slate-100 text-slate-600 border-slate-300' : 'bg-slate-900 text-slate-400 border-slate-800')">
            <span class="w-2 h-2 rounded-full" [ngClass]="autoSyncWithPresenter() ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'"></span>
            <span class="hidden md:inline">{{ autoSyncWithPresenter() ? 'Auto-Sync ON' : 'Lock Room' }}</span>
          </button>

          <!-- Status & PIN -->
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-xs transition-colors duration-300"
            [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'">
            @if (room()?.status === 'completed') {
              <span class="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span class="text-xs font-bold hidden sm:inline"
                [ngClass]="isLight() ? 'text-purple-700' : 'text-purple-300'">Session Ended</span>
            } @else if (room()?.status === 'draft' || room()?.status === 'closed' || !room()?.activePollId) {
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span class="text-xs font-semibold hidden sm:inline"
                [ngClass]="isLight() ? 'text-slate-600' : 'text-slate-300'">Waiting to Start</span>
            } @else {
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs font-semibold hidden sm:inline"
                [ngClass]="isLight() ? 'text-slate-600' : 'text-slate-300'">Live Stage</span>
            }
            <span class="hidden sm:inline" [ngClass]="isLight() ? 'text-slate-300' : 'text-slate-700'">|</span>
            <span class="text-xs font-mono font-black"
              [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">PIN: {{ roomCode() }}</span>
          </div>
        </div>
      </header>

      <!-- Main Central Presentation Area: Fit to viewport without scrolling -->
      <main class="flex-1 min-h-0 flex flex-col justify-center py-2 z-10 max-w-7xl mx-auto w-full overflow-hidden">
        @if (room()?.status === 'completed') {
          <!-- Grand Finale Celebration Screen for Big TV / Projector with Results Breakdown -->
          <div class="h-full max-h-[calc(100vh-140px)] flex flex-col justify-start space-y-4 max-w-5xl mx-auto animate-fadein w-full px-2 sm:px-4 overflow-y-auto pr-1 sm:pr-2">
            <!-- Festive Badge & Title -->
            <div class="text-center space-y-1.5 shrink-0 pt-1">
              <div class="flex items-center justify-center">
                <span class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider shadow-sm border"
                  [ngClass]="isLight() ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'">
                  <span>🎉</span>
                  <span>Poll Completed • ការស្ទង់មតិបានបញ្ចប់</span>
                </span>
              </div>
              <h1 class="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-tight"
                [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                ការស្ទង់មតិបានបញ្ចប់ដោយជោគជ័យ!
              </h1>
              <p class="text-xs sm:text-sm font-medium"
                [ngClass]="isLight() ? 'text-slate-600' : 'text-slate-300'">
                Final Audience Results & Performance Summary for Room <span class="font-mono font-bold" [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">{{ roomCode() }}</span>
              </p>
            </div>

            <!-- Grand KPI Summary Cards (4 Cards) -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 shrink-0 max-w-4xl mx-auto w-full pt-4">
              <!-- Total Questions -->
              <div class="p-5 sm:p-6 rounded-3xl border shadow-sm text-center space-y-1 transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'">
                <div class="text-3xl sm:text-4xl font-black font-mono leading-tight"
                  [ngClass]="isLight() ? 'text-slate-900' : 'text-slate-100'">
                  {{ totalQuestionsCount() }}
                </div>
                <div class="text-xs font-bold uppercase tracking-wider"
                  [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                  Total Questions
                </div>
              </div>

              <!-- Audience Votes Cast -->
              <div class="p-5 sm:p-6 rounded-3xl border shadow-sm text-center space-y-1 transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'">
                <div class="text-3xl sm:text-4xl font-black font-mono leading-tight text-indigo-600 dark:text-indigo-400">
                  {{ totalVotesCount() }}
                </div>
                <div class="text-xs font-bold uppercase tracking-wider"
                  [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                  Total Votes Cast
                </div>
              </div>

              <!-- Overall Accuracy or Top Consensus -->
              <div class="p-5 sm:p-6 rounded-3xl border shadow-sm text-center space-y-1 transition-colors"
                [ngClass]="sessionStats().hasScoredQuestions 
                  ? (isLight() ? 'bg-emerald-50/70 border-emerald-300' : 'border-emerald-500/40 bg-emerald-950/20') 
                  : (isLight() ? 'bg-amber-50/70 border-amber-300' : 'border-amber-500/40 bg-amber-950/20')">
                <div class="text-3xl sm:text-4xl font-black font-mono leading-tight"
                  [ngClass]="sessionStats().hasScoredQuestions 
                    ? (isLight() ? 'text-emerald-700' : 'text-emerald-400') 
                    : (isLight() ? 'text-amber-700' : 'text-amber-400')">
                  {{ sessionStats().hasScoredQuestions ? sessionStats().overallAccuracy + '%' : sessionStats().topConsensusPercentage + '%' }}
                </div>
                <div class="text-xs font-bold uppercase tracking-wider"
                  [ngClass]="sessionStats().hasScoredQuestions 
                    ? (isLight() ? 'text-emerald-800' : 'text-emerald-300') 
                    : (isLight() ? 'text-amber-800' : 'text-amber-300')">
                  {{ sessionStats().hasScoredQuestions ? 'Overall Accuracy' : 'Top Consensus' }}
                </div>
              </div>

              <!-- Status -->
              <div class="p-5 sm:p-6 rounded-3xl border shadow-sm text-center space-y-1 transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'">
                <div class="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 font-mono leading-tight">
                  100%
                </div>
                <div class="text-xs font-bold uppercase tracking-wider"
                  [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                  Completed
                </div>
              </div>
            </div>

            <!-- Congratulatory audience banner -->
            <div class="p-6 sm:p-8 rounded-3xl border text-center max-w-4xl mx-auto w-full transition-colors space-y-2"
              [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/70 border-slate-800'">
              <div class="text-2xl sm:text-3xl">👏</div>
              <h2 class="text-lg sm:text-xl font-black" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                សូមអរគុណសម្រាប់ការចូលរួមយ៉ាងសកម្ម!
              </h2>
              <p class="text-xs sm:text-sm max-w-lg mx-auto" [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                Thank you for participating! All audience votes and feedback have been collected and securely recorded for Room <span class="font-mono font-bold" [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">{{ roomCode() }}</span>.
              </p>
            </div>
          </div>
        } @else {
          <!-- Split Stage Layout: Flexible QR Station on Left + Question & Results on Right -->
          <div class="flex flex-col lg:flex-row items-center lg:items-center gap-4 lg:gap-6 xl:gap-8 w-full h-full min-h-0">

            <!-- LEFT SIDE: Adaptive Big Scannable QR Station -->
            <div class="w-full lg:w-64 xl:w-72 shrink-0 flex flex-col items-center max-h-full">
              <div class="border rounded-2xl sm:rounded-3xl p-3 sm:p-4 backdrop-blur-xl shadow-xl flex flex-col items-center text-center space-y-2 sm:space-y-3 w-full max-w-xs overflow-hidden transition-colors"
                [ngClass]="isLight() ? 'bg-white border-slate-200 shadow-slate-200/50' : 'bg-slate-900/95 border-slate-800'">

                <!-- Responsive QR Code (Adapts smoothly to viewport height) -->
                <div class="p-2 sm:p-2.5 bg-white rounded-xl sm:rounded-2xl shadow-md ring-2 sm:ring-4 ring-indigo-500/20 shrink-0 border border-slate-100">
                  @if (qrCodeDataUrl()) {
                    <img [src]="qrCodeDataUrl()" alt="Scan to join Mati" class="h-[min(26vh,11.5rem)] w-[min(26vh,11.5rem)] max-h-48 max-w-48 object-contain" />
                  } @else {
                    <div class="h-[min(26vh,11.5rem)] w-[min(26vh,11.5rem)] max-h-48 max-w-48 flex items-center justify-center bg-gray-100 text-gray-400 rounded-xl">
                      <i class="pi pi-qrcode text-3xl animate-pulse"></i>
                    </div>
                  }
                </div>

                <!-- URL & Instructions -->
                <div class="space-y-1 w-full shrink-0">
                  <div class="text-[10px] sm:text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5"
                    [ngClass]="isLight() ? 'text-indigo-600' : 'text-indigo-400'">
                    <i class="pi pi-camera text-[10px] sm:text-xs"></i>
                    <span>Scan with phone to join</span>
                  </div>
                  <div class="text-[10px] sm:text-[11px] font-bold font-mono truncate px-2 py-1 rounded-lg border"
                    [ngClass]="isLight() ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-slate-950/70 text-slate-300 border-slate-800/80'">
                    {{ joinUrlShort() }}
                  </div>
                </div>

                <!-- Room PIN -->
                <div class="w-full pt-2 border-t shrink-0"
                  [ngClass]="isLight() ? 'border-slate-100' : 'border-slate-800/80'">
                  <div class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest"
                    [ngClass]="isLight() ? 'text-slate-400' : 'text-slate-400'">Room PIN</div>
                  <div class="text-2xl sm:text-3xl xl:text-4xl font-black font-mono tracking-widest leading-tight"
                    [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">
                    {{ roomCode() }}
                  </div>
                </div>

              </div>
            </div>

            <!-- RIGHT SIDE: Active Question & Live Vote Option Bars -->
            <div class="flex-1 min-h-0 flex flex-col justify-center min-w-0 w-full overflow-hidden">
              @if (pollStats(); as stats) {
                <!-- Question Title Bar -->
                <div class="text-center mb-2 sm:mb-3 space-y-1 sm:space-y-1.5 shrink-0">
                  <div class="flex items-center justify-center gap-2 flex-wrap">
                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase border"
                      [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'">
                      Question #{{ stats.poll.order }}
                    </span>

                    @if (remainingSeconds() !== null) {
                      @if (remainingSeconds()! > 10) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black border font-mono shadow-xs"
                          [ngClass]="isLight() ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'">
                          <i class="pi pi-clock text-xs"></i> {{ remainingSeconds() }}s
                        </span>
                      } @else if (remainingSeconds()! <= 10 && remainingSeconds()! > 5) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black border font-mono shadow-xs"
                          [ngClass]="isLight() ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'">
                          <i class="pi pi-clock text-xs"></i> {{ remainingSeconds() }}s
                        </span>
                      } @else if (remainingSeconds()! <= 5 && remainingSeconds()! > 0) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black border font-mono shadow-md animate-pulse"
                          [ngClass]="isLight() ? 'bg-red-50 text-red-700 border-red-300' : 'bg-red-500/30 text-red-300 border-red-500/50'">
                          <i class="pi pi-clock text-xs"></i> {{ remainingSeconds() }}s left!
                        </span>
                      } @else if (remainingSeconds() === 0) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-black border font-mono"
                          [ngClass]="isLight() ? 'bg-red-100 text-red-800 border-red-300' : 'bg-red-600/30 text-red-200 border-red-500/60'">
                          <i class="pi pi-times-circle text-xs"></i> Time's Up!
                        </span>
                      }
                    }

                    @if (stats.poll.isLocked && !isTimeUp()) {
                      <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold border"
                        [ngClass]="isLight() ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-500/20 text-red-300 border-red-500/30'">
                        <i class="pi pi-lock text-[10px]"></i> Voting Locked
                      </span>
                    }
                  </div>

                  <h1 class="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight leading-snug max-w-4xl mx-auto px-2 break-words"
                    [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
                    {{ stats.poll.question }}
                  </h1>

                  <!-- Slim Glowing TV Stage Progress Bar -->
                  @if (remainingSeconds() !== null && remainingSeconds()! > 0) {
                    <div class="max-w-md mx-auto h-1.5 w-full rounded-full overflow-hidden mt-2"
                      [ngClass]="isLight() ? 'bg-slate-200' : 'bg-slate-800/80'">
                      <div class="h-full transition-all duration-300 ease-linear rounded-full"
                        [style.width.%]="timerPercent()"
                        [ngClass]="{
                          'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]': remainingSeconds()! > 10,
                          'bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.8)]': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                          'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]': remainingSeconds()! <= 5
                        }">
                      </div>
                    </div>
                  }
                </div>

                <!-- Hidden Results Overlay Mode -->
                @if (!stats.poll.showResults) {
                  <div class="max-w-md mx-auto p-6 rounded-3xl text-center space-y-2 border shadow-xl w-full transition-colors"
                    [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'">
                    <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto text-lg animate-soft-pulse"
                      [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-600' : 'bg-indigo-600/20 text-indigo-400'">
                      <i class="pi pi-eye-slash"></i>
                    </div>
                    <h3 class="text-lg font-bold" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">Voting in progress...</h3>
                    <p class="text-xs" [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                      Audience answers are being recorded. Results will appear on this screen once revealed.
                    </p>
                    <div class="pt-1 font-bold text-sm text-indigo-600 dark:text-indigo-400">
                      {{ stats.totalVotes }} participant{{ stats.totalVotes === 1 ? '' : 's' }} answered
                    </div>
                  </div>
                } @else {
                  <!-- Live Grid Options -->
                  <div class="grid gap-2 sm:gap-2.5 w-full overflow-y-auto max-h-[calc(100vh-230px)] pr-1" [ngClass]="stats.poll.options.length > 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto'">
                    @for (opt of stats.poll.options; track opt.id) {
                      <div class="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border relative overflow-hidden transition-all shadow-sm flex items-center justify-between gap-3"
                        [ngClass]="isLeadingOption(stats, opt.id) 
                          ? (isLight() ? 'border-amber-400 ring-2 ring-amber-400/30 bg-amber-50/40' : 'border-amber-400/70 ring-1 ring-amber-400/40 shadow-amber-500/10 bg-slate-900/90') 
                          : (isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800')">
                        <!-- Animated Progress bar background -->
                        <div 
                          class="absolute top-0 bottom-0 left-0 transition-all duration-700 ease-out" 
                          [style.width.%]="stats.percentages[opt.id] || 0"
                          [ngClass]="isLeadingOption(stats, opt.id) 
                            ? (isLight() ? 'bg-amber-200/50' : 'bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-yellow-500/20') 
                            : (isLight() ? 'bg-indigo-100/70' : 'bg-gradient-to-r from-indigo-600/40 via-indigo-500/30 to-blue-500/20')">
                        </div>

                        <!-- Option Number & Text -->
                        <div class="relative z-10 flex items-center gap-2.5 flex-1 min-w-0">
                          <div style="width: 2rem; height: 2rem; min-width: 2rem;" class="rounded-lg flex items-center justify-center font-black text-xs shrink-0 border"
                            [ngClass]="isLeadingOption(stats, opt.id) 
                              ? (isLight() ? 'bg-amber-500 text-white border-amber-600' : 'bg-amber-400/20 text-amber-300 border-amber-400/40') 
                              : (isLight() ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-indigo-400 border-slate-700')">
                            {{ opt.id }}
                          </div>
                          <div class="text-sm sm:text-base font-bold leading-snug break-words flex-1"
                            [ngClass]="isLight() ? 'text-slate-900' : 'text-slate-100'">
                            {{ opt.text }}
                          </div>
                          @if (isLeadingOption(stats, opt.id) && stats.totalVotes > 0) {
                            <span class="px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider hidden sm:inline-flex items-center gap-1 shrink-0"
                              [ngClass]="isLight() ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-amber-400/20 border-amber-400/40 text-amber-300'">
                              🏆 Leading
                            </span>
                          }
                        </div>

                        <!-- Percentage & Votes count -->
                        <div class="relative z-10 text-right shrink-0 pl-2">
                          <div class="text-xl sm:text-2xl font-black font-mono leading-none"
                            [ngClass]="isLeadingOption(stats, opt.id) 
                              ? (isLight() ? 'text-amber-700' : 'text-amber-300') 
                              : (isLight() ? 'text-slate-900' : 'text-white')">
                            {{ stats.percentages[opt.id] || 0 }}%
                          </div>
                          <div class="text-[10px] font-medium mt-0.5"
                            [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                            {{ stats.votesPerOption[opt.id] || 0 }} votes
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              } @else {
                <!-- Waiting Screen on Right Side -->
                <div class="text-center py-8 space-y-3 rounded-3xl p-6 border shadow-lg max-w-md mx-auto w-full transition-colors"
                  [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/60 border-slate-800/80'">
                  <div class="w-12 h-12 rounded-full border flex items-center justify-center mx-auto text-xl animate-bounce"
                    [ngClass]="isLight() ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-900 text-indigo-400 border-slate-800'">
                    <i class="pi pi-hourglass"></i>
                  </div>
                  <h2 class="text-xl font-black" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">Waiting for Presenter to launch poll...</h2>
                  <p class="max-w-sm mx-auto text-xs" [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
                    Scan the QR code on the left or enter PIN <span class="font-mono font-bold" [ngClass]="isLight() ? 'text-amber-600' : 'text-amber-400'">{{ roomCode() }}</span> to join this session.
                  </p>
                </div>
              }
            </div>

          </div>
        }
      </main>

      <!-- Bottom Bar: Compact Footer with total vote counter -->
      <footer class="flex items-center justify-between gap-4 z-10 border-t pt-2.5 shrink-0"
        [class.transition-colors]="hasMounted()" [class.duration-300]="hasMounted()"
        [ngClass]="isLight() ? 'border-slate-200' : 'border-slate-800/80'">
        <div class="flex items-center gap-2 text-xs font-medium"
          [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">
          <span class="w-2.5 h-2.5 rounded-full" [ngClass]="room()?.status === 'completed' ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'"></span>
          <span class="hidden sm:inline">{{ room()?.status === 'completed' ? 'Session Concluded' : 'Mati (មតិ) Live Audience System' }}</span>
          <span class="hidden sm:inline" [ngClass]="isLight() ? 'text-slate-300' : 'text-slate-600'">•</span>
          <span class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">Room {{ roomCode() }}</span>
        </div>

        <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl border shadow-xs"
          [ngClass]="isLight() ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'">
          <i class="pi pi-users text-emerald-500 text-sm"></i>
          <span class="text-xs font-semibold" [ngClass]="isLight() ? 'text-slate-500' : 'text-slate-400'">Total Votes:</span>
          <span class="text-lg font-black font-mono" [ngClass]="isLight() ? 'text-slate-900' : 'text-white'">
            {{ room()?.status === 'completed' ? totalVotesCount() : (pollStats()?.totalVotes || 0) }}
          </span>
        </div>
      </footer>
    </div>
  `
})
export class StageComponent implements OnInit, AfterViewInit, OnDestroy {
  private route = inject(ActivatedRoute);
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
    questionResults: []
  });
  qrCodeDataUrl = signal<string>('');
  fullJoinUrl = signal<string>('');
  joinUrlShort = signal<string>('');

  // Projector / TV Theme: light vs dark
  isLight = computed(() => this.currentTheme() === 'light');

  // Total question and vote counts for completed stage
  totalQuestionsCount = computed(() => Math.max(this.polls().length, this.sessionStats().totalQuestions));
  totalVotesCount = computed(() => this.sessionStats().totalVotes);

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
}
