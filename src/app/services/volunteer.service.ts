import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { VolunteerProfile, VolunteerStatus } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class VolunteerService extends InMemoryCrudService<VolunteerProfile> {
  updateAvailability(id: string, status: VolunteerStatus): Observable<VolunteerProfile | undefined> {
    return this.update(id, { status });
  }
}
