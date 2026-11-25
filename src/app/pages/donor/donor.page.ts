import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { IonContent } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService, DonorDashboardSnapshot, DonorDonationCreateOptions, DonorHistorySnapshot, DonorManagementDonation, DonorRequestInboxItem } from '../../services/auth.service';

type DonorSection = 'dashboard' | 'donations' | 'requests' | 'history' | 'create' | 'edit';
type DonationStatusFilter = 'all' | 'available' | 'hidden' | 'reserved' | 'finalized';
type RequestStatusFilter = 'pending' | 'accepted' | 'finalized';

function localDateTimeAfter(hours: number): string {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateTimeValue(value: string): string {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

@Component({
  selector: 'app-donor',
  templateUrl: './donor.page.html',
  styleUrls: ['./donor.page.scss'],
  imports: [IonContent, RouterLink, DecimalPipe],
})
export class DonorPage {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  readonly session = this.auth.session;
  readonly avatarUrl = this.auth.currentAvatarUrl;
  readonly dashboard = signal<DonorDashboardSnapshot | null>(null);
  readonly dashboardLoading = signal(false);
  readonly dashboardError = signal('');
  readonly donations = signal<DonorManagementDonation[]>([]);
  readonly editingDonation = signal<DonorManagementDonation | null>(null);
  readonly donationActionsId = signal<string | null>(null);
  readonly selectedDonation = signal<DonorManagementDonation | null>(null);
  readonly donationsLoading = signal(false);
  readonly donationsError = signal('');
  readonly donationSearch = signal('');
  readonly donationStatusFilter = signal<DonationStatusFilter>('all');
  readonly requests = signal<DonorRequestInboxItem[]>([]);
  readonly requestsLoading = signal(false);
  readonly requestsLoaded = signal(false);
  readonly requestsError = signal('');
  readonly requestActionError = signal('');
  readonly requestActionMessage = signal('');
  readonly reviewingRequestId = signal<string | null>(null);
  readonly renewingRequestId = signal<string | null>(null);
  readonly renewalFormRequestId = signal<string | null>(null);
  readonly renewalStartsAt = signal(localDateTimeAfter(1));
  readonly renewalEndsAt = signal(localDateTimeAfter(4));
  readonly renewalFoodSafeConfirmed = signal(false);
  readonly renewalError = signal('');
  readonly requestStatusFilter = signal<RequestStatusFilter>('pending');
  readonly expandedRequestProfile = signal<string | null>(null);
  readonly history = signal<DonorHistorySnapshot | null>(null);
  readonly historyLoading = signal(false);
  readonly historyError = signal('');
  readonly createOptions = signal<DonorDonationCreateOptions | null>(null);
  readonly createOptionsLoading = signal(false);
  readonly createOptionsError = signal('');
  readonly donationSaving = signal(false);
  readonly donationFormError = signal('');
  readonly donationCreateMessage = signal('');
  readonly createFoodName = signal('');
  readonly createCategoryId = signal('');
  readonly createQuantity = signal('');
  readonly createUnit = signal('');
  readonly createDescription = signal('');
  readonly createPickupStartsAt = signal(localDateTimeAfter(1));
  readonly createPickupEndsAt = signal(localDateTimeAfter(4));
  readonly selectedImage = signal<File | null>(null);
  readonly selectedImagePreview = signal<string | null>(null);
  readonly removeCurrentImage = signal(false);
  readonly pendingRequestCount = computed(() => this.requestsLoaded()
    ? this.requests().filter((request) => request.status === 'pending').length
    : this.dashboard()?.newRequests ?? 0);
  readonly visibleRequests = computed(() => this.requests().filter((request) => {
    const filter = this.requestStatusFilter();
    if (filter === 'pending') return request.status === 'pending';
    if (filter === 'accepted') return request.status === 'accepted' && !request.receivedConfirmedAt && request.deliveryStatus !== 'cancelled';
    return request.status === 'rejected' || request.status === 'cancelled'
      || Boolean(request.receivedConfirmedAt) || request.deliveryStatus === 'cancelled';
  }));
  readonly filteredDonations = computed(() => {
    const search = this.donationSearch().trim().toLocaleLowerCase();
    const status = this.donationStatusFilter();
    return this.donations().filter((donation) => {
      const matchesStatus = status === 'all'
        || (status === 'available' && donation.status === 'available' && donation.isVisible)
        || (status === 'hidden' && !donation.isVisible)
        || (status === 'reserved' && ['requested', 'reserved', 'pickup_in_progress', 'picked_up', 'in_pickup', 'in_delivery'].includes(donation.status))
        || (status === 'finalized' && ['delivered', 'completed', 'expired', 'cancelled'].includes(donation.status));
      const matchesSearch = !search || `${donation.foodName} ${donation.categoryName} ${donation.status} ${donation.isVisible ? '' : 'oculta'} ${donation.beneficiaryName ?? ''}`.toLocaleLowerCase().includes(search);
      return matchesStatus && matchesSearch;
    });
  });
  readonly section = signal<DonorSection>('dashboard');
  readonly menuOpen = signal(false);

  constructor() { this.loadDashboard(); }

  select(section: DonorSection): void {
    if (section !== 'edit' && this.editingDonation()) this.resetDonationForm();
    this.section.set(section);
    this.menuOpen.set(false);
    this.donationActionsId.set(null);
    if (section !== 'edit') this.editingDonation.set(null);
    if (section === 'dashboard') this.loadDashboard();
    if (section === 'donations') this.loadDonations();
    if (section === 'requests') this.loadRequests();
    if (section === 'history') this.loadHistory();
    if (section === 'create' || section === 'edit') {
      this.donationFormError.set('');
      this.donationCreateMessage.set('');
      this.loadDonationCreateOptions();
    }
  }

  openPersonalAidRequests(): void {
    this.menuOpen.set(false);
    void this.router.navigateByUrl('/app/aid-requests');
  }

  loadDashboard(): void {
    this.dashboardLoading.set(true);
    this.dashboardError.set('');
    this.auth.loadDonorDashboard().subscribe({
      next: (snapshot) => { this.dashboard.set(snapshot); this.dashboardLoading.set(false); },
      error: (error: Error) => { this.dashboardError.set(error.message || 'No se pudo cargar el inicio de tu organización.'); this.dashboardLoading.set(false); },
    });
  }

  loadDonations(selectDonationId?: string): void {
    this.selectedDonation.set(null);
    this.donationsLoading.set(true);
    this.donationsError.set('');
    this.auth.loadDonorDonations().subscribe({
      next: (snapshot) => {
        this.donations.set(snapshot.donations);
        this.selectedDonation.set(selectDonationId ? snapshot.donations.find((donation) => donation.id === selectDonationId) ?? null : null);
        this.donationsLoading.set(false);
      },
      error: (error: Error) => { this.donationsError.set(error.message || 'No se pudieron cargar las donaciones.'); this.donationsLoading.set(false); },
    });
  }

  openDonationDetails(donation: DonorManagementDonation): void {
    this.selectedDonation.set(donation);
  }

  openDashboardDonationDetails(donationId: string): void {
    this.section.set('donations');
    this.menuOpen.set(false);
    this.loadDonations(donationId);
  }

  closeDonationDetails(): void {
    this.selectedDonation.set(null);
  }

  loadRequests(): void {
    this.requestsLoading.set(true);
    this.requestsError.set('');
    this.requestActionError.set('');
    this.auth.loadDonorRequests().subscribe({
      next: (items) => { this.requests.set(items); this.requestsLoaded.set(true); this.requestsLoading.set(false); },
      error: (error: Error) => { this.requestsError.set(error.message || 'No se pudieron cargar las solicitudes.'); this.requestsLoaded.set(false); this.requestsLoading.set(false); },
    });
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.historyError.set('');
    this.auth.loadDonorHistory().subscribe({
      next: (snapshot) => { this.history.set(snapshot); this.historyLoading.set(false); },
      error: (error: Error) => { this.historyError.set(error.message || 'No se pudo cargar el historial.'); this.historyLoading.set(false); },
    });
  }

  loadDonationCreateOptions(): void {
    if (this.createOptionsLoading()) return;
    this.createOptionsLoading.set(true);
    this.createOptionsError.set('');
    this.auth.loadDonorDonationCreateOptions().subscribe({
      next: (options) => {
        this.createOptions.set(options);
        if (!this.createCategoryId() && options.categories.length) this.createCategoryId.set(options.categories[0].id);
        this.createOptionsLoading.set(false);
      },
      error: (error: Error) => {
        this.createOptionsError.set(error.message || 'No se pudieron cargar los datos para publicar.');
        this.createOptionsLoading.set(false);
      },
    });
  }

  setCreateFoodName(event: Event): void { this.createFoodName.set((event.target as HTMLInputElement).value); }
  setCreateCategory(event: Event): void { this.createCategoryId.set((event.target as HTMLSelectElement).value); }
  setCreateQuantity(event: Event): void { this.createQuantity.set((event.target as HTMLInputElement).value); }
  setCreateUnit(event: Event): void { this.createUnit.set((event.target as HTMLSelectElement).value); }
  setCreateDescription(event: Event): void { this.createDescription.set((event.target as HTMLTextAreaElement).value); }
  setCreatePickupStartsAt(event: Event): void { this.createPickupStartsAt.set((event.target as HTMLInputElement).value); }
  setCreatePickupEndsAt(event: Event): void { this.createPickupEndsAt.set((event.target as HTMLInputElement).value); }

  selectDonationImage(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.donationFormError.set('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.clearDonationImage(input, false);
      this.donationFormError.set('La imagen debe ser JPG, PNG o WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.clearDonationImage(input, false);
      this.donationFormError.set('La imagen debe pesar menos de 5 MB.');
      return;
    }
    this.releaseImagePreview();
    this.selectedImage.set(file);
    this.selectedImagePreview.set(URL.createObjectURL(file));
    this.removeCurrentImage.set(false);
  }

  clearDonationImage(input?: HTMLInputElement, removeCurrent = true): void {
    this.releaseImagePreview();
    this.selectedImage.set(null);
    if (removeCurrent && this.editingDonation()) this.removeCurrentImage.set(true);
    if (input) input.value = '';
  }

  submitDonation(event: Event): void {
    event.preventDefault();
    if (this.donationSaving()) return;
    this.donationFormError.set('');
    const form = event.target as HTMLFormElement;
    if (!form.reportValidity()) return;
    const options = this.createOptions();
    if (!options) {
      this.donationFormError.set('Espera a que carguen los datos de tu organización.');
      return;
    }
    const startsAt = new Date(this.createPickupStartsAt()).getTime();
    const endsAt = new Date(this.createPickupEndsAt()).getTime();
    if (!Number.isFinite(startsAt) || startsAt <= Date.now()) {
      this.donationFormError.set('La fecha de inicio debe ser posterior a la hora actual.');
      return;
    }
    if (!Number.isFinite(endsAt) || endsAt <= startsAt) {
      this.donationFormError.set('La fecha límite debe ser posterior al inicio de la recogida.');
      return;
    }
    const quantity = Number(this.createQuantity());
    if (!Number.isFinite(quantity) || quantity <= 0) {
      this.donationFormError.set('La cantidad debe ser mayor que cero.');
      return;
    }

    this.donationSaving.set(true);
    const input = {
      foodName: this.createFoodName().trim(), categoryId: this.createCategoryId(), quantity,
      unit: this.createUnit(), description: this.createDescription(),
      pickupStartsAt: this.createPickupStartsAt(), pickupEndsAt: this.createPickupEndsAt(), image: this.selectedImage(),
    };
    const editing = this.editingDonation();
    const save: Observable<unknown> = editing
      ? this.auth.updateDonorDonation(editing.id, input, this.removeCurrentImage())
      : this.auth.createDonorDonation(input);
    save.subscribe({
      next: () => {
        this.donationSaving.set(false);
        this.donationCreateMessage.set(editing ? 'La donación se actualizó correctamente.' : 'La donación se publicó correctamente.');
        this.editingDonation.set(null);
        this.resetDonationForm(form.querySelector<HTMLInputElement>('input[type="file"]') ?? undefined);
        this.select('donations');
      },
      error: (error: Error) => {
        this.donationFormError.set(error.message || 'No se pudo publicar la donación. Inténtalo de nuevo.');
        this.donationSaving.set(false);
      },
    });
  }

  private releaseImagePreview(): void {
    const preview = this.selectedImagePreview();
    if (preview) URL.revokeObjectURL(preview);
    this.selectedImagePreview.set(null);
  }

  private resetDonationForm(imageInput?: HTMLInputElement): void {
    this.createFoodName.set('');
    this.createCategoryId.set(this.createOptions()?.categories[0]?.id ?? '');
    this.createQuantity.set('');
    this.createUnit.set('');
    this.createDescription.set('');
    this.createPickupStartsAt.set(localDateTimeAfter(1));
    this.createPickupEndsAt.set(localDateTimeAfter(4));
    this.removeCurrentImage.set(false);
    this.clearDonationImage(imageInput, false);
  }

  toggleDonationActions(id: string): void {
    this.donationActionsId.update((current) => current === id ? null : id);
  }

  canEditDonation(donation: DonorManagementDonation): boolean {
    return donation.status === 'available' && donation.requestCount === 0;
  }

  editDonation(donation: DonorManagementDonation): void {
    if (!this.canEditDonation(donation)) return;
    this.editingDonation.set(donation);
    this.donationActionsId.set(null);
    this.donationFormError.set('');
    this.createFoodName.set(donation.foodName);
    this.createCategoryId.set(donation.categoryId ?? '');
    this.createQuantity.set(String(donation.quantity));
    this.createUnit.set(donation.unit);
    this.createDescription.set(donation.description ?? '');
    this.createPickupStartsAt.set(localDateTimeValue(donation.pickupStartsAt));
    this.createPickupEndsAt.set(localDateTimeValue(donation.pickupEndsAt));
    this.releaseImagePreview();
    this.selectedImage.set(null);
    this.selectedImagePreview.set(donation.imageUrl);
    this.removeCurrentImage.set(false);
    this.section.set('edit');
    this.menuOpen.set(false);
    this.loadDonationCreateOptions();
  }

  toggleDonationVisibility(donation: DonorManagementDonation): void {
    this.donationActionsId.set(null);
    this.auth.setDonorDonationVisibility(donation.id, donation.isVisible).subscribe({
      next: () => {
        this.donationCreateMessage.set(donation.isVisible ? 'La donación quedó oculta para las demás organizaciones.' : 'La donación volvió a estar disponible.');
        this.loadDonations();
      },
      error: (error: Error) => this.donationsError.set(error.message || 'No se pudo cambiar la visibilidad de la donación.'),
    });
  }

  deleteDonation(donation: DonorManagementDonation): void {
    this.donationActionsId.set(null);
    if (donation.requestCount > 0) return;
    if (!window.confirm(`¿Eliminar la donación “${donation.foodName}”? Esta acción no se puede deshacer.`)) return;
    this.auth.deleteDonorDonation(donation.id).subscribe({
      next: () => {
        this.donationCreateMessage.set('La donación se eliminó correctamente.');
        this.loadDonations();
      },
      error: (error: Error) => this.donationsError.set(error.message || 'No se pudo eliminar la donación.'),
    });
  }

  historyDate(value: string): string {
    return new Intl.DateTimeFormat('es-DO', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
  }

  historyStatusLabel(status: string): string {
    return status === 'completed' ? 'Completada' : 'Entregada';
  }

  setRequestFilter(filter: RequestStatusFilter): void { this.requestStatusFilter.set(filter); }
  requestCount(filter: RequestStatusFilter): number {
    return this.requests().filter((request) => {
      if (filter === 'pending') return request.status === 'pending';
      if (filter === 'accepted') return request.status === 'accepted' && !request.receivedConfirmedAt && request.deliveryStatus !== 'cancelled';
      return request.status === 'rejected' || request.status === 'cancelled'
        || Boolean(request.receivedConfirmedAt) || request.deliveryStatus === 'cancelled';
    }).length;
  }

  toggleRequestProfile(requestId: string): void {
    this.expandedRequestProfile.update((current) => current === requestId ? null : requestId);
  }

  canAcceptRequest(request: DonorRequestInboxItem): boolean {
    return request.status === 'pending' && request.donationStatus === 'available'
      && Date.parse(request.expiresAt) > Date.now()
      && (request.quantityRequested === null || request.quantityRequested <= request.donationQuantity);
  }

  requestUnavailableReason(request: DonorRequestInboxItem): string {
    if (request.donationStatus !== 'available') return 'La donación ya está reservada, finalizada o cancelada.';
    const expiresAt = Date.parse(request.expiresAt);
    if (!Number.isFinite(expiresAt)) return 'La donación no tiene una fecha límite válida.';
    if (expiresAt <= Date.now()) return `La oferta venció el ${this.requestReceiptDate(request.expiresAt)}.`;
    if (request.quantityRequested !== null && request.quantityRequested > request.donationQuantity) return 'La cantidad solicitada supera lo disponible.';
    return 'La donación ya no está disponible para reservar.';
  }

  canRenewRequest(request: DonorRequestInboxItem): boolean {
    return request.status === 'pending' && request.donationStatus === 'available'
      && Number.isFinite(Date.parse(request.expiresAt)) && Date.parse(request.expiresAt) <= Date.now();
  }

  openRenewalForm(request: DonorRequestInboxItem): void {
    if (!this.canRenewRequest(request)) return;
    this.renewalFormRequestId.set(request.id);
    this.renewalStartsAt.set(localDateTimeAfter(1));
    this.renewalEndsAt.set(localDateTimeAfter(4));
    this.renewalFoodSafeConfirmed.set(false);
    this.renewalError.set('');
  }

  setRenewalStartsAt(event: Event): void { this.renewalStartsAt.set((event.target as HTMLInputElement).value); }
  setRenewalEndsAt(event: Event): void { this.renewalEndsAt.set((event.target as HTMLInputElement).value); }
  setRenewalFoodSafeConfirmed(event: Event): void { this.renewalFoodSafeConfirmed.set((event.target as HTMLInputElement).checked); }

  renewRequestDonation(request: DonorRequestInboxItem): void {
    if (!this.canRenewRequest(request) || this.renewingRequestId()) return;
    this.renewingRequestId.set(request.id);
    this.renewalError.set('');
    this.auth.renewDonorDonationAvailability(request.donationId, this.renewalStartsAt(), this.renewalEndsAt(), this.renewalFoodSafeConfirmed()).subscribe({
      next: () => {
        this.renewingRequestId.set(null);
        this.renewalFormRequestId.set(null);
        this.requestActionMessage.set('Horario actualizado. La donación sigue apta y ahora puedes aceptar o rechazar la solicitud.');
        this.loadRequests();
      },
      error: (error: Error) => {
        this.renewingRequestId.set(null);
        this.renewalError.set(error.message || 'No se pudo actualizar la vigencia.');
      },
    });
  }

  reviewRequest(request: DonorRequestInboxItem, decision: 'accepted' | 'rejected'): void {
    if (this.reviewingRequestId() || request.status !== 'pending') return;
    this.reviewingRequestId.set(request.id);
    this.requestActionError.set('');
    this.requestActionMessage.set('');
    this.auth.reviewDonorRequest(request.id, decision).subscribe({
      next: () => {
        this.requestActionMessage.set(decision === 'accepted'
          ? 'Solicitud aceptada. La donación quedó reservada y se cerraron las demás solicitudes pendientes de ese alimento.'
          : 'Solicitud rechazada.');
        this.reviewingRequestId.set(null);
        this.loadRequests();
      },
      error: (error: Error) => {
        this.requestActionError.set(error.message || 'No se pudo actualizar la solicitud.');
        this.reviewingRequestId.set(null);
      },
    });
  }

  requestQuantity(request: DonorRequestInboxItem): string {
    return request.quantityRequested === null
      ? 'Solicita esta donación'
      : `Solicita ${request.quantityRequested} ${request.donationUnit}`;
  }

  requestStatusLabel(status: string): string {
    return (({ pending: 'Pendiente', accepted: 'Aceptada', rejected: 'Rechazada', cancelled: 'Cancelada' }) as Record<string, string>)[status] ?? status;
  }

  requestOutcomeLabel(request: DonorRequestInboxItem): string {
    if (request.receivedConfirmedAt) return 'Recepción confirmada por la beneficiaria';
    if (request.deliveryStatus === 'cancelled') return 'Entrega cancelada';
    if (request.deliveryStatus === 'delivered') return 'Entrega registrada; confirmación pendiente';
    if (request.status === 'accepted') return 'Coordinar recogida y entrega';
    return this.requestStatusLabel(request.status);
  }

  deliveryStatusLabel(request: DonorRequestInboxItem): string {
    if (request.receivedConfirmedAt) return 'Recepción confirmada por la beneficiaria';
    return ({
      pending: 'Entrega aceptada · coordinar la recogida',
      assigned: 'Recogida coordinada',
      pickup_in_progress: 'Recogida en curso',
      picked_up: 'Alimento recogido · pendiente de recepción',
      delivered: 'Entrega registrada · falta confirmar recepción',
      cancelled: 'Entrega cancelada',
    } as Record<string, string>)[request.deliveryStatus ?? 'pending'] ?? 'Coordinar recogida y entrega';
  }

  requestDirectionsUrl(request: DonorRequestInboxItem): string | null {
    const origin = this.mapPlace(request.pickupAddress, request.pickupCity, request.pickupLatitude, request.pickupLongitude);
    const destination = [request.beneficiaryAddress.trim(), request.beneficiaryCity.trim()].filter(Boolean).join(', ');
    if (!origin || !destination) return null;
    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`;
  }

  requestReceiptDate(value: string): string {
    return new Intl.DateTimeFormat('es-DO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  private mapPlace(address: string, city: string, latitude: number | null, longitude: number | null): string {
    if (latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) return `${latitude},${longitude}`;
    return [address.trim(), city.trim()].filter(Boolean).join(', ');
  }

  setDonationSearch(event: Event): void { this.donationSearch.set((event.target as HTMLInputElement).value); }
  setDonationFilter(filter: DonationStatusFilter): void { this.donationStatusFilter.set(filter); }
  donationCount(filter: DonationStatusFilter): number {
    if (filter === 'all') return this.donations().length;
    if (filter === 'available') return this.donations().filter((donation) => donation.status === 'available' && donation.isVisible).length;
    if (filter === 'hidden') return this.donations().filter((donation) => !donation.isVisible).length;
    if (filter === 'reserved') return this.donations().filter((donation) => ['requested', 'reserved', 'pickup_in_progress', 'picked_up', 'in_pickup', 'in_delivery'].includes(donation.status)).length;
    return this.donations().filter((donation) => ['delivered', 'completed', 'expired', 'cancelled'].includes(donation.status)).length;
  }

  donationTone(category: string): string {
    const value = category.toLocaleLowerCase();
    if (value.includes('frut')) return 'fruit';
    if (value.includes('prepar') || value.includes('verd')) return 'salad';
    return 'bread';
  }

  donationIcon(category: string): string {
    return ({ bread: '▣', salad: '♧', fruit: '●' })[this.donationTone(category) as 'bread' | 'salad' | 'fruit'];
  }

  donationDetail(donation: DonorManagementDonation): string {
    const unitLabels: Record<string, string> = {
      kg: 'kg', g: 'g', lb: 'lb', unit: 'unidades', portion: 'porciones', box: 'cajas', package: 'paquetes',
    };
    const amount = `${donation.quantity} ${unitLabels[donation.unit] ?? donation.unit}`;
    if (['delivered', 'completed'].includes(donation.status)) {
      const date = donation.deliveredAt ? new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' }).format(new Date(donation.deliveredAt)) : '';
      return `${amount} · Entregada${date ? ` el ${date}` : ''}`;
    }
    if (donation.status === 'reserved' || ['requested', 'pickup_in_progress', 'picked_up', 'in_pickup', 'in_delivery'].includes(donation.status)) {
      return `${amount} · ${this.pickupTime(donation.pickupStartsAt, donation.pickupEndsAt)}`;
    }
    if (donation.status === 'cancelled') return `${amount} · Cancelada`;
    return `${amount} · ${this.donationTiming(donation.expiresAt)}`;
  }

  donationFooter(donation: DonorManagementDonation): string {
    if (donation.beneficiaryName && ['reserved', 'pickup_in_progress', 'in_pickup', 'picked_up', 'in_delivery', 'delivered', 'completed'].includes(donation.status)) {
      return `⌂ ${donation.beneficiaryName}`;
    }
    if (donation.deliveredAt) return '✓ Confirmada';
    if (donation.requestCount > 0) return `◫ ${donation.requestCount} ${donation.requestCount === 1 ? 'solicitud' : 'solicitudes'}`;
    return 'Sin solicitudes';
  }

  initials(value: string): string {
    return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase() || 'OR';
  }

  donationTiming(expiresAt: string): string {
    const expiry = new Date(expiresAt);
    const time = new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' }).format(expiry);
    const today = new Date();
    const isToday = expiry.toDateString() === today.toDateString();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const isTomorrow = expiry.toDateString() === tomorrow.toDateString();
    const day = isToday ? 'hoy' : isTomorrow ? 'mañana' : new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' }).format(expiry);
    return `vence ${day}, ${time}`;
  }

  pickupTime(startsAt: string, endsAt: string): string {
    const format = (value: string) => new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' }).format(new Date(value));
    return `recogida ${format(startsAt)} – ${format(endsAt)}`;
  }

  recentAge(value: string): string {
    const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
    if (minutes < 1) return 'Ahora';
    if (minutes < 60) return `Hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Hace ${days} d`;
    return new Intl.DateTimeFormat('es-DO', { day: 'numeric', month: 'short' }).format(new Date(value));
  }

  statusLabel(status: string): string {
    return (({ available: 'Disponible', requested: 'Solicitada', reserved: 'Reservada', pickup_in_progress: 'En recogida', in_pickup: 'En recogida', picked_up: 'Recogida', in_delivery: 'En entrega', delivered: 'Entregada', completed: 'Entregada', expired: 'Vencida', cancelled: 'Cancelada' }) as Record<string, string>)[status] ?? status;
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  openProfile(): void { void this.router.navigateByUrl('/app/profile'); }
}
