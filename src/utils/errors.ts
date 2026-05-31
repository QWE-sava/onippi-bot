export class AppError extends Error {
  status: number;
  retryable: boolean;

  constructor(message: string, status = 500, retryable = false) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.retryable = retryable;
  }
}

export class ProviderError extends AppError {
  provider: string;

  constructor(provider: string, message: string, status = 500, retryable = false) {
    super(message, status, retryable);
    this.name = "ProviderError";
    this.provider = provider;
  }
}

export function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599);
}

export function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message.includes("timeout"));
}
