import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Notification } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class NotificationService extends InMemoryCrudService<Notification> {
  getByUser(userId: string): Observable<readonly Notification[]> {
    return this.getAll().pipe(map((notifications) => notifications.filter((notification) => notification.userId === userId)));
  }

  markAsRead(id: string): Observable<Notification | undefined> {
    return this.update(id, { isRead: true });
  }

  markAllAsRead(userId: string): Observable<readonly Notification[]> {
    const updatedNotifications = this.getSnapshot().map((notification) => (
      notification.userId === userId && !notification.isRead
        ? { ...notification, isRead: true, updatedAt: new Date().toISOString() }
        : notification
    ));

    this.setEntities(updatedNotifications);
    return this.getByUser(userId);
  }
}
