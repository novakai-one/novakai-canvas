/** Persistence seam. Implementations own transport and storage details. */
/** Persistence seam for validated JSON values. */
export interface JsonRepository<T> {
  load(): Promise<T>;
  save(value: T): Promise<void>;
}
