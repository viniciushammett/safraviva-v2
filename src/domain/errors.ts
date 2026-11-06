export type DomainErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION' | 'INVALID_TRANSITION' | 'INSUFFICIENT_STOCK' | 'CONFLICT' | 'STORAGE_UNAVAILABLE' | 'INCOMPATIBLE_SCHEMA' | 'CONFIRMATION_REQUIRED'
export class DomainError extends Error {
  constructor(public readonly code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
  }
}
export function invariant(condition: unknown, code: DomainErrorCode, message: string): asserts condition {
  if (!condition) throw new DomainError(code, message)
}
