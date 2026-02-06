/**
 * Unit tests for JSON reporter
 */

import { generateReport } from '../../src/reporter/json';
import { TestCaseResult } from '../../src/reporter/terminal';

describe('generateReport', () => {
  const baseOptions = {
    jiraKey: 'TEST-123',
    parentSummary: 'Test feature',
    platform: 'all',
    linkType: 'is tested by',
    matchMode: 'title',
    isDryRun: false,
    outputPath: '.jira-test-report.json',
  };

  it('should generate report with correct version and timestamp', () => {
    const report = generateReport({
      ...baseOptions,
      testCaseResults: [],
    });

    expect(report.version).toBe('1.0');
    expect(report.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('should include input parameters', () => {
    const report = generateReport({
      ...baseOptions,
      platform: 'web',
      testCaseResults: [],
    });

    expect(report.input).toEqual({
      jiraKey: 'TEST-123',
      platform: 'web',
      linkType: 'is tested by',
      matchMode: 'title',
    });
  });

  it('should calculate summary correctly', () => {
    const testCaseResults: TestCaseResult[] = [
      {
        testCase: {
          jiraKey: 'TC-1',
          summary: 'Test 1',
          labels: [],
          source: 'subtask',
        },
        status: 'PASS',
      },
      {
        testCase: {
          jiraKey: 'TC-2',
          summary: 'Test 2',
          labels: [],
          source: 'subtask',
        },
        status: 'PASS',
      },
      {
        testCase: {
          jiraKey: 'TC-3',
          summary: 'Test 3',
          labels: [],
          source: 'linked',
        },
        status: 'FAIL',
      },
      {
        testCase: {
          jiraKey: 'TC-4',
          summary: 'Test 4',
          labels: [],
          source: 'subtask',
        },
        status: 'NOT_FOUND',
      },
    ];

    const report = generateReport({
      ...baseOptions,
      testCaseResults,
    });

    expect(report.summary).toEqual({
      total: 4,
      passed: 2,
      failed: 1,
      notFound: 1,
      errors: 0,
    });
  });

  it('should set overallResult to pass when all tests pass', () => {
    const testCaseResults: TestCaseResult[] = [
      {
        testCase: {
          jiraKey: 'TC-1',
          summary: 'Test 1',
          labels: [],
          source: 'subtask',
        },
        status: 'PASS',
      },
    ];

    const report = generateReport({
      ...baseOptions,
      testCaseResults,
    });

    expect(report.overallResult).toBe('pass');
  });

  it('should set overallResult to fail when any test fails', () => {
    const testCaseResults: TestCaseResult[] = [
      {
        testCase: {
          jiraKey: 'TC-1',
          summary: 'Test 1',
          labels: [],
          source: 'subtask',
        },
        status: 'PASS',
      },
      {
        testCase: {
          jiraKey: 'TC-2',
          summary: 'Test 2',
          labels: [],
          source: 'subtask',
        },
        status: 'FAIL',
      },
    ];

    const report = generateReport({
      ...baseOptions,
      testCaseResults,
    });

    expect(report.overallResult).toBe('fail');
  });

  it('should set overallResult to no_tests when no test cases', () => {
    const report = generateReport({
      ...baseOptions,
      testCaseResults: [],
    });

    expect(report.overallResult).toBe('no_tests');
  });

  it('should not count NOT_FOUND as failure for overallResult', () => {
    const testCaseResults: TestCaseResult[] = [
      {
        testCase: {
          jiraKey: 'TC-1',
          summary: 'Test 1',
          labels: [],
          source: 'subtask',
        },
        status: 'PASS',
      },
      {
        testCase: {
          jiraKey: 'TC-2',
          summary: 'Test 2',
          labels: [],
          source: 'subtask',
        },
        status: 'NOT_FOUND',
      },
    ];

    const report = generateReport({
      ...baseOptions,
      testCaseResults,
    });

    expect(report.overallResult).toBe('pass');
  });

  it('should include test case details', () => {
    const testCaseResults: TestCaseResult[] = [
      {
        testCase: {
          jiraKey: 'TC-1',
          summary: 'Test with locations',
          labels: ['platform:web'],
          source: 'subtask',
        },
        status: 'PASS',
        locations: {
          title: 'Test with locations',
          locations: [
            { file: 'src/test.ts', line: 42, match: 'it("Test with locations")' },
          ],
        },
      },
    ];

    const report = generateReport({
      ...baseOptions,
      testCaseResults,
    });

    expect(report.testCases[0]).toMatchObject({
      jiraKey: 'TC-1',
      summary: 'Test with locations',
      labels: ['platform:web'],
      source: 'subtask',
      status: 'PASS',
      locations: [{ file: 'src/test.ts', line: 42 }],
    });
  });
});
