import { Routes } from '@angular/router';
import { AuthGuard } from './shared/guards/auth.guard';
import { AdminGuard } from './shared/guards/admin.guard';

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
      // Rota específica para listar servidores por município deve vir antes
      // das rotas genéricas que usam ':letter' e ':id', para evitar conflitos
      {
        path: 'servers/municipality/:municipalityCode',
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
      },
      {
        path: 'documentacoes-financeiras/municipality',
        loadComponent: () => import('./modules/admin/components/municipality-selector/municipality-selector.component')
          .then(m => m.MunicipalitySelectorComponent),
        canActivate: [AdminGuard]
      },
      {
        path: 'documentacoes-financeiras/municipality/:municipalityCode',
        loadComponent: () => import('./modules/dashboard/components/financial-documents/financial-documents.component')
          .then(m => m.FinancialDocumentsComponent)
      },
      {
        path: 'users',
        loadComponent: () => import('./modules/dashboard/components/users-list/users-list.component')
          .then(m => m.UsersListComponent)
      },
      {
        path: 'users/new',
        loadComponent: () => import('./modules/dashboard/components/user-registration/user-registration.component')
          .then(m => m.UserRegistrationComponent)
      },
      {
        path: 'admin/municipalities',
        loadComponent: () => import('./modules/admin/components/municipality-selector/municipality-selector.component').then(m => m.MunicipalitySelectorComponent),
        canActivate: [AdminGuard]
      }
    ]
  },
  {
    path: '**',
    redirectTo: '/dashboard'
  }
];