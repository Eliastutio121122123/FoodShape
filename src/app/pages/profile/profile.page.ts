import { Component, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AccountProfile, AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  imports: [IonContent, RouterLink],
})
export class ProfilePage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly account = signal<AccountProfile | null>(null);
  readonly fullName = signal('');
  readonly phone = signal('');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly signingOut = signal(false);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly roleName = computed(() => ({
    admin: 'Administración', donor: 'Organización donante', beneficiary: 'Organización beneficiaria', volunteer: 'Voluntariado',
  })[this.account()?.role ?? 'volunteer']);
  readonly homeRoute = computed(() => {
    const role = this.account()?.role ?? this.auth.currentRole();
    return role ? `/app/${role}` : '/login';
  });

  constructor() {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.auth.loadAccountProfile().subscribe({
      next: (profile) => {
        this.account.set(profile);
        this.fullName.set(profile.fullName);
        this.phone.set(profile.phone);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.errorMessage.set(error.message || 'No se pudo cargar el perfil.');
        this.loading.set(false);
      },
    });
  }

  updateFullName(event: Event): void { this.fullName.set((event.target as HTMLInputElement).value); }
  updatePhone(event: Event): void { this.phone.set((event.target as HTMLInputElement).value); }

  save(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (!this.fullName().trim()) {
      this.errorMessage.set('Escribe tu nombre para guardar el perfil.');
      return;
    }

    this.saving.set(true);
    this.auth.updateAccountProfile(this.fullName(), this.phone()).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Perfil actualizado.');
        this.reload();
      },
      error: (error: Error) => {
        this.saving.set(false);
        this.errorMessage.set(error.message || 'No se pudo guardar el perfil.');
      },
    });
  }

  async signOut(): Promise<void> {
    this.errorMessage.set('');
    this.signingOut.set(true);
    try {
      await this.auth.signOut();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'No se pudo cerrar la sesion.');
    } finally {
      this.signingOut.set(false);
    }
  }
}
