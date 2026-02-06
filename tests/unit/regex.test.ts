/**
 * Unit tests for regex utilities
 */

import {
  escapeRegex,
  createExactMatchPattern,
  createCombinedPattern,
  isValidRegex,
  testPattern,
} from '../../src/matcher/regex';

describe('escapeRegex', () => {
  it('should escape special regex characters', () => {
    expect(escapeRegex('a.b')).toBe('a\\.b');
    expect(escapeRegex('a*b')).toBe('a\\*b');
    expect(escapeRegex('a+b')).toBe('a\\+b');
    expect(escapeRegex('a?b')).toBe('a\\?b');
    expect(escapeRegex('a^b')).toBe('a\\^b');
    expect(escapeRegex('a$b')).toBe('a\\$b');
    expect(escapeRegex('a{b}')).toBe('a\\{b\\}');
    expect(escapeRegex('a(b)')).toBe('a\\(b\\)');
    expect(escapeRegex('a[b]')).toBe('a\\[b\\]');
    expect(escapeRegex('a|b')).toBe('a\\|b');
    expect(escapeRegex('a\\b')).toBe('a\\\\b');
  });

  it('should handle strings with multiple special characters', () => {
    expect(escapeRegex('should validate (guest.email)')).toBe(
      'should validate \\(guest\\.email\\)'
    );
    expect(escapeRegex('price: $100.00 [USD]')).toBe(
      'price: \\$100\\.00 \\[USD\\]'
    );
  });

  it('should handle strings with no special characters', () => {
    expect(escapeRegex('simple test title')).toBe('simple test title');
    expect(escapeRegex('test123')).toBe('test123');
  });

  it('should handle empty string', () => {
    expect(escapeRegex('')).toBe('');
  });
});

describe('createExactMatchPattern', () => {
  it('should wrap escaped string with end anchor', () => {
    expect(createExactMatchPattern('simple test')).toBe('simple test$');
    expect(createExactMatchPattern('test.with.dots')).toBe(
      'test\\.with\\.dots$'
    );
  });

  it('should create patterns that match test titles with describe prefixes', () => {
    const pattern = createExactMatchPattern('should calculate total');
    const regex = new RegExp(pattern);

    // Matches exact title
    expect(regex.test('should calculate total')).toBe(true);
    // Matches with describe() prefix (how Jest reports full test names)
    expect(regex.test('Booking Feature should calculate total')).toBe(true);
    // Does not match if title continues
    expect(regex.test('should calculate total price')).toBe(false);
  });
});

describe('createCombinedPattern', () => {
  it('should return empty string for empty array', () => {
    expect(createCombinedPattern([])).toBe('');
  });

  it('should return single pattern for single title', () => {
    expect(createCombinedPattern(['test one'])).toBe('test one$');
  });

  it('should combine multiple patterns with alternation', () => {
    const pattern = createCombinedPattern(['test one', 'test two']);
    expect(pattern).toBe('(test one$)|(test two$)');

    const regex = new RegExp(pattern);
    expect(regex.test('test one')).toBe(true);
    expect(regex.test('test two')).toBe(true);
    expect(regex.test('Describe test one')).toBe(true); // with describe prefix
    expect(regex.test('test three')).toBe(false);
  });

  it('should handle titles with special characters', () => {
    const pattern = createCombinedPattern([
      'should validate (email)',
      'price: $100',
    ]);

    const regex = new RegExp(pattern);
    expect(regex.test('should validate (email)')).toBe(true);
    expect(regex.test('price: $100')).toBe(true);
    expect(regex.test('should validate email')).toBe(false);
  });
});

describe('isValidRegex', () => {
  it('should return true for valid patterns', () => {
    expect(isValidRegex('^test$')).toBe(true);
    expect(isValidRegex('a|b|c')).toBe(true);
    expect(isValidRegex('test.*')).toBe(true);
  });

  it('should return false for invalid patterns', () => {
    expect(isValidRegex('[')).toBe(false);
    expect(isValidRegex('(')).toBe(false);
    expect(isValidRegex('*')).toBe(false);
  });
});

describe('testPattern', () => {
  it('should return true when pattern matches', () => {
    expect(testPattern('^test$', 'test')).toBe(true);
    expect(testPattern('test.*', 'testing')).toBe(true);
  });

  it('should return false when pattern does not match', () => {
    expect(testPattern('^test$', 'testing')).toBe(false);
    expect(testPattern('^exact$', 'not exact')).toBe(false);
  });

  it('should return false for invalid patterns', () => {
    expect(testPattern('[', 'test')).toBe(false);
  });
});
