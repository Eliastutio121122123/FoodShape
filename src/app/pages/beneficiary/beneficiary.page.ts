import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService, BeneficiaryDashboardSnapshot, BeneficiaryDonation, BeneficiaryRequest } from '../../services/auth.service';

type BeneficiarySection = 'home' | 'search' | 'requests' | 'history' | 'detail';

@Component({
  selector: 'app-beneficiary',
  templateUrl: './beneficiary.page.html',
  styleUrls: ['./beneficiary.page.scss'],
  imports: [RouterLink],
})
export class BeneficiaryPage {
  private readonly auth = inject(AuthService);
  readonly data = signal<BeneficiaryDashboardSnapshot | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly section = signal<BeneficiarySection>('home');
  readonly query = signal('');
  readonly selectedCategory = signal('Todas');
  readonly sortMode = signal<'recent' | 'expiry' | 'quantity'>('recent');
  readonly notificationsOpen = signal(false);
  readonly selectedDonation = signal<BeneficiaryDonation | null>(null);
  readonly requestQuantity = signal(1);
  readonly requestMessage = signal('');
  readonly requestSending = signal(false);
  readonly requestError = signal('');
  readonly requestSent = signal(false);
  readonly expandedTrackingId = signal<string | null>(null);
  readonly confirmingDeliveryId = signal<string | null>(null);
  readonly confirmationError = signal('');
  readonly confirmationMessage = signal('');

  readonly availableDonations = computed(() => this.data()?.donations ?? []);
  readonly donationCategories = computed(() => ['Todas', ...new Set(this.availableDonations().map((donation) => donation.categoryName))]);
  readonly filteredDonations = computed(() => {
    const needle = this.query().trim().toLocaleLowerCase();
    const category = this.selectedCategory();
    const results = this.availableDonations().filter((donation) =>
      (category === 'Todas' || donation.categoryName === category)
      && (!needle || `${donation.foodName} ${donation.categoryName} ${donation.city}`.toLocaleLowerCase().includes(needle)),
    );
    const sortMode = this.sortMode();
    return results.sort((a, b) => sortMode === 'expiry'
      ? Date.parse(a.expiresAt) - Date.parse(b.expiresAt)
      : sortMode === 'quantity'
        ? b.quantity - a.quantity
        : Date.parse(b.createdAt) - Date.parse(a.createdAt));
  });
  readonly pendingRequests = computed(() => (this.data()?.requests ?? []).filter((request) => request.status === 'pending'));
  readonly activeRequests = computed(() => (this.data()?.requests ?? []).filter((request) =>
    (request.status === 'accepted' && !request.receivedConfirmedAt && request.deliveryStatus !== 'cancelled')
      || ['assigned', 'pickup_in_progress', 'picked_up'].includes(request.deliveryStatus ?? ''),
  ));
  readonly completedRequests = computed(() => (this.data()?.requests ?? []).filter((request) => Boolean(request.receivedConfirmedAt)));
  readonly recentRequests = computed(() => (this.data()?.requests ?? []).slice(0, 4));
  readonly unreadCount = computed(() => (this.data()?.notifications ?? []).filter((notification) => !notification.read).length);
  readonly canRequest = computed(() => this.data()?.verificationStatus === 'approved' && this.data()?.organizationStatus === 'active');

  constructor() { this.reload(); }

  reload(): void {
    this.loading.set(true);
    this.error.set('');
    this.auth.loadBeneficiaryDashboard().subscribe({
      next: (snapshot) => { this.data.set(snapshot); this.loading.set(false); },
      error: (reason: Error) => {
        const message = reason?.message || 'No se pudo cargar el espacio de tu organización.';
        this.error.set(/network|fetch|conexión|conectar/i.test(message)
          ? 'No hay conexión con FoodShare en este momento. Revisa tu conexión e inténtalo de nuevo.'
          : message);
        this.loading.set(false);
      },
    });
  }

  navigateTo(section: BeneficiarySection): void {
    this.section.set(section);
    this.selectedDonation.set(null);
    if (section === 'requests' || section === 'history') this.reload();
  }
  updateSearch(event: Event): void { this.query.set((event.target as HTMLInputElement).value); }
  setCategory(category: string): void { this.selectedCategory.set(category); }
  setSortMode(event: Event): void { this.sortMode.set((event.target as HTMLSelectElement).value as 'recent' | 'expiry' | 'quantity'); }
  openDonation(donation: BeneficiaryDonation): void {
    this.selectedDonation.set(donation);
    this.requestQuantity.set(1);
    this.requestMessage.set('');
    this.requestError.set('');
    this.requestSent.set(false);
    this.section.set('detail');
  }
  goBackToDonations(): void { this.section.set('search'); this.selectedDonation.set(null); }
  setQuantity(event: Event): void { this.requestQuantity.set(Number((event.target as HTMLInputElement).value)); }
  setMessage(event: Event): void { this.requestMessage.set((event.target as HTMLTextAreaElement).value); }

