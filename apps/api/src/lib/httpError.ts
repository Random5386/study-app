/**
 * An error that knows which HTTP status code to send.
 * Throw it anywhere: `throw new HttpError(404, 'Note not found')`.
 * The error handler middleware turns it into a JSON response. See docs/04-express-backend.md.
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
