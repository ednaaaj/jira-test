/**
 * jira-test - CLI tool that connects Jira issues to automated tests
 *
 * This module exports the main API for programmatic usage.
 * For CLI usage, use the bin/jira-test.js entry point.
 */

export { createCli, EXIT_CODES } from './cli';
export type { RunOptions } from './cli';

export { loadConfig, ConfigError } from './config';
export type { AppConfig } from './config';

export { JiraClient, JiraClientError } from './jira/client';
export { collectTestCases, extractLinkedIssueKeys, matchesPlatformFilter } from './jira/collector';
export type {
  JiraConfig,
  JiraAuth,
  JiraIssue,
  TestCase,
  Platform,
  CollectorOptions,
} from './jira/types';

export { createTestPattern, escapeRegex, createExactMatchPattern } from './matcher';
export type { MatchMode, MatcherOptions, MatchResult } from './matcher';

export { runJest, buildJestCommand } from './runner/jest';
export type { JestRunnerOptions, TestResult, JestRunResult } from './runner/jest';

export { locateTests, parseRipgrepOutput, formatLocation } from './locator';
export type { TestLocation, LocatorResult, LocatorOptions } from './locator';

export { writeJsonReport, generateReport } from './reporter/json';
export type { JsonReport, JsonReportTestCase, JsonReportOptions } from './reporter/json';

export type { TestCaseResult, TestCaseStatus, ReportData } from './reporter/terminal';
