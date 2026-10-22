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
        <!-- My matis (Active Item) -->
        <a 
          routerLink="/dashboard" 
          routerLinkActive="bg-indigo-50 text-indigo-700 font-bold border-r-2 border-indigo-600" 
          [routerLinkActiveOptions]="{exact: true}" 
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100/80 transition-colors">
          <i class="pi pi-chart-bar text-base text-indigo-600"></i>
          <span>My matis</span>
        </a>

        <!-- Team (Admin User Management) -->
        @if (isAdmin()) {
          <a 
            routerLink="/dashboard/users" 
            routerLinkActive="bg-indigo-50 text-indigo-700 font-bold border-r-2 border-indigo-600" 
            class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-gray-700 hover:bg-gray-100/80 transition-colors">
            <i class="pi pi-users text-base text-gray-500"></i>
            <span>Team</span>
          </a>
        }
      </nav>
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
