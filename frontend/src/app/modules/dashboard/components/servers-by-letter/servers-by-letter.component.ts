import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

interface ServerInfo {
  id: string;
  name: string;
  ip: string;
  status: 'online' | 'offline';
  filesCount: number;
  lastAccess: Date;
}

@Component({
  selector: 'app-servers-by-letter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './servers-by-letter.component.html',
  styleUrls: ['./servers-by-letter.component.scss']
})
export class ServersByLetterComponent implements OnInit {
  letter: string = '';
  servers: ServerInfo[] = [];
  searchTerm: string = '';
  filteredServers: ServerInfo[] = [];

  // Dados simulados de servidores por letra
  private serversData: { [key: string]: ServerInfo[] } = {
    'A': [
      { id: '65', name: 'Ana Maria', ip: '192.168.1.65', status: 'online', filesCount: 24, lastAccess: new Date('2024-11-10') },
      { id: '66', name: 'Antonio Silva', ip: '192.168.1.66', status: 'online', filesCount: 18, lastAccess: new Date('2024-11-09') },
      { id: '67', name: 'Andrea Santos', ip: '192.168.1.67', status: 'offline', filesCount: 31, lastAccess: new Date('2024-11-08') },
      { id: '68', name: 'Alberto Costa', ip: '192.168.1.68', status: 'online', filesCount: 12, lastAccess: new Date('2024-11-07') }
    ],
    'B': [
      { id: '70', name: 'Bruno Costa', ip: '192.168.1.70', status: 'online', filesCount: 15, lastAccess: new Date('2024-11-10') },
      { id: '71', name: 'Beatriz Silva', ip: '192.168.1.71', status: 'online', filesCount: 22, lastAccess: new Date('2024-11-09') }
    ],
    'C': [
      { id: '72', name: 'Carlos Eduardo', ip: '192.168.1.72', status: 'offline', filesCount: 8, lastAccess: new Date('2024-11-06') },
      { id: '73', name: 'Carla Pereira', ip: '192.168.1.73', status: 'online', filesCount: 28, lastAccess: new Date('2024-11-10') }
    ],
    'J': [
      { id: '74', name: 'João Santos', ip: '192.168.1.74', status: 'online', filesCount: 18, lastAccess: new Date('2024-11-10') },
      { id: '75', name: 'Julia Oliveira', ip: '192.168.1.75', status: 'online', filesCount: 26, lastAccess: new Date('2024-11-09') }
    ],
    'M': [
      { id: '77', name: 'Maria Silva', ip: '192.168.1.77', status: 'online', filesCount: 31, lastAccess: new Date('2024-11-10') },
      { id: '78', name: 'Marcos Lima', ip: '192.168.1.78', status: 'online', filesCount: 14, lastAccess: new Date('2024-11-08') }
    ]
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.letter = this.route.snapshot.params['letter'].toUpperCase();
    this.loadServers();
  }

  loadServers(): void {
    this.servers = this.serversData[this.letter] || [];
    this.filteredServers = [...this.servers];
  }

  onSearch(): void {
    if (this.searchTerm.trim() === '') {
      this.filteredServers = [...this.servers];
    } else {
      this.filteredServers = this.servers.filter(server =>
        server.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        server.ip.includes(this.searchTerm)
      );
    }
  }

  navigateToServerDetails(serverId: string): void {
    this.router.navigate(['/servers', this.letter, serverId]);
  }

  goBack(): void {
    this.router.navigate(['/servers']);
  }

  getStatusColor(status: string): string {
    return status === 'online' ? 'text-green-600' : 'text-red-600';
  }

  getStatusBgColor(status: string): string {
    return status === 'online' ? 'bg-green-100' : 'bg-red-100';
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  }
}