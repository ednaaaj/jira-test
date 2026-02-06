/**
 * Regex utilities for matching test titles
 * Handles escaping special characters for Jest's --testNamePattern
 */

/**
 * Escape special regex characters in a string
 * Used to create a pattern that matches the literal string
 */
export function escapeRegex(str: string): string {
  // Escape all regex special characters
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a Jest-compatible test name pattern for matching
 * Uses end anchor ($) to match test titles that may be prefixed by describe() blocks
 * Jest full test names include describe block names: "Describe Block test title"
 */
export function createExactMatchPattern(title: string): string {
  const escaped = escapeRegex(title);
  // Use only end anchor - Jest prepends describe() names to test titles
  return `${escaped}$`;
}

/**
 * Create a combined pattern for multiple test titles
 * Uses alternation (|) to match any of the titles
 */
export function createCombinedPattern(titles: string[]): string {
  if (titles.length === 0) {
    return '';
  }

  if (titles.length === 1) {
    return createExactMatchPattern(titles[0]);
  }

  const patterns = titles.map((t) => `(${createExactMatchPattern(t)})`);
  return patterns.join('|');
}

/**
 * Validate that a regex pattern is valid
 */
export function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

/**
 * Test if a string matches a pattern
 */
export function testPattern(pattern: string, testString: string): boolean {
  try {
    const regex = new RegExp(pattern);
    return regex.test(testString);
  } catch {
    return false;
  }
}
