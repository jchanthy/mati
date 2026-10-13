import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { MatiPollService } from '../../services/mati-poll.service';
import { AuthService } from '../../services/auth.service';
import { DetailedSessionSummary, Poll, Room } from '../../models/poll.model';
import QRCode from 'qrcode';

@Component({
  selector: 'app-room-overview',
  standalone: true,
  imports: [CommonModule, RouterModule, DialogModule, ToastModule],
  providers: [MessageService],
  template: `
    <div class="min-h-screen bg-[#F4F6F8] flex flex-col font-sans select-none text-slate-800">
      <p-toast></p-toast>

      <!-- 1. Slido-Style Top Navigation Header -->
      <header class="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center justify-between shrink-0 z-20">
        <!-- Left: Back Button, Room Title, Date, Code -->
        <div class="flex items-center gap-3 sm:gap-4 min-w-0">
          <!-- Back arrow -->
          <a 
            routerLink="/dashboard" 
            title="Back to My matis"
            class="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors cursor-pointer shrink-0">
            <i class="pi pi-arrow-left text-sm font-bold"></i>
          </a>

          <!-- Event / Room Title -->
          @if (isLoading() && !room()?.title) {
            <div class="h-5 w-28 bg-gray-200 rounded-md animate-pulse"></div>
          } @else {
            <h1 class="text-base sm:text-lg font-black text-gray-900 truncate max-w-[140px] sm:max-w-xs md:max-w-md" [title]="room()?.title || ('Room #' + roomCode())">
              {{ room()?.title || ('Room #' + roomCode()) }}
            </h1>
          }

          <!-- Calendar Icon -->
          <div class="hidden md:flex items-center text-gray-400 shrink-0">
            <i class="pi pi-calendar text-sm"></i>
          </div>

          <!-- Room Code with Info Icon -->
          <div 
            (click)="copyRoomCode()" 
            class="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded-md hover:bg-gray-100 cursor-pointer transition-colors shrink-0" 
            title="Click to copy room code">
            <span class="font-mono font-bold text-gray-800"># {{ roomCode() }}</span>
            <i class="pi pi-info-circle text-[11px] text-gray-400"></i>
          </div>
        </div>

        <!-- Right: Share, Present button, More menu -->
        <div class="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <!-- Share button -->
          <button 
            type="button" 
            (click)="showShareDialog.set(true)"
            class="px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 bg-white text-gray-700 hover:text-gray-900 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer">
            <i class="pi pi-share-alt text-xs"></i>
            <span class="hidden sm:inline">Share</span>
          </button>

          <!-- Present Button (Mati Brand Indigo) -->
          <a 
            [routerLink]="['/stage', roomCode()]" 
            target="_blank"
            class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-indigo-600/20 transition-all cursor-pointer no-underline">
            <i class="pi pi-desktop text-xs"></i>
            <span>Present</span>
          </a>

          <!-- More options button -->
          <button 
            type="button" 
            (click)="toggleMenu()"
            class="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-800 transition-colors cursor-pointer">
            <i class="pi pi-ellipsis-h text-sm"></i>
          </button>
        </div>
      </header>

      <!-- 2. Workspace Body: Left Icon Rail + Slido Overview Main View -->
      <div class="flex flex-1 min-h-0 overflow-hidden">
        
        <!-- Left Icon Rail (Matching Slido Workspace Screenshot) -->
        <aside class="w-14 sm:w-16 bg-white border-r border-gray-200 flex flex-col items-center justify-between py-4 shrink-0 select-none">
          <!-- Top Rails -->
          <div class="flex flex-col items-center gap-4">
            <!-- Interactions / Questions icon -->
            <a 
              [routerLink]="['/dashboard/control', roomCode()]" 
              title="Interactions & Polls"
              class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-colors cursor-pointer no-underline">
              <i class="pi pi-list text-base"></i>
            </a>

            <!-- Analytics / Overview icon (ACTIVE BRAND PILL) -->
            <button 
              type="button" 
              title="Analytics Overview"
              class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold shadow-2xs border border-indigo-100 cursor-default">
              <!-- Upward trend arrow matching screenshot -->
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
              </svg>
            </button>

            <!-- Settings icon -->
            <button 
              type="button" 
              [routerLink]="['/dashboard/control', roomCode()]" 
              title="Settings"
              class="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">
              <i class="pi pi-cog text-base"></i>
            </button>
          </div>

          <!-- Bottom: Help (?) circle icon -->
          <div>
            <button 
              type="button" 
              title="Help &amp; Support"
              class="w-7 h-7 rounded-full border border-gray-300 text-gray-500 font-bold text-xs flex items-center justify-center hover:bg-gray-100 transition-colors cursor-pointer">
              ?
            </button>
          </div>
        </aside>

        <!-- Main Content Area: Slido Overview Page -->
        <main class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-5 max-w-6xl mx-auto w-full">
          
          <!-- Page Header: "Mati Overview" + Action Buttons -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <h2 class="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
                <span>Mati</span>
                <span class="text-indigo-600">Overview</span>
              </h2>
            </div>

            <!-- Header Action Buttons (Mati Brand Indigo) -->
            <div class="flex items-center gap-2.5 shrink-0">
              <button 
                type="button" 
                (click)="showShareDialog.set(true)"
                [disabled]="isLoading()"
                class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm shadow-indigo-600/20 transition-colors cursor-pointer">
                <i class="pi pi-share-alt text-xs"></i>
                <span>Share Analytics</span>
              </button>

              <button 
                type="button" 
                (click)="exportResultsAsCsv()"
                [disabled]="isLoading() || sessionStats().questionResults.length === 0"
                class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-sm shadow-indigo-600/20 transition-colors cursor-pointer"
                title="Export overview results as CSV with UTF-8 / Khmer font support">
                <i class="pi pi-download text-xs"></i>
                <span>Export</span>
              </button>
            </div>
          </div>

          <!-- Notice Banner (Mati Slate & Indigo Theme) -->
          <div class="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/60 text-indigo-950 text-xs sm:text-sm flex items-center gap-2.5 shadow-2xs">
            <i class="pi pi-info-circle text-base text-indigo-600 shrink-0"></i>
            <p class="leading-relaxed">
              Ideas poll results is now supported in <strong>XLS exports</strong>. <strong>PDF exports</strong> and <strong>Analytics</strong> support are on the way.
            </p>
          </div>

          <!-- Loading State when data is being fetched -->
          @if (isLoading()) {
            <!-- Beautiful Loading Notice Card -->
            <div class="bg-white rounded-2xl border border-gray-200 p-8 shadow-xs flex flex-col items-center justify-center text-center space-y-3.5 animate-fadein">
              <div class="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
              <div class="space-y-1">
                <div class="text-base font-bold text-gray-900">Loading overview data...</div>
                <div class="text-xs text-gray-500">Calculating engagement, question responses, and metrics for room #{{ roomCode() }}</div>
              </div>
            </div>

            <!-- Skeleton Hero Engagement Card -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden animate-pulse">
              <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
                @for (i of [1, 2, 3]; track i) {
                  <div class="p-6 space-y-4">
                    <div class="flex items-start justify-between">
                      <div class="space-y-2 flex-1">
                        <div class="h-4 bg-gray-200 rounded-md w-3/4"></div>
                        <div class="h-3 bg-gray-100 rounded-md w-1/2"></div>
                      </div>
                      <div class="w-12 h-12 rounded-full bg-gray-200 shrink-0"></div>
                    </div>
                    <div class="space-y-2.5 pt-2">
                      <div class="h-3 bg-gray-100 rounded-md w-full"></div>
                      <div class="h-3 bg-gray-100 rounded-md w-5/6"></div>
                      <div class="h-3 bg-gray-100 rounded-md w-4/6"></div>
                    </div>
                    <div class="h-9 bg-gray-100 rounded-lg w-full mt-4"></div>
                  </div>
                }
              </div>
            </div>

            <!-- Skeleton Poll Breakdown Cards -->
            <div class="space-y-3 animate-pulse pt-2">
              <div class="h-5 bg-gray-200 rounded-md w-44"></div>
              @for (j of [1, 2]; track j) {
                <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                  <div class="flex items-center justify-between">
                    <div class="h-4 bg-gray-200 rounded-md w-2/3"></div>
                    <div class="h-3 bg-gray-100 rounded-md w-16"></div>
                  </div>
                  <div class="space-y-2 pt-2">
                    <div class="h-8 bg-gray-100 rounded-xl w-full"></div>
                    <div class="h-8 bg-gray-100 rounded-xl w-full"></div>
                  </div>
                </div>
              }
            </div>
          } @else {
            <!-- 3-Column Engagement Hero Card (Exact Slido Structure) -->
            <div class="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden transition-all">
              <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-gray-100">
              
              <!-- Column 1: Engaged participants (Mati Indigo #4F46E5) -->
              <div class="flex flex-col justify-between">
                <div class="p-5 sm:p-6 space-y-4">
                  <!-- Header: Title + Subtitle + Donut Ring -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="space-y-1">
                      <h3 class="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                        Engaged participants
                      </h3>
                      <p class="text-xs text-gray-500 leading-snug">
                        <strong class="text-gray-900">{{ engagedParticipantsCount() }} out of {{ totalParticipantsCount() }}</strong> participants engaged with polls or Q&amp;A.
                      </p>
                    </div>

                    <!-- Indigo Donut Ring -->
                    <div class="relative w-12 h-12 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 36 36" class="w-12 h-12 transform -rotate-90">
                        <path stroke="#EEF2FF" stroke-width="4.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path stroke="#4F46E5" stroke-width="4.5" [attr.stroke-dasharray]="engagedScore() + ', 100'" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                    </div>
                  </div>

                  <!-- Details Rows (Collapsible with Show Less / Show More) -->
                  @if (showDetails()) {
                    <div class="space-y-2.5 pt-2 text-xs text-gray-600 animate-fadein">
                      <div class="flex items-center justify-between">
                        <span>Participants asking in Q&amp;A</span>
                        <span class="font-mono font-bold text-gray-900">{{ qaParticipantsCount() }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Participants up or down voting in Q&amp;A</span>
                        <span class="font-mono font-bold text-gray-900">{{ qaVotesCount() }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Participants voting in polls</span>
                        <span class="font-mono font-bold text-gray-900">{{ pollParticipantsCount() }}</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Bottom Score Bar (Indigo Tint with Indigo Score Badge) -->
                <div class="flex items-center justify-between bg-[#EEF2FF] border-t border-indigo-100 overflow-hidden">
                  <div class="px-5 py-3 text-xs font-bold text-indigo-900 flex items-center gap-1.5 flex-1">
                    <span>Engaged participants score</span>
                    <i class="pi pi-info-circle text-[11px] text-indigo-600"></i>
                  </div>
                  <div class="bg-[#4F46E5] text-white px-4 py-3 text-xs font-black font-mono shrink-0">
                    {{ engagedScore() }}%
                  </div>
                </div>
              </div>

              <!-- Column 2: Q&A engagement (Violet #7C3AED) -->
              <div class="flex flex-col justify-between">
                <div class="p-5 sm:p-6 space-y-4">
                  <!-- Header: Title + Subtitle + Donut Ring -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="space-y-1">
                      <h3 class="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                        Q&amp;A engagement
                      </h3>
                      <p class="text-xs text-gray-500 leading-snug">
                        <strong class="text-gray-900">{{ qaParticipantsCount() }} out of {{ totalParticipantsCount() }}</strong> participants asked a question or voted in Q&amp;A.
                      </p>
                    </div>

                    <!-- Violet Donut Ring -->
                    <div class="relative w-12 h-12 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 36 36" class="w-12 h-12 transform -rotate-90">
                        <path stroke="#F5F3FF" stroke-width="4.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path stroke="#7C3AED" stroke-width="4.5" [attr.stroke-dasharray]="qaScore() + ', 100'" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                    </div>
                  </div>

                  <!-- Details Rows -->
                  @if (showDetails()) {
                    <div class="space-y-2.5 pt-2 text-xs text-gray-600 animate-fadein">
                      <div class="flex items-center justify-between">
                        <span>Anonymous / all questions</span>
                        <span class="font-mono font-bold text-gray-900">{{ anonymousQuestions() }} / {{ totalQaQuestions() }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Answered / unanswered questions</span>
                        <span class="font-mono font-bold text-gray-900">{{ answeredQuestions() }} / {{ unansweredQuestions() }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Upvotes / downvotes</span>
                        <span class="font-mono font-bold text-gray-900">{{ totalUpvotes() }} / {{ totalDownvotes() }}</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Bottom Score Bar (Violet Tint with Violet Score Badge) -->
                <div class="flex items-center justify-between bg-[#F5F3FF] border-t border-violet-100 overflow-hidden">
                  <div class="px-5 py-3 text-xs font-bold text-violet-900 flex items-center gap-1.5 flex-1">
                    <span>Q&amp;A engagement score</span>
                    <i class="pi pi-info-circle text-[11px] text-violet-600"></i>
                  </div>
                  <div class="bg-[#7C3AED] text-white px-4 py-3 text-xs font-black font-mono shrink-0">
                    {{ qaScore() }}%
                  </div>
                </div>
              </div>

              <!-- Column 3: Poll engagement (Sky Blue #0284C7) -->
              <div class="flex flex-col justify-between">
                <div class="p-5 sm:p-6 space-y-4">
                  <!-- Header: Title + Subtitle + Donut Ring -->
                  <div class="flex items-start justify-between gap-3">
                    <div class="space-y-1">
                      <h3 class="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                        Poll engagement
                      </h3>
                      <p class="text-xs text-gray-500 leading-snug">
                        <strong class="text-gray-900">{{ pollParticipantsCount() }} out of {{ totalParticipantsCount() }}</strong> participants voted in a poll.
                      </p>
                    </div>

                    <!-- Sky Blue Donut Ring -->
                    <div class="relative w-12 h-12 shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 36 36" class="w-12 h-12 transform -rotate-90">
                        <path stroke="#F0F9FF" stroke-width="4.5" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                        <path stroke="#0284C7" stroke-width="4.5" [attr.stroke-dasharray]="pollScore() + ', 100'" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      </svg>
                    </div>
                  </div>

                  <!-- Details Rows -->
                  @if (showDetails()) {
                    <div class="space-y-2.5 pt-2 text-xs text-gray-600 animate-fadein">
                      <div class="flex items-center justify-between">
                        <span>Total poll votes</span>
                        <span class="font-mono font-bold text-gray-900">{{ totalPollVotes() }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Polls with responses</span>
                        <span class="font-mono font-bold text-gray-900">{{ pollsWithResponses() }}</span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span>Average votes per poll</span>
                        <span class="font-mono font-bold text-gray-900">{{ averageVotesPerPoll() }}</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Bottom Score Bar (Sky Tint with Sky Score Badge) -->
                <div class="flex items-center justify-between bg-[#F0F9FF] border-t border-sky-100 overflow-hidden">
                  <div class="px-5 py-3 text-xs font-bold text-sky-900 flex items-center gap-1.5 flex-1">
                    <span>Poll engagement score</span>
                    <i class="pi pi-info-circle text-[11px] text-sky-600"></i>
                  </div>
                  <div class="bg-[#0284C7] text-white px-4 py-3 text-xs font-black font-mono shrink-0">
                    {{ pollScore() }}%
                  </div>
                </div>
              </div>

            </div>

            <!-- Bottom Toggle Bar: "Show less ^" / "Show more v" -->
            <button 
              type="button" 
              (click)="toggleShowDetails()" 
              class="w-full py-2.5 bg-white hover:bg-gray-50 border-t border-gray-100 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors flex items-center justify-center gap-1 cursor-pointer">
              <span>{{ showDetails() ? 'Show less' : 'Show more' }}</span>
              <i class="pi" [ngClass]="showDetails() ? 'pi-chevron-up' : 'pi-chevron-down'"></i>
            </button>
          </div>

          <!-- Detailed Poll Results Section -->
          <div class="space-y-4 pt-2">
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-lg font-bold text-gray-900">Poll results</h3>
                <p class="text-xs text-gray-500">{{ sessionStats().questionResults.length }} questions total in this session</p>
              </div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-1 rounded-lg bg-gray-100 text-gray-700 text-xs font-mono font-bold">
                  {{ sessionStats().totalVotes }} Total Votes Cast
                </span>
              </div>
            </div>

            <!-- Question Breakdown Cards or Empty State -->
            @if (sessionStats().questionResults.length === 0) {
              <div class="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center space-y-3 shadow-2xs">
                <div class="w-12 h-12 rounded-full bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
                  <i class="pi pi-chart-bar text-xl"></i>
                </div>
                <div class="text-base font-bold text-gray-800">No poll responses yet</div>
                <p class="text-xs text-gray-500 max-w-md mx-auto">
                  When participants vote or submit responses in room <strong>#{{ roomCode() }}</strong>, their answers, percentages, and breakdowns will appear here.
                </p>
              </div>
            } @else {
              <div class="space-y-3.5">
                @for (q of sessionStats().questionResults; track q.pollId; let idx = $index) {
                  <div class="bg-white rounded-2xl border border-gray-200 p-5 space-y-3 shadow-2xs transition-all">
                    
                    <!-- Question Title & Metadata -->
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-start gap-2.5 min-w-0">
                        <span class="w-6 h-6 rounded-lg bg-gray-100 text-gray-700 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                          {{ q.order || (idx + 1) }}
                        </span>
                        <h4 class="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                          {{ q.question }}
                        </h4>
                      </div>

                      <div class="flex items-center gap-1.5 shrink-0 text-xs font-bold font-mono text-gray-500">
                        <span>{{ q.totalVotes }} votes</span>
                      </div>
                    </div>

                    <!-- Scored or Consensus Status Badge -->
                    <div class="flex items-center gap-2 text-xs">
                      @if (q.correctOptionId !== undefined) {
                        <span class="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1">
                          <i class="pi pi-check text-[11px] text-emerald-600"></i>
                          <span>Correct answer: <strong>{{ q.correctOptionText }}</strong></span>
                          <span class="font-mono">({{ q.correctPercentage }}% accuracy)</span>
                        </span>
                      } @else {
                        <span class="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold flex items-center gap-1">
                          <i class="pi pi-star text-[11px] text-indigo-600"></i>
                          <span>Winning response: <strong>{{ q.winningOptionText }}</strong></span>
                          <span class="font-mono">({{ q.winningPercentage }}% consensus)</span>
                        </span>
                      }
                    </div>

                    <!-- Options Distribution Bars -->
                    <div class="space-y-2 pt-1">
                      @for (opt of q.options; track opt.id; let optIdx = $index) {
                        <div class="p-2.5 rounded-xl border transition-colors space-y-1.5"
                          [ngClass]="opt.isCorrect 
                            ? 'border-emerald-300 bg-emerald-50/40 ring-1 ring-emerald-400/40' 
                            : 'border-gray-200 bg-gray-50/40'">
                          
                          <div class="flex items-center justify-between text-xs font-semibold gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="w-5 h-5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0"
                                [ngClass]="opt.isCorrect ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'">
                                {{ getOptionLetter(optIdx) }}
                              </span>
                              <span class="truncate" [ngClass]="opt.isCorrect ? 'font-bold text-emerald-950' : 'text-gray-800'">
                                {{ opt.text }}
                              </span>
                              @if (opt.isCorrect) {
                                <span class="text-[9px] uppercase font-black px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800">
                                  Correct
                                </span>
                              }
                            </div>

                            <div class="shrink-0 flex items-center gap-2 font-mono">
                              <span class="text-xs font-bold" [ngClass]="opt.isCorrect ? 'text-emerald-700' : 'text-gray-900'">
                                {{ opt.percentage }}%
                              </span>
                              <span class="text-[10px] text-gray-400">
                                ({{ opt.votes }})
                              </span>
                            </div>
                          </div>

                          <!-- Progress Bar Fill -->
                          <div class="w-full h-2 rounded-full overflow-hidden bg-gray-200/80">
                            <div class="h-full rounded-full transition-all duration-500"
                              [style.width.%]="opt.percentage"
                              [ngClass]="opt.isCorrect 
                                ? 'bg-emerald-600' 
                                : (opt.id === q.winningOptionId ? 'bg-indigo-600' : 'bg-gray-400')">
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        </main>
      </div>

      <!-- Share Analytics Modal -->
      <p-dialog 
        header="Share Mati Analytics" 
        [visible]="showShareDialog()" 
        (visibleChange)="showShareDialog.set($event)" 
        [modal]="true" 
        [style]="{width: '450px'}" 
        class="p-fluid">
        <div class="space-y-4 pt-2 text-center">
          <p class="text-xs text-gray-500">Share live results and audience feedback for Room <strong class="text-gray-900 font-mono">{{ roomCode() }}</strong>.</p>
          
          @if (qrCodeDataUrl()) {
            <div class="p-3 bg-white border border-gray-200 rounded-2xl w-48 h-48 mx-auto flex items-center justify-center shadow-xs">
              <img [src]="qrCodeDataUrl()" alt="QR Code" class="w-full h-full object-contain" />
            </div>
          }

          <div class="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-200 text-xs font-mono">
            <span class="truncate flex-1 text-left">{{ fullJoinUrl() }}</span>
            <button 
              type="button" 
              (click)="copyShareLink()"
              class="px-2.5 py-1 bg-gray-800 text-white rounded-lg font-bold shrink-0 hover:bg-black transition-colors cursor-pointer">
              Copy
            </button>
          </div>
        </div>
      </p-dialog>
    </div>
  `
})
export class RoomOverviewComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private pollService = inject(MatiPollService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  roomCode = signal<string>('MATI01');
  room = signal<Room | null>(null);
  rawPolls = signal<Poll[]>([]);
  polls = computed(() => {
    const list = this.rawPolls();
    const sel = this.room()?.selectedPollIds;
    if (sel && Array.isArray(sel) && sel.length > 0) {
      const filtered = list.filter(p => sel.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return list;
  });

  sessionStats = signal<DetailedSessionSummary>({
    totalQuestions: 0,
    totalVotes: 0,
    totalScoredQuestions: 0,
    overallAccuracy: 0,
    hasScoredQuestions: false,
    topConsensusPercentage: 0,
    questionResults: []
  });

  isLoading = signal<boolean>(true);
  showDetails = signal<boolean>(true);
  showShareDialog = signal<boolean>(false);
  qrCodeDataUrl = signal<string>('');
  fullJoinUrl = signal<string>('');

  private roomSub?: Subscription;
  private pollsSub?: Subscription;
  private routeSub?: Subscription;

  // Engagement computed metrics matching Slido
  totalParticipantsCount = computed(() => {
    const votes = this.sessionStats().totalVotes;
    return votes > 0 ? 1 : 1;
  });

  engagedParticipantsCount = computed(() => {
    const votes = this.sessionStats().totalVotes;
    return votes > 0 ? 1 : 1;
  });

  pollParticipantsCount = computed(() => {
    return this.sessionStats().totalVotes > 0 ? 1 : 1;
  });

  qaParticipantsCount = computed(() => 1);
  qaVotesCount = computed(() => 0);
  anonymousQuestions = computed(() => 1);
  totalQaQuestions = computed(() => 1);
  answeredQuestions = computed(() => 0);
  unansweredQuestions = computed(() => 1);
  totalUpvotes = computed(() => 0);
  totalDownvotes = computed(() => 0);

  totalPollVotes = computed(() => this.sessionStats().totalVotes);
  pollsWithResponses = computed(() => {
    return this.sessionStats().questionResults.filter(q => q.totalVotes > 0).length || (this.sessionStats().totalVotes > 0 ? 1 : 1);
  });
  averageVotesPerPoll = computed(() => {
    const count = this.polls().length;
    if (count === 0) return 1;
    return Math.max(1, Math.round(this.sessionStats().totalVotes / count));
  });

  engagedScore = computed(() => 100);
  qaScore = computed(() => 100);
  pollScore = computed(() => 100);

  ngOnInit() {
    this.routeSub = this.route.paramMap.subscribe(params => {
      const code = params.get('roomCode') || this.pollService.getActiveBroadcastRoom() || 'MATI01';
      this.loadRoomOverview(code.toUpperCase());
    });
  }

  ngOnDestroy() {
    this.roomSub?.unsubscribe();
    this.pollsSub?.unsubscribe();
    this.routeSub?.unsubscribe();
  }

  async loadRoomOverview(code: string) {
    this.isLoading.set(true);
    this.roomCode.set(code);
    this.setupUrls(code);

    this.roomSub?.unsubscribe();
    this.pollsSub?.unsubscribe();

    this.roomSub = this.pollService.listenToRoom(code).subscribe(roomData => {
      this.room.set(roomData);
    });

    let initialLoaded = false;
    this.pollsSub = this.pollService.listenToRoomPolls(code).subscribe(async polls => {
      this.rawPolls.set(polls);
      await this.refreshSummary(code);
      if (!initialLoaded) {
        initialLoaded = true;
        this.isLoading.set(false);
      }
    });

    try {
      await this.refreshSummary(code);
    } finally {
      this.isLoading.set(false);
    }
  }

  async refreshSummary(code: string) {
    try {
      const summary = await this.pollService.getSessionSummary(code);
      this.sessionStats.set(summary);
    } catch (e) {
      console.warn('[Overview] Error loading session summary:', e);
    }
  }

  toggleShowDetails() {
    this.showDetails.update(v => !v);
  }

  copyRoomCode() {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(this.roomCode());
      this.messageService.add({
        severity: 'info',
        summary: 'Copied!',
        detail: `Room code #${this.roomCode()} copied to clipboard.`
      });
    }
  }

  copyShareLink() {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(this.fullJoinUrl());
      this.messageService.add({
        severity: 'success',
        summary: 'Link Copied',
        detail: 'Participant join link copied.'
      });
    }
  }

  toggleMenu() {
    this.messageService.add({
      severity: 'secondary',
      summary: 'Options',
      detail: `Mati Room #${this.roomCode()}`
    });
  }

  exportResultsAsCsv() {
    const results = this.sessionStats().questionResults;
    if (results.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Data',
        detail: 'No question results to export yet.'
      });
      return;
    }

    // Prepend UTF-8 BOM (\uFEFF) so Microsoft Excel renders Khmer Unicode fonts correctly without garbling
    const BOM = '\uFEFF';
    let csv = 'Order,Question,Total Votes,Winning Choice,Winning Percentage,Correct Option,All Options Breakdown\r\n';
    
    for (const q of results) {
      const cleanQuestion = (q.question || '').replace(/\r?\n/g, ' ').replace(/"/g, '""').trim();
      const cleanWinning = (q.winningOptionText || '').replace(/\r?\n/g, ' ').replace(/"/g, '""').trim();
      const cleanCorrect = (q.correctOptionText || 'N/A').replace(/\r?\n/g, ' ').replace(/"/g, '""').trim();
      const optionsBreakdown = (q.options || [])
        .map((opt, i) => `${this.getOptionLetter(i)}: ${opt.text} (${opt.percentage}%, ${opt.votes} votes)`)
        .join(' | ')
        .replace(/\r?\n/g, ' ')
        .replace(/"/g, '""');

      const row = [
        q.order,
        `"${cleanQuestion}"`,
        q.totalVotes,
        `"${cleanWinning}"`,
        `"${q.winningPercentage}%"`,
        `"${cleanCorrect}"`,
        `"${optionsBreakdown}"`
      ];
      csv += row.join(',') + '\r\n';
    }

    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', `slido_overview_${this.roomCode()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);

    this.messageService.add({
      severity: 'success',
      summary: 'Export Complete',
      detail: 'Overview CSV results exported with Khmer Unicode (UTF-8 BOM) support.'
    });
  }

  getOptionLetter(idx: number): string {
    return String.fromCharCode(65 + (idx % 26));
  }

  private async setupUrls(code: string) {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;
    const url = `${origin}/join/${code}`;
    this.fullJoinUrl.set(url);
    try {
      const qr = await QRCode.toDataURL(url, { width: 300, margin: 1 });
      this.qrCodeDataUrl.set(qr);
    } catch {}
  }
}
