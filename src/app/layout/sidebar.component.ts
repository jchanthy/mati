import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MatiPollService } from '../services/mati-poll.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar-wrapper w-56 sm:w-60 bg-white border-r border-gray-200/90 py-5 px-3 flex flex-col justify-between h-[calc(100vh-4rem)] select-none">
      <!-- Main Nav Items -->
      <nav class="flex flex-col gap-1.5">
        <!-- My slidos (Active Item) -->
        <a 
          routerLink="/dashboard" 
          routerLinkActive="bg-[#E8F5E9] text-[#087A38] font-bold" 
          [routerLinkActiveOptions]="{exact: true}" 
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100/80 transition-colors">
          <i class="pi pi-chart-bar text-base text-[#087A38]"></i>
          <span>My slidos</span>
        </a>

        <!-- Team -->
        <a 
          [routerLink]="isAdmin() ? '/dashboard/users' : '/dashboard'" 
          routerLinkActive="bg-[#E8F5E9] text-[#087A38] font-bold" 
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100/80 transition-colors">
          <i class="pi pi-users text-base text-gray-500"></i>
          <span>Team</span>
        </a>

        <!-- Organization analytics -->
        <a 
          routerLink="/dashboard" 
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100/80 transition-colors">
          <i class="pi pi-chart-line text-base text-gray-500"></i>
          <span>Organization analytics</span>
        </a>

        <!-- Tutorials -->
        <a 
          routerLink="/dashboard" 
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100/80 transition-colors">
          <i class="pi pi-graduation-cap text-base text-gray-500"></i>
          <span>Tutorials</span>
        </a>

        <!-- Integrations Header -->
        <div class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 font-medium">
          <i class="pi pi-th-large text-base text-gray-500"></i>
          <span>Integrations</span>
        </div>

        <!-- Sub-integrations list (matching Slido screenshot) -->
        <div class="pl-7 flex flex-col gap-1 text-xs text-gray-600">
          <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-100/70 hover:text-gray-900 transition-colors">
            <span class="w-4 h-4 rounded-sm bg-orange-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">P</span>
            <span>PowerPoint</span>
          </a>
          <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-100/70 hover:text-gray-900 transition-colors">
            <span class="w-4 h-4 rounded-sm bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">S</span>
            <span>Google Slides</span>
          </a>
          <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-100/70 hover:text-gray-900 transition-colors">
            <span class="w-4 h-4 rounded-sm bg-indigo-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">T</span>
            <span>Microsoft Teams</span>
          </a>
          <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-100/70 hover:text-gray-900 transition-colors">
            <span class="w-4 h-4 rounded-sm bg-cyan-600 text-white font-bold text-[9px] flex items-center justify-center shrink-0">W</span>
            <span>Webex</span>
          </a>
          <a [routerLink]="['/stage', activeRoomCode()]" target="_blank" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-gray-100/70 hover:text-gray-900 transition-colors">
            <span class="w-4 h-4 rounded-sm bg-blue-500 text-white font-bold text-[9px] flex items-center justify-center shrink-0">Z</span>
            <span>Zoom</span>
          </a>
        </div>
      </nav>

      <!-- Bottom: Help (?) circle icon matching Slido screenshot -->
      <div class="pt-4 border-t border-gray-100">
        <button 
          type="button" 
          title="Help &amp; Support"
          class="w-8 h-8 rounded-full border border-gray-300 text-gray-700 font-bold text-sm flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
          ?
        </button>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar-wrapper {
      min-width: 14rem;
    }
  `]
})
export class SidebarComponent {
  private authService = inject(AuthService);
  private pollService = inject(MatiPollService);

  isAdmin = this.authService.isAdmin;
  currentUser = this.authService.currentUser;
  activeRoomCode = signal<string>('MATI01');

  constructor() {
    this.pollService.listenToActiveBroadcastRoom().subscribe(code => {
      this.activeRoomCode.set(code);
    });
  }
}
