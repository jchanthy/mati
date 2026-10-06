import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';

export const routes: Routes = [
  // Admin Login with Google
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/auth/login.component').then(m => m.LoginComponent)
  },

  // Teacher Dashboard (Direct Access without Auth Guard)
  {
    path: 'dashboard',
    component: AppLayoutComponent,
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
      }
    ]
  },

  // Presenter Stage (Blank shell for Projector/TV)
  {
    path: 'stage/:roomCode',
    loadComponent: () =>
      import('./pages/stage/stage.component').then(m => m.StageComponent)
  },

  // Participant Mobile Experience (Minimal distraction-free mobile shell)
  {
    path: 'join/:roomCode',
    loadComponent: () =>
      import('./pages/student/student-view.component').then(m => m.StudentViewComponent)
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
