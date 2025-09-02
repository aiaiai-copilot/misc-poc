import { Result, Ok, Err } from '../result';

describe('Result<T, E>', () => {
  describe('Ok constructor', () => {
    it('should create a successful Result with value', () => {
      const result = Ok(42);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.unwrap()).toBe(42);
    });

    it('should create Ok result with null value', () => {
      const result = Ok(null);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(null);
    });

    it('should create Ok result with undefined value', () => {
      const result = Ok(undefined);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toBe(undefined);
    });
  });

  describe('Err constructor', () => {
    it('should create an error Result with error value', () => {
      const error = new Error('Something went wrong');
      const result = Err(error);
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe(error);
    });

    it('should create Err result with string error', () => {
      const result = Err('Invalid input');
      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBe('Invalid input');
    });
  });

  describe('unwrap', () => {
    it('should return value for Ok result', () => {
      const result = Ok('success');
      expect(result.unwrap()).toBe('success');
    });

    it('should throw error for Err result', () => {
      const result = Err('failure');
      expect(() => result.unwrap()).toThrow('Called unwrap on an Err value: failure');
    });
  });

  describe('unwrapErr', () => {
    it('should return error for Err result', () => {
      const error = new Error('test error');
      const result = Err(error);
      expect(result.unwrapErr()).toBe(error);
    });

    it('should throw error for Ok result', () => {
      const result = Ok(42);
      expect(() => result.unwrapErr()).toThrow('Called unwrapErr on an Ok value: 42');
    });
  });

  describe('unwrapOr', () => {
    it('should return value for Ok result', () => {
      const result = Ok(42);
      expect(result.unwrapOr(0)).toBe(42);
    });

    it('should return default value for Err result', () => {
      const result = Err('error');
      expect(result.unwrapOr(0)).toBe(0);
    });
  });

  describe('map', () => {
    it('should transform Ok value', () => {
      const result = Ok(5);
      const mapped = result.map(x => x * 2);
      expect(mapped.unwrap()).toBe(10);
    });

    it('should not transform Err value', () => {
      const result = Err('error');
      const mapped = result.map(x => x * 2);
      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr()).toBe('error');
    });
  });

  describe('mapErr', () => {
    it('should not transform Ok value', () => {
      const result = Ok(42);
      const mapped = result.mapErr(err => `Error: ${err}`);
      expect(mapped.isOk()).toBe(true);
      expect(mapped.unwrap()).toBe(42);
    });

    it('should transform Err value', () => {
      const result = Err('failure');
      const mapped = result.mapErr(err => `Error: ${err}`);
      expect(mapped.isErr()).toBe(true);
      expect(mapped.unwrapErr()).toBe('Error: failure');
    });
  });

  describe('andThen', () => {
    it('should chain Ok results', () => {
      const result = Ok(5);
      const chained = result.andThen(x => Ok(x * 2));
      expect(chained.unwrap()).toBe(10);
    });

    it('should not chain if first result is Err', () => {
      const result = Err('error');
      const chained = result.andThen(x => Ok(x * 2));
      expect(chained.isErr()).toBe(true);
      expect(chained.unwrapErr()).toBe('error');
    });

    it('should return Err if chained operation fails', () => {
      const result = Ok(5);
      const chained = result.andThen(x => Err('chained error'));
      expect(chained.isErr()).toBe(true);
      expect(chained.unwrapErr()).toBe('chained error');
    });
  });

  describe('orElse', () => {
    it('should not call alternative for Ok result', () => {
      const result = Ok(42);
      const alternative = result.orElse(err => Ok(0));
      expect(alternative.unwrap()).toBe(42);
    });

    it('should call alternative for Err result', () => {
      const result = Err('error');
      const alternative = result.orElse(err => Ok(0));
      expect(alternative.unwrap()).toBe(0);
    });

    it('should return Err if alternative also fails', () => {
      const result = Err('original error');
      const alternative = result.orElse(err => Err('alternative error'));
      expect(alternative.isErr()).toBe(true);
      expect(alternative.unwrapErr()).toBe('alternative error');
    });
  });

  describe('match', () => {
    it('should call ok handler for Ok result', () => {
      const result = Ok(42);
      const matched = result.match(
        value => `Success: ${value}`,
        error => `Error: ${error}`
      );
      expect(matched).toBe('Success: 42');
    });

    it('should call err handler for Err result', () => {
      const result = Err('failure');
      const matched = result.match(
        value => `Success: ${value}`,
        error => `Error: ${error}`
      );
      expect(matched).toBe('Error: failure');
    });
  });

  describe('type guards and pattern matching', () => {
    it('should work with type guards', () => {
      const results: Result<number, string>[] = [Ok(1), Err('error'), Ok(2)];
      
      const values = results
        .filter(r => r.isOk())
        .map(r => r.unwrap());
      
      expect(values).toEqual([1, 2]);
    });
  });
});