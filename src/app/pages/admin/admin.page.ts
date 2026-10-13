import { Component, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type AdminSection = 'dashboard' | 'users' | 'organizations' | 'catalogs' | 'reports' | 'settings';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  imports: [IonContent, RouterLink],
})
export class AdminPage {
  private readonly auth = inject(AuthService);
  readonly pendingOrganizations = this.auth.pendingOrganizations;
  readonly section = signal<AdminSection>('dashboard');
  readonly menuOpen = signal(false);

  select(section: AdminSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  approveOrganization(id: string): void { this.auth.reviewOrganization(id, 'approved'); }
  rejectOrganization(id: string): void { this.auth.reviewOrganization(id, 'rejected'); }
}
