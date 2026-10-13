import { Component, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { RouterLink } from '@angular/router';

type DonorSection = 'dashboard' | 'donations' | 'requests' | 'history' | 'create';

@Component({
  selector: 'app-donor',
  templateUrl: './donor.page.html',
  styleUrls: ['./donor.page.scss'],
  imports: [IonContent, RouterLink],
})
export class DonorPage {
  readonly section = signal<DonorSection>('dashboard');
  readonly menuOpen = signal(false);

  select(section: DonorSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
