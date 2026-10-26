import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  imports: [IonContent, RouterLink],
})
export class LandingPage {
  private readonly auth = inject(AuthService);
  readonly dashboardRoute = computed(() => {
    const role = this.auth.currentRole();
    return role ? `/app/${role}` : null;
  });
  readonly dashboardLabel = computed(() => this.auth.currentRole() === 'admin'
    ? 'Volver a administración'
    : 'Volver a mi panel');
}
