import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TopbarComponent } from './topbar.component';
import { SidebarComponent } from './sidebar.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, TopbarComponent, SidebarComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950">
      <app-topbar></app-topbar>
      <div class="flex flex-1 overflow-hidden">
        <app-sidebar class="hidden md:block"></app-sidebar>
        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-gray-50/50 dark:bg-gray-950/50">
          <div class="max-w-7xl mx-auto">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `
})
export class AppLayoutComponent {}
