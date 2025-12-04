import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../environments/environment';
import { ActivatedRoute } from '@angular/router';

interface Municipality {
  code: string;
  name: string;
  state?: string; // Added optional state property
}

@Component({
  selector: 'app-municipality-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './municipality-selector.component.html',
  styleUrls: ['./municipality-selector.component.scss']
})
export class MunicipalitySelectorComponent implements OnInit {
  municipalities: Municipality[] = [];
  filteredMunicipalities: Municipality[] = [];
  isLoading: boolean = false;
  searchQuery: string = '';

  constructor(private http: HttpClient, private router: Router, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadMunicipalities();
  }

  private loadMunicipalities(): void {
    this.isLoading = true;
    this.http.get<{ success: boolean; data: Municipality[] }>(`${environment.apiUrl}/municipalities`).subscribe(
      response => {
        if (response.success) {
          this.municipalities = response.data;
          this.filteredMunicipalities = [...this.municipalities];
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

  filterMunicipalities(): void {
    const query = this.searchQuery.toLowerCase();
    this.filteredMunicipalities = this.municipalities.filter(municipality =>
      municipality.name.toLowerCase().includes(query)
    );
  }

  selectMunicipality(municipalityCode: string): void {
    const redirectTo = this.route.snapshot.queryParams['redirectTo'] || '/servers/municipality';
    this.router.navigate([redirectTo, municipalityCode]);
  }
}