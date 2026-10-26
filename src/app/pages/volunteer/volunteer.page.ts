import { Component, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type VolunteerSection = 'dashboard' | 'deliveries' | 'detail' | 'update' | 'history';

@Component({
  selector: 'app-volunteer',
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss'],
  imports: [IonContent, RouterLink],
})
export class VolunteerPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly session = this.auth.session;
  readonly section = signal<VolunteerSection>('dashboard');
  readonly menuOpen = signal(false);

  select(section: VolunteerSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  openProfile(): void { void this.router.navigateByUrl('/app/profile'); }
}
