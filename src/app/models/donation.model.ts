import type { Attachment, BaseEntity, TimeWindow } from './base.model';

export type FoodUnit = 'kg' | 'g' | 'lb' | 'unit' | 'portion' | 'box' | 'package';
export type DonationStatus =
  | 'draft'
  | 'available'
  | 'requested'
  | 'reserved'
  | 'in_pickup'
  | 'picked_up'
  | 'in_delivery'
  | 'delivered'
  | 'completed'
  | 'expired'
  | 'cancelled';

export interface Donation extends BaseEntity {
  donorOrganizationId: string;
  branchId: string;
  foodCategoryId: string;
  foodName: string;
  quantity: number;
  unit: FoodUnit;
  description?: string;
  availableUntil: string;
  pickupWindow: TimeWindow;
  images: Attachment[];
  status: DonationStatus;
}
