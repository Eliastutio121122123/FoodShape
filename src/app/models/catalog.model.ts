import type { BaseEntity } from './base.model';

export type CatalogType = 'food_category' | 'organization_type';

export interface CatalogItem extends BaseEntity {
  type: CatalogType;
  name: string;
  isActive: boolean;
}
