import { Routes } from '@angular/router';
import { AppLayoutComponent } from './layout/app.layout.component';

export const routes: Routes = [
  // Teacher Dashboard (Sakai Shell)
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
