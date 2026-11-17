import { Component, inject, signal } from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService, PersonalAidRequest } from '../../services/auth.service';

@Component({
  selector: 'app-aid-requests',
  templateUrl: './aid-requests.page.html',
  styleUrls: ['./aid-requests.page.scss'],
  imports: [RouterLink, UpperCasePipe],
})
export class AidRequestsPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly requests = signal<PersonalAidRequest[]>([]);
  readonly dates = signal<Record<string, string>>({});
  readonly loading = signal(true);
  readonly error = signal('');
  readonly feedback = signal('');
  readonly processing = signal<string | null>(null);
  readonly role = this.auth.currentRole;

  constructor() {
    if (this.role() !== 'donor' && this.role() !== 'beneficiary') {
      void this.router.navigateByUrl('/app/profile');
      return;
    }
    this.reload();
  }
  reload(): void {
    this.loading.set(true);
    this.auth.loadOrganizationAidRequests().subscribe({
      next: (items) => { this.requests.set(items); this.loading.set(false); },
      error: (reason: Error) => { this.error.set(reason.message || 'No se pudieron cargar las solicitudes.'); this.loading.set(false); },
    });
  }
  setDate(id: string, event: Event): void {
    this.dates.update((items) => ({ ...items, [id]: (event.target as HTMLInputElement).value }));
  }
  review(item: PersonalAidRequest, status: 'approved' | 'rejected'): void {
    this.processing.set(item.id);
    this.error.set('');
    const date = this.dates()[item.id];
    if (status === 'approved' && item.requestType === 'ration' && !date) {
      this.processing.set(null);
      this.error.set('Elige la fecha y hora de entrega antes de aprobar una solicitud de ración.');
      return;
    }
    const scheduledAt = status === 'approved' && item.requestType === 'ration' && date ? new Date(date).toISOString() : null;
    this.auth.reviewOrganizationAidRequest(item.id, status, scheduledAt,
      status === 'approved' && scheduledAt ? `Ración coordinada para ${new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(scheduledAt))}.` : '')
      .subscribe({
        next: () => { this.processing.set(null); this.feedback.set(status === 'approved' ? 'Solicitud aprobada y actualizada.' : 'Solicitud marcada como no aprobada.'); this.reload(); },
        error: (reason: Error) => { this.processing.set(null); this.error.set(reason.message || 'No se pudo actualizar la solicitud.'); },
      });
  }
  nameForRole(): string { return this.role() === 'donor' ? 'donante' : 'beneficiaria'; }
  formatDate(value: string): string { return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
}
