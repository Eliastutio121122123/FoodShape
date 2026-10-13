import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Organization, OrganizationType, VerificationStatus } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class OrganizationService extends InMemoryCrudService<Organization> {
  getByType(type: OrganizationType): Observable<readonly Organization[]> {
    return this.getAll().pipe(map((organizations) => organizations.filter((organization) => organization.types.includes(type))));
  }

  updateVerificationStatus(id: string, verificationStatus: VerificationStatus): Observable<Organization | undefined> {
    return this.update(id, { verificationStatus });
  }

  deactivate(id: string): Observable<Organization | undefined> {
    return this.update(id, { status: 'inactive' });
  }
}
