import { Routes } from '@angular/router';
import { roleGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing.page').then((m) => m.LandingPage),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/auth.page').then((m) => m.AuthPage),
  },
  {
    path: 'app/donor',
    canActivate: [roleGuard],
    data: { role: 'donor' },
    loadComponent: () => import('./pages/donor/donor.page').then((m) => m.DonorPage),
  },
  {
    path: 'app/admin',
    canActivate: [roleGuard],
    data: { role: 'admin' },
    loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage),
  },
  {
    path: 'app/volunteer',
    canActivate: [roleGuard],
    data: { role: 'volunteer' },
    loadComponent: () => import('./pages/volunteer/volunteer.page').then((m) => m.VolunteerPage),
  },
  {
    path: 'app/:role',
    canActivate: [roleGuard],
    loadComponent: () => import('./pages/workspace/workspace.page').then((m) => m.WorkspacePage),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
