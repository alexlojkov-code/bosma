// Ошибка с кодом из SPEC §4.2.
export class AppError extends Error {
  constructor(code, { message, retryable = false, retryAfter, status, cause } = {}) {
    super(message || code, { cause });
    this.code = code;
    this.retryable = retryable;
    this.retryAfter = retryAfter;
    this.status = status;
  }
}
