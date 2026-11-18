import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './guards/auth.guard';

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
    path: 'app/beneficiary',
    canActivate: [roleGuard],
    data: { role: 'beneficiary' },
    loadComponent: () => import('./pages/beneficiary/beneficiary.page').then((m) => m.BeneficiaryPage),
  },
  {
    path: 'app/person',
    canActivate: [roleGuard],
    data: { role: 'person' },
    loadComponent: () => import('./pages/person/person.page').then((m) => m.PersonPage),
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
    path: 'app/profile',
    canActivate: [roleGuard],
    loadComponent: () => import('./pages/profile/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'app/aid-requests',
    canActivate: [roleGuard],
    loadComponent: () => import('./pages/aid-requests/aid-requests.page').then((m) => m.AidRequestsPage),
  },
  {
    path: 'app/chat',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/chat/chat.page').then((m) => m.ChatPage),
  },
  {
    path: 'app/chat/:conversationId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/chat/chat.page').then((m) => m.ChatPage),
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
