/**
 * JSON Reporter
 * Generates JSON report file
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestCaseResult, TestCaseStatus } from './terminal';

export interface JsonReportTestCase {
  jiraKey: string;
  summary: string;
  labels: string[];
  source: 'subtask' | 'linked';
  status: TestCaseStatus;
  matchedTestCount: number;
  locations: Array<{
    file: string;
    line: number;
  }>;
  failureMessage?: string;
  error?: string;
}

export interface JsonReport {
  version: '1.0';
  timestamp: string;
  input: {
    jiraKey: string;
    platform: string;
    linkType: string;
    matchMode: string;
  };
  parentIssue: {
    key: string;
    summary: string;
  };
  testCases: JsonReportTestCase[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    notFound: number;
    errors: number;
  };
  overallResult: 'pass' | 'fail' | 'no_tests';
  isDryRun: boolean;
}

export interface JsonReportOptions {
  jiraKey: string;
  parentSummary: string;
  platform: string;
  linkType: string;
  matchMode: string;
  testCaseResults: TestCaseResult[];
  isDryRun: boolean;
  outputPath: string;
}

/**
 * Generate and write JSON report
 */
export async function writeJsonReport(
  options: JsonReportOptions
): Promise<void> {
  const report = generateReport(options);
  const outputPath = path.resolve(options.outputPath);

  await fs.promises.writeFile(outputPath, JSON.stringify(report, null, 2));
}

/**
 * Generate JSON report object
 */
export function generateReport(options: JsonReportOptions): JsonReport {
  const {
    jiraKey,
    parentSummary,
    platform,
    linkType,
    matchMode,
    testCaseResults,
    isDryRun,
  } = options;

  const testCases: JsonReportTestCase[] = testCaseResults.map((result) => ({
    jiraKey: result.testCase.jiraKey,
    summary: result.testCase.summary,
    labels: result.testCase.labels,
    source: result.testCase.source,
    status: result.status,
    matchedTestCount: result.jestResult ? 1 : 0,
    locations: (result.locations?.locations || []).map((loc) => ({
      file: loc.file,
      line: loc.line,
    })),
    failureMessage: result.jestResult?.failureMessage,
    error: result.error,
  }));

  const passed = testCaseResults.filter((r) => r.status === 'PASS').length;
  const failed = testCaseResults.filter((r) => r.status === 'FAIL').length;
  const notFound = testCaseResults.filter(
    (r) => r.status === 'NOT_FOUND'
  ).length;
  const errors = testCaseResults.filter((r) => r.status === 'ERROR').length;

  let overallResult: 'pass' | 'fail' | 'no_tests';
  if (testCaseResults.length === 0) {
    overallResult = 'no_tests';
  } else if (failed > 0 || errors > 0) {
    overallResult = 'fail';
  } else {
    overallResult = 'pass';
  }

  return {
    version: '1.0',
    timestamp: new Date().toISOString(),
    input: {
      jiraKey,
      platform,
      linkType,
      matchMode,
    },
    parentIssue: {
      key: jiraKey,
      summary: parentSummary,
    },
    testCases,
    summary: {
      total: testCaseResults.length,
      passed,
      failed,
      notFound,
      errors,
    },
    overallResult,
    isDryRun,
  };
}
