import type { BaseEntity } from './base.model';
import type { Location } from './location.model';

export type DeliveryStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'in_pickup'
  | 'picked_up'
  | 'in_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled';

export interface Delivery extends BaseEntity {
  donationId: string;
  donationRequestId: string;
  volunteerUserId?: string;
  pickupLocation: Location;
  deliveryLocation: Location;
  scheduledAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  recipientConfirmedAt?: string;
  status: DeliveryStatus;
  observations?: string;
}
