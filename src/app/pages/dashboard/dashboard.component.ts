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
    <div class="space-y-6">
      <p-toast></p-toast>

      <!-- Welcome Banner -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 text-white p-8 shadow-xl">
        <div class="relative z-10 max-w-3xl">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 backdrop-blur-md border border-indigo-400/30 text-indigo-200 text-xs font-semibold mb-4">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Mati Live Audience Engine</span>
            <span>•</span>
            <span class="capitalize">{{ isAdmin() ? 'Administrator' : 'Presenter' }}: {{ currentUser()?.displayName || currentUser()?.email }}</span>
          </div>
          <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Mati (មតិ) Studio Dashboard
          </h1>
          <p class="mt-2 text-indigo-100 text-sm sm:text-base leading-relaxed">
            Create real-time audience polls, display live projection charts, and control interactive classroom sessions effortlessly.
          </p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button 
              type="button" 
              (click)="showNewRoomDialog = true" 
              class="banner-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all border border-indigo-500 active:scale-95 cursor-pointer">
              <i class="pi pi-plus"></i>
              <span>Create New Room</span>
            </button>

            <button 
              type="button" 
              (click)="showNewPollDialog = true" 
              class="banner-ghost-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white border border-white/30 backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer">
              <i class="pi pi-question-circle"></i>
              <span>Add Question</span>
            </button>

            <button 
              type="button" 
              (click)="showImportDialog = true" 
              class="banner-ghost-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white border border-white/30 backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer">
              <i class="pi pi-file-import"></i>
              <span>Import Questions (CSV / XML)</span>
            </button>

            <a 
              routerLink="/dashboard/control" 
              class="banner-ghost-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white border border-white/30 backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer">
              <i class="pi pi-sliders-h"></i>
              <span>Open Live Controller</span>
            </a>

            @if (isAdmin()) {
              <a 
                routerLink="/dashboard/users" 
                class="banner-ghost-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-purple-200 bg-purple-900/40 border border-purple-400/40 backdrop-blur-md shadow-sm transition-all active:scale-95 cursor-pointer hover:bg-purple-900/60">
                <i class="pi pi-users"></i>
                <span>Manage Users</span>
              </a>
            }
          </div>
        </div>
        <div class="absolute -right-10 -bottom-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none"></div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl shrink-0">
            <i class="pi pi-desktop"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Managing Room</div>
            <div class="flex items-center gap-2 mt-0.5">
              <span class="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono">{{ selectedRoomCode() }}</span>
              <span class="text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md">Live</span>
            </div>
            <div class="text-xs text-gray-500 truncate">{{ getSelectedRoomTitle() }}</div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xl shrink-0">
            <i class="pi pi-chart-bar"></i>
          </div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Total Polls</div>
            <div class="text-2xl font-extrabold text-gray-900 dark:text-white">{{ polls().length }}</div>
            <div class="text-xs text-gray-500">In {{ selectedRoomCode() }} session</div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs flex items-center gap-4">
          <div class="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center text-xl shrink-0">
            <i class="pi pi-users"></i>
          </div>
          <div>
            <div class="text-xs font-bold uppercase tracking-wider text-gray-400">Audience Links</div>
            <div class="flex items-center gap-2 mt-1">
              <a [routerLink]="['/stage', selectedRoomCode()]" target="_blank" class="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1">
                <i class="pi pi-external-link text-[10px]"></i> Stage View
              </a>
              <span class="text-gray-300">•</span>
              <a [routerLink]="['/join', selectedRoomCode()]" target="_blank" class="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1">
                <i class="pi pi-external-link text-[10px]"></i> Mobile View
              </a>
            </div>
            <div class="text-[11px] text-gray-400 mt-1">Click to launch in new tab</div>
          </div>
        </div>
      </div>

      <!-- Rooms in System (Managed by User) -->
      <div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-base">
              <i class="pi pi-building"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-lg font-black text-gray-900 dark:text-white">
                  Rooms in Your System
                </h2>
                <span class="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold font-mono">
                  {{ filteredRooms().length }} Visible
                </span>
              </div>
              <p class="text-xs text-gray-500">
                Click any room to select and manage its polls or launch its presentation stage.
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            @if (isAdmin()) {
              <div class="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded-xl text-xs font-bold border border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  (click)="roomFilter.set('all')"
                  [ngClass]="roomFilter() === 'all' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
                  class="px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                  All Rooms ({{ rooms().length }})
                </button>
                <button
                  type="button"
                  (click)="roomFilter.set('mine')"
                  [ngClass]="roomFilter() === 'mine' ? 'bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-300 shadow-xs' : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'"
                  class="px-3 py-1.5 rounded-lg transition-all cursor-pointer">
                  My Rooms ({{ myRoomsCount() }})
                </button>
              </div>
            }

            <button 
              type="button" 
              (click)="showNewRoomDialog = true" 
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer">
              <i class="pi pi-plus"></i>
              <span>Create New Room</span>
            </button>
          </div>
        </div>

        <!-- Rooms Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (r of filteredRooms(); track r.code) {
            <div 
              class="p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 relative group"
              [ngClass]="selectedRoomCode() === r.code 
                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/30 ring-2 ring-indigo-400/50 shadow-md' 
                : 'border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 hover:border-gray-300 dark:hover:border-gray-700'">
              
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 font-mono font-black text-xs border border-gray-200 dark:border-gray-700 shadow-2xs">
                    PIN: {{ r.code }}
                  </span>
                  <div class="flex items-center gap-1">
                    @if (r.mode === 'survey') {
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                        Survey
                      </span>
                    }
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider"
                      [ngClass]="r.status === 'completed' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'">
                      {{ r.status || 'Active' }}
                    </span>

                    @if (canManageRoom(r)) {
                      <button
                        type="button"
                        (click)="deleteRoom(r.code)"
                        title="Delete Room"
                        class="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer">
                        <i class="pi pi-trash text-xs"></i>
                      </button>
                    }
                  </div>
                </div>

                <div>
                  <h3 class="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2">
                    {{ r.title || ('Room ' + r.code) }}
                  </h3>
                  <div class="text-[11px] text-gray-500 mt-1 flex items-center justify-between">
                    <span>{{ selectedRoomCode() === r.code ? polls().length + ' polls loaded' : 'Room ready' }}</span>
                    <span class="text-[10px] font-medium text-slate-400 truncate max-w-[130px]">
                      {{ r.ownerEmail === currentUser()?.email ? 'Owner: You' : (r.ownerEmail ? 'Owner: ' + r.ownerEmail : 'Public') }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Action buttons -->
              <div class="pt-2 border-t border-gray-200/80 dark:border-gray-800 flex items-center justify-between gap-1.5 flex-wrap">
                <button 
                  type="button" 
                  (click)="switchRoom(r.code)"
                  [ngClass]="selectedRoomCode() === r.code ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100'"
                  class="px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer">
                  <i class="pi pi-check text-[10px]"></i>
                  <span>{{ selectedRoomCode() === r.code ? 'Selected' : 'Manage' }}</span>
                </button>

                <a 
                  [routerLink]="['/dashboard/control', r.code]" 
                  class="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 border border-gray-200 dark:border-gray-700 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-all flex items-center gap-1">
                  <i class="pi pi-sliders-h text-[10px]"></i> Controller
                </a>

                <a 
                  [routerLink]="['/stage', r.code]" 
                  target="_blank" 
                  class="p-1.5 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" 
                  title="Open Projector Stage">
                  <i class="pi pi-desktop text-sm"></i>
                </a>

                <a 
                  [routerLink]="['/join', r.code]" 
                  target="_blank" 
                  class="p-1.5 rounded-xl text-gray-500 hover:text-emerald-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all" 
                  title="Open Voter Phone View">
                  <i class="pi pi-mobile text-sm"></i>
                </a>
              </div>
            </div>
          } @empty {
            <div class="col-span-full text-center py-8 text-gray-400 text-xs">
              No rooms found. Click "Create New Room" to get started!
            </div>
          }
        </div>
      </div>

      <!-- Polls Management List -->
      <div class="bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 p-6 shadow-xs">
        <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Active Room Polls: {{ selectedRoomCode() }}</h2>
            <p class="text-xs text-gray-500">Select which question to project live onto the presenter stage.</p>
          </div>
          <div class="flex items-center gap-2">
            <button pButton label="Import Moodle XML" icon="pi pi-file-import" class="p-button-outlined p-button-sm rounded-xl" (click)="showImportDialog = true"></button>
            <button pButton label="New Question" icon="pi pi-plus" class="p-button-primary p-button-sm rounded-xl" (click)="showNewPollDialog = true"></button>
          </div>
        </div>

        <div class="space-y-4">
          @for (poll of polls(); track poll.id; let idx = $index) {
            <div class="p-5 rounded-2xl border transition-all" [ngClass]="currentRoom()?.activePollId === poll.id ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-md ring-1 ring-indigo-500' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300'">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-bold flex items-center justify-center text-gray-600 dark:text-gray-300">
                      {{ idx + 1 }}
                    </span>
                    <h3 class="text-base font-bold text-gray-900 dark:text-white">
                      {{ poll.question }}
                    </h3>
                    @if (currentRoom()?.activePollId === poll.id) {
                      <p-tag severity="info" value="LIVE ON STAGE" icon="pi pi-broadcast"></p-tag>
                    }
                    @if (poll.isLocked) {
                      <p-tag severity="danger" value="VOTING LOCKED" icon="pi pi-lock"></p-tag>
                    }
                  </div>
                  <div class="flex flex-wrap gap-2 pt-2">
                    @for (opt of poll.options; track opt.id) {
                      <span class="text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5"
                        [ngClass]="poll.correctOptionId === opt.id ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-bold' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'">
                        <span>{{ opt.id }}. {{ opt.text }}</span>
                        @if (poll.correctOptionId === opt.id) {
                          <i class="pi pi-check text-[10px]"></i>
                        }
                      </span>
                    }
                  </div>
                </div>

                <div class="flex items-center gap-2 self-end md:self-center shrink-0">
                  @if (currentRoom()?.activePollId !== poll.id) {
                    <button pButton label="Make Live" icon="pi pi-play" class="p-button-sm p-button-success rounded-xl" (click)="setAsLive(poll.id)"></button>
                  } @else {
                    <a [routerLink]="['/dashboard/control', selectedRoomCode()]" pButton label="Remote Control" icon="pi pi-sliders-h" class="p-button-sm p-button-primary rounded-xl"></a>
                  }

                  <button
                    type="button"
                    (click)="deletePoll(poll.id)"
                    title="Delete Question"
                    class="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl transition-colors cursor-pointer">
                    <i class="pi pi-trash text-sm"></i>
                  </button>
                </div>
              </div>
            </div>
          } @empty {
            <div class="text-center py-12 text-gray-400">
              <i class="pi pi-inbox text-4xl mb-2"></i>
              <p>No questions yet in this room. Click "New Question" or "Import Moodle XML".</p>
            </div>
          }
        </div>
      </div>

      <!-- Create Room Dialog -->
      <p-dialog header="Create New Mati Room" [(visible)]="showNewRoomDialog" [modal]="true" [style]="{width: '450px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Room Title</label>
            <input pInputText type="text" [(ngModel)]="newRoomTitle" placeholder="e.g. AI & Web Summit 2026" class="w-full" />
          </div>
          <div>
            <label class="block text-xs font-bold uppercase text-gray-600 dark:text-gray-300 mb-1">Room Code (PIN)</label>
            <input pInputText type="text" [(ngModel)]="newRoomCode" placeholder="Leave blank for auto PIN (e.g. MATI02)" class="w-full uppercase" />
          </div>
          <div class="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900 text-xs text-indigo-700 dark:text-indigo-300">
            This room will be assigned to your account: <strong>{{ currentUser()?.email }}</strong>
          </div>
        </div>
        <ng-template pTemplate="footer">
          <button pButton label="Cancel" icon="pi pi-times" class="p-button-text" (click)="showNewRoomDialog = false"></button>
          <button pButton label="Create Room" icon="pi pi-check" class="p-button-primary" (click)="createNewRoom()"></button>
        </ng-template>
      </p-dialog>

      <!-- Create Poll Dialog -->
      <p-dialog [header]="'Create Question for ' + selectedRoomCode()" [(visible)]="showNewPollDialog" [modal]="true" [style]="{width: '550px'}" class="p-fluid">
        <div class="space-y-4 pt-2">
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
                  Target Room: <strong class="text-indigo-600 dark:text-indigo-400 font-bold">{{ selectedRoomCode() }}</strong>
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
  polls = signal<Poll[]>([]);
  currentRoom = this.pollService.currentRoom;

  // Filtered rooms depending on user role and filter selection
  filteredRooms = computed(() => {
    const all = this.rooms();
    const user = this.currentUser();
    if (!user) return all;

    if (this.isAdmin() && this.roomFilter() === 'all') {
      return all;
    }

    // Presenter mode or 'mine' filter:
    const myRooms = all.filter(r => r.ownerEmail === user.email || r.ownerId === user.uid);
    // If user has no created rooms yet, also show default MATI01 for usability
    if (myRooms.length > 0) return myRooms;
    return all;
  });

  myRoomsCount = computed(() => {
    const user = this.currentUser();
    if (!user) return 0;
    return this.rooms().filter(r => r.ownerEmail === user.email || r.ownerId === user.uid).length;
  });

  private roomsSub?: Subscription;
  private pollsSub?: Subscription;

  showNewRoomDialog = false;
  showNewPollDialog = false;
  showImportDialog = false;

  newRoomTitle = '';
  newRoomCode = '';
  newPollQuestion = '';
  newPollOptionsRaw = 'Angular 19\nReact 19\nVue 3\nSvelte 5';
  newPollCorrectIndex: number | null = null;

  xmlContent = '';
  parsedQuestions: ParsedQuestion[] = [];
  detectedFormat = signal<'csv' | 'xml'>('csv');
  uploadedFileName = signal<string>('');
  isImporting = false;

  ngOnInit() {
    this.roomsSub = this.pollService.listenToRooms().subscribe(list => {
      this.rooms.set(list);
      const visible = this.filteredRooms();
      if (visible.length > 0 && !visible.some(r => r.code === this.selectedRoomCode())) {
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
    this.selectedRoomCode.set(code);
    this.pollService.broadcastActiveRoom(code, this.currentUser()?.email);
    this.pollsSub?.unsubscribe();
    this.pollsSub = this.pollService.listenToRoomPolls(code).subscribe(list => {
      this.polls.set(list);
    });
  }

  getSelectedRoomTitle(): string {
    const r = this.rooms().find(rm => rm.code === this.selectedRoomCode());
    return r?.title || 'Interactive Session';
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
    const code = await this.pollService.createRoom(
      this.newRoomTitle,
      this.newRoomCode || undefined,
      user?.uid,
      user?.email || undefined
    );
    this.showNewRoomDialog = false;
    this.newRoomTitle = '';
    this.newRoomCode = '';
    this.switchRoom(code);
    this.messageService.add({
      severity: 'success',
      summary: 'Room Created! 🎉',
      detail: `Room ${code} is ready and selected!`
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
    await this.pollService.createPoll(this.selectedRoomCode(), this.newPollQuestion, opts, correctId);
    this.showNewPollDialog = false;
    this.newPollQuestion = '';
    this.newPollCorrectIndex = null;
    this.messageService.add({
      severity: 'success',
      summary: 'Question Created',
      detail: `Question added to ${this.selectedRoomCode()}!`
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
      const targetRoom = this.selectedRoomCode();
      const count = await this.pollService.createPollsBatch(targetRoom, this.parsedQuestions);
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
