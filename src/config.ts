/**
 * Configuration loading from environment variables
 * Supports both Jira Cloud and Jira Data Center/Server authentication
 */

import { JiraConfig, JiraAuth } from './jira/types';

export interface AppConfig {
  jira: JiraConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

/**
 * Load configuration from environment variables
 * Required: JIRA_BASE_URL
 * For Jira Cloud: JIRA_EMAIL + JIRA_API_TOKEN
 * For Jira DC/Server: JIRA_PAT
 */
export function loadConfig(): AppConfig {
  const baseUrl = process.env.JIRA_BASE_URL;

  if (!baseUrl) {
    throw new ConfigError(
      'JIRA_BASE_URL environment variable is required.\n' +
        'Set it to your Jira instance URL (e.g., https://your-domain.atlassian.net)'
    );
  }

  const auth = loadAuth();

  return {
    jira: {
      baseUrl: normalizeBaseUrl(baseUrl),
      auth,
      apiVersion: 'auto',
    },
  };
}

function loadAuth(): JiraAuth {
  const email = process.env.JIRA_EMAIL;
  const apiToken = process.env.JIRA_API_TOKEN;
  const pat = process.env.JIRA_PAT;

  // Jira Cloud: email + API token
  if (email && apiToken) {
    return { type: 'basic', email, apiToken };
  }

  // Jira Data Center/Server: Personal Access Token
  if (pat) {
    return { type: 'pat', token: pat };
  }

  throw new ConfigError(
    'Jira authentication not configured.\n' +
      'For Jira Cloud: Set JIRA_EMAIL and JIRA_API_TOKEN\n' +
      'For Jira Data Center/Server: Set JIRA_PAT'
  );
}

function normalizeBaseUrl(url: string): string {
  // Remove trailing slash
  return url.replace(/\/+$/, '');
}

/**
 * Validate that all required config is present without exposing values
 * Returns a sanitized summary for debugging
 */
export function getConfigSummary(config: AppConfig): Record<string, string> {
  return {
    baseUrl: config.jira.baseUrl,
    authType: config.jira.auth.type,
    authConfigured: 'yes',
  };
}
