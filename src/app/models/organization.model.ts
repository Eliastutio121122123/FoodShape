import type { BaseEntity } from './base.model';
import type { Location } from './location.model';
import type { UserRole } from './user.model';

export type OrganizationType = 'donor' | 'beneficiary';
export type VerificationStatus = 'pending' | 'under_review' | 'verified' | 'rejected';
export type OrganizationStatus = 'active' | 'inactive';
export type OrganizationRole = Exclude<UserRole, 'foodshare_admin'>;

export interface Organization extends BaseEntity {
  name: string;
  types: OrganizationType[];
  rnc?: string;
  email: string;
  phone: string;
  location: Location;
  verificationStatus: VerificationStatus;
  status: OrganizationStatus;
  logoUrl?: string;
}

export interface OrganizationMember extends BaseEntity {
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  isActive: boolean;
}
