/**
 * Unit tests for test locator
 */

import { parseRipgrepOutput, formatLocation } from '../../src/locator';

describe('parseRipgrepOutput', () => {
  const repoPath = '/Users/dev/project';

  it('should parse ripgrep output with file:line:column:match format', () => {
    const output = `/Users/dev/project/src/booking.test.ts:42:5:  it("should display booking summary", () => {
/Users/dev/project/src/payment.test.ts:87:5:  test("should handle payment errors", () => {`;

    const locations = parseRipgrepOutput(output, repoPath);

    expect(locations).toHaveLength(2);
    expect(locations[0]).toEqual({
      file: 'src/booking.test.ts',
      line: 42,
      column: 5,
      match: 'it("should display booking summary", () => {',
    });
    expect(locations[1]).toEqual({
      file: 'src/payment.test.ts',
      line: 87,
      column: 5,
      match: 'test("should handle payment errors", () => {',
    });
  });

  it('should handle empty output', () => {
    expect(parseRipgrepOutput('', repoPath)).toEqual([]);
    expect(parseRipgrepOutput('   ', repoPath)).toEqual([]);
  });

  it('should handle single match', () => {
    const output = `/Users/dev/project/tests/unit.test.ts:15:3:  it("validates email", () => {`;

    const locations = parseRipgrepOutput(output, repoPath);

    expect(locations).toHaveLength(1);
    expect(locations[0].file).toBe('tests/unit.test.ts');
    expect(locations[0].line).toBe(15);
    expect(locations[0].column).toBe(3);
  });

  it('should handle paths with spaces', () => {
    const output = `/Users/dev/project/src/my tests/booking.test.ts:10:1:test("works")`;

    const locations = parseRipgrepOutput(output, repoPath);

    expect(locations).toHaveLength(1);
    expect(locations[0].file).toBe('src/my tests/booking.test.ts');
  });

  it('should handle Windows-style paths when on Windows', () => {
    // This tests the relative path calculation
    const winOutput = `C:\\dev\\project\\src\\test.ts:5:2:it("test")`;

    // With mismatched paths, it falls back to the original
    const locations = parseRipgrepOutput(winOutput, repoPath);

    expect(locations).toHaveLength(1);
  });

  it('should ignore malformed lines', () => {
    const output = `some random text
/Users/dev/project/src/test.ts:10:2:it("valid")
another random line`;

    const locations = parseRipgrepOutput(output, repoPath);

    expect(locations).toHaveLength(1);
    expect(locations[0].line).toBe(10);
  });
});

describe('formatLocation', () => {
  it('should format location as file:line', () => {
    expect(
      formatLocation({
        file: 'src/test.ts',
        line: 42,
        column: 5,
        match: 'test content',
      })
    ).toBe('src/test.ts:42');
  });

  it('should handle locations without column', () => {
    expect(
      formatLocation({
        file: 'tests/unit.test.ts',
        line: 100,
        match: 'content',
      })
    ).toBe('tests/unit.test.ts:100');
  });
});
