import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./modules/auth/components/login/login-simple.component')
      .then(m => m.LoginSimpleComponent)
  },
  {
    path: 'login',
    redirectTo: '/auth/login'
  },
  {
    path: '',
    loadComponent: () => import('./modules/dashboard/components/dashboard-layout/dashboard-layout.component')
      .then(m => m.DashboardLayoutComponent),
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/components/dashboard-home/dashboard-home.component')
          .then(m => m.DashboardHomeComponent)
      },
      {
        path: 'servers',
        loadComponent: () => import('./modules/dashboard/components/servers-list/servers-list.component')
          .then(m => m.ServersListComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];