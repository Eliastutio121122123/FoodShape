import type { BaseEntity } from './base.model';
import type { Location } from './location.model';

export type BranchStatus = 'active' | 'inactive';

export interface Branch extends BaseEntity {
  organizationId: string;
  name: string;
  location: Location;
  phone?: string;
  status: BranchStatus;
}
