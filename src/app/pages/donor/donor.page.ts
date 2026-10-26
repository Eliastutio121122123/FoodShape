import { Component, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type DonorSection = 'dashboard' | 'donations' | 'requests' | 'history' | 'create';

@Component({
  selector: 'app-donor',
  templateUrl: './donor.page.html',
  styleUrls: ['./donor.page.scss'],
  imports: [IonContent, RouterLink],
})
export class DonorPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly session = this.auth.session;
  readonly section = signal<DonorSection>('dashboard');
  readonly menuOpen = signal(false);

  select(section: DonorSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  openProfile(): void { void this.router.navigateByUrl('/app/profile'); }
}
