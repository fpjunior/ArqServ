import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../../environments/environment';

interface Municipality {
  code: string;
  name: string;
}

@Component({
  selector: 'app-municipality-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './municipality-selector.component.html',
  styleUrls: ['./municipality-selector.component.scss']
})
export class MunicipalitySelectorComponent implements OnInit {
  municipalities: Municipality[] = [];
  isLoading: boolean = false;

  constructor(private http: HttpClient, private router: Router) {}

  ngOnInit(): void {
    this.loadMunicipalities();
  }

  private loadMunicipalities(): void {
    this.isLoading = true;
    this.http.get<{ success: boolean; data: Municipality[] }>(`${environment.apiUrl}/municipalities`).subscribe(
      response => {
        if (response.success) {
          this.municipalities = response.data;
        } else {
          console.error('Erro ao carregar municípios:', response);
        }
        this.isLoading = false;
      },
      error => {
        console.error('Erro na requisição de municípios:', error);
        this.isLoading = false;
      }
    );
  }

  selectMunicipality(municipalityCode: string): void {
    this.router.navigate(['/servers/municipality', municipalityCode]);
  }
}