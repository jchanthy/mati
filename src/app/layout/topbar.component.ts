import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="topbar-container flex justify-between items-center px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 shadow-xs">
      <div class="flex items-center gap-3">
        <button type="button" class="sidebar-toggle p-2 text-gray-600 hover:text-indigo-600 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" (click)="toggleSidebar()">
          <i class="pi pi-bars text-xl"></i>
        </button>
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20">
            ម
          </div>
          <div>
            <span class="text-xl font-extrabold tracking-tight text-gray-900 dark:text-white">Mati</span>
            <span class="text-xs font-semibold px-1.5 py-0.5 ml-1.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-md uppercase">Studio</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <a routerLink="/dashboard" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs">
          <i class="pi pi-plus text-xs"></i>
          <span>Create Room</span>
        </a>
        <a routerLink="/stage/MATI01" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 transition-all border border-indigo-200 dark:border-indigo-800">
          <i class="pi pi-desktop text-sm"></i>
          <span>Launch Stage</span>
        </a>
        <a routerLink="/join/MATI01" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 transition-all border border-emerald-200 dark:border-emerald-800">
          <i class="pi pi-mobile text-sm"></i>
          <span>Join Preview</span>
        </a>
        
        <div class="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-1"></div>

        <!-- Admin Badge -->
        <div class="flex items-center gap-2 pl-1">
          <div class="w-8 h-8 rounded-full bg-indigo-600/10 dark:bg-indigo-400/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
            <i class="pi pi-user"></i>
          </div>
          <span class="text-xs font-bold text-gray-900 dark:text-white hidden md:inline">
            Admin
          </span>
        </div>
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
  sidebarVisible = signal(true);

  toggleSidebar() {
    this.sidebarVisible.update(v => !v);
  }
}

