import { Component, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { RouterLink } from '@angular/router';

type VolunteerSection = 'dashboard' | 'deliveries' | 'detail' | 'update' | 'history';

@Component({
  selector: 'app-volunteer',
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss'],
  imports: [IonContent, RouterLink],
})
export class VolunteerPage {
  readonly section = signal<VolunteerSection>('dashboard');
  readonly menuOpen = signal(false);

  select(section: VolunteerSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }
}
