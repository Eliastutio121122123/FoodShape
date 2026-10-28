import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { AccountProfile, AuthService, VolunteerDashboardSnapshot, VolunteerDeliveryItem } from '../../services/auth.service';

type VolunteerSection = 'dashboard' | 'deliveries' | 'detail' | 'update' | 'history';

@Component({
  selector: 'app-volunteer',
  templateUrl: './volunteer.page.html',
  styleUrls: ['./volunteer.page.scss'],
  imports: [IonContent, RouterLink],
})
export class VolunteerPage implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  readonly session = this.auth.session;
  readonly section = signal<VolunteerSection>('dashboard');
  readonly menuOpen = signal(false);
  readonly profile = signal<AccountProfile | null>(null);
  readonly dashboard = signal<VolunteerDashboardSnapshot | null>(null);
  readonly dashboardLoading = signal(true);
  readonly dashboardError = signal('');
  readonly selectedDelivery = signal<VolunteerDeliveryItem | null>(null);
  readonly isAvailable = signal(false);
  readonly togglingAvailability = signal(false);

  // ── Datos derivados del perfil ─────────────────────────────────────
  readonly avatarUrl = computed(() => this.profile()?.avatarUrl ?? this.auth.currentAvatarUrl() ?? null);

  readonly avatarLetter = computed(() => {
    const name = this.profile()?.fullName || this.session()?.email || '';
    return name.slice(0, 1).toUpperCase();
  });

  readonly firstName = computed(() => {
    const full = this.profile()?.fullName?.trim();
    return full ? full.split(' ')[0] : (this.session()?.email ?? 'Voluntario');
  });

  readonly displayName = computed(() =>
    this.profile()?.fullName || this.session()?.email || 'Mi cuenta'
  );

  // ── Datos derivados del dashboard ──────────────────────────────────
  readonly activeCount = computed(() => this.dashboard()?.activeDeliveries.length ?? 0);
  readonly completedThisMonth = computed(() => this.dashboard()?.completedThisMonth ?? 0);
  readonly totalCompleted = computed(() => this.dashboard()?.totalCompleted ?? 0);

  /** Siguiente entrega activa ordenada por pickup_starts_at */
  readonly nextDelivery = computed(() =>
    this.dashboard()?.activeDeliveries[0] ?? null
  );

  readonly welcomeMessage = computed(() => {
    const count = this.activeCount();
    if (count === 0) return 'No tienes entregas asignadas ahora mismo.';
    if (count === 1) return 'Tienes 1 entrega asignada. ¡Gracias por tu ayuda!';
    return `Tienes ${count} entregas asignadas. Gracias por hacer que la ayuda llegue.`;
  });

  ngOnInit(): void {
    this.auth.loadAccountProfile().subscribe({
      next: (p) => {
        this.profile.set(p);
        this.isAvailable.set(p.volunteer?.status === 'available');
      },
      error: () => {},
    });

    this.loadDashboard();
  }

  loadDashboard(): void {
    this.dashboardLoading.set(true);
    this.dashboardError.set('');
    this.auth.loadVolunteerDashboard().subscribe({
      next: (data) => {
        this.dashboard.set(data);
        this.isAvailable.set(data.volunteerStatus === 'available');
        this.dashboardLoading.set(false);
      },
      error: (err: Error) => {
        this.dashboardError.set(err.message || 'No se pudo cargar el panel.');
        this.dashboardLoading.set(false);
      },
    });
  }

  toggleAvailability(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.togglingAvailability.set(true);
    this.auth.updateVolunteerStatus(checked ? 'available' : 'inactive').subscribe({
      next: () => {
        this.isAvailable.set(checked);
        this.togglingAvailability.set(false);
      },
      error: () => {
        // Revertir si falla
        this.isAvailable.set(!checked);
        this.togglingAvailability.set(false);
      },
    });
  }

  openDetail(delivery: VolunteerDeliveryItem): void {
    this.selectedDelivery.set(delivery);
    this.section.set('detail');
  }

  /** Formatea una fecha ISO a hora local "3:30 p. m." */
  formatTime(isoDate: string | null): string {
    if (!isoDate) return '—';
    return new Date(isoDate).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit', hour12: true });
  }

  /** Etiqueta de estado legible */
  statusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Pendiente', assigned: 'Asignada',
      pickup_in_progress: 'En camino', picked_up: 'Recogida',
      delivered: 'Entregada', cancelled: 'Cancelada',
    };
    return map[status] ?? status;
  }

  select(section: VolunteerSection): void {
    this.section.set(section);
    this.menuOpen.set(false);
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  openProfile(): void { void this.router.navigateByUrl('/app/profile'); }
}
