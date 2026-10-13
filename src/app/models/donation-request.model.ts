import type { BaseEntity } from './base.model';

export type DonationRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface DonationRequest extends BaseEntity {
  donationId: string;
  beneficiaryOrganizationId: string;
  requestedByUserId: string;
  quantityRequested?: number;
  observations?: string;
  status: DonationRequestStatus;
  reviewedByUserId?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}
