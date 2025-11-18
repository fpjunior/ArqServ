import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, map, filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class DocumentsService {
  private apiUrl = environment.apiUrl;
  private uploadProgressSubject = new BehaviorSubject<UploadProgress | null>(null);
  
  // Observable para progresso de upload
  uploadProgress$ = this.uploadProgressSubject.asObservable();

  constructor(private http: HttpClient) {}

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
    
    if (documentData.server_id) {
      formData.append('server_id', documentData.server_id);
    }
    if (documentData.server_name) {
      formData.append('server_name', documentData.server_name);
    }
    if (documentData.municipality_name) {
      formData.append('municipality_name', documentData.municipality_name);
    }

    return this.http.post<ApiResponse<Document>>(
      `${this.apiUrl}/documents/upload`,
      formData,
      {
        reportProgress: true,
        observe: 'events'
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

    return this.http.get<ApiResponse<Document[]>>(url)
      .pipe(catchError(this.handleError));
  }

  /**
   * Buscar documento por ID
   */
  getDocumentById(id: number): Observable<ApiResponse<Document>> {
    return this.http.get<ApiResponse<Document>>(`${this.apiUrl}/documents/${id}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Download de documento
   */
  downloadDocument(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/documents/${id}/download`, {
      responseType: 'blob'
    }).pipe(catchError(this.handleError));
  }

  /**
   * Deletar documento
   */
  deleteDocument(id: number): Observable<ApiResponse<any>> {
    return this.http.delete<ApiResponse<any>>(`${this.apiUrl}/documents/${id}`)
      .pipe(catchError(this.handleError));
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
    return this.http.post<ApiResponse<Municipality>>(`${this.apiUrl}/municipalities`, municipality)
      .pipe(catchError(this.handleError));
  }

  /**
   * Listar municípios
   */
  getMunicipalities(): Observable<ApiResponse<Municipality[]>> {
    return this.http.get<ApiResponse<Municipality[]>>(`${this.apiUrl}/municipalities`)
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
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/servers`, server)
      .pipe(catchError(this.handleError));
  }

  /**
   * Listar servidores por município
   */
  getServersByMunicipality(municipalityCode: string): Observable<ApiResponse<any[]>> {
    return this.http.get<ApiResponse<any[]>>(`${this.apiUrl}/servers/municipality/${municipalityCode}`)
      .pipe(catchError(this.handleError));
  }

  /**
   * Reset do progresso de upload
   */
  resetUploadProgress(): void {
    this.uploadProgressSubject.next(null);
  }
}
