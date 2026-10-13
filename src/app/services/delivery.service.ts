import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Delivery, DeliveryStatus } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

const validTransitions: Readonly<Record<DeliveryStatus, readonly DeliveryStatus[]>> = {
  pending_assignment: ['assigned', 'cancelled'],
  assigned: ['in_pickup', 'cancelled'],
  in_pickup: ['picked_up', 'cancelled'],
  picked_up: ['in_delivery', 'cancelled'],
  in_delivery: ['delivered', 'cancelled'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

@Injectable({ providedIn: 'root' })
export class DeliveryService extends InMemoryCrudService<Delivery> {
  getByVolunteer(userId: string): Observable<readonly Delivery[]> {
    return this.getAll().pipe(map((deliveries) => deliveries.filter((delivery) => delivery.volunteerUserId === userId)));
  }

  assignVolunteer(id: string, volunteerUserId: string): Observable<Delivery | undefined> {
    const delivery = this.getSnapshot().find((item) => item.id === id);
    if (!delivery || delivery.status !== 'pending_assignment') {
      return this.getById(id);
    }

    return this.update(id, { volunteerUserId, status: 'assigned' });
  }

  updateStatus(id: string, status: DeliveryStatus, observations?: string): Observable<Delivery | undefined> {
    const delivery = this.getSnapshot().find((item) => item.id === id);
    if (!delivery || !validTransitions[delivery.status].includes(status)) {
      return this.getById(id);
    }

    const now = new Date().toISOString();
    return this.update(id, {
      status,
      observations,
      pickedUpAt: status === 'picked_up' ? now : delivery.pickedUpAt,
      deliveredAt: status === 'delivered' ? now : delivery.deliveredAt,
      recipientConfirmedAt: status === 'completed' ? now : delivery.recipientConfirmedAt,
    });
  }
}
