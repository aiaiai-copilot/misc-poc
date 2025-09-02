export abstract class Result<T, E> {
  abstract isOk(): this is OkResult<T, E>;
  abstract isErr(): this is ErrResult<T, E>;
  abstract unwrap(): T;
  abstract unwrapErr(): E;
  abstract unwrapOr(defaultValue: T): T;
  abstract map<U>(fn: (value: T) => U): Result<U, E>;
  abstract mapErr<F>(fn: (error: E) => F): Result<T, F>;
  abstract andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E>;
  abstract orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F>;
  abstract match<U>(onOk: (value: T) => U, onErr: (error: E) => U): U;
}

class OkResult<T, E> extends Result<T, E> {
  constructor(private readonly value: T) {
    super();
  }

  isOk(): this is OkResult<T, E> {
    return true;
  }

  isErr(): this is ErrResult<T, E> {
    return false;
  }

  unwrap(): T {
    return this.value;
  }

  unwrapErr(): E {
    throw new Error(`Called unwrapErr on an Ok value: ${this.value}`);
  }

  unwrapOr(_defaultValue: T): T {
    return this.value;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return new OkResult(fn(this.value));
  }

  mapErr<F>(_fn: (error: E) => F): Result<T, F> {
    return new OkResult(this.value);
  }

  andThen<U>(fn: (value: T) => Result<U, E>): Result<U, E> {
    return fn(this.value);
  }

  orElse<F>(_fn: (error: E) => Result<T, F>): Result<T, F> {
    return new OkResult(this.value);
  }

  match<U>(onOk: (value: T) => U, _onErr: (error: E) => U): U {
    return onOk(this.value);
  }
}

class ErrResult<T, E> extends Result<T, E> {
  constructor(private readonly error: E) {
    super();
  }

  isOk(): this is OkResult<T, E> {
    return false;
  }

  isErr(): this is ErrResult<T, E> {
    return true;
  }

  unwrap(): T {
    throw new Error(`Called unwrap on an Err value: ${this.error}`);
  }

  unwrapErr(): E {
    return this.error;
  }

  unwrapOr(defaultValue: T): T {
    return defaultValue;
  }

  map<U>(_fn: (value: T) => U): Result<U, E> {
    return new ErrResult(this.error);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return new ErrResult(fn(this.error));
  }

  andThen<U>(_fn: (value: T) => Result<U, E>): Result<U, E> {
    return new ErrResult(this.error);
  }

  orElse<F>(fn: (error: E) => Result<T, F>): Result<T, F> {
    return fn(this.error);
  }

  match<U>(_onOk: (value: T) => U, onErr: (error: E) => U): U {
    return onErr(this.error);
  }
}

export function Ok<T, E = unknown>(value: T): Result<T, E> {
  return new OkResult<T, E>(value);
}

export function Err<T = unknown, E = unknown>(error: E): Result<T, E> {
  return new ErrResult<T, E>(error);
}