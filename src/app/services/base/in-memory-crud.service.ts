import { BehaviorSubject, Observable, map } from 'rxjs';
import type { BaseEntity } from '../../models';

export type CreateEntity<T extends BaseEntity> = Omit<T, keyof BaseEntity>;
export type UpdateEntity<T extends BaseEntity> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

export abstract class InMemoryCrudService<T extends BaseEntity> {
  private readonly entitiesSubject: BehaviorSubject<readonly T[]>;

  protected constructor(initialEntities: readonly T[] = []) {
    this.entitiesSubject = new BehaviorSubject<readonly T[]>(initialEntities);
  }

  getAll(): Observable<readonly T[]> {
    return this.entitiesSubject.asObservable();
  }

  getById(id: string): Observable<T | undefined> {
    return this.getAll().pipe(map((entities) => entities.find((entity) => entity.id === id)));
  }

  create(data: CreateEntity<T>): Observable<T> {
    const now = new Date().toISOString();
    const entity = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    } as T;

    this.setEntities([...this.entitiesSubject.value, entity]);
    return this.getById(entity.id).pipe(map((createdEntity) => createdEntity as T));
  }

  update(id: string, changes: UpdateEntity<T>): Observable<T | undefined> {
    const entity = this.entitiesSubject.value.find((item) => item.id === id);

    if (!entity) {
      return this.getById(id);
    }

    const updatedEntity = {
      ...entity,
      ...changes,
      id: entity.id,
      createdAt: entity.createdAt,
      updatedAt: new Date().toISOString(),
    } as T;

    this.setEntities(this.entitiesSubject.value.map((item) => (item.id === id ? updatedEntity : item)));
    return this.getById(id);
  }

  delete(id: string): Observable<boolean> {
    const entities = this.entitiesSubject.value;
    const exists = entities.some((entity) => entity.id === id);

    if (exists) {
      this.setEntities(entities.filter((entity) => entity.id !== id));
    }

    return new BehaviorSubject(exists).asObservable();
  }

  protected getSnapshot(): readonly T[] {
    return this.entitiesSubject.value;
  }

  protected setEntities(entities: readonly T[]): void {
    this.entitiesSubject.next(entities);
  }
}
