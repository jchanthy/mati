import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';
import { authGuard } from './guards/auth.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  // Admin & Presenter Login with Google
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login.component').then(m => m.LoginComponent)
  },

  // Authenticated Dashboard
  {
    path: 'dashboard',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'control',
        loadComponent: () =>
          import('./pages/control/admin-poll-control.component').then(m => m.AdminPollControlComponent)
      },
      {
        path: 'control/:roomCode',
        loadComponent: () =>
          import('./pages/control/admin-poll-control.component').then(m => m.AdminPollControlComponent)
      },
      {
        path: 'users',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./pages/admin/user-management.component').then(m => m.UserManagementComponent)
      }
    ]
  },

  // Presenter Stage (Blank shell for Projector/TV) - Public
  {
    path: 'stage',
    loadComponent: () =>
      import('./pages/stage/stage.component').then(m => m.StageComponent)
  },
  {
    path: 'stage/:roomCode',
    loadComponent: () =>
      import('./pages/stage/stage.component').then(m => m.StageComponent)
  },

  // Participant Mobile Experience (Minimal distraction-free mobile shell) - Public
  {
    path: 'join',
    loadComponent: () =>
      import('./pages/student/student-view.component').then(m => m.StudentViewComponent)
  },
  {
    path: 'join/:roomCode',
    loadComponent: () =>
      import('./pages/student/student-view.component').then(m => m.StudentViewComponent)
  },
  {
    path: 'vote',
    redirectTo: 'join',
    pathMatch: 'full'
  },
  {
    path: 'vote/:roomCode',
    loadComponent: () =>
      import('./pages/student/student-view.component').then(m => m.StudentViewComponent)
  },

  // Controller aliases
  {
    path: 'control',
    redirectTo: 'dashboard/control',
    pathMatch: 'full'
  },
  {
    path: 'control/:roomCode',
    redirectTo: ({ params }) => `dashboard/control/${params['roomCode']}`
  },
  {
    path: 'controller',
    redirectTo: 'dashboard/control',
    pathMatch: 'full'
  },
  {
    path: 'controller/:roomCode',
    redirectTo: ({ params }) => `dashboard/control/${params['roomCode']}`
  },

  // Redirect root to dashboard
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },

  // Wildcard fallback
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
