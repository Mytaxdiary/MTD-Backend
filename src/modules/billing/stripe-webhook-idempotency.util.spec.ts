import { QueryFailedError } from 'typeorm';
import { isDuplicateKeyError } from './stripe-webhook-idempotency.util';

describe('isDuplicateKeyError', () => {
  it('detects MySQL duplicate key', () => {
    const err = new QueryFailedError(
      'INSERT',
      [],
      Object.assign(new Error('dup'), { errno: 1062 }),
    );
    expect(isDuplicateKeyError(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isDuplicateKeyError(new Error('nope'))).toBe(false);
    const err = new QueryFailedError('INSERT', [], Object.assign(new Error('x'), { errno: 1054 }));
    expect(isDuplicateKeyError(err)).toBe(false);
  });
});
