import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { DonationRequestService } from '../../services/donation-request.service';
import { DonationService } from '../../services/donation.service';

type WorkspaceRole = 'admin' | 'donor' | 'beneficiary' | 'volunteer';

@Component({
  selector: 'app-workspace',
  templateUrl: './workspace.page.html',
  styleUrls: ['./workspace.page.scss'],
  imports: [RouterLink],
})
export class WorkspacePage {
  private readonly route = inject(ActivatedRoute);
  private readonly donationService = inject(DonationService);
  private readonly requestService = inject(DonationRequestService);
  private readonly donationRows = toSignal(this.donationService.getAvailable(), { initialValue: [] });
  private readonly requestRows = toSignal(this.requestService.getByBeneficiaryOrganization('org-casa-luz'), { initialValue: [] });
  readonly role = signal<WorkspaceRole>('donor');
  readonly section = signal('home');
  readonly showOther = signal(false);
  readonly donationSearch = signal('');
  readonly donationCategory = signal('Todas');
  readonly donationView = signal<'list' | 'map'>('list');
  readonly favoriteDonations = signal<number[]>([]);
  readonly selectedDonationId = signal(1);
  readonly availableDonations = computed(() => this.donationRows().map((donation, index) => ({
    id: index + 1,
    serviceId: donation.id,
    name: donation.foodName,
    category: ({ bakery: 'Panadería', prepared: 'Comidas preparadas', fruit: 'Frutas' } as Record<string, string>)[donation.foodCategoryId] ?? 'Otros',
    quantity: `${donation.quantity} ${{ kg: 'kg', unit: 'unidades', portion: 'porciones', g: 'g', lb: 'lb', box: 'cajas', package: 'paquetes' }[donation.unit]}`,
    donor: ({ 'org-bakery': 'Panadería Sol', 'org-ceiba': 'Restaurante Ceiba', 'org-market': 'Mercado Central' } as Record<string, string>)[donation.donorOrganizationId] ?? 'Organización donante',
    distance: ['1.2 km', '2.0 km', '2.7 km'][index % 3],
    pickup: `${new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' }).format(new Date(donation.pickupWindow.startsAt))} – ${new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' }).format(new Date(donation.pickupWindow.endsAt))}`,
    icon: donation.foodName.slice(0, 1),
    tone: ['gold', 'green', 'coral'][index % 3],
  })));
  readonly donationCategories = ['Todas', 'Panadería', 'Frutas', 'Comidas preparadas'];
  readonly filteredDonations = computed(() => {
    const query = this.donationSearch().trim().toLocaleLowerCase();
    const category = this.donationCategory();
    return this.availableDonations().filter((donation) =>
      (category === 'Todas' || donation.category === category)
      && (!query || `${donation.name} ${donation.category} ${donation.donor}`.toLocaleLowerCase().includes(query)),
    );
  });
  readonly selectedDonation = computed(() => this.availableDonations().find((donation) => donation.id === this.selectedDonationId()) ?? this.availableDonations()[0] ?? { id: 0, serviceId: '', name: 'Donación no disponible', category: '', quantity: '', donor: '', distance: '', pickup: '', icon: '', tone: '' });
  readonly activeRequestCount = computed(() => this.requestRows().filter((request) => request.status === 'pending' || request.status === 'accepted').length);
  readonly title = computed(() => ({ admin: 'Administración', donor: 'Mis donaciones', beneficiary: 'Donaciones disponibles', volunteer: 'Mis entregas' })[this.role()]);

  constructor() {
    this.route.paramMap.pipe(map((params) => params.get('role'))).subscribe((role) => {
      if (role === 'admin' || role === 'donor' || role === 'beneficiary' || role === 'volunteer') {
        this.role.set(role);
        this.section.set('home');
      }
    });
  }

  select(section: string): void { this.section.set(section); this.showOther.set(false); }
  toggleOther(): void { this.showOther.update((visible) => !visible); }
  updateDonationSearch(event: Event): void { this.donationSearch.set((event.target as HTMLInputElement).value); }
  setDonationCategory(category: string): void { this.donationCategory.set(category); }
  clearDonationFilters(): void { this.donationSearch.set(''); this.donationCategory.set('Todas'); }
  openDonation(id: number): void { this.selectedDonationId.set(id); this.select('detail'); }
  requestSelectedDonation(): void {
    const donation = this.availableDonations().find((item) => item.id === this.selectedDonationId());
    if (!donation) return;
    this.requestService.create({ donationId: donation.serviceId, beneficiaryOrganizationId: 'org-casa-luz', requestedByUserId: 'user-beneficiary', quantityRequested: 1, status: 'pending' }).subscribe(() => this.select('history'));
  }
  setDonationView(view: 'list' | 'map'): void { this.donationView.set(view); }
  isFavorite(id: number): boolean { return this.favoriteDonations().includes(id); }
  toggleFavorite(id: number): void {
    this.favoriteDonations.update((favorites) => favorites.includes(id)
      ? favorites.filter((favoriteId) => favoriteId !== id)
      : [...favorites, id]);
  }
}
