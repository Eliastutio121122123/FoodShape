import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { User, UserRole } from '../models';
import { InMemoryCrudService } from './base/in-memory-crud.service';

@Injectable({ providedIn: 'root' })
export class UserService extends InMemoryCrudService<User> {
  getByRole(role: UserRole): Observable<readonly User[]> {
    return this.getAll().pipe(map((users) => users.filter((user) => user.roles.includes(role))));
  }
}
