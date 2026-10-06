import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { AppUser } from '../../models/user.model';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    ToastModule
  ],
  providers: [MessageService],
  template: `
    <div class="space-y-6">
      <p-toast></p-toast>

      <!-- Page Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              User Management
            </h1>
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              Admin Only
            </span>
          </div>
          <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pre-register authorized Google accounts. Only accounts added here can log in to Mati Studio.
          </p>
        </div>

        <button
          type="button"
          (click)="openAddUserDialog()"
          class="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer">
          <i class="pi pi-user-plus"></i>
          <span>Add Authorized User</span>
        </button>
      </div>

      <!-- Whitelist Explanation Notice -->
      <div class="p-4 sm:p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 flex items-start gap-3.5">
        <div class="w-9 h-9 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 text-base">
          <i class="pi pi-shield"></i>
        </div>
        <div class="text-xs space-y-1">
          <h3 class="font-bold text-slate-900 dark:text-white">Strict Google Access Control</h3>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            Mati uses a zero-trust pre-authorization model: users cannot sign in with arbitrary Google emails. 
            An administrator must register their Google email in Firebase first. Any unregistered login attempt will be immediately rejected.
          </p>
        </div>
      </div>

      <!-- Users Grid / Table Card -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div class="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div class="flex items-center gap-2 font-bold text-sm text-slate-800 dark:text-slate-200">
            <i class="pi pi-users text-indigo-500"></i>
            <span>Registered Accounts ({{ users().length }})</span>
          </div>
          <div class="text-xs text-slate-400 font-mono">
            Synced with Firestore
          </div>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs border-collapse">
            <thead>
              <tr class="bg-slate-50/80 dark:bg-slate-800/50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800">
                <th class="py-3 px-5">User</th>
                <th class="py-3 px-5">Email Address</th>
                <th class="py-3 px-5">Role</th>
                <th class="py-3 px-5">Status</th>
                <th class="py-3 px-5">Last Activity</th>
                <th class="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              @for (u of users(); track u.email) {
                <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <!-- User Avatar & Display Name -->
                  <td class="py-3.5 px-5">
                    <div class="flex items-center gap-3 min-w-0">
                      @if (u.photoURL && !failedAvatars()[u.email]) {
                        <img 
                          [src]="u.photoURL" 
                          referrerpolicy="no-referrer"
                          (error)="markAvatarFailed(u.email)"
                          class="w-9 h-9 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0" 
                          alt="">
                      } @else {
                        <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {{ (u.displayName || u.email).charAt(0).toUpperCase() }}
                        </div>
                      }
                      <div class="min-w-0">
                        <div class="font-bold text-slate-900 dark:text-white truncate">
                          {{ u.displayName || 'Authorized User' }}
                        </div>
                        <div class="text-[11px] text-slate-400 font-mono truncate">
                          {{ u.uid ? 'UID: ' + u.uid.substring(0, 10) + '...' : 'Pending first login' }}
                        </div>
                      </div>
                    </div>
                  </td>

                  <!-- Email Address -->
                  <td class="py-3.5 px-5">
                    <span class="font-mono text-slate-700 dark:text-slate-300 font-semibold select-all">
                      {{ u.email }}
                    </span>
                  </td>

                  <!-- Role Badge -->
                  <td class="py-3.5 px-5">
                    @if (u.role === 'admin') {
                      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                        <i class="pi pi-crown text-[10px]"></i> Admin
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-sky-100 dark:bg-sky-950/70 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                        <i class="pi pi-user text-[10px]"></i> Presenter
                      </span>
                    }
                  </td>

                  <!-- Status Badge -->
                  <td class="py-3.5 px-5">
                    @if (u.status === 'active') {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Active
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                        <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Disabled
                      </span>
                    }
                  </td>

                  <!-- Last Activity -->
                  <td class="py-3.5 px-5 text-slate-500 dark:text-slate-400">
                    {{ u.lastLoginAt ? 'Active session' : 'Awaiting sign-in' }}
                  </td>

                  <!-- Actions -->
                  <td class="py-3.5 px-5 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <!-- Toggle Status -->
                      <button
                        type="button"
                        (click)="toggleUserStatus(u)"
                        title="{{ u.status === 'active' ? 'Disable Account' : 'Activate Account' }}"
                        class="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <i class="pi" [ngClass]="u.status === 'active' ? 'pi-ban text-amber-500' : 'pi-check-circle text-emerald-500'"></i>
                      </button>

                      <!-- Toggle Role -->
                      <button
                        type="button"
                        (click)="toggleUserRole(u)"
                        title="Switch Role between Admin / Presenter"
                        class="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <i class="pi pi-sync"></i>
                      </button>

                      <!-- Delete User -->
                      <button
                        type="button"
                        (click)="deleteUser(u)"
                        title="Delete User"
                        [disabled]="u.email === currentUserEmail"
                        class="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed">
                        <i class="pi pi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="text-center py-12 text-slate-400">
                    <i class="pi pi-user-plus text-2xl mb-2 text-slate-300"></i>
                    <div>No users registered yet. Add your first authorized Google account!</div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Add User Modal Dialog -->
      <p-dialog
        [(visible)]="showAddDialog"
        [modal]="true"
        [draggable]="false"
        [resizable]="false"
        header="Add Authorized Google Account"
        [style]="{ width: '90vw', maxWidth: '480px' }">
        <div class="space-y-4 pt-2">
          <div class="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <strong>Important:</strong> Enter the exact Google email address the user will use to sign in via Google.
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Google Email Address *
            </label>
            <input
              type="email"
              pInputText
              [(ngModel)]="newEmail"
              placeholder="e.g. presenter@cadt.edu.kh or user@gmail.com"
              class="w-full text-sm font-mono" />
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Full Name (Optional)
            </label>
            <input
              type="text"
              pInputText
              [(ngModel)]="newDisplayName"
              placeholder="e.g. Chan Chanthoeun"
              class="w-full text-sm" />
          </div>

          <div class="space-y-1.5">
            <label class="block text-xs font-bold text-slate-700 dark:text-slate-300">
              System Role *
            </label>
            <div class="grid grid-cols-2 gap-3">
              <label 
                (click)="newRole = 'presenter'"
                [ngClass]="newRole === 'presenter' ? 'ring-2 ring-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'"
                class="p-3 rounded-xl border flex flex-col items-start gap-1 cursor-pointer transition-all">
                <span class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <i class="pi pi-user text-indigo-500"></i> Presenter
                </span>
                <span class="text-[11px] text-slate-500">Create & control own rooms</span>
              </label>

              <label 
                (click)="newRole = 'admin'"
                [ngClass]="newRole === 'admin' ? 'ring-2 ring-purple-500 bg-purple-50/50 dark:bg-purple-950/40 border-purple-400' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'"
                class="p-3 rounded-xl border flex flex-col items-start gap-1 cursor-pointer transition-all">
                <span class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <i class="pi pi-crown text-purple-500"></i> Admin
                </span>
                <span class="text-[11px] text-slate-500">Full control & manage users</span>
              </label>
            </div>
          </div>
        </div>

        <ng-template pTemplate="footer">
          <div class="flex items-center justify-end gap-2 pt-3">
            <button
              type="button"
              (click)="showAddDialog = false"
              class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer">
              Cancel
            </button>
            <button
              type="button"
              (click)="saveNewUser()"
              [disabled]="isSaving() || !newEmail"
              class="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
              @if (isSaving()) {
                <i class="pi pi-spin pi-spinner mr-1"></i> Saving...
              } @else {
                Authorize Account
              }
            </button>
          </div>
        </ng-template>
      </p-dialog>
    </div>
  `
})
export class UserManagementComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  users = signal<AppUser[]>([]);
  showAddDialog = false;
  isSaving = signal<boolean>(false);

  newEmail = '';
  newDisplayName = '';
  newRole: 'admin' | 'presenter' = 'presenter';

  private sub?: Subscription;

  get currentUserEmail(): string {
    return this.authService.currentUser()?.email || '';
  }

  failedAvatars = signal<{ [email: string]: boolean }>({});

  markAvatarFailed(email: string) {
    this.failedAvatars.update(map => ({ ...map, [email]: true }));
  }

  ngOnInit() {
    this.sub = this.authService.listUsers().subscribe({
      next: (list) => {
        this.users.set(list);
      },
      error: (err) => {
        console.error('Failed to load users:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load user list from Firestore.'
        });
      }
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  openAddUserDialog() {
    this.newEmail = '';
    this.newDisplayName = '';
    this.newRole = 'presenter';
    this.showAddDialog = true;
  }

  async saveNewUser() {
    const email = this.newEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Invalid Email',
        detail: 'Please provide a valid Google email address.'
      });
      return;
    }

    this.isSaving.set(true);
    try {
      await this.authService.createUser({
        email,
        displayName: this.newDisplayName.trim() || undefined,
        role: this.newRole
      });
      this.messageService.add({
        severity: 'success',
        summary: 'Account Created',
        detail: `"${email}" has been authorized. They can now log in using Google!`
      });
      this.showAddDialog = false;
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to save user account.'
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  async toggleUserStatus(user: AppUser) {
    const newStatus = user.status === 'active' ? 'disabled' : 'active';
    try {
      await this.authService.updateUserStatus(user.email, newStatus);
      this.messageService.add({
        severity: 'info',
        summary: 'Status Updated',
        detail: `User "${user.email}" is now ${newStatus}.`
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to update user status.'
      });
    }
  }

  async toggleUserRole(user: AppUser) {
    const newRole = user.role === 'admin' ? 'presenter' : 'admin';
    try {
      await this.authService.updateUserRole(user.email, newRole);
      this.messageService.add({
        severity: 'info',
        summary: 'Role Updated',
        detail: `User "${user.email}" is now a ${newRole}.`
      });
    } catch (err: any) {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: err.message || 'Failed to update user role.'
      });
    }
  }

  async deleteUser(user: AppUser) {
    if (confirm(`Are you sure you want to remove "${user.email}"? They will no longer be able to log in.`)) {
      try {
        await this.authService.deleteUser(user.email);
        this.messageService.add({
          severity: 'success',
          summary: 'User Removed',
          detail: `User "${user.email}" has been deleted.`
        });
      } catch (err: any) {
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: err.message || 'Failed to delete user.'
        });
      }
    }
  }
}
