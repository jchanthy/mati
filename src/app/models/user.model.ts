export interface AppUser {
  uid?: string;
  email: string;
  displayName?: string | null;
  photoURL?: string | null;
  role: 'admin' | 'presenter';
  status: 'active' | 'disabled';
  createdAt?: any;
  lastLoginAt?: any;
  createdBy?: string;
}
