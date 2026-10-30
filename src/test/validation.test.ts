import { describe, expect, it } from 'vitest';
import { isValidWeightKg, parseNumberInput } from '../lib/validation';

describe('parseNumberInput', () => {
  it('accepts finite numbers and decimals', () => {
    expect(parseNumberInput('64')).toBe(64);
    expect(parseNumberInput(' 64.5 ')).toBe(64.5);
    expect(parseNumberInput('30.0')).toBe(30);
  });

  it('rejects empty and non-numeric input', () => {
    expect(parseNumberInput('')).toBeNull();
    expect(parseNumberInput('   ')).toBeNull();
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('NaN')).toBeNull();
    expect(parseNumberInput('Infinity')).toBeNull();
  });
});

describe('weight-log boundaries (30–300 kg)', () => {
  it.each([
    ['29', false],
    ['29.9', false],
    ['30', true],
    ['30.0', true],
    ['64.5', true],
    ['300', true],
    ['300.1', false],
    ['301', false],
    ['', false],
    ['   ', false],
    ['abc', false],
    ['NaN', false],
  ])('%s → %s', (input, expected) => {
    expect(isValidWeightKg(input)).toBe(expected);
  });
});
