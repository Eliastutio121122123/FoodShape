import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { Branch } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class BranchService extends InMemoryCrudService<Branch> {
  getByOrganization(organizationId: string): Observable<readonly Branch[]> {
    return this.getAll().pipe(map((branches) => branches.filter((branch) => branch.organizationId === organizationId)));
  }

  deactivate(id: string): Observable<Branch | undefined> {
    return this.update(id, { status: 'inactive' });
  }
}
