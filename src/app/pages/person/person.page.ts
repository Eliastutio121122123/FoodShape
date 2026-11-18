import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService, CommunityOrganization, PersonalAidRequest, PersonalFoodOffer } from '../../services/auth.service';

type PersonSection = 'offers' | 'organizations' | 'join' | 'rations';

@Component({
  selector: 'app-person',
  templateUrl: './person.page.html',
  styleUrls: ['./person.page.scss'],
  imports: [RouterLink],
})
export class PersonPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly section = signal<PersonSection>('offers');
  readonly organizations = signal<CommunityOrganization[]>([]);
  readonly selectedOrganization = signal<CommunityOrganization | null>(null);
  readonly foodOffers = signal<PersonalFoodOffer[]>([]);
  readonly requests = signal<PersonalAidRequest[]>([]);
  readonly fullName = signal('');
  readonly cityFilter = signal('');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly sending = signal<string | null>(null);
  readonly message = signal('');
  readonly requestError = signal('');
  readonly chatError = signal('');
  readonly chatOpening = signal<string | null>(null);
  readonly preferredDates = signal<Record<string, string>>({});
  readonly searchCity = computed(() => this.cityFilter().trim());
  readonly joinRequests = computed(() => this.requests().filter((item) => item.requestType === 'membership'));
  readonly rationRequests = computed(() => this.requests().filter((item) => item.requestType === 'ration'));
  readonly upcomingRations = computed(() => this.rationRequests().filter((item) => item.status === 'approved' && item.scheduledAt));
  readonly name = computed(() => this.fullName() || this.auth.session()?.email?.split('@')[0] || 'Bienvenida');

  constructor() {
    this.auth.loadAccountProfile().subscribe({ next: (profile) => this.fullName.set(profile.fullName), error: () => {} });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.loadCommunityDirectory(this.cityFilter()).subscribe({
      next: (items) => { this.organizations.set(items); this.loading.set(false); },
      error: (reason: Error) => { this.error.set(reason.message || 'No pudimos cargar las organizaciones.'); this.loading.set(false); },
    });
    this.auth.loadPersonalFoodOffers(this.cityFilter()).subscribe({
      next: (items) => this.foodOffers.set(items),
      error: (reason: Error) => { this.error.set(reason.message || 'No pudimos cargar las donaciones.'); this.loading.set(false); },
    });
    this.auth.loadPersonalAidRequests().subscribe({
      next: (items) => this.requests.set(items),
      error: (reason: Error) => { this.error.set(reason.message || 'No pudimos cargar tus solicitudes.'); this.loading.set(false); },
    });
  }

  setCity(event: Event): void { this.cityFilter.set((event.target as HTMLInputElement).value); }
  async openChat(organizationId: string): Promise<void> {
    if (this.chatOpening()) return;
    this.chatOpening.set(organizationId);
    this.chatError.set('');
    try {
      const conversationId = await this.auth.openChatWithOrganization(organizationId);
      await this.router.navigate(['/app/chat', conversationId]);
    } catch (reason) {
      this.chatError.set(reason instanceof Error ? reason.message : 'No se pudo abrir la conversación.');
    } finally {
      this.chatOpening.set(null);
    }
  }
  openInbox(): void { void this.router.navigateByUrl('/app/chat'); }
  viewOrganization(organization: CommunityOrganization): void { this.selectedOrganization.set(organization); }
  closeOrganizationProfile(): void { this.selectedOrganization.set(null); }
  setDate(id: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.preferredDates.update((dates) => ({ ...dates, [id]: value }));
  }
  hasRequest(orgId: string, type: 'membership' | 'ration'): boolean {
    return this.requests().some((item) => item.organizationId === orgId && item.requestType === type
      && (type === 'membership' ? item.status !== 'rejected' : item.status === 'pending'));
  }
  request(org: CommunityOrganization, type: 'membership' | 'ration'): void {
    if (this.sending()) return;
    const key = `${org.id}:${type}`;
    this.sending.set(key);
    this.requestError.set('');
    this.message.set('');
    this.auth.createPersonalAidRequest(org.id, type, type === 'ration' ? this.preferredDates()[org.id] ?? null : null,
      type === 'membership' ? 'Solicitud para unirme y recibir información de apoyo.' : 'Solicitud de una ración de alimentos.')
      .subscribe({
        next: () => {
          this.sending.set(null);
          this.message.set(type === 'membership' ? `Solicitud enviada a ${org.name}.` : `Solicitud de ración enviada a ${org.name}.`);
          this.reload();
        },
        error: (reason: Error) => { this.sending.set(null); this.requestError.set(reason.message || 'No se pudo enviar la solicitud.'); },
      });
  }

  requestFood(offer: PersonalFoodOffer): void {
    if (this.sending()) return;
    this.sending.set(`${offer.id}:food`);
    this.requestError.set('');
    this.message.set('');
    this.auth.createPersonalAidRequest(offer.organizationId, 'ration', this.preferredDates()[offer.id] ?? null,
      `Solicitud de ración: ${offer.foodName}.`, offer.id).subscribe({
      next: () => { this.sending.set(null); this.message.set(`Solicitaste ${offer.foodName} a ${offer.organizationName}.`); this.reload(); },
      error: (reason: Error) => { this.sending.set(null); this.requestError.set(reason.message || 'No se pudo solicitar esta donación.'); },
    });
  }

  statusLabel(status: string): string {
    return ({ pending: 'Pendiente de respuesta', approved: 'Aprobada', rejected: 'No aprobada' } as Record<string, string>)[status] ?? status;
  }
  requestLabel(type: string): string { return type === 'membership' ? 'Solicitud para unirse' : 'Solicitud de ración'; }
  hasFoodRequest(donationId: string): boolean {
    return this.requests().some((item) => item.donationId === donationId && item.status !== 'rejected');
  }
  formatDate(value: string | null): string {
    if (!value) return 'Fecha por coordinar';
    return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }
  mapUrl(org: CommunityOrganization | PersonalAidRequest | PersonalFoodOffer): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${org.address}, ${org.city}`)}`;
  }
}
