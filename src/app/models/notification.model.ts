import type { BaseEntity } from './base.model';

export type NotificationType = 'donation' | 'request' | 'delivery' | 'system';

export interface Notification extends BaseEntity {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  relatedEntityId?: string;
}
