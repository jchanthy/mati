import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { DetailedSessionSummary, Poll, PollStats, Room } from '../../models/poll.model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-stage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="stage-container h-screen max-h-screen bg-slate-950 text-white flex flex-col justify-between p-2.5 sm:p-4 lg:p-5 select-none overflow-hidden relative">
      <!-- Background Ambient Glow -->
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Top Bar -->
      <header class="flex items-center justify-between gap-3 z-10 border-b border-slate-800/80 pb-2 sm:pb-2.5 shrink-0">
        <div class="flex items-center gap-2.5 sm:gap-3">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white text-lg sm:text-xl font-black shadow-lg shadow-indigo-500/30">
            ម
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">Mati</span>
              <span class="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-widest">Presenter Stage</span>
              @if (room()?.mode === 'survey') {
                <span class="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800 uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <i class="pi pi-list-check text-[9px]"></i> Survey Mode
                </span>
              }
            </div>
          </div>
        </div>

        <!-- Header Right: Live Stage Status Widget -->
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl backdrop-blur-md shadow-sm">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span class="text-xs font-semibold text-slate-300 hidden sm:inline">Live Stage</span>
            <span class="text-slate-700 hidden sm:inline">|</span>
            <span class="text-xs font-mono font-bold text-amber-400">PIN: {{ roomCode() }}</span>
          </div>
        </div>
      </header>

      <!-- Main Central Presentation Area: Fit to viewport without scrolling -->
      <main class="flex-1 min-h-0 flex flex-col justify-center py-1 sm:py-2 z-10 max-w-7xl mx-auto w-full overflow-hidden">
        @if (room()?.status === 'completed') {
          <!-- Grand Finale Celebration Screen for Big TV / Projector with Results Breakdown -->
          <div class="h-full max-h-[calc(100vh-120px)] flex flex-col justify-start space-y-3 sm:space-y-4 max-w-5xl mx-auto animate-fadein w-full px-2 sm:px-4 overflow-y-auto pr-1 sm:pr-2">
            <!-- Festive Badge & Title -->
            <div class="text-center space-y-1.5 shrink-0 pt-1">
              <div class="flex items-center justify-center">
                <span class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md">
                  <span>🎉</span>
                  <span>Poll Completed • ការស្ទង់មតិបានបញ្ចប់</span>
                </span>
              </div>
              <h1 class="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                ការស្ទង់មតិបានបញ្ចប់ដោយជោគជ័យ!
              </h1>
              <p class="text-xs sm:text-sm font-medium text-slate-300">
                Final Audience Results & Performance Summary for Room <span class="font-mono text-amber-400 font-bold">{{ roomCode() }}</span>
              </p>
            </div>

            <!-- Grand KPI Summary Cards (4 Cards) -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3 shrink-0">
              <!-- Total Questions -->
              <div class="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg text-center space-y-0.5">
                <div class="text-2xl sm:text-3xl font-black text-slate-100 font-mono leading-tight">
                  {{ totalQuestionsCount() }}
                </div>
                <div class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Questions
                </div>
              </div>

              <!-- Audience Votes Cast -->
              <div class="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg text-center space-y-0.5">
                <div class="text-2xl sm:text-3xl font-black text-indigo-400 font-mono leading-tight">
                  {{ totalVotesCount() }}
                </div>
                <div class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Total Votes Cast
                </div>
              </div>

              <!-- Overall Accuracy or Top Consensus -->
              <div class="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border backdrop-blur-md shadow-lg text-center space-y-0.5"
                [ngClass]="sessionStats().hasScoredQuestions ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-amber-500/40 bg-amber-950/20'">
                <div class="text-2xl sm:text-3xl font-black font-mono leading-tight"
                  [ngClass]="sessionStats().hasScoredQuestions ? 'text-emerald-400' : 'text-amber-400'">
                  {{ sessionStats().hasScoredQuestions ? sessionStats().overallAccuracy + '%' : sessionStats().topConsensusPercentage + '%' }}
                </div>
                <div class="text-[10px] sm:text-xs font-bold uppercase tracking-wider"
                  [ngClass]="sessionStats().hasScoredQuestions ? 'text-emerald-300' : 'text-amber-300'">
                  {{ sessionStats().hasScoredQuestions ? 'Overall Accuracy' : 'Top Consensus' }}
                </div>
              </div>

              <!-- Status -->
              <div class="p-3 sm:p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-lg text-center space-y-0.5">
                <div class="text-2xl sm:text-3xl font-black text-emerald-400 font-mono leading-tight">
                  100%
                </div>
                <div class="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Completed
                </div>
              </div>
            </div>

            <!-- Detailed Question-by-Question Results Review -->
            @if (sessionStats().questionResults.length > 0) {
              <div class="space-y-2.5 pt-1">
                <div class="flex items-center justify-between px-1">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <i class="pi pi-list-check text-indigo-400"></i>
                    <span>Question Breakdown & Answer Results</span>
                  </h3>
                  <span class="text-[10px] sm:text-xs font-semibold text-slate-400">
                    {{ sessionStats().questionResults.length }} question{{ sessionStats().questionResults.length === 1 ? '' : 's' }} tallied
                  </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pb-4">
                  @for (q of sessionStats().questionResults; track q.pollId) {
                    <div class="bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-3 sm:p-3.5 backdrop-blur-md shadow-md space-y-2 transition-all">
                      <!-- Question header & Accuracy / Top Badge -->
                      <div class="flex items-start justify-between gap-2">
                        <div class="flex items-start gap-2 flex-1 min-w-0">
                          <span class="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 font-bold text-[11px] shrink-0 border border-indigo-500/30">
                            #{{ q.order }}
                          </span>
                          <h4 class="text-xs sm:text-sm font-bold text-white leading-snug line-clamp-2">
                            {{ q.question }}
                          </h4>
                        </div>
                        
                        @if (q.correctOptionId !== undefined) {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 border"
                            [ngClass]="q.correctPercentage >= 50 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border-amber-500/40'">
                            {{ q.correctPercentage }}% Correct
                          </span>
                        } @else {
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shrink-0 bg-slate-800 text-slate-300 border border-slate-700">
                            {{ q.totalVotes }} Votes
                          </span>
                        }
                      </div>

                      <!-- Options Mini Progress Bars -->
                      <div class="space-y-1.5 pt-1">
                        @for (opt of q.options; track opt.id) {
                          <div class="relative overflow-hidden rounded-lg bg-slate-950/60 border p-1.5 sm:p-2 text-xs flex items-center justify-between gap-2"
                            [ngClass]="opt.isCorrect ? 'border-emerald-500/50 bg-emerald-950/20' : (opt.id === q.winningOptionId && q.correctOptionId === undefined ? 'border-indigo-500/40' : 'border-slate-800/80')">
                            
                            <!-- Bar fill -->
                            <div class="absolute top-0 bottom-0 left-0 transition-all duration-500 opacity-25"
                              [style.width.%]="opt.percentage"
                              [ngClass]="opt.isCorrect ? 'bg-emerald-500' : 'bg-indigo-500'">
                            </div>

                            <div class="relative z-10 flex items-center gap-1.5 min-w-0 flex-1">
                              <span class="w-4 h-4 rounded text-[10px] font-black flex items-center justify-center shrink-0"
                                [ngClass]="opt.isCorrect ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-300'">
                                {{ opt.id }}
                              </span>
                              <span class="font-medium text-slate-200 truncate text-[11px] sm:text-xs">
                                {{ opt.text }}
                              </span>
                              @if (opt.isCorrect) {
                                <i class="pi pi-check text-emerald-400 text-[10px] shrink-0 font-bold"></i>
                              }
                            </div>

                            <div class="relative z-10 font-mono text-[11px] font-bold shrink-0 text-slate-300">
                              <span>{{ opt.percentage }}%</span>
                              <span class="text-[9px] text-slate-500 ml-1">({{ opt.votes }})</span>
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- Split Stage Layout: Flexible QR Station on Left + Question & Results on Right -->
          <div class="flex flex-col lg:flex-row items-center lg:items-center gap-4 lg:gap-6 xl:gap-8 w-full h-full min-h-0">

            <!-- LEFT SIDE: Adaptive Big Scannable QR Station -->
            <div class="w-full lg:w-64 xl:w-72 shrink-0 flex flex-col items-center max-h-full">
              <div class="bg-slate-900/95 border border-slate-800 rounded-2xl sm:rounded-3xl p-3 sm:p-4 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center space-y-2 sm:space-y-3 w-full max-w-xs overflow-hidden">

                <!-- Responsive QR Code (Adapts smoothly to viewport height) -->
                <div class="p-2 sm:p-2.5 bg-white rounded-xl sm:rounded-2xl shadow-xl ring-2 sm:ring-4 ring-indigo-500/20 shrink-0">
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
                  <div class="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-400 flex items-center justify-center gap-1.5">
                    <i class="pi pi-camera text-[10px] sm:text-xs"></i>
                    <span>Scan with phone to join</span>
                  </div>
                  <div class="text-[10px] sm:text-[11px] font-bold text-slate-300 font-mono truncate px-2 py-1 bg-slate-950/70 rounded-lg border border-slate-800/80">
                    {{ joinUrlShort() }}
                  </div>
                </div>

                <!-- Room PIN -->
                <div class="w-full pt-2 border-t border-slate-800/80 shrink-0">
                  <div class="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-slate-400">Room PIN</div>
                  <div class="text-2xl sm:text-3xl xl:text-4xl font-black font-mono tracking-widest text-amber-400 leading-tight">
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
                    <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Question #{{ stats.poll.order }}
                    </span>

                    @if (remainingSeconds() !== null) {
                      @if (remainingSeconds()! > 10) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black border border-emerald-500/40 font-mono shadow-sm">
                          <i class="pi pi-clock text-emerald-400 text-xs"></i> {{ remainingSeconds() }}s
                        </span>
                      } @else if (remainingSeconds()! <= 10 && remainingSeconds()! > 5) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-black border border-amber-500/40 font-mono shadow-sm">
                          <i class="pi pi-clock text-amber-400 text-xs"></i> {{ remainingSeconds() }}s
                        </span>
                      } @else if (remainingSeconds()! <= 5 && remainingSeconds()! > 0) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-red-500/30 text-red-300 text-xs font-black border border-red-500/50 font-mono shadow-md shadow-red-500/30 animate-pulse">
                          <i class="pi pi-clock text-red-400 text-xs"></i> {{ remainingSeconds() }}s left!
                        </span>
                      } @else if (remainingSeconds() === 0) {
                        <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-red-600/30 text-red-200 text-xs font-black border border-red-500/60 font-mono">
                          <i class="pi pi-times-circle text-red-400 text-xs"></i> Time's Up!
                        </span>
                      }
                    }

                    @if (stats.poll.isLocked || isTimeUp()) {
                      <span class="inline-flex items-center gap-1 px-3 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[11px] font-bold border border-red-500/30">
                        <i class="pi pi-lock text-[10px]"></i> {{ isTimeUp() ? "Time's Up" : "Voting Locked" }}
                      </span>
                    }
                  </div>

                  <h1 class="text-lg sm:text-xl md:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-snug max-w-4xl mx-auto px-2 break-words">
                    {{ stats.poll.question }}
                  </h1>

                  <!-- Slim Glowing TV Stage Progress Bar -->
                  @if (remainingSeconds() !== null && remainingSeconds()! > 0) {
                    <div class="max-w-md mx-auto h-1 w-full bg-slate-800/80 rounded-full overflow-hidden mt-1.5 shadow-inner">
                      <div class="h-full transition-all duration-300 ease-linear rounded-full"
                        [style.width.%]="timerPercent()"
                        [ngClass]="{
                          'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]': remainingSeconds()! > 10,
                          'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]': remainingSeconds()! <= 10 && remainingSeconds()! > 5,
                          'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.9)]': remainingSeconds()! <= 5
                        }">
                      </div>
                    </div>
                  }
                </div>

                <!-- Hidden Results Overlay Mode -->
                @if (!stats.poll.showResults) {
                  <div class="max-w-md mx-auto p-6 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-2 backdrop-blur-md shadow-2xl w-full">
                    <div class="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto text-lg animate-soft-pulse">
                      <i class="pi pi-eye-slash"></i>
                    </div>
                    <h3 class="text-lg font-bold text-white">Voting in progress...</h3>
                    <p class="text-xs text-slate-400">
                      Audience answers are being recorded. Results will appear on this screen once revealed.
                    </p>
                    <div class="pt-1 text-indigo-400 font-bold text-sm">
                      {{ stats.totalVotes }} participant{{ stats.totalVotes === 1 ? '' : 's' }} answered
                    </div>
                  </div>
                } @else {
                  <!-- Live Grid Options -->
                  <div class="grid gap-2 sm:gap-2.5 w-full overflow-y-auto max-h-[calc(100vh-230px)] pr-1" [ngClass]="stats.poll.options.length > 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-3xl mx-auto'">
                    @for (opt of stats.poll.options; track opt.id) {
                      <div class="bg-slate-900/90 border p-2.5 sm:p-3 rounded-xl sm:rounded-2xl backdrop-blur-md relative overflow-hidden transition-all shadow-md flex items-center justify-between gap-3"
                        [ngClass]="isLeadingOption(stats, opt.id) ? 'border-amber-400/70 ring-1 ring-amber-400/40 shadow-amber-500/10' : 'border-slate-800'">
                        <!-- Animated Progress bar background -->
                        <div 
                          class="absolute top-0 bottom-0 left-0 transition-all duration-700 ease-out" 
                          [style.width.%]="stats.percentages[opt.id] || 0"
                          [ngClass]="isLeadingOption(stats, opt.id) ? 'bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-yellow-500/20' : 'bg-gradient-to-r from-indigo-600/40 via-indigo-500/30 to-blue-500/20'">
                        </div>

                        <!-- Option Number & Text -->
                        <div class="relative z-10 flex items-center gap-2.5 flex-1 min-w-0">
                          <div style="width: 2rem; height: 2rem; min-width: 2rem;" class="rounded-lg flex items-center justify-center font-black text-xs shrink-0 border"
                            [ngClass]="isLeadingOption(stats, opt.id) ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-slate-800 text-indigo-400 border-slate-700'">
                            {{ opt.id }}
                          </div>
                          <div class="text-sm sm:text-base font-bold text-slate-100 leading-snug break-words flex-1">
                            {{ opt.text }}
                          </div>
                          @if (isLeadingOption(stats, opt.id) && stats.totalVotes > 0) {
                            <span class="px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[9px] font-black uppercase tracking-wider hidden sm:inline-flex items-center gap-1 shrink-0">
                              🏆 Leading
                            </span>
                          }
                        </div>

                        <!-- Percentage & Votes count -->
                        <div class="relative z-10 text-right shrink-0 pl-2">
                          <div class="text-xl sm:text-2xl font-black font-mono leading-none"
                            [ngClass]="isLeadingOption(stats, opt.id) ? 'text-amber-300' : 'text-white'">
                            {{ stats.percentages[opt.id] || 0 }}%
                          </div>
                          <div class="text-[10px] text-slate-400 font-medium mt-0.5">
                            {{ stats.votesPerOption[opt.id] || 0 }} votes
                          </div>
                        </div>
                      </div>
                    }
                  </div>
                }
              } @else {
                <!-- Waiting Screen on Right Side -->
                <div class="text-center py-8 space-y-3 bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 backdrop-blur-md max-w-md mx-auto w-full">
                  <div class="w-12 h-12 rounded-full bg-slate-900 text-indigo-400 border border-slate-800 flex items-center justify-center mx-auto text-xl animate-bounce">
                    <i class="pi pi-hourglass"></i>
                  </div>
                  <h2 class="text-xl font-black text-white">Waiting for Presenter to launch poll...</h2>
                  <p class="text-slate-400 max-w-sm mx-auto text-xs">
                    Scan the QR code on the left or enter PIN <span class="font-mono text-amber-400 font-bold">{{ roomCode() }}</span> to join this session.
                  </p>
                </div>
              }
            </div>

          </div>
        }
      </main>

      <!-- Bottom Bar: Compact Footer with total vote counter -->
      <footer class="flex items-center justify-between gap-4 z-10 border-t border-slate-800/80 pt-2 shrink-0">
        <div class="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span class="w-2.5 h-2.5 rounded-full" [ngClass]="room()?.status === 'completed' ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'"></span>
          <span class="hidden sm:inline">{{ room()?.status === 'completed' ? 'Session Concluded' : 'Mati (មតិ) Live Audience System' }}</span>
          <span class="text-slate-600 hidden sm:inline">•</span>
          <span class="font-mono text-indigo-400">Room {{ roomCode() }}</span>
        </div>

        <div class="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl">
          <i class="pi pi-users text-emerald-400 text-sm"></i>
          <span class="text-xs font-semibold text-slate-400">Total Votes:</span>
          <span class="text-lg font-black text-white font-mono">{{ room()?.status === 'completed' ? totalVotesCount() : (pollStats()?.totalVotes || 0) }}</span>
        </div>
      </footer>
    </div>
  `
})
export class StageComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private pollService = inject(MatiPollService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  roomCode = signal<string>('MATI01');
  pollStats = signal<PollStats | null>(null);
  room = signal<Room | null>(null);
  polls = signal<Poll[]>([]);
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

  private pollSub?: Subscription;
  private roomSub?: Subscription;
  private pollsListSub?: Subscription;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const code = (params.get('roomCode') || 'MATI01').toUpperCase();
      this.roomCode.set(code);
      this.setupUrls(code);
      this.generateQr(code);
      this.listenToPoll(code);
      this.listenToRoom(code);
      this.listenToRoomPolls(code);
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.roomSub?.unsubscribe();
    this.pollsListSub?.unsubscribe();
    this.stopLocalTimer();
  }

  private listenToRoomPolls(code: string) {
    this.pollsListSub?.unsubscribe();
    this.pollsListSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.polls.set(list);
    });
  }

  private listenToRoom(code: string) {
    this.roomSub?.unsubscribe();
    this.roomSub = this.pollService.listenToRoom(code).subscribe(roomData => {
      this.room.set(roomData);
      if (roomData?.status === 'completed') {
        this.pollService.getSessionSummary(code).then(summary => {
          this.sessionStats.set(summary);
        });
      }
    });
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

  private listenToPoll(code: string) {
    this.pollSub?.unsubscribe();
    this.pollSub = this.pollService.listenToActivePoll(code).subscribe(stats => {
      this.pollStats.set(stats);
      if (stats?.timerEndsAt && stats.timerEndsAt > 0) {
        this.timerDuration.set(stats.timerDuration || 30);
        this.startLocalTimer(stats.timerEndsAt);
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
