import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';

export const routes: Routes = [
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
        path: '',
        redirectTo: '/dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/components/dashboard-home/dashboard-home.component')
          .then(m => m.DashboardHomeComponent)
      },
      {
        path: 'upload',
        loadComponent: () => import('./components/upload-documents/upload-documents.component')
          .then(m => m.UploadDocumentsComponent)
      },
      {
        path: 'servers',
        loadComponent: () => import('./modules/dashboard/components/servers-list/servers-list.component')
          .then(m => m.ServersListComponent)
      },
      {
        path: 'servers/:letter',
        loadComponent: () => import('./modules/dashboard/components/servers-by-letter/servers-by-letter.component')
          .then(m => m.ServersByLetterComponent)
      },
      {
        path: 'servers/:letter/:id',
        loadComponent: () => import('./modules/dashboard/components/server-details/server-details.component')
          .then(m => m.ServerDetailsComponent)
      },
      {
        path: 'documentacoes-financeiras',
        loadComponent: () => import('./modules/dashboard/components/financial-documents/financial-documents.component')
          .then(m => m.FinancialDocumentsComponent)
      },
      {
        path: 'documentacoes-financeiras/:category',
        loadComponent: () => import('./modules/dashboard/components/financial-category-details/financial-category-details.component')
          .then(m => m.FinancialCategoryDetailsComponent)
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];