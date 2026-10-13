import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MatiPollService } from '../../services/mati-poll.service';
import { AuthService } from '../../services/auth.service';
import { Room, Poll } from '../../models/poll.model';
import { QuestionImporter, MoodleXmlParser, CsvQuestionParser, ParsedQuestion } from '../../utils/moodle-xml-parser';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    CardModule,
    ButtonModule,
    TagModule,
    DialogModule,
    InputTextModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="space-y-6" (click)="closeRoomMenu()">
      <p-toast></p-toast>

      <!-- Slido Top Header: Tabs on Left + "+ Create slido" Button on Right -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <!-- Tabs matching Slido screenshot: All [N], Active & upcoming [N], Past [N] -->
        <div class="flex items-center gap-2">
          <!-- All Tab -->
          <button 
            type="button" 
            (click)="setTab('all')" 
            [ngClass]="activeTab() === 'all' 
              ? 'border-2 border-[#087A38] bg-white text-gray-900 font-bold shadow-2xs' 
              : 'border border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'"
            class="px-3.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all cursor-pointer">
            <span>All</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold"
              [ngClass]="activeTab() === 'all' ? 'bg-[#087A38] text-white' : 'bg-gray-100 text-gray-600'">
              {{ allMatisCount() }}
            </span>
          </button>

          <!-- Active & upcoming Tab -->
          <button 
            type="button" 
            (click)="setTab('active')" 
            [ngClass]="activeTab() === 'active' 
              ? 'border-2 border-[#087A38] bg-white text-gray-900 font-bold shadow-2xs' 
              : 'border border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'"
            class="px-3.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all cursor-pointer">
            <span>Active &amp; upcoming</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold"
              [ngClass]="activeTab() === 'active' ? 'bg-[#087A38] text-white' : 'bg-gray-100 text-gray-600'">
              {{ activeMatisCount() }}
            </span>
          </button>

          <!-- Past Tab -->
          <button 
            type="button" 
            (click)="setTab('past')" 
            [ngClass]="activeTab() === 'past' 
              ? 'border-2 border-[#087A38] bg-white text-gray-900 font-bold shadow-2xs' 
              : 'border border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-100 font-medium'"
            class="px-3.5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all cursor-pointer">
            <span>Past</span>
            <span class="px-2 py-0.5 rounded-full text-xs font-bold"
              [ngClass]="activeTab() === 'past' ? 'bg-[#087A38] text-white' : 'bg-gray-100 text-gray-600'">
              {{ pastMatisCount() }}
            </span>
          </button>
        </div>

        <!-- + Create mati Primary Button -->
        <button 
          type="button" 
          (click)="openNewRoomDialog()" 
          class="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm bg-[#087A38] hover:bg-[#06652e] text-white shadow-xs transition-all cursor-pointer select-none">
          <i class="pi pi-plus text-xs"></i>
          <span>Create mati</span>
        </button>
      </div>

      <!-- Mati Filter & Search Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <!-- Search Input with Magnifying Glass -->
        <div class="relative w-full sm:w-80">
          <input 
            type="text" 
            [ngModel]="searchQuery()"
            (ngModelChange)="searchQuery.set($event)"
            placeholder="Search by name, owner, code" 
            class="w-full pl-3.5 pr-9 py-2 rounded-lg border border-gray-300 text-sm placeholder-gray-400 focus:outline-none focus:border-[#087A38] focus:ring-1 focus:ring-[#087A38] bg-white transition-all" />
          <i class="pi pi-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none"></i>
        </div>

        <!-- Dropdown Filter -->
        <div class="relative">
          <select 
            [ngModel]="matiDropdownFilter()"
            (ngModelChange)="matiDropdownFilter.set($event)"
            class="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 text-sm font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-1 focus:ring-[#087A38] cursor-pointer">
            <option value="all">All matis</option>
            <option value="mine">My matis</option>
            <option value="survey">Surveys</option>
          </select>
          <i class="pi pi-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs pointer-events-none"></i>
        </div>
      </div>

      <!-- Mati Details Table (matching Slido screenshot) -->
      <div class="border border-gray-200/90 rounded-xl bg-white shadow-2xs relative z-30">
        <!-- Table Header -->
        <div class="bg-gray-50/60 border-b border-gray-200 px-4 sm:px-6 py-3.5 flex items-center text-xs font-semibold text-gray-600 rounded-t-xl">
          <div class="w-8 shrink-0">
            <input 
              type="checkbox" 
              (change)="toggleSelectAllRooms($event)"
              class="w-4 h-4 rounded text-[#087A38] focus:ring-[#087A38] cursor-pointer border-gray-300" />
          </div>
          <div class="flex-1 min-w-0">Mati details</div>
          <div class="w-40 sm:w-56 text-left hidden sm:block">Status</div>
          <div class="w-40 sm:w-48 text-right">More actions</div>
        </div>

        <!-- Table Rows -->
        <div class="divide-y divide-gray-100">
          @for (r of filteredRooms(); track r.code) {
            <div 
              (click)="switchRoom(r.code)"
              class="px-4 sm:px-6 py-4 flex items-center transition-colors group cursor-pointer relative hover:bg-gray-50/80"
              [class.border-l-4]="selectedRoomCode() === r.code"
              [style.borderLeftColor]="selectedRoomCode() === r.code ? '#087A38' : 'transparent'"
              [style.backgroundColor]="selectedRoomCode() === r.code ? 'rgba(236, 253, 245, 0.4)' : null"
              [class.z-50]="activeMenuRoom() === r.code"
              [class.z-0]="activeMenuRoom() !== r.code">
              
              <!-- Checkbox -->
              <div class="w-8 shrink-0" (click)="$event.stopPropagation()">
                <input 
                  type="checkbox" 
                  [checked]="isRoomChecked(r.code)"
                  (change)="toggleRoomCheck(r.code, $event)"
                  class="w-4 h-4 rounded text-[#087A38] focus:ring-[#087A38] cursor-pointer border-gray-300" />
              </div>

              <!-- Slido details: Title (#code) and date range -->
              <div class="flex-1 min-w-0 pr-4">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-gray-900 group-hover:text-[#087A38] transition-colors truncate">
                    {{ r.title || ('Room ' + r.code) }}
                  </span>
                  <span class="text-xs font-mono font-semibold text-gray-500">
                    (#{{ r.code }})
                  </span>
                </div>
                <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                  <span>{{ formatRoomDate(r) }}</span>
                  <span>•</span>
                  <span>{{ selectedRoomCode() === r.code ? polls().length + ' polls' : 'Session ready' }}</span>
                </div>
              </div>

              <!-- Status column -->
              <div class="w-40 sm:w-56 text-left hidden sm:flex items-center gap-2 text-xs font-medium text-gray-600">
                @if (!isRoomActive(r)) {
                  <span class="inline-flex items-center gap-1.5 text-gray-600 bg-gray-100 px-2.5 py-1 rounded-md border border-gray-200 font-medium">
                    <i class="pi pi-pause-circle text-xs text-gray-400"></i>
                    <span>Inactive</span>
                  </span>
                } @else if (r.mode === 'survey') {
                  <span class="inline-flex items-center gap-1.5 text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 font-medium">
                    <i class="pi pi-list text-xs"></i>
                    <span>Survey</span>
                  </span>
                } @else {
                  <span class="inline-flex items-center gap-1.5 text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold">
                    <span class="w-1.5 h-1.5 rounded-full bg-[#087A38] animate-pulse"></span>
                    <span>Active &amp; upcoming</span>
                  </span>
                }
              </div>

              <!-- More actions column -->
              <div class="w-40 sm:w-48 text-right flex items-center justify-end gap-1.5" (click)="$event.stopPropagation()">
                <!-- Quick Add question icon [+] -->
                <button 
                  type="button" 
                  (click)="openAddQuestionForRoom(r.code)"
                  title="Add Question" 
                  class="p-1.5 rounded-lg text-gray-500 hover:text-[#087A38] hover:bg-emerald-50 transition-colors cursor-pointer">
                  <i class="pi pi-plus-circle text-base"></i>
                </button>

                <!-- Present Stage [TV] -->
                <a 
                  [routerLink]="['/stage', r.code]" 
                  target="_blank" 
                  title="Launch Presenter Stage" 
                  class="p-1.5 rounded-lg text-gray-500 hover:text-[#087A38] hover:bg-emerald-50 transition-colors cursor-pointer">
                  <i class="pi pi-desktop text-sm"></i>
                </a>

                <!-- Controller [Sliders] -->
                <a 
                  [routerLink]="['/dashboard/control', r.code]" 
                  title="Remote Controller" 
                  class="p-1.5 rounded-lg text-gray-500 hover:text-[#087A38] hover:bg-emerald-50 transition-colors cursor-pointer">
                  <i class="pi pi-sliders-h text-sm"></i>
                </a>

                <!-- More menu [...] -->
                <div class="relative" [class.z-50]="activeMenuRoom() === r.code">
                  <button 
                    type="button" 
                    (click)="toggleRoomMenu(r.code, $event)"
                    title="More actions" 
                    class="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer">
                    <i class="pi pi-ellipsis-h text-sm"></i>
                  </button>

                  <!-- Slido-Style Popover Menu -->
                  @if (activeMenuRoom() === r.code) {
                    <div 
                      (click)="$event.stopPropagation()"
                      class="absolute right-0 top-full mt-2 w-80 sm:w-[330px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[100] text-left overflow-hidden animate-fadein">
                      
                      <!-- Top Upgrade Banner -->
                      <div class="bg-gradient-to-r from-[#B45309] to-[#92400E] px-4 py-2.5 flex items-center gap-2.5 text-white text-xs font-semibold select-none">
                        <div class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                          <i class="pi pi-crown text-[10px] text-white"></i>
                        </div>
                        <span class="truncate">Click here to upgrade your mati account</span>
                      </div>

                      <div class="p-4 space-y-3.5">
                        <!-- Room Header: Title, dates, owner, and status badge -->
                        <div class="flex items-start justify-between gap-3">
                          <div class="min-w-0 flex-1">
                            <h4 class="text-base font-bold text-gray-900 leading-snug truncate" [title]="r.title || ('Room ' + r.code)">
                              {{ r.title || ('Room ' + r.code) }}
                            </h4>
                            <div class="flex flex-col text-xs text-gray-500 mt-1 space-y-0.5">
                              <div class="flex items-center gap-1.5 truncate">
                                <i class="pi pi-calendar text-[11px] text-gray-400"></i>
                                <span>{{ formatRoomDates(r) || formatRoomDate(r) }}</span>
                              </div>
                              <div class="flex items-center gap-1.5 truncate">
                                <i class="pi pi-user text-[11px] text-gray-400"></i>
                                <span>{{ getOwnerDisplayName(r) }}</span>
                              </div>
                            </div>
                          </div>

                          <!-- Active now vs Inactive badge -->
                          @if (isRoomActive(r)) {
                            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-[#E8F5E9] text-[#087A38] shrink-0 border border-emerald-200">
                              Active now
                            </span>
                          } @else {
                            <span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-600 shrink-0 border border-gray-200">
                              Inactive
                            </span>
                          }
                        </div>

                        <!-- Action Tiles Grid -->
                        @if (isRoomActive(r)) {
                          <!-- ACTIVE NOW TILES: Copy link & Copy code -->
                          <div class="grid grid-cols-2 gap-2.5">
                            <!-- Copy mati link -->
                            <button 
                              type="button" 
                              (click)="copyRoomLink(r.code)"
                              class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-[#087A38] bg-white hover:bg-emerald-50/20 text-center transition-all cursor-pointer group shadow-2xs">
                              <div class="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-emerald-100/60 flex items-center justify-center text-gray-700 group-hover:text-[#087A38] mb-1.5 transition-colors">
                                <i class="pi pi-mobile text-sm"></i>
                              </div>
                              <span class="text-xs font-semibold text-gray-800 group-hover:text-[#087A38]">
                                Copy mati link
                              </span>
                            </button>

                            <!-- Copy mati code -->
                            <button 
                              type="button" 
                              (click)="copyRoomCode(r.code)"
                              class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-[#087A38] bg-white hover:bg-emerald-50/20 text-center transition-all cursor-pointer group shadow-2xs">
                              <div class="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-emerald-100/60 flex items-center justify-center text-gray-700 group-hover:text-[#087A38] mb-1.5 transition-colors">
                                <span class="font-mono font-bold text-sm">#</span>
                              </div>
                              <span class="text-xs font-semibold text-gray-800 group-hover:text-[#087A38]">
                                Copy mati code
                              </span>
                            </button>
                          </div>
                        } @else {
                          <!-- INACTIVE TILES: View results & Duplicate -->
                          <div class="grid grid-cols-2 gap-2.5">
                            <!-- View results -->
                            <a 
                              [routerLink]="['/stage', r.code]" 
                              target="_blank"
                              (click)="activeMenuRoom.set(null)"
                              class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-[#087A38] bg-white hover:bg-emerald-50/20 text-center transition-all cursor-pointer group shadow-2xs no-underline">
                              <div class="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-emerald-100/60 flex items-center justify-center text-gray-700 group-hover:text-[#087A38] mb-1.5 transition-colors">
                                <i class="pi pi-chart-bar text-sm"></i>
                              </div>
                              <span class="text-xs font-semibold text-gray-800 group-hover:text-[#087A38]">
                                View results
                              </span>
                            </a>

                            <!-- Duplicate -->
                            <button 
                              type="button" 
                              (click)="duplicateRoom(r.code)"
                              class="flex flex-col items-center justify-center p-3 rounded-xl border border-gray-200 hover:border-[#087A38] bg-white hover:bg-emerald-50/20 text-center transition-all cursor-pointer group shadow-2xs">
                              <div class="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-emerald-100/60 flex items-center justify-center text-gray-700 group-hover:text-[#087A38] mb-1.5 transition-colors">
                                <i class="pi pi-clone text-sm"></i>
                              </div>
                              <span class="text-xs font-semibold text-gray-800 group-hover:text-[#087A38]">
                                Duplicate
                              </span>
                            </button>
                          </div>
                        }

                        <!-- Wide Duplicate Card (matching Slido screenshot) -->
                        <div 
                          (click)="duplicateRoom(r.code)"
                          class="flex items-center rounded-xl border border-gray-200 hover:border-[#087A38] bg-white hover:bg-emerald-50/10 overflow-hidden cursor-pointer group transition-all shadow-2xs">
                          <div class="w-16 self-stretch bg-[#F0FDF4] border-r border-emerald-100 flex items-center justify-center p-3 text-[#087A38]">
                            <div class="w-8 h-8 rounded-lg border-2 border-[#087A38] flex items-center justify-center">
                              <i class="pi pi-plus text-xs font-bold"></i>
                            </div>
                          </div>
                          <div class="p-3 text-left flex-1 min-w-0">
                            <div class="text-xs font-bold text-gray-900 group-hover:text-[#087A38] transition-colors">
                              Duplicate
                            </div>
                            <div class="text-[11px] text-gray-500 leading-tight mt-0.5">
                              Create a fresh mati using polls and settings from this mati.
                            </div>
                          </div>
                        </div>

                        <!-- Quick Session Actions (Manage & Pick) -->
                        <div class="flex items-center gap-2 pt-1 text-xs">
                          <button 
                            type="button" 
                            (click)="switchRoom(r.code); activeMenuRoom.set(null)"
                            class="flex-1 py-1 px-2 rounded-md border border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 font-medium flex items-center justify-center gap-1 cursor-pointer">
                            <i class="pi pi-folder-open text-[10px] text-gray-500"></i>
                            <span>Manage Questions</span>
                          </button>
                          <button 
                            type="button" 
                            (click)="switchRoom(r.code); openPickQuestionsDialog(); activeMenuRoom.set(null)"
                            class="flex-1 py-1 px-2 rounded-md border border-gray-200 hover:border-gray-300 text-gray-700 hover:bg-gray-50 font-medium flex items-center justify-center gap-1 cursor-pointer">
                            <i class="pi pi-check-square text-[10px] text-gray-500"></i>
                            <span>Pick Questions</span>
                          </button>
                        </div>

                        <!-- Bottom Action Row: Toggle Active / Inactive & Delete -->
                        <div class="flex items-center border-t border-gray-100 pt-2 text-xs">
                          <button 
                            type="button" 
                            (click)="toggleRoomActiveStatus(r)"
                            class="flex-1 py-1.5 px-3 text-gray-700 hover:bg-gray-100 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer">
                            <i class="pi pi-sync text-xs text-gray-500"></i>
                            <span>{{ isRoomActive(r) ? 'Set Inactive' : 'Set Active' }}</span>
                          </button>
                          <div class="w-px h-5 bg-gray-200 mx-1"></div>
                          <button 
                            type="button" 
                            (click)="deleteRoom(r.code); activeMenuRoom.set(null)"
                            class="flex-1 py-1.5 px-3 text-red-600 hover:bg-red-50 rounded-lg flex items-center justify-center gap-1.5 font-medium transition-colors cursor-pointer">
                            <i class="pi pi-trash text-xs"></i>
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            </div>
          } @empty {
            <div class="text-center py-12 px-4 text-gray-500 text-sm">
              <i class="pi pi-inbox text-3xl text-gray-300 mb-2 block"></i>
              No matis found in this view. Click <button type="button" (click)="openNewRoomDialog()" class="font-bold text-[#087A38] hover:underline cursor-pointer">+ Create mati</button> to add your first session!
            </div>
          }
        </div>

        <!-- Table Footer Pagination matching Slido screenshot -->
        <div class="bg-white border-t border-gray-200 px-4 sm:px-6 py-3.5 flex items-center justify-between text-xs text-gray-500 select-none rounded-b-xl relative z-0">
          <div>Page 1</div>
          <div class="flex items-center gap-4">
            <span class="hover:text-gray-900 cursor-pointer flex items-center gap-1">
              <i class="pi pi-angle-left text-[10px]"></i> Previous
            </span>
            <span class="hover:text-gray-900 cursor-pointer flex items-center gap-1">
              Next <i class="pi pi-angle-right text-[10px]"></i>
            </span>
          </div>
        </div>
      </div>

      <!-- Mati Questions Management Workspace for the Selected Mati -->
      <div class="bg-white rounded-xl border border-gray-200/90 p-5 sm:p-6 shadow-2xs space-y-4 relative z-10">
        <!-- Slido Question Header -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-gray-200">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-lg font-bold text-gray-900">
                Questions in {{ getSelectedRoomTitle() }}
              </h2>
              <span class="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-[#087A38] border border-emerald-200">
                #{{ selectedRoomCode() }}
              </span>
            </div>
            <p class="text-xs text-gray-500 mt-0.5">
              Select or activate polls live on stage, pick subsets, or import questions.
            </p>
          </div>

          <!-- Actions matching Slido green accents -->
          <div class="flex items-center gap-2 flex-wrap">
            <button 
              type="button" 
              (click)="openPickQuestionsDialog()" 
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer">
              <i class="pi pi-check-square text-xs text-[#087A38]"></i>
              <span>Pick Questions ({{ selectedQuestionCount() || allRawPolls().length }})</span>
            </button>

            <button 
              type="button" 
              (click)="openImportForRoom(selectedRoomCode())" 
              class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 transition-colors flex items-center gap-1.5 cursor-pointer">
              <i class="pi pi-file-import text-xs"></i>
              <span>Import (CSV / XML)</span>
            </button>

            <button 
              type="button" 
              (click)="openAddQuestionForRoom(selectedRoomCode())" 
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#087A38] hover:bg-[#06652e] text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs">
              <i class="pi pi-plus text-xs"></i>
              <span>+ Add Question</span>
            </button>
          </div>
        </div>

        <!-- Questions List -->
        <div class="space-y-3">
          @for (poll of polls(); track poll.id; let idx = $index) {
            <div 
              class="p-4 rounded-xl border transition-all"
              [ngClass]="currentRoom()?.activePollId === poll.id 
                ? 'border-[#087A38] bg-emerald-50/20 shadow-xs ring-1 ring-[#087A38]' 
                : 'border-gray-200 bg-white hover:border-gray-300'">
              
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div class="space-y-1.5 flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="w-6 h-6 rounded-full bg-gray-100 text-xs font-bold flex items-center justify-center text-gray-700">
                      {{ idx + 1 }}
                    </span>
                    <h3 class="text-sm font-bold text-gray-900 leading-snug break-words">
                      {{ poll.question }}
                    </h3>
                    @if (currentRoom()?.activePollId === poll.id) {
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-[#087A38] border border-emerald-300 flex items-center gap-1">
                        <span class="w-1.5 h-1.5 rounded-full bg-[#087A38] animate-pulse"></span>
                        LIVE ON STAGE
                      </span>
                    }
                    @if (poll.isLocked) {
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">
                        LOCKED
                      </span>
                    }
                  </div>

                  <!-- Options list -->
                  <div class="flex flex-wrap gap-1.5 pt-1">
                    @for (opt of poll.options; track opt.id) {
                      <span class="text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5"
                        [ngClass]="poll.correctOptionId === opt.id 
                          ? 'bg-emerald-50 text-[#087A38] border-emerald-300 font-bold' 
                          : 'bg-gray-50 text-gray-600 border-gray-200'">
                        <span>{{ opt.id }}. {{ opt.text }}</span>
                        @if (poll.correctOptionId === opt.id) {
                          <i class="pi pi-check text-[10px]"></i>
                        }
                      </span>
                    }
                  </div>
                </div>

                <!-- Action buttons -->
                <div class="flex items-center gap-2 shrink-0 self-end md:self-center">
                  @if (currentRoom()?.activePollId !== poll.id) {
                    <button 
                      type="button" 
                      (click)="setAsLive(poll.id)" 
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#087A38] hover:bg-[#06652e] text-white flex items-center gap-1 cursor-pointer transition-colors shadow-2xs">
                      <i class="pi pi-play text-[10px]"></i>
                      <span>Present</span>
                    </button>
                  } @else {
                    <a 
                      [routerLink]="['/dashboard/control', selectedRoomCode()]" 
                      class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-900 hover:bg-black text-white flex items-center gap-1 cursor-pointer transition-colors">
                      <i class="pi pi-sliders-h text-[10px]"></i>
                      <span>Controller</span>
                    </a>
                  }

                  <button 
                    type="button" 
                    (click)="deletePoll(poll.id)" 
                    title="Delete Question"
                    class="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer">
                    <i class="pi pi-trash text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          } @empty {
            <div class="text-center py-10 px-4 rounded-xl border border-dashed border-gray-200 bg-gray-50/50 space-y-3">
              <i class="pi pi-question-circle text-2xl text-gray-400"></i>
              <div class="text-xs text-gray-500">
                No questions in Mati <strong>#{{ selectedRoomCode() }}</strong> yet.
              </div>
              <div class="flex items-center justify-center gap-2 pt-1">
                <button 
                  type="button" 
                  (click)="openAddQuestionForRoom(selectedRoomCode())" 
                  class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#087A38] text-white hover:bg-[#06652e] cursor-pointer">
                  + Add Question
                </button>
                <button 
                  type="button" 
                  (click)="openImportForRoom(selectedRoomCode())" 
                  class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer">
                  Import Questions
                </button>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Create Mati Dialog -->
      <p-dialog 
        [(visible)]="showNewRoomDialog" 
        [modal]="true" 
        [closable]="false" 
        [showHeader]="false" 
        [style]="{ width: '560px', maxWidth: '95vw', border: 'none', background: 'transparent', boxShadow: 'none' }" 
        [contentStyle]="{ padding: '0', borderRadius: '16px', overflow: 'hidden' }"
        styleClass="border-0 shadow-2xl rounded-2xl overflow-hidden p-0">
        <div class="bg-white p-6 sm:p-7 rounded-2xl space-y-5 border border-gray-100 shadow-2xl">
          <!-- Dialog Title -->
          <div class="text-xl font-bold text-gray-900 tracking-tight">
            Create your mati
          </div>

          <!-- Mati Name Field -->
          <div>
            <label class="block text-sm font-semibold text-gray-800 mb-1.5">
              Give your mati a name
            </label>
            <input 
              type="text" 
              [(ngModel)]="newRoomTitle" 
              (keydown.enter)="createNewRoom()"
              placeholder="Mati name" 
              class="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors" />
          </div>

          <!-- Start Date & End Date Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <!-- Start date -->
            <div>
              <label class="block text-sm font-semibold text-gray-800 mb-1.5">
                Start date
              </label>
              <div 
                class="relative flex items-center justify-between w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm hover:border-gray-400 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900 transition-colors cursor-pointer">
                <span class="text-gray-900 font-medium select-none truncate">
                  {{ formatDisplayDate(newRoomStartDate) || 'Select date' }}
                </span>
                <i class="pi pi-calendar text-gray-500 text-sm shrink-0"></i>
                <input 
                  type="date" 
                  [(ngModel)]="newRoomStartDate" 
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </div>

            <!-- End date -->
            <div>
              <label class="block text-sm font-semibold text-gray-800 mb-1.5">
                End date
              </label>
              <div 
                class="relative flex items-center justify-between w-full px-3.5 py-2.5 rounded-lg border border-gray-300 bg-white text-sm hover:border-gray-400 focus-within:border-gray-900 focus-within:ring-1 focus-within:ring-gray-900 transition-colors cursor-pointer">
                <span class="text-gray-900 font-medium select-none truncate">
                  {{ formatDisplayDate(newRoomEndDate) || 'Select date' }}
                </span>
                <i class="pi pi-calendar text-gray-500 text-sm shrink-0"></i>
                <input 
                  type="date" 
                  [(ngModel)]="newRoomEndDate" 
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
              </div>
            </div>
          </div>

          <!-- Optional Room PIN / Custom Code -->
          <div>
            @if (!showCustomCodeInput) {
              <button 
                type="button" 
                (click)="showCustomCodeInput = true" 
                class="text-xs text-gray-500 hover:text-gray-800 font-medium inline-flex items-center gap-1.5 cursor-pointer">
                <i class="pi pi-sliders-h text-[10px]"></i>
                <span>Custom room code (optional)</span>
              </button>
            } @else {
              <div class="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="block text-xs font-semibold text-gray-700">Mati Code (PIN)</label>
                  <button type="button" (click)="showCustomCodeInput = false; newRoomCode = ''" class="text-[11px] text-gray-400 hover:text-gray-600">Auto-generate</button>
                </div>
                <input 
                  type="text" 
                  [(ngModel)]="newRoomCode" 
                  placeholder="Leave blank for auto PIN (e.g. MATI02)" 
                  class="w-full px-3 py-1.5 rounded-md border border-gray-300 text-xs text-gray-900 uppercase font-mono placeholder:text-gray-400 focus:outline-none focus:border-gray-900" />
              </div>
            }
          </div>

          <!-- Dialog Footer matching Slido screenshot -->
          <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
            <!-- Info Pill on left -->
            <div class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F0F7FD] border border-[#D0E2F2] text-[#1E5A8A] text-xs font-normal">
              <i class="pi pi-info-circle text-sm text-[#1E5A8A] shrink-0"></i>
              <span class="truncate">Anyone with the code or link can participate</span>
            </div>

            <!-- Action buttons on right -->
            <div class="flex items-center justify-end gap-3 shrink-0">
              <button 
                type="button" 
                (click)="showNewRoomDialog = false"
                class="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
                Cancel
              </button>
              <button 
                type="button" 
                (click)="createNewRoom()"
                [disabled]="!newRoomTitle.trim()"
                class="px-5 py-2 text-sm font-semibold text-white bg-[#087A38] hover:bg-[#06652E] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-2xs transition-colors cursor-pointer">
                Create mati
              </button>
            </div>
          </div>
        </div>
      </p-dialog>

      <!-- Create Poll Dialog -->
      <p-dialog [header]="'Create Question for Room ' + targetRoomForNewPoll()" [(visible)]="showNewPollDialog" [modal]="true" [style]="{width: '550px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <!-- Target Room Selector -->
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1 flex items-center justify-between">
              <span>Target Room</span>
              <span class="text-indigo-600 dark:text-indigo-400 font-normal">Question will be added here</span>
            </label>
            <select [ngModel]="targetRoomForNewPoll()" (ngModelChange)="targetRoomForNewPoll.set($event)" class="w-full p-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              @for (r of rooms(); track r.code) {
                <option [value]="r.code">{{ r.code }} - {{ r.title || ('Room ' + r.code) }}</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Question</label>
            <input pInputText type="text" [(ngModel)]="newPollQuestion" placeholder="e.g. Which framework is your favorite?" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Options (One per line)</label>
            <textarea [(ngModel)]="newPollOptionsRaw" rows="4" placeholder="Angular 19&#10;React 19&#10;Vue 3&#10;Svelte 5" class="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Correct Option Number (Optional, 1-based)</label>
            <input pInputText type="number" [(ngModel)]="newPollCorrectIndex" placeholder="e.g. 1" class="w-full" />
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewPollDialog = false"></button>
          <button pButton label="Save Question" icon="pi pi-check" class="p-button-primary" (click)="createNewPoll()"></button>
        </ng-template>
      </p-dialog>

      <!-- Import Questions Dialog (CSV & Moodle XML) -->
      <p-dialog header="Import Questions (CSV / Moodle XML)" [(visible)]="showImportDialog" [modal]="true" [style]="{width: '740px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <!-- Information Banner -->
          <div class="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-xs text-indigo-950 dark:text-indigo-200 space-y-2">
            <div class="font-bold flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
              <i class="pi pi-file-excel text-sm"></i>
              Supported Formats: CSV, TSV, or Moodle XML
            </div>
            <p class="leading-relaxed">
              Upload a <strong>CSV / TSV</strong> spreadsheet or a <strong>Moodle XML</strong> export file. Mati automatically detects the format, question titles, multiple choices (2 to 8 answers), and correct answer markings.
            </p>
            <div class="flex flex-wrap items-center gap-2 pt-1">
              <button 
                type="button" 
                (click)="downloadCsvTemplate()" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer">
                <i class="pi pi-download"></i>
                <span>Download CSV Template</span>
              </button>
              <button 
                type="button" 
                (click)="loadSampleCsv()" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 transition-all cursor-pointer">
                <i class="pi pi-file-edit"></i>
                <span>Load Sample CSV</span>
              </button>
              <button 
                type="button" 
                (click)="loadSampleXml()" 
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 transition-all cursor-pointer">
                <i class="pi pi-code"></i>
                <span>Load Sample XML</span>
              </button>
            </div>
          </div>

          <!-- Target Room Selection -->
          <div class="flex items-center justify-between p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-xs gap-3">
            <label class="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <i class="pi pi-building text-indigo-600 dark:text-indigo-400 text-sm"></i>
              <span>Target Room to Receive Questions:</span>
            </label>
            <select [ngModel]="targetRoomForImport()" (ngModelChange)="targetRoomForImport.set($event)" class="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs font-bold text-indigo-600 dark:text-indigo-400 focus:ring-2 focus:ring-indigo-500 cursor-pointer">
              @for (r of rooms(); track r.code) {
                <option [value]="r.code">{{ r.code }} - {{ r.title || ('Room ' + r.code) }}</option>
              }
            </select>
          </div>

          <!-- File Upload Zone -->
          <div class="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-5 text-center hover:border-indigo-500 transition-colors bg-gray-50/50 dark:bg-gray-900/50">
            <input type="file" #fileInput (change)="onFileSelected($event)" accept=".csv,.tsv,.xml,text/csv,text/xml,application/xml" class="hidden" />
            <div class="space-y-1.5 cursor-pointer" (click)="fileInput.click()">
              <div class="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto text-lg">
                <i class="pi pi-cloud-upload"></i>
              </div>
              <div class="text-sm font-bold text-gray-800 dark:text-gray-200">
                Click to browse CSV or XML file
              </div>
              <div class="text-xs text-gray-500">
                Supports .csv, .tsv, .xml • UTF-8 Unicode &amp; Khmer font supported
              </div>
              @if (uploadedFileName()) {
                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium">
                  <i class="pi pi-file"></i>
                  <span>{{ uploadedFileName() }}</span>
                </div>
              }
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">Raw Content (CSV or XML)</label>
              @if (parsedQuestions.length > 0) {
                <span class="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                  [ngClass]="detectedFormat() === 'csv' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300'">
                  <i [class]="detectedFormat() === 'csv' ? 'pi pi-table' : 'pi pi-code'"></i>
                  <span>{{ detectedFormat() === 'csv' ? 'CSV Format Detected' : 'Moodle XML Detected' }}</span>
                </span>
              }
            </div>
            <textarea [(ngModel)]="xmlContent" (ngModelChange)="onXmlContentChange()" rows="5" placeholder="&quot;Question&quot;,&quot;Option 1&quot;,&quot;Option 2&quot;,&quot;Option 3&quot;,&quot;Option 4&quot;,&quot;Correct Option (1-4 or A-D)&quot;&#10;or paste Moodle XML..." class="w-full p-3 font-mono text-xs rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-indigo-500"></textarea>
          </div>

          <!-- Parsed Preview -->
          @if (parsedQuestions.length > 0) {
            <div class="space-y-2">
              <div class="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span class="flex items-center gap-1.5">
                  <i class="pi pi-check-circle"></i>
                  <span>Ready to import {{ parsedQuestions.length }} question(s)</span>
                </span>
                <span class="text-gray-500 dark:text-gray-400 font-normal">
                  Target Room: <strong class="text-indigo-600 dark:text-indigo-400 font-bold">{{ targetRoomForImport() }}</strong>
                </span>
              </div>
              <div class="max-h-52 overflow-y-auto space-y-2 pr-1 border border-gray-200 dark:border-gray-800 rounded-xl p-2 bg-gray-50/60 dark:bg-gray-900/60">
                @for (q of parsedQuestions; track q.question; let idx = $index) {
                  <div class="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 text-xs shadow-xs">
                    <div class="font-bold text-gray-900 dark:text-white flex items-start gap-1.5">
                      <span class="text-indigo-600 dark:text-indigo-400 font-black">{{ idx + 1 }}.</span>
                      <span class="flex-1">{{ q.question }}</span>
                    </div>
                    <div class="text-gray-500 mt-2 flex flex-wrap gap-1.5">
                      @for (opt of q.options; track opt; let optIdx = $index) {
                        <span class="px-2 py-0.5 rounded-md flex items-center gap-1"
                          [ngClass]="optIdx === q.correctOptionIndex ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-700' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'">
                          @if (optIdx === q.correctOptionIndex) {
                            <i class="pi pi-check text-[10px]"></i>
                          }
                          <span>{{ opt }}</span>
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showImportDialog = false"></button>
          <button pButton [label]="'Import ' + parsedQuestions.length + ' Questions'" icon="pi pi-check" class="p-button-primary" [disabled]="parsedQuestions.length === 0 || isImporting" (click)="importParsedQuestions()"></button>
        </ng-template>
      </p-dialog>

      <!-- Pick Questions to Vote Dialog (Subset Selector) -->
      <p-dialog 
        [header]="'Pick Questions to Vote (' + selectedRoomCode() + ')'" 
        [(visible)]="showPickQuestionsDialog" 
        [modal]="true" 
        [style]="{width: '640px', maxWidth: '95vw'}" 
        class="p-fluid">
        <div class="space-y-4 pt-1">
          <div class="flex items-center justify-between text-xs text-gray-500">
            <span>Choose which questions are included in this room session.</span>
            <span class="font-bold text-indigo-600 dark:text-indigo-400 font-mono">
              {{ tempSelectedPollIds().length }} / {{ allRawPolls().length }} Selected
            </span>
          </div>

          <!-- Quick Presets -->
          <div class="flex items-center gap-1.5 flex-wrap p-2.5 rounded-2xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mr-1">Presets:</span>
            <button 
              type="button" 
              (click)="presetSelectFirst(5)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:text-indigo-600 cursor-pointer transition-all">
              First 5
            </button>
            <button 
              type="button" 
              (click)="presetSelectFirst(10)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:text-indigo-600 cursor-pointer transition-all">
              First 10
            </button>
            <button 
              type="button" 
              (click)="presetSelectFirst(15)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-indigo-600 dark:text-indigo-400 font-black cursor-pointer transition-all shadow-2xs">
              First 15
            </button>
            <button 
              type="button" 
              (click)="presetSelectFirst(20)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 hover:text-indigo-600 cursor-pointer transition-all">
              First 20
            </button>
            <button 
              type="button" 
              (click)="presetSelectRandom(15)" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 cursor-pointer transition-all">
              🎲 Random 15
            </button>
            <button 
              type="button" 
              (click)="presetSelectAll()" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 cursor-pointer transition-all ml-auto">
              Select All ({{ allRawPolls().length }})
            </button>
            <button 
              type="button" 
              (click)="presetClearAll()" 
              class="px-2.5 py-1 rounded-lg text-xs font-bold bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 cursor-pointer transition-all">
              Clear
            </button>
          </div>

          <!-- Question Checklist -->
          @if (allRawPolls().length === 0) {
            <div class="p-8 text-center text-xs text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-200 dark:border-gray-700 space-y-3">
              <i class="pi pi-question-circle text-2xl text-indigo-400"></i>
              <p>No questions found in room <strong>{{ selectedRoomCode() }}</strong> yet.</p>
              <button type="button" (click)="showPickQuestionsDialog = false; openAddQuestionForRoom(selectedRoomCode())" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1 cursor-pointer">
                <i class="pi pi-plus"></i> Add First Question
              </button>
            </div>
          } @else {
            <div class="max-h-80 overflow-y-auto space-y-1.5 pr-1 border border-gray-100 dark:border-gray-800 rounded-2xl p-2 bg-white dark:bg-gray-900">
              @for (p of allRawPolls(); track p.id; let idx = $index) {
                <label class="flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer border"
                  [ngClass]="isQuestionSelected(p.id) 
                    ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' 
                    : 'bg-gray-50/40 dark:bg-gray-800/30 border-transparent hover:border-gray-200 dark:hover:border-gray-700'">
                  <input 
                    type="checkbox" 
                    [checked]="isQuestionSelected(p.id)" 
                    (change)="toggleQuestionSelection(p.id)" 
                    class="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer" />
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-mono font-black"
                        [ngClass]="isQuestionSelected(p.id) ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'">
                        #{{ p.order || (idx + 1) }}
                      </span>
                      <span class="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">
                        {{ p.question }}
                      </span>
                    </div>
                    <div class="text-[11px] text-gray-500 mt-0.5">
                      {{ p.options.length }} choices
                      @if (p.correctOptionId !== undefined) {
                        • <span class="text-emerald-600 font-semibold">Scored (Option #{{ p.correctOptionId }})</span>
                      }
                    </div>
                  </div>
                </label>
              }
            </div>
          }
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showPickQuestionsDialog = false"></button>
          <button pButton [label]="'Apply (' + tempSelectedPollIds().length + ' Questions)'" icon="pi pi-check" class="p-button-primary" (click)="savePickedQuestions()"></button>
        </ng-template>
      </p-dialog>
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  private pollService = inject(MatiPollService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  currentUser = this.authService.currentUser;
  isAdmin = this.authService.isAdmin;

  rooms = signal<Room[]>([]);
  roomFilter = signal<'all' | 'mine'>('all');
  selectedRoomCode = signal<string>('MATI01');
  allRawPolls = signal<Poll[]>([]);
  currentRoom = this.pollService.currentRoom;

  // Mati Dashboard State
  searchQuery = signal<string>('');
  activeTab = signal<'all' | 'active' | 'past'>('all');
  matiDropdownFilter = signal<'all' | 'mine' | 'survey'>('all');
  selectedRoomCodes = signal<string[]>([]);
  activeMenuRoom = signal<string | null>(null);

  allMatisCount = computed(() => this.rooms().filter(r => r.code && !r.code.startsWith('_')).length);
  activeMatisCount = computed(() => this.rooms().filter(r => r.code && !r.code.startsWith('_') && this.isRoomActive(r)).length);
  pastMatisCount = computed(() => this.rooms().filter(r => r.code && !r.code.startsWith('_') && !this.isRoomActive(r)).length);

  // Selected active questions subset
  polls = computed(() => {
    const raw = this.allRawPolls();
    const sel = this.currentRoom()?.selectedPollIds;
    if (sel && Array.isArray(sel) && sel.length > 0) {
      const filtered = raw.filter(p => sel.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return raw;
  });

  selectedQuestionCount = computed(() => {
    const sel = this.currentRoom()?.selectedPollIds;
    return sel && sel.length > 0 ? sel.length : 0;
  });

  // Filtered rooms matching tabs, search, and dropdown
  filteredRooms = computed(() => {
    let list = this.rooms().filter(r => r.code && !r.code.startsWith('_'));
    const user = this.currentUser();
    const query = this.searchQuery().trim().toLowerCase();
    const tab = this.activeTab();
    const drop = this.matiDropdownFilter();

    // 1. Tab filter
    if (tab === 'active') {
      list = list.filter(r => this.isRoomActive(r));
    } else if (tab === 'past') {
      list = list.filter(r => !this.isRoomActive(r));
    }

    // 2. Dropdown filter
    if (drop === 'mine' && user) {
      list = list.filter(r => r.ownerEmail === user.email || r.ownerId === user.uid);
    } else if (drop === 'survey') {
      list = list.filter(r => r.mode === 'survey');
    }

    // 3. Search query
    if (query) {
      list = list.filter(r => 
        (r.title && r.title.toLowerCase().includes(query)) ||
        (r.code && r.code.toLowerCase().includes(query)) ||
        (r.ownerEmail && r.ownerEmail.toLowerCase().includes(query))
      );
    }

    return list;
  });

  myRoomsCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    return this.rooms().filter(r => r.ownerEmail === user.email || r.ownerId === user.uid).length;
  });

  setTab(tab: 'all' | 'active' | 'past') {
    this.activeTab.set(tab);
  }

  formatRoomDate(r: Room): string {
    if (r.startDate && r.endDate) {
      return this.formatRoomDates(r);
    }
    if (r.createdAt) {
      try {
        const d = (r.createdAt as any).toDate ? (r.createdAt as any).toDate() : new Date(r.createdAt as any);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      } catch {
        return 'Recent session';
      }
    }
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  toggleSelectAllRooms(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedRoomCodes.set(this.filteredRooms().map(r => r.code));
    } else {
      this.selectedRoomCodes.set([]);
    }
  }

  isRoomChecked(code: string): boolean {
    return this.selectedRoomCodes().includes(code);
  }

  toggleRoomCheck(code: string, event: Event) {
    event.stopPropagation();
    this.selectedRoomCodes.update(codes => 
      codes.includes(code) ? codes.filter(c => c !== code) : [...codes, code]
    );
  }

  toggleRoomMenu(code: string, event: Event) {
    event.stopPropagation();
    this.activeMenuRoom.update(cur => cur === code ? null : code);
  }

  closeRoomMenu() {
    this.activeMenuRoom.set(null);
  }

  getSelectedRoomTitle(): string {
    const r = this.rooms().find(rm => rm.code === this.selectedRoomCode());
    return r?.title || `Room ${this.selectedRoomCode()}`;
  }

  private roomsSub?: Subscription;
  private pollsSub?: Subscription;

  showNewRoomDialog = false;
  showNewPollDialog = false;
  showImportDialog = false;
  showPickQuestionsDialog = false;
  tempSelectedPollIds = signal<string[]>([]);

  isQuestionSelected(pollId: string): boolean {
    return this.tempSelectedPollIds().includes(pollId);
  }

  newRoomTitle = '';
  newRoomCode = '';
  newRoomStartDate = '';
  newRoomEndDate = '';
  showCustomCodeInput = false;

  openNewRoomDialog() {
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + 2);

    this.newRoomTitle = '';
    this.newRoomCode = '';
    this.newRoomStartDate = this.toInputDateFormat(today);
    this.newRoomEndDate = this.toInputDateFormat(end);
    this.showCustomCodeInput = false;
    this.showNewRoomDialog = true;
  }

  private toInputDateFormat(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  formatDisplayDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  formatShortDate(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return dateStr;
      const year = Number(parts[0]);
      const month = Number(parts[1]);
      const day = Number(parts[2]);
      if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  formatRoomDates(r: Room): string {
    if (r.startDate && r.endDate) {
      return `${this.formatShortDate(r.startDate)} - ${this.formatShortDate(r.endDate)}`;
    }
    if (r.startDate) {
      return this.formatShortDate(r.startDate);
    }
    return '';
  }

  isRoomActive(r: Room): boolean {
    return r.status !== 'inactive' && r.status !== 'completed' && r.status !== 'closed';
  }

  getOwnerDisplayName(r: Room): string {
    const user = this.currentUser();
    if (user && (r.ownerEmail === user.email || r.ownerId === user.uid)) {
      return `${user.displayName || 'John Chanthy'} (You)`;
    }
    return r.ownerEmail || 'Organizer';
  }

  async copyRoomLink(code: string) {
    const url = `${window.location.origin}/student?room=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      this.messageService.add({
        severity: 'success',
        summary: 'Link Copied! 📋',
        detail: `Shareable link for #${code} copied to clipboard!`
      });
    } catch {
      this.messageService.add({
        severity: 'info',
        summary: 'Shareable Link',
        detail: url
      });
    }
  }

  async copyRoomCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      this.messageService.add({
        severity: 'success',
        summary: 'Code Copied! 📋',
        detail: `Mati code #${code} copied to clipboard!`
      });
    } catch {
      this.messageService.add({
        severity: 'info',
        summary: 'Mati Code',
        detail: code
      });
    }
  }

  async duplicateRoom(code: string) {
    try {
      this.activeMenuRoom.set(null);
      const user = this.currentUser();
      const newCode = await this.pollService.duplicateRoom(
        code,
        undefined,
        user?.uid,
        user?.email || undefined
      );
      this.switchRoom(newCode);
      this.messageService.add({
        severity: 'success',
        summary: 'Mati Duplicated! 🎉',
        detail: `New duplicate session #${newCode} created with all questions!`
      });
    } catch (err) {
      console.error('Duplicate room failed:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Duplicate Failed',
        detail: 'Could not duplicate room.'
      });
    }
  }

  async toggleRoomActiveStatus(r: Room) {
    const isCurrentlyActive = this.isRoomActive(r);
    const newStatus: 'active' | 'inactive' = isCurrentlyActive ? 'inactive' : 'active';

    // 1. Instantly update the local rooms signal so UI changes immediately
    this.rooms.update(list => list.map(item => item.code === r.code ? { ...item, status: newStatus } : item));

    // 2. Persist to Firestore and service
    await this.pollService.setRoomStatus(r.code, newStatus);

    this.messageService.add({
      severity: 'success',
      summary: newStatus === 'active' ? 'Mati Activated! 🟢' : 'Mati Marked Inactive ⏸️',
      detail: `Room #${r.code} is now ${newStatus === 'active' ? 'Active now' : 'Inactive (Moved to Past)'}.`
    });
  }
  newPollQuestion = '';
  newPollOptionsRaw = 'Angular 19\nReact 19\nVue 3\nSvelte 5';
  newPollCorrectIndex: number | null = null;

  xmlContent = '';
  parsedQuestions: ParsedQuestion[] = [];
  detectedFormat = signal<'csv' | 'xml'>('csv');
  uploadedFileName = signal<string>('');
  targetRoomForNewPoll = signal<string>('MATI01');
  targetRoomForImport = signal<string>('MATI01');
  isImporting = false;

  ngOnInit() {
    this.roomsSub = this.pollService.listenToRooms().subscribe(list => {
      const validRooms = list.filter(r => r.code && !r.code.startsWith('_'));
      this.rooms.set(validRooms);
      const visible = this.filteredRooms();
      if (visible.length > 0 && (!this.selectedRoomCode() || this.selectedRoomCode().startsWith('_') || !visible.some(r => r.code === this.selectedRoomCode()))) {
        this.switchRoom(visible[0].code);
      }
    });
    this.switchRoom(this.selectedRoomCode());
  }

  ngOnDestroy() {
    this.roomsSub?.unsubscribe();
    this.pollsSub?.unsubscribe();
  }

  canManageRoom(r: Room): boolean {
    if (this.isAdmin()) return true;
    const user = this.currentUser();
    return !!(user && (r.ownerEmail === user.email || r.ownerId === user.uid));
  }

  switchRoom(code: string) {
    if (!code || code.startsWith('_')) return;
    this.selectedRoomCode.set(code);
    this.targetRoomForNewPoll.set(code);
    this.targetRoomForImport.set(code);
    this.pollService.broadcastActiveRoom(code, this.currentUser()?.email);
    this.pollsSub?.unsubscribe();
    this.pollsSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.allRawPolls.set(list);
    });
  }

  // Pick Questions Subset Methods for Dashboard
  openPickQuestionsDialog() {
    const raw = this.allRawPolls();
    const currentSelected = this.currentRoom()?.selectedPollIds;
    if (currentSelected && currentSelected.length > 0) {
      const valid = currentSelected.filter(id => raw.some(p => p.id === id));
      this.tempSelectedPollIds.set(valid.length > 0 ? valid : raw.map(p => p.id));
    } else {
      this.tempSelectedPollIds.set(raw.map(p => p.id));
    }
    this.showPickQuestionsDialog = true;
  }

  toggleQuestionSelection(pollId: string) {
    this.tempSelectedPollIds.update(ids => 
      ids.includes(pollId) ? ids.filter(id => id !== pollId) : [...ids, pollId]
    );
  }

  presetSelectFirst(count: number) {
    const list = this.allRawPolls().slice(0, count).map(p => p.id);
    this.tempSelectedPollIds.set(list);
  }

  presetSelectRandom(count: number) {
    const ids = this.allRawPolls().map(p => p.id);
    const shuffled = [...ids].sort(() => 0.5 - Math.random());
    this.tempSelectedPollIds.set(shuffled.slice(0, count));
  }

  presetSelectAll() {
    this.tempSelectedPollIds.set(this.allRawPolls().map(p => p.id));
  }

  presetClearAll() {
    this.tempSelectedPollIds.set([]);
  }

  async savePickedQuestions() {
    const raw = this.allRawPolls();
    let pickedList: string[] | null = [...this.tempSelectedPollIds()];

    if (pickedList.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Questions Selected',
        detail: 'Please pick at least 1 question for the session.'
      });
      return;
    }

    if (pickedList.length === raw.length) {
      pickedList = null;
    }

    const code = this.selectedRoomCode();
    await this.pollService.updateRoomSelectedPollIds(code, pickedList);
    this.showPickQuestionsDialog = false;

    this.messageService.add({
      severity: 'success',
      summary: 'Session Questions Updated! 🎯',
      detail: pickedList 
        ? `${pickedList.length} of ${raw.length} questions activated for room ${code}.`
        : `All ${raw.length} questions activated for room ${code}.`
    });
  }

  openAddQuestionForRoom(code: string) {
    this.switchRoom(code);
    this.targetRoomForNewPoll.set(code);
    this.showNewPollDialog = true;
  }

  openImportForRoom(code: string) {
    this.switchRoom(code);
    this.targetRoomForImport.set(code);
    this.showImportDialog = true;
  }

  async setAsLive(pollId: string) {
    this.pollService.broadcastActiveRoom(this.selectedRoomCode(), this.currentUser()?.email);
    await this.pollService.setActivePoll(this.selectedRoomCode(), pollId);
    this.messageService.add({
      severity: 'success',
      summary: 'Poll Activated',
      detail: `Question is now live in room ${this.selectedRoomCode()}!`
    });
  }

  async createNewRoom() {
    if (!this.newRoomTitle.trim()) return;
    const user = this.currentUser();
    const createdTitle = this.newRoomTitle.trim();
    const code = await this.pollService.createRoom(
      createdTitle,
      this.newRoomCode || undefined,
      user?.uid,
      user?.email || undefined,
      this.newRoomStartDate || undefined,
      this.newRoomEndDate || undefined
    );
    this.showNewRoomDialog = false;
    this.newRoomTitle = '';
    this.newRoomCode = '';
    this.switchRoom(code);
    this.messageService.add({
      severity: 'success',
      summary: 'Mati Created! 🎉',
      detail: `Mati "${createdTitle}" (${code}) is ready!`
    });
  }

  async deleteRoom(code: string) {
    if (confirm(`Are you sure you want to delete room "${code}"? This will remove all its polls.`)) {
      await this.pollService.deleteRoom(code);
      this.messageService.add({
        severity: 'info',
        summary: 'Room Deleted',
        detail: `Room ${code} has been deleted.`
      });
      const remaining = this.filteredRooms().filter(r => r.code !== code);
      if (remaining.length > 0) {
        this.switchRoom(remaining[0].code);
      }
    }
  }

  async createNewPoll() {
    if (!this.newPollQuestion.trim()) return;
    const opts = this.newPollOptionsRaw
      .split('\n')
      .map(o => o.trim())
      .filter(o => o.length > 0);

    if (opts.length < 2) {
      this.messageService.add({
        severity: 'warn',
        summary: 'At least 2 options needed',
        detail: 'Please provide at least 2 answer choices.'
      });
      return;
    }

    const correctId = this.newPollCorrectIndex ? Number(this.newPollCorrectIndex) : undefined;
    const targetRoom = this.targetRoomForNewPoll() || this.selectedRoomCode();
    await this.pollService.createPoll(targetRoom, this.newPollQuestion, opts, correctId);
    this.switchRoom(targetRoom);
    this.showNewPollDialog = false;
    this.newPollQuestion = '';
    this.newPollCorrectIndex = null;
    this.messageService.add({
      severity: 'success',
      summary: 'Question Created',
      detail: `Question added to ${targetRoom}!`
    });
  }

  async deletePoll(pollId: string) {
    if (confirm('Are you sure you want to remove this question?')) {
      await this.pollService.deletePoll(this.selectedRoomCode(), pollId);
      this.messageService.add({
        severity: 'info',
        summary: 'Question Removed',
        detail: 'Question removed from room.'
      });
    }
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    this.uploadedFileName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.xmlContent = (e.target?.result as string) || '';
      this.onXmlContentChange();
    };
    reader.readAsText(file, 'utf-8');
  }

  onXmlContentChange() {
    if (!this.xmlContent.trim()) {
      this.parsedQuestions = [];
      return;
    }
    try {
      const result = QuestionImporter.parse(this.xmlContent, this.uploadedFileName());
      this.detectedFormat.set(result.format);
      this.parsedQuestions = result.questions;
    } catch (err: any) {
      this.parsedQuestions = [];
      this.messageService.add({
        severity: 'error',
        summary: 'Parse Error',
        detail: err.message || 'Unable to parse questions.'
      });
    }
  }

  loadSampleCsv() {
    this.uploadedFileName.set('sample_questions.csv');
    this.xmlContent = `"Question","Option A","Option B","Option C","Option D","Correct Answer"
"តើបច្ចេកវិទ្យា AI ណាដែលមានឥទ្ធិពលខ្លាំងលើវិស័យអប់រំនៅកម្ពុជា?","Generative AI & Intelligent Tutors","Static Rule-based LMS","Paper-based Quizzes","Legacy Video Tapes","1"
"What is the primary benefit of live audience polling?","Immediate comprehension check & real-time feedback","Midterm final exam scoring","Replacing instructors entirely","Passive listening","A"
"តើ Mati អាចប្រើប្រាស់សម្រាប់ថ្នាក់រៀនអន្តរកម្មបានដែរឬទេ?","True (ពិត)","False (មិនពិត)","","","True"
"Which language is primarily used for styling modern web applications?","CSS","Python","SQL","C++","CSS"`;
    this.onXmlContentChange();
  }

  downloadCsvTemplate() {
    const templateContent = `"Question","Option A","Option B","Option C","Option D","Correct Answer"\r\n` +
      `"តើបច្ចេកវិទ្យា AI ណាដែលមានឥទ្ធិពលខ្លាំងលើវិស័យអប់រំ?","Generative AI","Static Rules","Legacy LMS","None","1"\r\n` +
      `"What is the primary benefit of live polling?","Live audience engagement","Final exam grading","Replacing teachers","Manual paper check","A"\r\n` +
      `"តើលោកអ្នកចូលចិត្តបច្ចេកវិទ្យាថ្មីៗដែរឬទេ?","True (ពិត)","False (មិនពិត)","","","A"\r\n`;

    const blob = new Blob(["\uFEFF" + templateContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'mati_questions_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  loadSampleXml() {
    this.uploadedFileName.set('sample_moodle.xml');
    this.xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<quiz>
  <question type="multichoice">
    <name><text>Question 1</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>តើបច្ចេកវិទ្យា AI ណាដែលមានឥទ្ធិពលខ្លាំងបំផុតសម្រាប់អនាគតការអប់រំនៅកម្ពុជា?</p>]]></text>
    </questiontext>
    <answer fraction="100">
      <text>Generative AI &amp; Intelligent Tutors</text>
    </answer>
    <answer fraction="0">
      <text>Traditional Rule-based Systems</text>
    </answer>
    <answer fraction="0">
      <text>Static LMS Video Playlists</text>
    </answer>
    <answer fraction="0">
      <text>Paper-based Quizzes</text>
    </answer>
  </question>

  <question type="multichoice">
    <name><text>Question 2</text></name>
    <questiontext format="html">
      <text><![CDATA[<p>What is the primary benefit of real-time polling during a live lecture?</p>]]></text>
    </questiontext>
    <answer fraction="100">
      <text>Immediate understanding check &amp; high audience retention</text>
    </answer>
    <answer fraction="0">
      <text>Grading formal midterm exams</text>
    </answer>
    <answer fraction="0">
      <text>Replacing all instructor explanations</text>
    </answer>
  </question>
</quiz>`;
    this.onXmlContentChange();
  }

  async importParsedQuestions() {
    if (this.parsedQuestions.length === 0 || this.isImporting) return;
    this.isImporting = true;
    try {
      const targetRoom = this.targetRoomForImport() || this.selectedRoomCode();
      const count = await this.pollService.createPollsBatch(targetRoom, this.parsedQuestions);
      this.switchRoom(targetRoom);
      this.showImportDialog = false;
      this.xmlContent = '';
      this.parsedQuestions = [];
      this.messageService.add({
        severity: 'success',
        summary: 'Questions Imported',
        detail: `Successfully added ${count} question(s) to room ${targetRoom}!`
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Import Failed',
        detail: err.message || 'Could not import questions.'
      });
    } finally {
      this.isImporting = false;
    }
  }
}
