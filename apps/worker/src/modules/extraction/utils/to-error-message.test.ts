import { describe, expect, it } from 'vitest';
import { toErrorMessage } from './to-error-message.js';

describe('toErrorMessage', () => {
  it('extracts message when error is an Error instance', () => {
    const error = new Error('something went wrong');
    expect(toErrorMessage(error)).toBe('something went wrong');
  });

  it('converts non-Error thrown values to string', () => {
    expect(toErrorMessage('a string error')).toBe('a string error');
    expect(toErrorMessage(123)).toBe('123');
    expect(toErrorMessage({ message: 'custom' })).toBe('[object Object]');
    expect(toErrorMessage(null)).toBe('null');
    expect(toErrorMessage(undefined)).toBe('undefined');
  });
});
