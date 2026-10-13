import type { BaseEntity } from './base.model';

export type UserRole =
  | 'foodshare_admin'
  | 'organization_admin'
  | 'donation_manager'
  | 'logistics_volunteer'
  | 'basic_user';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface User extends BaseEntity {
  fullName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  roles: UserRole[];
  status: UserStatus;
}
