/**
 * Test Matcher Module
 * Matches Jira test case summaries to Jest test titles
 */

import { TestCase } from '../jira/types';
import { createCombinedPattern, isValidRegex } from './regex';

export type MatchMode = 'title';

export interface MatcherOptions {
  mode: MatchMode;
}

export interface MatchResult {
  pattern: string;
  testCases: TestCase[];
  warnings: string[];
}

/**
 * Create a Jest test pattern from test cases
 * Currently supports 'title' mode (exact match on summary)
 */
export function createTestPattern(
  testCases: TestCase[],
  options: MatcherOptions
): MatchResult {
  const warnings: string[] = [];

  if (testCases.length === 0) {
    return {
      pattern: '',
      testCases: [],
      warnings: [],
    };
  }

  if (options.mode !== 'title') {
    throw new Error(`Unsupported match mode: ${options.mode}`);
  }

  // Extract unique titles
  const titles = testCases.map((tc) => tc.summary);
  const uniqueTitles = [...new Set(titles)];

  // Check for duplicates
  if (uniqueTitles.length < titles.length) {
    const counts = new Map<string, number>();
    for (const title of titles) {
      counts.set(title, (counts.get(title) || 0) + 1);
    }

    for (const [title, count] of counts) {
      if (count > 1) {
        warnings.push(
          `Duplicate test title "${title}" found in ${count} Jira test cases. All matches will be run.`
        );
      }
    }
  }

  const pattern = createCombinedPattern(uniqueTitles);

  if (!isValidRegex(pattern)) {
    throw new Error('Generated pattern is not a valid regex');
  }

  return {
    pattern,
    testCases,
    warnings,
  };
}

export { escapeRegex, createExactMatchPattern, createCombinedPattern } from './regex';
