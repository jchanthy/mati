import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
  Auth
} from 'firebase/auth';

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private firebaseApp = inject(FirebaseApp, { optional: true });
  private isBrowser = isPlatformBrowser(this.platformId);

  private auth: Auth | null = null;

  // Reactive state signals
  readonly currentUser = signal<AdminUser | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isAuthenticated = computed(() => !!this.currentUser());

  constructor() {
    if (this.isBrowser && this.firebaseApp) {
      try {
        this.auth = getAuth(this.firebaseApp);
        onAuthStateChanged(this.auth, (user: User | null) => {
          if (user) {
            this.currentUser.set({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              photoURL: user.photoURL
            });
          } else {
            this.currentUser.set(null);
          }
          this.isLoading.set(false);
        });
      } catch (err) {
        console.warn('Firebase Auth initialization error:', err);
        this.isLoading.set(false);
      }
    } else {
      this.isLoading.set(false);
    }
  }

  /**
   * Sign in with Google Popup
   */
  async loginWithGoogle(): Promise<AdminUser | null> {
    if (!this.auth) {
      throw new Error('Authentication is only supported in browser mode with Firebase configured.');
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(this.auth, provider);
    const user = result.user;
    const adminUser: AdminUser = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL
    };
    this.currentUser.set(adminUser);
    return adminUser;
  }

  /**
   * Sign out current admin user
   */
  async logout(): Promise<void> {
    if (this.auth) {
      await signOut(this.auth);
    }
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }
}
