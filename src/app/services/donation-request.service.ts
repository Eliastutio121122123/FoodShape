import { Injectable } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';
import type { DonationRequest } from '../models';
import { DonationService } from './donation.service';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class DonationRequestService extends InMemoryCrudService<DonationRequest> {
  constructor(private readonly donationService: DonationService) {
    const now = new Date().toISOString();
    super([
      { id: 'request-demo-pending', createdAt: now, updatedAt: now, donationId: 'donation-bread', beneficiaryOrganizationId: 'org-casa-luz', requestedByUserId: 'user-beneficiary', quantityRequested: 6, status: 'pending' },
      { id: 'request-demo-accepted', createdAt: now, updatedAt: now, donationId: 'donation-salad', beneficiaryOrganizationId: 'org-casa-luz', requestedByUserId: 'user-beneficiary', quantityRequested: 4, status: 'accepted', reviewedByUserId: 'user-donor', reviewedAt: now },
    ]);
  }

  getByBeneficiaryOrganization(organizationId: string): Observable<readonly DonationRequest[]> {
    return this.getAll().pipe(map((requests) => requests.filter((request) => request.beneficiaryOrganizationId === organizationId)));
  }

  accept(id: string, reviewedByUserId: string): Observable<DonationRequest | undefined> {
    const request = this.getSnapshot().find((item) => item.id === id);
    if (!request || request.status !== 'pending') {
      return this.getById(id);
    }

    return this.donationService.reserve(request.donationId).pipe(
      switchMap((donation) => donation
        ? this.update(id, { status: 'accepted', reviewedByUserId, reviewedAt: new Date().toISOString() })
        : this.getById(id)),
    );
  }

  reject(id: string, reviewedByUserId: string, rejectionReason: string): Observable<DonationRequest | undefined> {
    return this.update(id, {
      status: 'rejected',
      reviewedByUserId,
      reviewedAt: new Date().toISOString(),
      rejectionReason,
    });
  }

  cancel(id: string): Observable<DonationRequest | undefined> {
    const request = this.getSnapshot().find((item) => item.id === id);
    return request?.status === 'pending' ? this.update(id, { status: 'cancelled' }) : this.getById(id);
  }
}