  submitRequest(): void {
    const donation = this.selectedDonation();
    if (!donation || this.requestSending()) return;
    this.requestSending.set(true);
    this.requestError.set('');
    this.requestSent.set(false);
    this.auth.createBeneficiaryDonationRequest(donation.id, this.requestQuantity(), this.requestMessage()).subscribe({
      next: () => {
        this.requestSending.set(false);
        this.requestSent.set(true);
        this.reload();
      },
      error: (reason: Error) => {
        this.requestSending.set(false);
        this.requestError.set(reason.message || 'No se pudo enviar la solicitud. Inténtalo de nuevo.');
      },
    });
  }

  toggleTracking(requestId: string): void {
    this.expandedTrackingId.update((current) => current === requestId ? null : requestId);
    this.confirmationError.set('');
    this.confirmationMessage.set('');
  }

  confirmReceipt(request: BeneficiaryRequest): void {
    if (!request.deliveryId || request.status !== 'accepted' || request.receivedConfirmedAt
      || request.deliveryStatus === 'cancelled' || this.confirmingDeliveryId()) return;
    this.confirmingDeliveryId.set(request.deliveryId);
    this.confirmationError.set('');
    this.confirmationMessage.set('');
    this.auth.confirmBeneficiaryDelivery(request.deliveryId).subscribe({
      next: () => {
        this.confirmingDeliveryId.set(null);
        this.confirmationMessage.set('Recepción confirmada. El donante ya puede ver la confirmación.');
        this.reload();
      },
      error: (reason: Error) => {
        this.confirmingDeliveryId.set(null);
        this.confirmationError.set(reason.message || 'No se pudo confirmar la recepción. Inténtalo de nuevo.');
      },
    });
  }

  directionsUrl(request: BeneficiaryRequest): string | null {
    const origin = this.mapPlace(request.pickupAddress ?? '', request.pickupCity, request.pickupLatitude, request.pickupLongitude);
    const snapshot = this.data();
    const destination = snapshot ? this.mapPlace(snapshot.organizationAddress, snapshot.organizationCity, null, null) : '';
    if (!origin || !destination) return null;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  }

  private mapPlace(address: string, city: string, latitude: number | null, longitude: number | null): string {
    if (latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) return `${latitude},${longitude}`;
    return [address.trim(), city.trim()].filter(Boolean).join(', ');
  }

  toggleNotifications(): void { this.notificationsOpen.update((open) => !open); }
  donationQuantity(donation: BeneficiaryDonation): string { return `${this.formatNumber(donation.quantity)} ${this.unitLabel(donation.unit)}`; }
  requestQuantityLabel(request: BeneficiaryRequest): string {
    const quantity = request.requestedQuantity ?? request.donationQuantity;
    return `${this.formatNumber(quantity)} ${this.unitLabel(request.unit)}`;
  }
  formatDate(value: string | null): string {
    if (!value) return 'Fecha pendiente';
    return new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
  }
  statusLabel(request: BeneficiaryRequest): string {
    if (request.receivedConfirmedAt) return 'Recepción confirmada';
    if (request.deliveryStatus === 'delivered') return 'Entrega registrada · confirmar recepción';
    if (request.deliveryStatus === 'picked_up') return 'Recogida';
    if (request.deliveryStatus === 'pickup_in_progress') return 'En recogida';
    if (request.deliveryStatus === 'assigned') return 'En coordinación';
    return ({ pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', cancelled: 'Cancelada' } as Record<string, string>)[request.status] ?? request.status;
  }
  canConfirmReceipt(request: BeneficiaryRequest): boolean {
    return request.status === 'accepted' && Boolean(request.deliveryId) && !request.receivedConfirmedAt && request.deliveryStatus !== 'cancelled';
  }
  unitLabel(unit: string): string { return ({ unit: 'unidades', portion: 'porciones', box: 'cajas', package: 'paquetes' } as Record<string, string>)[unit] ?? unit; }
  formatNumber(value: number): string { return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 }).format(value); }
  receivedSummary(): string {
    const amounts = this.data()?.receivedByUnitThisMonth ?? [];
    return amounts.length ? amounts.map((item) => `${this.formatNumber(item.quantity)} ${this.unitLabel(item.unit)}`).join(' · ') : 'Sin entregas registradas este mes';
  }
}
