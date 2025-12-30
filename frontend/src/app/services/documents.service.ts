import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError, of } from 'rxjs';
import { catchError, map, filter, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from '../shared/services/auth.service';

// Interfaces
export interface Municipality {
  id?: number;
  code: string;
  name: string;
  state: string;
  drive_folder_id?: string;
}

export interface Document {
  id: number;
  title: string;
  description?: string;
  category: string;
  municipality_code: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  google_drive_id: string;
  uploaded_by?: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export interface DocumentFilters {
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  municipality_code?: string;
  limit?: number;
}

export interface DashboardStats {
  servers: { total: number; this_month: number };
  documents: { total: number; today: number };
  storage: { used: number; total: number };
  activities: { uploads_today: number; views_today: number; downloads_today: number };
}

export interface FinancialDocumentType {
  id: number;
  code: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = environment.apiUrl;
  private uploadProgressSubject = new BehaviorSubject<UploadProgress | null>(null);

  // Observable para progresso de upload
  uploadProgress$ = this.uploadProgressSubject.asObservable();

  constructor(private http: HttpClient, private authService: AuthService) { }

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) return new HttpHeaders();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  private getAuthHeadersForFormData(): HttpHeaders {
    const token = this.authService.getToken();
    if (!token) return new HttpHeaders();
    // NÃO incluir Content-Type - o navegador define automaticamente com multipart/form-data boundary
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Upload de documento para o Google Drive
   */
  uploadDocument(file: File, documentData: {
    title: string;
    description?: string;
    category?: string;
    municipality_code: string;
    server_id?: string;
    server_name?: string;
    municipality_name?: string;
    // Novos campos para documentos financeiros
    upload_type?: string;
    financial_document_type?: string;
    financial_year?: string;
    financial_period?: string;
  }): Observable<ApiResponse<Document>> {
    console.log('🚀 DocumentsService.uploadDocument CHAMADO!', {
      file: file.name,
      size: file.size,
      data: documentData,
      apiUrl: this.apiUrl
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', documentData.title);
    formData.append('description', documentData.description || '');

    if (documentData.category) {
      formData.append('category', documentData.category);
    }

    formData.append('municipality_code', documentData.municipality_code);

    // Campos para upload de servidores
    if (documentData.server_id) {
      formData.append('server_id', documentData.server_id);
    }
    if (documentData.server_name) {
      formData.append('server_name', documentData.server_name);
    }
    if (documentData.municipality_name) {
      formData.append('municipality_name', documentData.municipality_name);
    }

    // Campos para upload financeiro
    if (documentData.upload_type) {
      formData.append('upload_type', documentData.upload_type);
    }
    if (documentData.financial_document_type) {
      formData.append('financial_document_type', documentData.financial_document_type);
    }
    if (documentData.financial_year) {
      formData.append('financial_year', documentData.financial_year);
    }
    if (documentData.financial_period) {
      formData.append('financial_period', documentData.financial_period);
    }

    console.log('📋 FormData sendo enviado:', {
      upload_type: documentData.upload_type,
      financial_document_type: documentData.financial_document_type,
      financial_year: documentData.financial_year,
      financial_period: documentData.financial_period
    });

    return this.http.post<ApiResponse<Document>>(
      `${this.apiUrl}/documents/upload`,
      formData,
      {
        reportProgress: true,
        observe: 'events',
        headers: this.getAuthHeadersForFormData()
      }
    ).pipe(
      map((event: HttpEvent<ApiResponse<Document>>) => {
        switch (event.type) {
          case HttpEventType.UploadProgress:
            if (event.total) {
              const progress: UploadProgress = {
                loaded: event.loaded,
                total: event.total,
                percentage: Math.round((event.loaded / event.total) * 100)
              };
              this.uploadProgressSubject.next(progress);
            }
            return null as any;

          case HttpEventType.Response:
            this.uploadProgressSubject.next(null);
            return event.body!;

          default:
            return null as any;
        }
      }),
      filter(result => result !== null),
      catchError(this.handleError)
    );
  }

  /**
   * Listar documentos por município
   */
  getDocumentsByMunicipality(
    municipalityCode: string,
    filters?: DocumentFilters
  ): Observable<ApiResponse<Document[]>> {
    let params = new URLSearchParams();

    if (filters?.category) params.append('category', filters.category);
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);

    const queryString = params.toString();
    const url = `${this.apiUrl}/documents/municipality/${municipalityCode}${queryString ? '?' + queryString : ''}`;

    return this.http.get<ApiResponse<Document[]>>(url, { headers: this.getAuthHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Buscar documento por ID
   */
  getDocumentById(id: number): Observable<ApiResponse<Document>> {
    return this.http.get<ApiResponse<Document>>(`${this.apiUrl}/documents/${id}`, { headers: this.getAuthHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Download de documento
   */
  downloadDocument(id: number | string): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${id}/download`, {
      responseType: 'blob'
    }).pipe(catchError(this.handleError));
  }

  /**
   * Deletar documento
   */
  deleteDocument(documentId: number): Observable<ApiResponse<null>> {
    const url = `${this.apiUrl}/documents/${documentId}`;
    const headers = this.getAuthHeaders();

    return this.http.delete<ApiResponse<null>>(url, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erro ao deletar documento:', error);
        return throwError(() => new Error(error.message));
      })
    );
  }

  /**
   * Deletar documento financeiro
   */
  deleteFinancialDocument(documentId: number | string): Observable<ApiResponse<null>> {
    const url = `${this.apiUrl}/documents/financial/${documentId}`;
    const headers = this.getAuthHeaders();
    return this.http.delete<ApiResponse<null>>(url, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Erro ao deletar documento financeiro:', error);
        return throwError(() => new Error(error.message));
      })
    );
  }

  /**
   * Tratamento de erros HTTP
   */
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Erro desconhecido';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Erro: ${error.error.message}`;
    } else {
      errorMessage = error.error?.message || `Erro ${error.status}: ${error.message}`;
    }

    console.error('DocumentsService Error:', error);
    return throwError(() => new Error(errorMessage));
  }

  /**
   * Criar novo município
   */
  createMunicipality(municipality: Omit<Municipality, 'id'>): Observable<ApiResponse<Municipality>> {
    return this.http.post<ApiResponse<Municipality>>(`${this.apiUrl}/municipalities`, municipality, { headers: this.getAuthHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Listar municípios
   */
  getMunicipalities(): Observable<ApiResponse<Municipality[]>> {
    return this.http.get<ApiResponse<Municipality[]>>(`${this.apiUrl}/municipalities`, { headers: this.getAuthHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Criar novo servidor
   */
  createServer(server: {
    name: string;
    municipality_code: string;
    municipality_name?: string;
  }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/servers`, server, { headers: this.getAuthHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Listar servidores por município
   */
  getServersByMunicipality(municipalityCode: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/servers/municipality/${municipalityCode}`, { headers: this.getAuthHeaders() })
      .pipe(catchError(this.handleError));
  }

  /**
   * Reset do progresso de upload
   */
  resetUploadProgress(): void {
    this.uploadProgressSubject.next(null);
  }

  /**
   * Obter estatísticas do dashboard
   */
  getDashboardStats(): Observable<any> {
    const url = `${environment.apiUrl}/dashboard/stats`;
    console.log('🔵 [DocumentsService] Chamando endpoint:', url);

    return this.http.get<any>(url, { headers: this.getAuthHeaders() }).pipe(
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro na requisição:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Obter atividades recentes do dashboard
   */
  getRecentActivities(limit: number = 10): Observable<ApiResponse<any[]>> {
    const url = `${environment.apiUrl}/dashboard/recent-activities?limit=${limit}`;
    console.log('🔵 [DocumentsService] Chamando endpoint de atividades recentes:', url);

    return this.http.get<ApiResponse<any[]>>(url, { headers: this.getAuthHeaders() }).pipe(
      tap(response => {
        console.log('✅ [DocumentsService] Atividades recentes recebidas:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao buscar atividades recentes:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Obter documentos acessados recentemente
   */
  getRecentDocuments(limit: number = 6): Observable<ApiResponse<any[]>> {
    const url = `${environment.apiUrl}/dashboard/recent-documents?limit=${limit}`;
    console.log('🔵 [DocumentsService] Chamando endpoint de documentos recentes:', url);

    return this.http.get<ApiResponse<any[]>>(url, { headers: this.getAuthHeaders() }).pipe(
      tap(response => {
        console.log('✅ [DocumentsService] Documentos recentes recebidos:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao buscar documentos recentes:', error);
        return this.handleError(error);
      })
    );
  }



  /**
   * Buscar anos disponíveis para um tipo de documento financeiro
   */
  getFinancialYearsByType(municipalityCode: string, type: string): Observable<any> {
    const url = `${environment.apiUrl}/documents/financial/${municipalityCode}/years/${type}`;
    console.log(`📡 [DocumentsService] Fetching years for type ${type} from: ${url}`);

    return this.http.get<any>(url).pipe(
      tap((response) => {
        console.log('✅ [DocumentsService] Anos recebidos:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao buscar anos:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Buscar documentos financeiros do município do usuário logado
   */
  getFinancialDocumentsByUser(): Observable<any> {
    const url = `${environment.apiUrl}/documents/financial`;

    console.log(`📡 [DocumentsService] Fetching financial documents for user from: ${url}`);

    return this.http.get<any>(url, { headers: this.getAuthHeaders() }).pipe(
      tap((response) => {
        console.log('✅ [DocumentsService] Resposta de documentos financeiros:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao buscar documentos financeiros:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Obter informações de armazenamento do Google Drive
   */
  getDriveStorageInfo(): Observable<ApiResponse<{ used: number; total: number; usageInDrive: number; usageInTrash: number }>> {
    const url = `${this.apiUrl}/documents/drive/storage-info`;
    const headers = this.getAuthHeaders();

    console.log('🔗 Chamando endpoint de armazenamento:', url);
    console.log('🔑 Headers:', headers);

    return this.http.get<ApiResponse<{ used: number; total: number; usageInDrive: number; usageInTrash: number }>>(url, { headers })
      .pipe(
        tap(response => {
          console.log('✅ Resposta do endpoint de armazenamento:', response);
        }),
        catchError((error: HttpErrorResponse) => {
          console.error('❌ Erro ao obter informações de armazenamento:', error);
          console.error('Status:', error.status);
          console.error('Message:', error.message);
          console.error('Body:', error.error);
          return throwError(() => new Error('Erro ao obter informações de armazenamento do Google Drive'));
        })
      );
  }

  /**
   * Registrar visualização de documento
   */
  logView(data: { documentId?: any; driveFileId?: string; fileName?: string; municipalityCode?: string }): Observable<any> {
    const url = `${environment.apiUrl}/documents/log-view`;
    console.log('👁️ [Activity] Chamando logView:', url, data);

    // Sanitize documentId for virtual drive files
    let safeDocId = data.documentId;
    if (typeof safeDocId === 'string' && safeDocId.startsWith('drive_')) {
      safeDocId = null;
    }

    const payload = {
      ...data,
      documentId: safeDocId
    };

    const token = this.authService.getToken();
    if (!token) {
      console.warn('⚠️ [Activity] Token não encontrado para logView');
      return of({ success: false });
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post<any>(url, payload, { headers }).pipe(
      tap((response) => console.log('📊 [Activity] Visualização registrada:', response)),
      catchError((error) => {
        console.error('❌ [Activity] Erro ao registrar visualização:', error);
        // Não propagar erro para não afetar a experiência do usuário
        return of({ success: false });
      })
    );
  }

  /**
   * Registrar download de documento
   */
  logDownload(data: { documentId?: number; driveFileId?: string; fileName?: string; municipalityCode?: string }): Observable<any> {
    const url = `${environment.apiUrl}/activities/download`;
    return this.http.post<any>(url, data, { headers: this.getAuthHeaders() }).pipe(
      tap(() => console.log('📊 [Activity] Download registrado')),
      catchError((error) => {
        console.error('❌ [Activity] Erro ao registrar download:', error);
        // Não propagar erro para não afetar a experiência do usuário
        return of({ success: false });
      })
    );
  }

  /**
   * Buscar tipos de documentos financeiros cadastrados no banco
   */
  getAllFinancialDocumentTypes(): Observable<ApiResponse<FinancialDocumentType[]>> {
    const url = `${environment.apiUrl}/financial-document-types`;
    console.log('📋 [DocumentsService] Buscando tipos de documentos financeiros:', url);

    return this.http.get<ApiResponse<FinancialDocumentType[]>>(url, { headers: this.getAuthHeaders() }).pipe(
      tap(response => {
        console.log('✅ [DocumentsService] Tipos recebidos:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao buscar tipos:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Buscar tipos de documentos financeiros disponíveis (do Drive/Diretórios)
   */
  getFinancialDocumentTypes(municipalityCode: string, year?: number): Observable<any> {
    const url = `${environment.apiUrl}/documents/financial/${municipalityCode}/types`;
    const params = year ? new HttpParams().set('year', year.toString()) : undefined;

    console.log(`📡 [DocumentsService] Fetching financial types from: ${url}`, { year });

    return this.http.get<any>(url, { params }).pipe(
      tap((response) => {
        console.log('✅ [DocumentsService] Resposta de tipos financeiros:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao buscar tipos financeiros:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Criar novo tipo de documento financeiro
   */
  createFinancialDocumentType(type: { name: string; description?: string }): Observable<ApiResponse<FinancialDocumentType>> {
    const url = `${environment.apiUrl}/financial-document-types`;
    console.log('📝 [DocumentsService] Criando novo tipo:', type);

    return this.http.post<ApiResponse<FinancialDocumentType>>(url, type, { headers: this.getAuthHeaders() }).pipe(
      tap(response => {
        console.log('✅ [DocumentsService] Tipo criado:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Erro ao criar tipo:', error);
        return this.handleError(error);
      })
    );
  }

  /**
   * Advanced search for documents and servers
   */
  /**
   * Get available search options (years, types, genders) for a municipality
   */
  getSearchOptions(municipalityCode: string): Observable<ApiResponse<{ years: number[], types: string[], genders: string[] }>> {
    const url = `${environment.apiUrl}/search/options`;
    const params = new HttpParams().set('municipalityCode', municipalityCode);

    console.log('🔍 [DocumentsService] Fetching search options:', url, municipalityCode);

    return this.http.get<ApiResponse<{ years: number[], types: string[], genders: string[] }>>(url, {
      params,
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        console.log('✅ [DocumentsService] Search options received:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Error fetching search options:', error);
        return this.handleError(error);
      })
    );
  }

  advancedSearch(filters: {
    municipalityCode: string;
    query?: string;
    year?: string | number;
    documentType?: string;
    gender?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Observable<ApiResponse<any[]>> {
    let params = new HttpParams();

    Object.keys(filters).forEach(key => {
      const value = filters[key as keyof typeof filters];
      if (value !== undefined && value !== null && value !== '' && value !== 'all') {
        params = params.set(key, value.toString());
      }
    });

    const url = `${environment.apiUrl}/search/advanced`;
    console.log('🔍 [DocumentsService] Advanced search:', url, filters);

    return this.http.get<ApiResponse<any[]>>(url, {
      params,
      headers: this.getAuthHeaders()
    }).pipe(
      tap(response => {
        console.log('✅ [DocumentsService] Search results:', response);
      }),
      catchError((error) => {
        console.error('❌ [DocumentsService] Search error:', error);
        return this.handleError(error);
      })
    );
  }
}
