/**
 * Jira API Types
 * Supports both Jira Cloud (REST API v3) and Jira Data Center/Server (REST API v2)
 */

export interface JiraConfig {
  baseUrl: string;
  auth: JiraAuth;
  apiVersion?: 'v2' | 'v3' | 'auto';
}

export type JiraAuth =
  | { type: 'basic'; email: string; apiToken: string }
  | { type: 'pat'; token: string };

export interface JiraIssue {
  key: string;
  id: string;
  fields: {
    summary: string;
    labels: string[];
    subtasks?: JiraSubtask[];
    issuelinks?: JiraIssueLink[];
    issuetype?: {
      name: string;
    };
  };
}

export interface JiraSubtask {
  key: string;
  id: string;
  fields: {
    summary: string;
    labels?: string[];
    issuetype?: {
      name: string;
    };
  };
}

export interface JiraIssueLink {
  id: string;
  type: {
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: {
    key: string;
    id: string;
    fields: {
      summary: string;
      labels?: string[];
    };
  };
  outwardIssue?: {
    key: string;
    id: string;
    fields: {
      summary: string;
      labels?: string[];
    };
  };
}

export interface TestCase {
  jiraKey: string;
  summary: string;
  labels: string[];
  source: 'subtask' | 'linked';
  linkType?: string;
}

export interface JiraApiError {
  errorMessages?: string[];
  errors?: Record<string, string>;
  message?: string;
  status?: number;
}

export type Platform = 'web' | 'mobile' | 'all';

export interface CollectorOptions {
  linkType: string;
  platform: Platform;
}
