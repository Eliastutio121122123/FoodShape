import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { CatalogItem, CatalogType } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class CatalogService extends InMemoryCrudService<CatalogItem> {
  getByType(type: CatalogType): Observable<readonly CatalogItem[]> {
    return this.getAll().pipe(map((items) => items.filter((item) => item.type === type && item.isActive)));
  }

  deactivate(id: string): Observable<CatalogItem | undefined> {
    return this.update(id, { isActive: false });
  }
}
