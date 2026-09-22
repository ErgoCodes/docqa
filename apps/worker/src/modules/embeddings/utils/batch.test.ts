import { describe, expect, it } from 'vitest';
import { toBatches } from './batch.js';

describe('toBatches', () => {
  it('returns an empty array when items array is empty', () => {
    const result = toBatches([], 5);
    expect(result).toEqual([]);
  });

  it('splits items evenly when length is an exact multiple of batchSize', () => {
    const items = [1, 2, 3, 4];
    const result = toBatches(items, 2);

    expect(result).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it('splits items with remainder in the final batch', () => {
    const items = [1, 2, 3, 4, 5];
    const result = toBatches(items, 2);

    expect(result).toEqual([
      [1, 2],
      [3, 4],
      [5],
    ]);
  });

  it('returns a single batch when items.length is less than batchSize', () => {
    const items = ['a', 'b'];
    const result = toBatches(items, 5);

    expect(result).toEqual([['a', 'b']]);
  });

  it('throws an error when batchSize is zero or negative', () => {
    expect(() => toBatches([1, 2], 0)).toThrow('batchSize must be a positive integer');
    expect(() => toBatches([1, 2], -3)).toThrow('batchSize must be a positive integer');
  });

  it('throws an error when batchSize is not an integer', () => {
    expect(() => toBatches([1, 2, 3], 2.5)).toThrow('batchSize must be a positive integer');
  });

  it('does not mutate the input array', () => {
    const items = [1, 2, 3];
    const copy = [...items];

    toBatches(items, 2);

    expect(items).toEqual(copy);
  });
});
