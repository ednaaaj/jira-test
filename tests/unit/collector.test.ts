/**
 * Unit tests for Jira test case collector
 */

import {
  extractLinkedIssueKeys,
  matchesPlatformFilter,
} from '../../src/jira/collector';
import { JiraIssueLink } from '../../src/jira/types';
import { createMockIssueLink } from '../mocks/jira-responses';

describe('extractLinkedIssueKeys', () => {
  it('should extract keys from inward links matching link type', () => {
    const links: JiraIssueLink[] = [
      createMockIssueLink('TEST-1', 'Test one', 'is tested by', 'inward'),
      createMockIssueLink('TEST-2', 'Test two', 'is tested by', 'inward'),
    ];

    const keys = extractLinkedIssueKeys(links, 'is tested by');

    expect(keys).toEqual(['TEST-1', 'TEST-2']);
  });

  it('should extract keys from outward links matching link type', () => {
    const links: JiraIssueLink[] = [
      createMockIssueLink('TEST-1', 'Test one', 'is tested by', 'outward'),
    ];

    const keys = extractLinkedIssueKeys(links, 'is tested by');

    expect(keys).toEqual(['TEST-1']);
  });

  it('should be case-insensitive for link type matching', () => {
    const links: JiraIssueLink[] = [
      createMockIssueLink('TEST-1', 'Test one', 'Is Tested By', 'inward'),
      createMockIssueLink('TEST-2', 'Test two', 'IS TESTED BY', 'inward'),
    ];

    const keys = extractLinkedIssueKeys(links, 'is tested by');

    expect(keys).toEqual(['TEST-1', 'TEST-2']);
  });

  it('should ignore links with non-matching link types', () => {
    const links: JiraIssueLink[] = [
      createMockIssueLink('TEST-1', 'Test one', 'is tested by', 'inward'),
      createMockIssueLink('BLOCK-1', 'Blocker', 'blocks', 'inward'),
      createMockIssueLink('DUP-1', 'Duplicate', 'duplicates', 'inward'),
    ];

    const keys = extractLinkedIssueKeys(links, 'is tested by');

    expect(keys).toEqual(['TEST-1']);
  });

  it('should return empty array when no links match', () => {
    const links: JiraIssueLink[] = [
      createMockIssueLink('BLOCK-1', 'Blocker', 'blocks', 'inward'),
    ];

    const keys = extractLinkedIssueKeys(links, 'is tested by');

    expect(keys).toEqual([]);
  });

  it('should return empty array for empty links', () => {
    expect(extractLinkedIssueKeys([], 'is tested by')).toEqual([]);
  });

  it('should handle links with both inward and outward issues', () => {
    const link: JiraIssueLink = {
      id: 'link-1',
      type: {
        name: 'is tested by',
        inward: 'is tested by',
        outward: 'tests',
      },
      inwardIssue: {
        key: 'TEST-IN',
        id: 'in-id',
        fields: { summary: 'Inward', labels: [] },
      },
      outwardIssue: {
        key: 'TEST-OUT',
        id: 'out-id',
        fields: { summary: 'Outward', labels: [] },
      },
    };

    const keys = extractLinkedIssueKeys([link], 'is tested by');

    expect(keys).toContain('TEST-IN');
    expect(keys).toContain('TEST-OUT');
  });
});

describe('matchesPlatformFilter', () => {
  describe('platform=all', () => {
    it('should match any labels', () => {
      expect(matchesPlatformFilter(['platform:web'], 'all')).toBe(true);
      expect(matchesPlatformFilter(['platform:mobile'], 'all')).toBe(true);
      expect(matchesPlatformFilter([], 'all')).toBe(true);
      expect(matchesPlatformFilter(['other-label'], 'all')).toBe(true);
    });
  });

  describe('platform=web', () => {
    it('should match issues with platform:web label', () => {
      expect(matchesPlatformFilter(['platform:web'], 'web')).toBe(true);
      expect(matchesPlatformFilter(['platform:web', 'other'], 'web')).toBe(
        true
      );
    });

    it('should match issues with no platform label', () => {
      expect(matchesPlatformFilter([], 'web')).toBe(true);
      expect(matchesPlatformFilter(['some-label', 'another'], 'web')).toBe(
        true
      );
    });

    it('should not match issues with only platform:mobile label', () => {
      expect(matchesPlatformFilter(['platform:mobile'], 'web')).toBe(false);
      expect(matchesPlatformFilter(['platform:mobile', 'other'], 'web')).toBe(
        false
      );
    });

    it('should match issues with both platform labels', () => {
      expect(
        matchesPlatformFilter(['platform:web', 'platform:mobile'], 'web')
      ).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(matchesPlatformFilter(['Platform:Web'], 'web')).toBe(true);
      expect(matchesPlatformFilter(['PLATFORM:WEB'], 'web')).toBe(true);
    });
  });

  describe('platform=mobile', () => {
    it('should match issues with platform:mobile label', () => {
      expect(matchesPlatformFilter(['platform:mobile'], 'mobile')).toBe(true);
    });

    it('should match issues with no platform label', () => {
      expect(matchesPlatformFilter([], 'mobile')).toBe(true);
    });

    it('should not match issues with only platform:web label', () => {
      expect(matchesPlatformFilter(['platform:web'], 'mobile')).toBe(false);
    });
  });
});
