/**
 * Jira REST API Client
 * Supports both Jira Cloud (REST API v3) and Jira Data Center/Server (REST API v2)
 * Auto-detects the correct API version by trying v3 first, falling back to v2
 */

import { JiraConfig, JiraIssue, JiraApiError } from './types';

export class JiraClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiErrors?: string[]
  ) {
    super(message);
    this.name = 'JiraClientError';
  }
}

export class JiraClient {
  private config: JiraConfig;
  private detectedApiVersion: 'v2' | 'v3' | null = null;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  /**
   * Fetch a Jira issue by key with all required fields
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    const fields = 'summary,labels,subtasks,issuelinks,issuetype';
    const apiVersion = await this.detectApiVersion();

    const path =
      apiVersion === 'v3'
        ? `/rest/api/3/issue/${issueKey}?fields=${fields}`
        : `/rest/api/2/issue/${issueKey}?fields=${fields}`;

    const response = await this.request(path);
    return this.normalizeIssue(response);
  }

  /**
   * Fetch multiple issues by keys (for getting full details of linked issues)
   */
  async getIssues(issueKeys: string[]): Promise<JiraIssue[]> {
    if (issueKeys.length === 0) return [];

    const apiVersion = await this.detectApiVersion();
    const jql = `key in (${issueKeys.map((k) => `"${k}"`).join(',')})`;
    const fields = 'summary,labels,issuetype';

    const path =
      apiVersion === 'v3'
        ? `/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=${fields}`
        : `/rest/api/2/search?jql=${encodeURIComponent(jql)}&fields=${fields}`;

    const response = await this.request(path) as { issues?: unknown[] };
    return (response.issues || []).map((issue: unknown) =>
      this.normalizeIssue(issue)
    );
  }

  /**
   * Auto-detect Jira API version
   * Tries v3 first (Jira Cloud), falls back to v2 (Jira DC/Server)
   */
  private async detectApiVersion(): Promise<'v2' | 'v3'> {
    if (this.config.apiVersion && this.config.apiVersion !== 'auto') {
      return this.config.apiVersion;
    }

    if (this.detectedApiVersion) {
      return this.detectedApiVersion;
    }

    // Try v3 first (Jira Cloud)
    try {
      await this.requestWithVersion('/rest/api/3/myself', 'v3');
      this.detectedApiVersion = 'v3';
      return 'v3';
    } catch {
      // Fall back to v2 (Jira DC/Server)
      try {
        await this.requestWithVersion('/rest/api/2/myself', 'v2');
        this.detectedApiVersion = 'v2';
        return 'v2';
      } catch (e) {
        throw new JiraClientError(
          'Failed to connect to Jira API. Check your JIRA_BASE_URL and authentication.'
        );
      }
    }
  }

  /**
   * Post a comment on a Jira issue
   */
  async addComment(issueKey: string, textBody: string, adfBody?: unknown): Promise<void> {
    const apiVersion = await this.detectApiVersion();

    const path =
      apiVersion === 'v3'
        ? `/rest/api/3/issue/${issueKey}/comment`
        : `/rest/api/2/issue/${issueKey}/comment`;

    // v3 (Cloud) uses ADF format, v2 (DC/Server) uses plain text
    // If a pre-built ADF body is provided, use it for v3; otherwise wrap text in basic ADF
    const body =
      apiVersion === 'v3'
        ? {
            body: adfBody || {
              version: 1,
              type: 'doc',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: textBody }],
                },
              ],
            },
          }
        : { body: textBody };

    await this.postRequest(path, body);
  }

  private async request(path: string): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  private async postRequest(path: string, body: unknown): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      await this.handleError(response);
    }

    return response.json();
  }

  private async requestWithVersion(
    path: string,
    _version: 'v2' | 'v3'
  ): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const headers = this.buildHeaders();

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.config.auth.type === 'basic') {
      const credentials = Buffer.from(
        `${this.config.auth.email}:${this.config.auth.apiToken}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else {
      headers['Authorization'] = `Bearer ${this.config.auth.token}`;
    }

    return headers;
  }

  private async handleError(response: Response): Promise<never> {
    let errorBody: JiraApiError | null = null;

    try {
      errorBody = (await response.json()) as JiraApiError;
    } catch {
      // Response body is not JSON
    }

    const messages: string[] = [];

    if (errorBody?.errorMessages) {
      messages.push(...errorBody.errorMessages);
    }
    if (errorBody?.message) {
      messages.push(errorBody.message);
    }
    if (errorBody?.errors) {
      messages.push(...Object.values(errorBody.errors));
    }

    const message =
      messages.length > 0
        ? messages.join('; ')
        : `Jira API error: HTTP ${response.status}`;

    throw new JiraClientError(message, response.status, messages);
  }

  /**
   * Normalize issue response to consistent format across API versions
   */
  private normalizeIssue(raw: unknown): JiraIssue {
    const issue = raw as JiraIssue;
    return {
      key: issue.key,
      id: issue.id,
      fields: {
        summary: issue.fields?.summary || '',
        labels: issue.fields?.labels || [],
        subtasks: issue.fields?.subtasks || [],
        issuelinks: issue.fields?.issuelinks || [],
        issuetype: issue.fields?.issuetype,
      },
    };
  }
}
