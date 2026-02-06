/**
 * Test Case Collector
 * Collects test cases from Jira issue subtasks and linked issues
 */

import { JiraClient } from './client';
import {
  JiraIssue,
  TestCase,
  CollectorOptions,
  Platform,
  JiraIssueLink,
} from './types';

export interface CollectorResult {
  parentIssue: {
    key: string;
    summary: string;
  };
  testCases: TestCase[];
  skippedByPlatform: number;
}

/**
 * Collect test cases from a Jira issue
 * Sources: subtasks and issues linked with the specified link type
 */
export async function collectTestCases(
  client: JiraClient,
  issueKey: string,
  options: CollectorOptions
): Promise<CollectorResult> {
  const parentIssue = await client.getIssue(issueKey);

  const testCases: TestCase[] = [];
  let skippedByPlatform = 0;

  // Collect from subtasks
  if (parentIssue.fields.subtasks) {
    for (const subtask of parentIssue.fields.subtasks) {
      const labels = subtask.fields.labels || [];

      if (!matchesPlatformFilter(labels, options.platform)) {
        skippedByPlatform++;
        continue;
      }

      testCases.push({
        jiraKey: subtask.key,
        summary: subtask.fields.summary,
        labels,
        source: 'subtask',
      });
    }
  }

  // Collect from issue links
  const linkedIssueKeys = extractLinkedIssueKeys(
    parentIssue.fields.issuelinks || [],
    options.linkType
  );

  if (linkedIssueKeys.length > 0) {
    const linkedIssues = await client.getIssues(linkedIssueKeys);
    const linkedIssueMap = new Map(linkedIssues.map((i) => [i.key, i]));

    for (const key of linkedIssueKeys) {
      const issue = linkedIssueMap.get(key);
      if (!issue) continue;

      const labels = issue.fields.labels || [];

      if (!matchesPlatformFilter(labels, options.platform)) {
        skippedByPlatform++;
        continue;
      }

      testCases.push({
        jiraKey: issue.key,
        summary: issue.fields.summary,
        labels,
        source: 'linked',
        linkType: options.linkType,
      });
    }
  }

  return {
    parentIssue: {
      key: parentIssue.key,
      summary: parentIssue.fields.summary,
    },
    testCases,
    skippedByPlatform,
  };
}

/**
 * Extract issue keys from issue links matching the specified link type
 * Matches case-insensitively on link type name (inward or outward)
 */
export function extractLinkedIssueKeys(
  links: JiraIssueLink[],
  linkType: string
): string[] {
  const keys: string[] = [];
  const linkTypeLower = linkType.toLowerCase();

  for (const link of links) {
    const typeName = link.type?.name?.toLowerCase() || '';
    const inwardName = link.type?.inward?.toLowerCase() || '';
    const outwardName = link.type?.outward?.toLowerCase() || '';

    // Check if any of the link type names match
    const matches =
      typeName === linkTypeLower ||
      inwardName === linkTypeLower ||
      outwardName === linkTypeLower;

    if (matches) {
      // Get the linked issue (could be inward or outward)
      if (link.inwardIssue) {
        keys.push(link.inwardIssue.key);
      }
      if (link.outwardIssue) {
        keys.push(link.outwardIssue.key);
      }
    }
  }

  return keys;
}

/**
 * Check if labels match the platform filter
 * - platform=all: include all
 * - platform=web: include if has "platform:web" OR has no platform label
 * - platform=mobile: include if has "platform:mobile" OR has no platform label
 */
export function matchesPlatformFilter(
  labels: string[],
  platform: Platform
): boolean {
  if (platform === 'all') {
    return true;
  }

  const platformLabels = labels.filter((l) =>
    l.toLowerCase().startsWith('platform:')
  );

  // No platform labels = include in all platform filters
  if (platformLabels.length === 0) {
    return true;
  }

  // Check for specific platform label
  const expectedLabel = `platform:${platform}`;
  return labels.some((l) => l.toLowerCase() === expectedLabel);
}
