import { Component, inject, signal, computed, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';

import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { Poll, PollStats, Room } from '../../models/poll.model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-stage',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="stage-container h-screen max-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8 select-none overflow-hidden relative">
      <!-- Background Ambient Glow -->
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Top Bar: Brand, Join instructions, PIN, and QR Code in header to save screen space -->
      <header class="flex items-center justify-between gap-4 z-10 border-b border-slate-800/80 pb-3 shrink-0">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white text-xl font-black shadow-lg shadow-indigo-500/30">
            ម
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-2xl font-black tracking-tight text-white">Mati</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-widest">Presenter Stage</span>
              @if (room()?.mode === 'survey') {
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-300 border border-amber-800 uppercase tracking-wider flex items-center gap-1 shadow-sm">
                  <i class="pi pi-list-check text-[10px]"></i> Survey Mode
                </span>
              }
            </div>
          </div>
        </div>

        <!-- Join Header Widget (PIN + Short Link + Mini QR) -->
        <div class="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-2xl backdrop-blur-md shadow-lg">
          @if (qrCodeDataUrl()) {
            <img [src]="qrCodeDataUrl()" alt="Join QR" class="w-10 h-10 rounded-lg bg-white p-0.5" />
          }
          <div class="text-left">
            <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Join on phone</div>
            <div class="text-xs font-bold text-indigo-300 font-mono">{{ joinUrlShort() }}</div>
          </div>
          <div class="h-6 w-px bg-slate-800"></div>
          <div>
            <div class="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Room PIN</div>
            <div class="text-xl font-black text-amber-400 font-mono tracking-wider">{{ roomCode() }}</div>
          </div>
        </div>
      </header>

      <!-- Main Central Presentation Area: Fit to viewport without scrolling -->
      <main class="flex-1 flex flex-col justify-center py-2 z-10 max-w-6xl mx-auto w-full overflow-hidden">
        @if (room()?.status === 'completed') {
          <!-- Grand Finale Celebration Screen for Big TV / Projector -->
          <div class="text-center space-y-4 max-w-4xl mx-auto animate-fadein w-full px-4">
            <!-- Festive Badge -->
            <div class="flex items-center justify-center">
              <span class="inline-flex items-center gap-2 px-4 py-1 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-md">
                <span>🎉</span>
                <span>Poll Completed • ការស្ទង់មតិបានបញ្ចប់</span>
              </span>
            </div>

            <!-- Title & Subtitle -->
            <div class="space-y-1">
              <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
                ការស្ទង់មតិបានបញ្ចប់ដោយជោគជ័យ!
              </h1>
              <p class="text-sm sm:text-lg font-bold text-indigo-300">
                Thank you for participating in Mati Live Session!
              </p>
              <p class="text-xs text-slate-400 max-w-lg mx-auto">
                All questions have concluded. Your collective votes have been gathered in real-time.
              </p>
            </div>

            <!-- Grand KPI Summary Cards (Compact, Perfectly Visible) -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1 max-w-3xl mx-auto">
              <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl text-center space-y-1">
                <div class="text-3xl sm:text-4xl font-black text-emerald-400 font-mono leading-tight">
                  {{ totalQuestionsCount() }}
                </div>
                <div class="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Total Questions
                </div>
              </div>

              <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl text-center space-y-1">
                <div class="text-3xl sm:text-4xl font-black text-indigo-400 font-mono leading-tight">
                  {{ totalVotesCount() }}
                </div>
                <div class="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Audience Votes Cast
                </div>
              </div>

              <div class="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-xl text-center space-y-1">
                <div class="text-3xl sm:text-4xl font-black text-amber-400 font-mono leading-tight">
                  100%
                </div>
                <div class="text-[11px] sm:text-xs font-bold text-slate-300 uppercase tracking-wider">
                  Session Completed
                </div>
              </div>
            </div>
          </div>
        } @else {
          @if (pollStats(); as stats) {
            <!-- Question Title Bar -->
          <div class="text-center mb-4 sm:mb-6 space-y-2 shrink-0">
            <div class="flex items-center justify-center gap-3">
              <span class="inline-block px-3 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Question #{{ stats.poll.order }}
              </span>

              @if (remainingSeconds() !== null) {
                @if (remainingSeconds()! > 10) {
                  <span class="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs sm:text-sm font-black border border-emerald-500/40 font-mono shadow-md">
                    <i class="pi pi-clock text-emerald-400"></i> {{ remainingSeconds() }}s
                  </span>
                } @else if (remainingSeconds()! <= 10 && remainingSeconds()! > 5) {
                  <span class="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs sm:text-sm font-black border border-amber-500/40 font-mono shadow-md">
                    <i class="pi pi-clock text-amber-400"></i> {{ remainingSeconds() }}s
                  </span>
                } @else if (remainingSeconds()! <= 5 && remainingSeconds()! > 0) {
                  <span class="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-red-500/30 text-red-300 text-xs sm:text-sm font-black border border-red-500/50 font-mono shadow-lg shadow-red-500/30 animate-pulse">
                    <i class="pi pi-clock text-red-400"></i> {{ remainingSeconds() }}s left!
                  </span>
                } @else if (remainingSeconds() === 0) {
                  <span class="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-red-600/30 text-red-200 text-xs sm:text-sm font-black border border-red-500/60 font-mono">
                    <i class="pi pi-times-circle text-red-400"></i> Time's Up!
                  </span>
                }
              }

              @if (stats.poll.isLocked || isTimeUp()) {
                <span class="inline-flex items-center gap-1.5 px-3.5 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                  <i class="pi pi-lock text-[10px]"></i> {{ isTimeUp() ? "Time's Up" : "Voting Locked" }}
                </span>
              }
            </div>

            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-relaxed max-w-5xl mx-auto px-4 break-words">
              {{ stats.poll.question }}
            </h1>

            <!-- Slim Glowing TV Stage Progress Bar -->
            @if (remainingSeconds() !== null && remainingSeconds()! > 0) {
              <div class="max-w-md mx-auto h-1.5 w-full bg-slate-800/80 rounded-full overflow-hidden mt-3 shadow-inner">
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
            <div class="max-w-xl mx-auto p-8 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-3 backdrop-blur-md shadow-2xl">
              <div class="w-14 h-14 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto text-xl animate-soft-pulse">
                <i class="pi pi-eye-slash"></i>
              </div>
              <h3 class="text-xl font-bold text-white">Voting in progress...</h3>
              <p class="text-xs text-slate-400">
                Audience answers are being recorded. Results will appear on this screen once revealed.
              </p>
              <div class="pt-1 text-indigo-400 font-bold text-base">
                {{ stats.totalVotes }} participant{{ stats.totalVotes === 1 ? '' : 's' }} answered
              </div>
            </div>
          } @else {
            <!-- Live Grid Options: 2 columns if >2 options, 1 column if 2 options -->
            <div class="grid gap-3.5 w-full" [ngClass]="stats.poll.options.length > 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-4xl mx-auto'">
              @for (opt of stats.poll.options; track opt.id) {
                <div class="bg-slate-900/90 border p-4 rounded-2xl backdrop-blur-md relative overflow-hidden transition-all shadow-lg flex items-center justify-between gap-4"
                  [ngClass]="isLeadingOption(stats, opt.id) ? 'border-amber-400/70 ring-1 ring-amber-400/40 shadow-amber-500/10' : 'border-slate-800'">
                  <!-- Animated Progress bar background -->
                  <div 
                    class="absolute top-0 bottom-0 left-0 transition-all duration-700 ease-out" 
                    [style.width.%]="stats.percentages[opt.id] || 0"
                    [ngClass]="isLeadingOption(stats, opt.id) ? 'bg-gradient-to-r from-amber-500/40 via-amber-400/30 to-yellow-500/20' : 'bg-gradient-to-r from-indigo-600/40 via-indigo-500/30 to-blue-500/20'">
                  </div>

                  <!-- Option Number & Text -->
                  <div class="relative z-10 flex items-center gap-3.5 flex-1 min-w-0">
                    <div style="width: 2.25rem; height: 2.25rem; min-width: 2.25rem;" class="rounded-xl flex items-center justify-center font-black text-sm shrink-0 border"
                      [ngClass]="isLeadingOption(stats, opt.id) ? 'bg-amber-400/20 text-amber-300 border-amber-400/40' : 'bg-slate-800 text-indigo-400 border-slate-700'">
                      {{ opt.id }}
                    </div>
                    <div class="text-base sm:text-lg font-bold text-slate-100 leading-snug break-words flex-1">
                      {{ opt.text }}
                    </div>
                    @if (isLeadingOption(stats, opt.id) && stats.totalVotes > 0) {
                      <span class="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-wider hidden sm:inline-flex items-center gap-1 shrink-0">
                        🏆 Leading
                      </span>
                    }
                  </div>

                  <!-- Percentage & Votes count -->
                  <div class="relative z-10 text-right shrink-0 pl-3">
                    <div class="text-2xl sm:text-3xl font-black font-mono leading-none"
                      [ngClass]="isLeadingOption(stats, opt.id) ? 'text-amber-300' : 'text-white'">
                      {{ stats.percentages[opt.id] || 0 }}%
                    </div>
                    <div class="text-[11px] text-slate-400 font-medium mt-1">
                      {{ stats.votesPerOption[opt.id] || 0 }} votes
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        } @else {
          <!-- Waiting Screen -->
          <div class="text-center py-12 space-y-4">
            <div class="w-16 h-16 rounded-full bg-slate-900 text-indigo-400 border border-slate-800 flex items-center justify-center mx-auto text-2xl animate-bounce">
              <i class="pi pi-hourglass"></i>
            </div>
            <h2 class="text-2xl font-black text-white">Waiting for Presenter to launch poll...</h2>
            <p class="text-slate-400 max-w-md mx-auto text-xs">
              Scan the QR code in top right or enter PIN <span class="font-mono text-amber-400 font-bold">{{ roomCode() }}</span> to join this session.
            </p>
          </div>
        }
      }
      </main>

      <!-- Bottom Bar: Compact Footer with total vote counter -->
      <footer class="flex items-center justify-between gap-4 z-10 border-t border-slate-800/80 pt-3 shrink-0">
        <div class="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span class="w-2.5 h-2.5 rounded-full" [ngClass]="room()?.status === 'completed' ? 'bg-amber-400' : 'bg-emerald-500 animate-pulse'"></span>
          <span>{{ room()?.status === 'completed' ? 'Session Concluded' : 'Mati (មតិ) Live Audience System' }}</span>
          <span class="text-slate-600">•</span>
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
  sessionStats = signal<{ totalQuestions: number; totalVotes: number; topQuestion?: string }>({ totalQuestions: 0, totalVotes: 0 });
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
        width: 256,
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
