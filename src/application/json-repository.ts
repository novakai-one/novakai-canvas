/** Persistence seam. Implementations own transport and storage details. */
export interface JsonRepository<T> {
  load(): Promise<T>;
  save(value: T): Promise<void>;
}
