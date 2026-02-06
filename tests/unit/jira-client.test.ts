/**
 * Unit tests for Jira client
 */

import { JiraClient, JiraClientError } from '../../src/jira/client';
import { JiraConfig } from '../../src/jira/types';
import {
  sampleIssueWithTestCases,
  createMockFetch,
  createMockSearchResponse,
} from '../mocks/jira-responses';

describe('JiraClient', () => {
  const mockConfig: JiraConfig = {
    baseUrl: 'https://test.atlassian.net',
    auth: { type: 'basic', email: 'test@example.com', apiToken: 'token123' },
    apiVersion: 'v3',
  };

  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getIssue', () => {
    it('should fetch and normalize issue data', async () => {
      const responses = new Map([
        ['/rest/api/3/issue/HOTEL-27735', sampleIssueWithTestCases],
      ]);
      global.fetch = createMockFetch(responses) as unknown as typeof fetch;

      const client = new JiraClient(mockConfig);
      const issue = await client.getIssue('HOTEL-27735');

      expect(issue.key).toBe('HOTEL-27735');
      expect(issue.fields.summary).toBe('Add hotel booking checkout flow');
      expect(issue.fields.subtasks).toHaveLength(3);
      expect(issue.fields.issuelinks).toHaveLength(2);
    });

    it('should throw JiraClientError for not found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ errorMessages: ['Issue not found'] }),
      }) as unknown as typeof fetch;

      const client = new JiraClient(mockConfig);

      await expect(client.getIssue('NOTFOUND-1')).rejects.toThrow(
        JiraClientError
      );
    });

    it('should throw JiraClientError for auth errors', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
      }) as unknown as typeof fetch;

      const client = new JiraClient(mockConfig);

      await expect(client.getIssue('TEST-1')).rejects.toThrow(JiraClientError);
    });
  });

  describe('getIssues', () => {
    it('should fetch multiple issues via search', async () => {
      const searchResponse = createMockSearchResponse([
        {
          key: 'TEST-1',
          id: '1',
          fields: {
            summary: 'Test one',
            labels: ['platform:web'],
          },
        },
        {
          key: 'TEST-2',
          id: '2',
          fields: {
            summary: 'Test two',
            labels: [],
          },
        },
      ]);

      const responses = new Map([['/rest/api/3/search', searchResponse]]);
      global.fetch = createMockFetch(responses) as unknown as typeof fetch;

      const client = new JiraClient(mockConfig);
      const issues = await client.getIssues(['TEST-1', 'TEST-2']);

      expect(issues).toHaveLength(2);
      expect(issues[0].key).toBe('TEST-1');
      expect(issues[1].key).toBe('TEST-2');
    });

    it('should return empty array for empty input', async () => {
      const client = new JiraClient(mockConfig);
      const issues = await client.getIssues([]);

      expect(issues).toEqual([]);
    });
  });

  describe('authentication', () => {
    it('should use Basic auth for cloud credentials', async () => {
      const responses = new Map([
        ['/rest/api/3/issue/TEST-1', sampleIssueWithTestCases],
      ]);
      global.fetch = createMockFetch(responses) as unknown as typeof fetch;

      const client = new JiraClient(mockConfig);
      await client.getIssue('TEST-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: expect.stringMatching(/^Basic /),
          }),
        })
      );
    });

    it('should use Bearer auth for PAT', async () => {
      const patConfig: JiraConfig = {
        baseUrl: 'https://jira.company.com',
        auth: { type: 'pat', token: 'pat-token-123' },
        apiVersion: 'v2',
      };

      const responses = new Map([
        ['/rest/api/2/issue/TEST-1', sampleIssueWithTestCases],
      ]);
      global.fetch = createMockFetch(responses) as unknown as typeof fetch;

      const client = new JiraClient(patConfig);
      await client.getIssue('TEST-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer pat-token-123',
          }),
        })
      );
    });
  });
});
