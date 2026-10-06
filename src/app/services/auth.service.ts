import { Injectable, inject, signal, computed, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { FirebaseApp } from '@angular/fire/app';
import { Firestore } from '@angular/fire/firestore';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  User,
  Auth
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { AppUser } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private firebaseApp = inject(FirebaseApp, { optional: true });
  private firestore = inject(Firestore, { optional: true });
  private isBrowser = isPlatformBrowser(this.platformId);

  private auth: Auth | null = null;

  // Reactive state signals
  readonly currentUser = signal<AppUser | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly isAuthenticated = computed(() => !!this.currentUser());
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  constructor() {
    if (this.isBrowser && this.firebaseApp) {
      try {
        this.auth = getAuth(this.firebaseApp);
        onAuthStateChanged(this.auth, async (gUser: User | null) => {
          if (gUser && gUser.email) {
            try {
              const authorized = await this.verifyAndGetAuthorizedUser(gUser.email, gUser);
              if (authorized && authorized.status === 'active') {
                this.currentUser.set(authorized);
              } else {
                // Not authorized or disabled in Firestore
                console.warn('[Mati Auth] User not authorized or disabled:', gUser.email);
                if (this.auth) await signOut(this.auth);
                this.currentUser.set(null);
              }
            } catch (err) {
              console.error('[Mati Auth] Error verifying user state:', err);
              this.currentUser.set(null);
            }
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
   * Helper: check if a user is pre-registered in the Firestore `users` collection.
   * If Firestore `users` collection is completely empty (initial setup),
   * the first logging-in user is bootstrapped as Super Admin.
   */
  private async verifyAndGetAuthorizedUser(rawEmail: string, gUser: User): Promise<AppUser | null> {
    const email = rawEmail.toLowerCase().trim();
    if (!this.firestore) {
      // Fallback for mock/offline dev mode
      return {
        uid: gUser.uid,
        email,
        displayName: gUser.displayName || 'Admin',
        photoURL: gUser.photoURL,
        role: 'admin',
        status: 'active'
      };
    }

    try {
      const userDocRef = doc(this.firestore, 'users', email);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data() as AppUser;
        // Update user record with latest Google profile info and login timestamp
        const updated: AppUser = {
          ...data,
          uid: gUser.uid,
          email,
          displayName: gUser.displayName || data.displayName || 'User',
          photoURL: gUser.photoURL || data.photoURL || null,
          lastLoginAt: serverTimestamp()
        };
        await updateDoc(userDocRef, {
          uid: gUser.uid,
          displayName: updated.displayName,
          photoURL: updated.photoURL,
          lastLoginAt: serverTimestamp()
        });
        return updated;
      }

      // Check if user was registered with auto-id instead of email as document ID
      const q = query(collection(this.firestore, 'users'), where('email', '==', email));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        const matchedDoc = qSnap.docs[0];
        const data = matchedDoc.data() as AppUser;
        const updated: AppUser = {
          ...data,
          uid: gUser.uid,
          email,
          displayName: gUser.displayName || data.displayName || 'User',
          photoURL: gUser.photoURL || data.photoURL || null,
          lastLoginAt: serverTimestamp()
        };
        await updateDoc(matchedDoc.ref, {
          uid: gUser.uid,
          displayName: updated.displayName,
          photoURL: updated.photoURL,
          lastLoginAt: serverTimestamp()
        });
        return updated;
      }

      // Check if this is the very first user in an empty system (Bootstrap Initial Admin)
      const allUsersSnap = await getDocs(collection(this.firestore, 'users'));
      if (allUsersSnap.empty) {
        console.info(`[Mati Auth] Initial empty database detected. Bootstrapping initial admin: ${email}`);
        const initialAdmin: AppUser = {
          uid: gUser.uid,
          email,
          displayName: gUser.displayName || 'Administrator',
          photoURL: gUser.photoURL,
          role: 'admin',
          status: 'active',
          createdAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        };
        await setDoc(userDocRef, initialAdmin);
        return initialAdmin;
      }

      // Not registered in Firebase users collection
      return null;
    } catch (err) {
      console.error('[Mati Auth] verifyAndGetAuthorizedUser error:', err);
      throw err;
    }
  }

  /**
   * Sign in with Google Popup.
   * Only allows users whose account has already been created in Firebase.
   */
  async loginWithGoogle(): Promise<AppUser> {
    if (!this.auth) {
      throw new Error('Authentication is only supported in browser mode with Firebase configured.');
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(this.auth, provider);
    const gUser = result.user;
    const email = (gUser.email || '').toLowerCase().trim();

    if (!email) {
      await signOut(this.auth);
      throw new Error('No valid email address was returned by Google.');
    }

    const authorizedUser = await this.verifyAndGetAuthorizedUser(email, gUser);
    if (!authorizedUser) {
      await signOut(this.auth);
      this.currentUser.set(null);
      throw new Error(
        `Access Denied: The Google account (${gUser.email}) is not registered in Firebase. An administrator must create your account in Firebase before you can log in.`
      );
    }

    if (authorizedUser.status === 'disabled') {
      await signOut(this.auth);
      this.currentUser.set(null);
      throw new Error(
        `Access Denied: Your account (${gUser.email}) has been deactivated by an administrator.`
      );
    }

    this.currentUser.set(authorizedUser);
    return authorizedUser;
  }

  /**
   * Sign out current user
   */
  async logout(): Promise<void> {
    if (this.auth) {
      await signOut(this.auth);
    }
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * User Management: Real-time observable of registered users
   */
  listUsers(): Observable<AppUser[]> {
    if (!this.firestore) {
      return new Observable<AppUser[]>(sub => {
        const current = this.currentUser();
        sub.next(current ? [current] : []);
      });
    }

    return new Observable<AppUser[]>(subscriber => {
      const usersCol = collection(this.firestore!, 'users');
      const unsub = onSnapshot(usersCol, (snap) => {
        const users: AppUser[] = snap.docs.map(d => ({
          ...d.data()
        } as AppUser));
        subscriber.next(users);
      }, (err) => {
        console.warn('[Mati Auth] listUsers listener error:', err);
        subscriber.error(err);
      });

      return () => unsub();
    });
  }

  /**
   * User Management: Create or invite a new user account into Firebase Firestore
   */
  async createUser(newUser: { email: string; displayName?: string; role: 'admin' | 'presenter' }): Promise<void> {
    if (!this.firestore) {
      throw new Error('Firestore is required to manage users.');
    }
    const email = newUser.email.toLowerCase().trim();
    if (!email || !email.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }

    const userDocRef = doc(this.firestore, 'users', email);
    const existingSnap = await getDoc(userDocRef);
    if (existingSnap.exists()) {
      throw new Error(`User with email "${email}" is already registered.`);
    }

    const userRecord: AppUser = {
      email,
      displayName: newUser.displayName || email.split('@')[0],
      role: newUser.role,
      status: 'active',
      createdAt: serverTimestamp(),
      createdBy: this.currentUser()?.email || 'admin'
    };

    await setDoc(userDocRef, userRecord);
  }

  /**
   * User Management: Update status ('active' | 'disabled')
   */
  async updateUserStatus(email: string, status: 'active' | 'disabled'): Promise<void> {
    if (!this.firestore) return;
    const normalized = email.toLowerCase().trim();
    const userDocRef = doc(this.firestore, 'users', normalized);
    await updateDoc(userDocRef, { status });
  }

  /**
   * User Management: Update role ('admin' | 'presenter')
   */
  async updateUserRole(email: string, role: 'admin' | 'presenter'): Promise<void> {
    if (!this.firestore) return;
    const normalized = email.toLowerCase().trim();
    const userDocRef = doc(this.firestore, 'users', normalized);
    await updateDoc(userDocRef, { role });
  }

  /**
   * User Management: Delete user
   */
  async deleteUser(email: string): Promise<void> {
    if (!this.firestore) return;
    const normalized = email.toLowerCase().trim();
    const userDocRef = doc(this.firestore, 'users', normalized);
    await deleteDoc(userDocRef);
  }
}
