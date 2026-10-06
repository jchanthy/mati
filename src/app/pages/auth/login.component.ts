import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex flex-col justify-center items-center p-4 bg-slate-950 text-white relative overflow-hidden select-none">
      <!-- Background Ambient Glow -->
      <div class="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div class="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none"></div>

      <!-- Main Login Container -->
      <div class="w-full max-w-md z-10 space-y-6">
        <!-- Logo & Header -->
        <div class="text-center space-y-2">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-indigo-500/30 mx-auto">
            ម
          </div>
          <h1 class="text-3xl font-black tracking-tight text-white">
            Mati (មតិ) Studio
          </h1>
          <p class="text-xs sm:text-sm text-slate-400 font-medium">
            Presenter & Classroom Admin Login
          </p>
        </div>

        <!-- Login Card -->
        <div class="p-6 sm:p-8 bg-slate-900/90 border border-slate-800 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
          <div class="space-y-1.5 text-center">
            <h2 class="text-lg font-bold text-white">Sign In to Dashboard</h2>
            <p class="text-xs text-slate-400">
              Authenticate with your Google account to create and manage live polling rooms.
            </p>
          </div>

          <!-- Error Alert -->
          @if (errorMessage()) {
            <div class="p-4 bg-red-950/80 border border-red-800 rounded-2xl text-red-200 text-xs flex items-start gap-3 animate-fadein leading-relaxed">
              <i class="pi pi-shield text-red-400 text-base shrink-0 mt-0.5"></i>
              <div class="space-y-0.5">
                <div class="font-bold text-red-100">Access Denied</div>
                <div class="text-[11px] text-red-300">{{ errorMessage() }}</div>
              </div>
            </div>
          }

          <!-- Google Login Button -->
          <button
            type="button"
            (click)="signInWithGoogle()"
            [disabled]="isLoggingIn()"
            class="w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl font-bold text-sm bg-white hover:bg-slate-100 text-slate-900 shadow-lg hover:shadow-indigo-500/10 transition-all active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
            @if (isLoggingIn()) {
              <i class="pi pi-spin pi-spinner text-base text-indigo-600"></i>
              <span>Signing in with Google...</span>
            } @else {
              <!-- Google Color SVG Icon -->
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            }
          </button>

          <!-- Divider -->
          <div class="relative flex items-center justify-center">
            <div class="border-t border-slate-800 w-full"></div>
            <span class="bg-slate-900 px-3 text-[11px] font-medium text-slate-500 uppercase tracking-wider absolute">Or Enter As Student</span>
          </div>

          <!-- Join Quick Box for Students -->
          <div class="text-center space-y-2 pt-1">
            <p class="text-xs text-slate-400">
              Are you an audience member or student?
            </p>
            <a
              routerLink="/join/MATI01"
              class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors">
              <i class="pi pi-mobile text-xs"></i>
              <span>Join a Live Session via PIN / QR</span>
            </a>
          </div>
        </div>

        <!-- Footer Notice -->
        <div class="text-center text-[11px] text-slate-500">
          Mati (មតិ) • Cambodia Academy of Digital Technology (CADT)
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  isLoggingIn = signal<boolean>(false);
  errorMessage = signal<string>('');

  async signInWithGoogle() {
    this.errorMessage.set('');
    this.isLoggingIn.set(true);
    try {
      await this.authService.loginWithGoogle();
      const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
      this.router.navigateByUrl(returnUrl);
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        this.errorMessage.set('Sign-in popup was closed. Please try again.');
      } else if (err?.code === 'auth/popup-blocked') {
        this.errorMessage.set('Popup was blocked by your browser. Please allow popups for this site.');
      } else {
        this.errorMessage.set(err?.message || 'Google authentication failed. Please try again.');
      }
    } finally {
      this.isLoggingIn.set(false);
    }
  }
}
