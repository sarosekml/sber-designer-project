export class AuthError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 423 | 429,
    message: string,
    readonly metadata: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'AuthError';
  }
}
