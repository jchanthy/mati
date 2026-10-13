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
    <div class="min-h-screen flex flex-col bg-[#F4F6F8]">
      <app-topbar></app-topbar>
      <div class="flex flex-1 overflow-hidden">
        <app-sidebar class="hidden md:block"></app-sidebar>
        <main class="flex-1 overflow-y-auto bg-[#F4F6F8]">
          <div class="w-full h-full min-h-[calc(100vh-4rem)] bg-white rounded-tl-2xl border-t border-l border-gray-200/90 p-5 sm:p-7 lg:p-8">
            <router-outlet></router-outlet>
          </div>
        </main>
      </div>
    </div>
  `
})
export class AppLayoutComponent {}
