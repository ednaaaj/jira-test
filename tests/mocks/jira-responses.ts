/**
 * Mock Jira API Responses
 * Used for unit and smoke tests without network calls
 */

import { JiraIssue, JiraIssueLink, JiraSubtask } from '../../src/jira/types';

/**
 * Create a mock Jira issue
 */
export function createMockIssue(overrides: Partial<JiraIssue> = {}): JiraIssue {
  return {
    key: 'HOTEL-27735',
    id: '10001',
    fields: {
      summary: 'Hotel booking feature',
      labels: [],
      subtasks: [],
      issuelinks: [],
      issuetype: { name: 'Story' },
    },
    ...overrides,
  };
}

/**
 * Create a mock subtask
 */
export function createMockSubtask(
  key: string,
  summary: string,
  labels: string[] = []
): JiraSubtask {
  return {
    key,
    id: `${key}-id`,
    fields: {
      summary,
      labels,
      issuetype: { name: 'Sub-task' },
    },
  };
}

/**
 * Create a mock issue link
 */
export function createMockIssueLink(
  linkedKey: string,
  linkedSummary: string,
  linkType: string = 'is tested by',
  direction: 'inward' | 'outward' = 'inward'
): JiraIssueLink {
  const link: JiraIssueLink = {
    id: `link-${linkedKey}`,
    type: {
      name: linkType,
      inward: linkType,
      outward: `tests`,
    },
  };

  if (direction === 'inward') {
    link.inwardIssue = {
      key: linkedKey,
      id: `${linkedKey}-id`,
      fields: {
        summary: linkedSummary,
        labels: [],
      },
    };
  } else {
    link.outwardIssue = {
      key: linkedKey,
      id: `${linkedKey}-id`,
      fields: {
        summary: linkedSummary,
        labels: [],
      },
    };
  }

  return link;
}

/**
 * Sample issue with subtasks and links for testing
 */
export const sampleIssueWithTestCases: JiraIssue = {
  key: 'HOTEL-27735',
  id: '10001',
  fields: {
    summary: 'Add hotel booking checkout flow',
    labels: ['feature', 'booking'],
    subtasks: [
      createMockSubtask(
        'HOTEL-27736',
        'should display booking summary',
        ['platform:web']
      ),
      createMockSubtask(
        'HOTEL-27737',
        'should calculate total price correctly',
        ['platform:web', 'platform:mobile']
      ),
      createMockSubtask(
        'HOTEL-27738',
        'should handle payment errors',
        ['platform:mobile']
      ),
    ],
    issuelinks: [
      createMockIssueLink(
        'HOTEL-27740',
        'should validate guest information'
      ),
      createMockIssueLink(
        'HOTEL-27741',
        'should send confirmation email'
      ),
    ],
    issuetype: { name: 'Story' },
  },
};

/**
 * Sample issue with no test cases
 */
export const sampleIssueNoTestCases: JiraIssue = {
  key: 'HOTEL-27750',
  id: '10002',
  fields: {
    summary: 'Research booking APIs',
    labels: ['research'],
    subtasks: [],
    issuelinks: [],
    issuetype: { name: 'Task' },
  },
};

/**
 * Mock fetch for Jira API
 */
export function createMockFetch(responses: Map<string, unknown>) {
  return jest.fn().mockImplementation((url: string) => {
    const urlPath = new URL(url).pathname;

    for (const [path, response] of responses) {
      if (urlPath.includes(path)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(response),
        });
      }
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ errorMessages: ['Issue not found'] }),
    });
  });
}

/**
 * Mock search response for linked issues
 */
export function createMockSearchResponse(issues: JiraIssue[]) {
  return {
    startAt: 0,
    maxResults: 50,
    total: issues.length,
    issues,
  };
}
