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
    <div class="stage-container min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden relative">
      <!-- Background Ambient Glow -->
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Top Bar: Brand, PIN, Instructions -->
      <header class="flex flex-col sm:flex-row items-center justify-between gap-4 z-10 border-b border-slate-800/80 pb-6">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-500/30">
            ម
          </div>
          <div>
            <div class="flex items-center gap-2">
              <span class="text-3xl font-black tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">Mati</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-950 text-indigo-400 border border-indigo-800 uppercase tracking-widest">Stage</span>
            </div>
            <p class="text-xs text-slate-400 font-medium mt-0.5">Real-Time Audience Polling</p>
          </div>
        </div>

        <!-- Join Callout Banner -->
        <div class="flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-6 py-3 rounded-2xl backdrop-blur-md shadow-xl">
          <div class="text-right">
            <div class="text-xs uppercase tracking-wider text-slate-400 font-bold">Join at</div>
            <div class="text-sm font-semibold text-indigo-300">{{ joinUrlShort() }}</div>
          </div>
          <div class="h-8 w-px bg-slate-800"></div>
          <div>
            <div class="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Room PIN</div>
            <div class="text-2xl font-black text-amber-400 tracking-wider font-mono">{{ roomCode() }}</div>
          </div>
        </div>
      </header>

      <!-- Main Central Presentation Area -->
      <main class="my-auto py-8 z-10 max-w-6xl mx-auto w-full">
        @if (pollStats(); as stats) {
          <!-- Question Title -->
          <div class="text-center mb-10 space-y-3">
            <span class="inline-block px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Live Question #{{ stats.poll.order }}
            </span>
            <h1 class="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {{ stats.poll.question }}
            </h1>
            @if (stats.poll.isLocked) {
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 text-red-300 text-xs font-bold border border-red-500/30">
                <i class="pi pi-lock"></i> Voting has been closed by presenter
              </div>
            }
          </div>

          <!-- Hidden Results Overlay Mode -->
          @if (!stats.poll.showResults) {
            <div class="max-w-xl mx-auto p-10 bg-slate-900/80 border border-slate-800 rounded-3xl text-center space-y-4 backdrop-blur-md shadow-2xl">
              <div class="w-16 h-16 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mx-auto text-2xl animate-soft-pulse">
                <i class="pi pi-eye-slash"></i>
              </div>
              <h3 class="text-2xl font-bold text-white">Voting in progress...</h3>
              <p class="text-sm text-slate-400">
                Responses are being captured anonymously. Results will appear once the presenter unlocks the screen.
              </p>
              <div class="pt-2 text-indigo-400 font-bold text-lg">
                {{ stats.totalVotes }} participant{{ stats.totalVotes === 1 ? '' : 's' }} answered
              </div>
            </div>
          } @else {
            <!-- Live Animated Bar Charts -->
            <div class="space-y-4">
              @for (opt of stats.poll.options; track opt.id) {
                <div class="bg-slate-900/80 border border-slate-800/80 p-5 rounded-2xl backdrop-blur-md relative overflow-hidden transition-all duration-300 hover:border-indigo-500/50">
                  <!-- Progress bar fill background -->
                  <div 
                    class="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-700/40 via-indigo-600/30 to-blue-600/20 transition-all duration-700 ease-out" 
                    [style.width.%]="stats.percentages[opt.id] || 0">
                  </div>

                  <div class="relative z-10 flex items-center justify-between gap-4">
                    <div class="flex items-center gap-4">
                      <span class="w-9 h-9 rounded-xl bg-slate-800 text-indigo-400 border border-slate-700 flex items-center justify-center font-black text-sm shrink-0">
                        {{ opt.id }}
                      </span>
                      <span class="text-lg sm:text-xl font-bold text-slate-100">
                        {{ opt.text }}
                      </span>
                    </div>

                    <div class="text-right shrink-0">
                      <div class="text-2xl sm:text-3xl font-black text-white font-mono">
                        {{ stats.percentages[opt.id] || 0 }}%
                      </div>
                      <div class="text-xs text-slate-400 font-medium">
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
          <div class="text-center py-20 space-y-4">
            <div class="w-20 h-20 rounded-full bg-slate-900 text-indigo-400 border border-slate-800 flex items-center justify-center mx-auto text-3xl animate-bounce">
              <i class="pi pi-hourglass"></i>
            </div>
            <h2 class="text-3xl font-black text-white">Waiting for Presenter to launch poll...</h2>
            <p class="text-slate-400 max-w-md mx-auto text-sm">
              Scan the QR code below or enter PIN <span class="font-mono text-amber-400 font-bold">{{ roomCode() }}</span> to join this session.
            </p>
          </div>
        }
      </main>

      <!-- Bottom Bar: Dynamic QR Code & Total Votes -->
      <footer class="flex flex-col sm:flex-row items-center justify-between gap-6 z-10 border-t border-slate-800/80 pt-6">
        <div class="flex items-center gap-4">
          <div class="bg-white p-2 rounded-2xl shadow-xl flex items-center justify-center">
            @if (qrCodeDataUrl()) {
              <img [src]="qrCodeDataUrl()" alt="Join QR Code" class="w-20 h-20 sm:w-24 sm:h-24 rounded-lg" />
            } @else {
              <div class="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                QR Code
              </div>
            }
          </div>
          <div class="space-y-1">
            <div class="text-sm font-bold text-white flex items-center gap-1.5">
              <span>Scan to Vote with Phone</span>
              <i class="pi pi-camera text-indigo-400 text-xs"></i>
            </div>
            <p class="text-xs text-slate-400">No app download needed. Works directly in browser.</p>
            <div class="text-xs font-mono text-indigo-400 select-all">{{ fullJoinUrl() }}</div>
          </div>
        </div>

        <div class="flex items-center gap-4">
          <div class="text-right">
            <div class="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Audience</div>
            <div class="text-3xl font-black text-white font-mono flex items-center justify-end gap-2">
              <i class="pi pi-users text-emerald-400 text-xl"></i>
              <span>{{ pollStats()?.totalVotes || 0 }}</span>
            </div>
          </div>
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
