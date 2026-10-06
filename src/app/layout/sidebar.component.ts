import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <aside class="sidebar-wrapper w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 flex flex-col justify-between h-[calc(100vh-4rem)]">
      <nav class="flex flex-col gap-1">
        <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Mati Studio
        </div>

        <a routerLink="/dashboard" routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 font-semibold" [routerLinkActiveOptions]="{exact: true}" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <i class="pi pi-home text-base"></i>
          <span>Overview</span>
        </a>

        <a routerLink="/dashboard/control" routerLinkActive="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 font-semibold" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <i class="pi pi-sliders-h text-base"></i>
          <span>Live Controller</span>
        </a>

        <div class="my-2">
          <a routerLink="/dashboard" class="flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all cursor-pointer">
            <i class="pi pi-plus"></i>
            <span>Create New Room</span>
          </a>
        </div>

        <div class="mt-4 px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Audience Stages
        </div>

        <a routerLink="/stage/MATI01" target="_blank" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <i class="pi pi-window-maximize text-base text-indigo-500"></i>
          <span>Projector Stage</span>
          <i class="pi pi-external-link text-xs ml-auto text-gray-400"></i>
        </a>

        <a routerLink="/join/MATI01" target="_blank" class="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <i class="pi pi-mobile text-base text-emerald-500"></i>
          <span>Participant Mobile</span>
          <i class="pi pi-external-link text-xs ml-auto text-gray-400"></i>
        </a>
      </nav>

      <div class="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
        <div class="flex items-center gap-2 mb-1">
          <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span class="text-xs font-bold text-gray-900 dark:text-white">Firestore Live</span>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
          Real-time atomic listeners active.
        </p>
        <div class="text-[11px] font-mono bg-white dark:bg-gray-900 px-2 py-1 rounded text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
          Room: MATI01
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar-wrapper {
      min-width: 16rem;
    }
  `]
})
export class SidebarComponent {}
