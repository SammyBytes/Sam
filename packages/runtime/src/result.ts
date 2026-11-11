export type Result<T, E = Error> =
  | { ok: true; value: T; error?: never }
  | { ok: false; value?: never; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}