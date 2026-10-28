import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular';
import { AccountProfile, AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-landing',
  templateUrl: './landing.page.html',
  styleUrls: ['./landing.page.scss'],
  imports: [IonContent, RouterLink],
})
export class LandingPage implements OnInit {
  private readonly auth = inject(AuthService);
  readonly profile = signal<AccountProfile | null>(null);

  readonly dashboardRoute = computed(() => {
    const role = this.auth.currentRole();
    return role ? `/app/${role}` : null;
  });

  readonly avatarUrl = computed(() => this.profile()?.avatarUrl ?? this.auth.currentAvatarUrl() ?? null);

  readonly avatarLetter = computed(() => {
    const name = this.profile()?.fullName || this.auth.session()?.email || '';
    return name.slice(0, 1).toUpperCase() || '?';
  });

  readonly displayName = computed(() =>
    this.profile()?.fullName || this.auth.session()?.email || 'Mi cuenta'
  );

  readonly dashboardLabel = computed(() => 'Ir a mi panel');

  ngOnInit(): void {
    if (this.auth.currentRole()) {
      this.auth.loadAccountProfile().subscribe({
        next: (p) => this.profile.set(p),
        error: () => {},
      });
    }
  }
}
