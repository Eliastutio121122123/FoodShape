import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Donation } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class DonationService extends InMemoryCrudService<Donation> {
  constructor() {
    const now = new Date();
    const startsAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
    const endsAt = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    super([
      { id: 'donation-bread', createdAt: now.toISOString(), updatedAt: now.toISOString(), donorOrganizationId: 'org-bakery', branchId: 'branch-bakery', foodCategoryId: 'bakery', foodName: 'Pan del día', quantity: 12, unit: 'unit', description: 'Pan fresco elaborado esta mañana.', availableUntil: endsAt, pickupWindow: { startsAt, endsAt }, images: [], status: 'available' },
      { id: 'donation-salad', createdAt: now.toISOString(), updatedAt: now.toISOString(), donorOrganizationId: 'org-ceiba', branchId: 'branch-ceiba', foodCategoryId: 'prepared', foodName: 'Ensaladas frescas', quantity: 8, unit: 'portion', description: 'Ensaladas preparadas y refrigeradas.', availableUntil: endsAt, pickupWindow: { startsAt, endsAt }, images: [], status: 'available' },
      { id: 'donation-fruit', createdAt: now.toISOString(), updatedAt: now.toISOString(), donorOrganizationId: 'org-market', branchId: 'branch-market', foodCategoryId: 'fruit', foodName: 'Frutas variadas', quantity: 5, unit: 'kg', description: 'Frutas de temporada.', availableUntil: endsAt, pickupWindow: { startsAt, endsAt }, images: [], status: 'available' },
    ]);
  }

  getAvailable(): Observable<readonly Donation[]> {
    const now = new Date().toISOString();
    return this.getAll().pipe(
      map((donations) => donations.filter((donation) => donation.status === 'available' && donation.availableUntil > now)),
    );
  }

  getByDonorOrganization(organizationId: string): Observable<readonly Donation[]> {
    return this.getAll().pipe(map((donations) => donations.filter((donation) => donation.donorOrganizationId === organizationId)));
  }

  publish(id: string): Observable<Donation | undefined> {
    return this.changeStatus(id, 'draft', 'available');
  }

  reserve(id: string): Observable<Donation | undefined> {
    return this.changeStatus(id, 'available', 'reserved');
  }

  cancel(id: string): Observable<Donation | undefined> {
    const donation = this.getSnapshot().find((item) => item.id === id);
    if (!donation || ['completed', 'cancelled'].includes(donation.status)) {
      return this.getById(id);
    }

    return this.update(id, { status: 'cancelled' });
  }

  private changeStatus(id: string, expectedStatus: Donation['status'], nextStatus: Donation['status']): Observable<Donation | undefined> {
    const donation = this.getSnapshot().find((item) => item.id === id);
    if (!donation || donation.status !== expectedStatus) {
      return this.getById(id);
    }

    return this.update(id, { status: nextStatus });
  }
}
