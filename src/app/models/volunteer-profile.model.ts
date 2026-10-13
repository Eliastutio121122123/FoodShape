import type { BaseEntity } from './base.model';

export type VolunteerStatus = 'available' | 'unavailable' | 'inactive';
export type TransportType = 'walking' | 'bicycle' | 'motorcycle' | 'car' | 'van';

export interface VolunteerProfile extends BaseEntity {
  userId: string;
  status: VolunteerStatus;
  transportType?: TransportType;
}
