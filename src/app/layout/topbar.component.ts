import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatiPollService } from '../services/mati-poll.service';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="topbar-container flex justify-between items-center px-4 sm:px-6 bg-white border-b border-gray-200/90 sticky top-0 z-50">
      <!-- Left: Mati Logo + Org Name -->
      <div class="flex items-center gap-3 sm:gap-6">
        <!-- Mati Brand Logo -->
        <a routerLink="/dashboard" class="flex items-center gap-1.5 no-underline select-none">
          <span class="text-2xl sm:text-[28px] font-black tracking-tight text-indigo-600 font-sans lowercase">mati</span>
        </a>

        <!-- Organization / Workspace info -->
        <div class="hidden sm:flex flex-col text-left border-l border-gray-200 pl-4 sm:pl-5">
          <span class="text-xs sm:text-sm font-bold text-gray-900 leading-tight truncate max-w-[200px]">
            {{ getOrgName() }}
          </span>
          <span class="text-[11px] text-gray-500 font-medium">
            {{ currentUser()?.role === 'admin' ? 'Administrator' : 'Owner' }}
          </span>
        </div>
      </div>

      <!-- Right: Quick Stage / Controller / What's new / User Avatar -->
      <div class="flex items-center gap-2.5 sm:gap-4">
        <!-- Controller Shortcut -->
        <a [routerLink]="['/dashboard/control', activeRoomCode()]" class="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors cursor-pointer" title="Live Controller">
          <i class="pi pi-sliders-h text-xs text-indigo-600"></i>
          <span>Controller</span>
        </a>

        <!-- Present Stage Shortcut -->
        <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" class="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors" title="Launch Presenter Stage">
          <i class="pi pi-desktop text-xs text-indigo-600"></i>
          <span>Present</span>
          <span class="text-[10px] font-mono font-bold px-1 rounded bg-indigo-50 text-indigo-600 border border-indigo-200">{{ activeRoomCode() }}</span>
        </a>

        <!-- What's new link -->
        <span class="text-xs font-medium text-gray-600 hover:text-gray-900 hidden sm:inline-block cursor-pointer">
          What's new
        </span>

        <!-- User Profile Avatar (Indigo circular border with initials) -->
        @if (currentUser(); as user) {
          <div class="relative">
            <button 
              type="button" 
              (click)="showUserMenu.set(!showUserMenu())"
              title="User profile"
              class="w-9 h-9 rounded-full border-2 border-indigo-600 text-indigo-600 font-bold text-xs flex items-center justify-center bg-white hover:bg-indigo-50 transition-colors cursor-pointer select-none">
              {{ getUserInitials() }}
            </button>

            <!-- User Menu Dropdown -->
            @if (showUserMenu()) {
              <div class="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50 animate-fadein">
                <div class="px-4 py-2 border-b border-gray-100">
                  <div class="text-xs font-bold text-gray-900 truncate">{{ user.displayName || user.email }}</div>
                  <div class="text-[11px] text-gray-500 truncate">{{ user.email }}</div>
                  <span class="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                    {{ user.role === 'admin' ? 'Administrator' : 'Owner' }}
                  </span>
                </div>
                <a routerLink="/dashboard" (click)="showUserMenu.set(false)" class="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600">
                  <i class="pi pi-chart-bar text-xs text-indigo-600"></i> My matis
                </a>
                <a [routerLink]="['/dashboard/control', activeRoomCode()]" (click)="showUserMenu.set(false)" class="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600">
                  <i class="pi pi-sliders-h text-xs text-gray-400"></i> Live Controller
                </a>
                <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" (click)="showUserMenu.set(false)" class="flex items-center gap-2 px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50/50 hover:text-indigo-600">
                  <i class="pi pi-desktop text-xs text-gray-400"></i> Presenter Stage
                </a>
                <div class="border-t border-gray-100 my-1"></div>
                <button type="button" (click)="logout()" class="w-full text-left flex items-center gap-2 px-4 py-2 text-xs text-red-600 hover:bg-red-50 cursor-pointer">
                  <i class="pi pi-sign-out text-xs"></i> Sign Out
                </button>
              </div>
            }
          </div>
        } @else {
          <a routerLink="/login" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-indigo-600 border border-indigo-600 hover:bg-indigo-50 transition-colors">
            Sign In
          </a>
        }
      </div>
    </header>
  `,
  styles: [`
    .topbar-container {
      height: 4rem;
    }
  `]
})
export class TopbarComponent {
  private authService = inject(AuthService);
  private pollService = inject(MatiPollService);

  currentUser = this.authService.currentUser;
  activeRoomCode = signal<string>('MATI01');
  showUserMenu = signal(false);

  constructor() {
    this.pollService.listenToActiveBroadcastRoom().subscribe(code => {
      this.activeRoomCode.set(code);
    });
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return 'JC';
    const name = user.displayName || user.email || 'JC';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  getOrgName(): string {
    const user = this.currentUser();
    if (!user) return "John's organization";
    const name = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || 'John';
    return `${name}'s organization`;
  }

  logout() {
    this.showUserMenu.set(false);
    this.authService.logout();
  }
}
