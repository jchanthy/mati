import { Component, inject, signal, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatiPollService } from '../../services/mati-poll.service';
import { PollStats } from '../../models/poll.model';
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
      <main class="flex-1 flex flex-col justify-center my-auto py-2 z-10 max-w-7xl mx-auto w-full overflow-hidden">
        @if (pollStats(); as stats) {
          <!-- Question Title Bar -->
          <div class="text-center mb-4 sm:mb-6 space-y-2 shrink-0">
            <div class="flex items-center justify-center gap-2">
              <span class="inline-block px-3 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Question #{{ stats.poll.order }}
              </span>
              @if (stats.poll.isLocked) {
                <span class="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                  <i class="pi pi-lock text-[10px]"></i> Voting Locked
                </span>
              }
            </div>

            <h1 class="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-relaxed max-w-5xl mx-auto px-4 break-words">
              {{ stats.poll.question }}
            </h1>
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
            <!-- Live Grid Options: 2 columns if 4 options, full width if 2-3 options to fit TV screen -->
            <div class="grid gap-3 w-full" [ngClass]="stats.poll.options.length > 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-4xl mx-auto'">
              @for (opt of stats.poll.options; track opt.id) {
                <div class="bg-slate-900/90 border border-slate-800 p-4 sm:p-5 rounded-2xl backdrop-blur-md relative overflow-hidden transition-all flex flex-col justify-between shadow-lg">
                  <!-- Animated Progress bar background -->
                  <div 
                    class="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-600/40 via-indigo-500/30 to-blue-500/20 transition-all duration-700 ease-out" 
                    [style.width.%]="stats.percentages[opt.id] || 0">
                  </div>

                  <div class="relative z-10 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-3.5 flex-1 min-w-0">
                      <span class="w-8 h-8 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center font-black text-sm shrink-0">
                        {{ opt.id }}
                      </span>
                      <!-- Full wide option text without vertical compression -->
                      <span class="text-base sm:text-lg lg:text-xl font-bold text-slate-100 leading-snug break-words">
                        {{ opt.text }}
                      </span>
                    </div>

                    <div class="text-right shrink-0 pl-2">
                      <div class="text-2xl sm:text-3xl font-black text-white font-mono leading-none">
                        {{ stats.percentages[opt.id] || 0 }}%
                      </div>
                      <div class="text-[11px] text-slate-400 font-medium mt-1">
                        {{ stats.votesPerOption[opt.id] || 0 }} votes
                      </div>
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
      </main>

      <!-- Bottom Bar: Compact Footer with total vote counter -->
      <footer class="flex items-center justify-between gap-4 z-10 border-t border-slate-800/80 pt-3 shrink-0">
        <div class="text-xs text-slate-400 font-medium">
          Mati (មតិ) Live Audience System
        </div>

        <div class="flex items-center gap-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-xl">
          <i class="pi pi-users text-emerald-400 text-sm"></i>
          <span class="text-xs font-semibold text-slate-400">Total Votes:</span>
          <span class="text-lg font-black text-white font-mono">{{ pollStats()?.totalVotes || 0 }}</span>
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
  qrCodeDataUrl = signal<string>('');
  fullJoinUrl = signal<string>('');
  joinUrlShort = signal<string>('');

  private pollSub?: Subscription;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const code = (params.get('roomCode') || 'MATI01').toUpperCase();
      this.roomCode.set(code);
      this.setupUrls(code);
      this.generateQr(code);
      this.listenToPoll(code);
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
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
    });
  }
}
