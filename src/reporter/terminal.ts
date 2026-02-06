/**
 * Terminal Reporter
 * Outputs formatted test results to the console
 */

import chalk from 'chalk';
import { TestCase } from '../jira/types';
import { TestResult } from '../runner/jest';
import { LocatorResult, formatLocation } from '../locator';

export type TestCaseStatus = 'PASS' | 'FAIL' | 'NOT_FOUND' | 'ERROR';

export interface TestCaseResult {
  testCase: TestCase;
  status: TestCaseStatus;
  jestResult?: TestResult;
  locations?: LocatorResult;
  error?: string;
}

export interface ReportData {
  jiraKey: string;
  parentSummary: string;
  platform: string;
  testCaseResults: TestCaseResult[];
  skippedByPlatform: number;
  isDryRun: boolean;
  warnings: string[];
}

/**
 * Print the test run header
 */
export function printHeader(data: ReportData): void {
  console.log('');
  console.log(chalk.bold('JIRA Test Runner'));
  console.log(chalk.gray('─'.repeat(50)));
  console.log(`${chalk.bold('Issue:')} ${data.jiraKey} - ${data.parentSummary}`);
  console.log(`${chalk.bold('Platform filter:')} ${data.platform}`);

  if (data.isDryRun) {
    console.log(chalk.yellow('\n[DRY RUN MODE - Tests will not be executed]'));
  }

  if (data.skippedByPlatform > 0) {
    console.log(
      chalk.gray(`(${data.skippedByPlatform} test cases filtered by platform)`)
    );
  }
  console.log('');
}

/**
 * Print warnings
 */
export function printWarnings(warnings: string[]): void {
  if (warnings.length === 0) return;

  console.log(chalk.yellow.bold('Warnings:'));
  for (const warning of warnings) {
    console.log(chalk.yellow(`  ⚠ ${warning}`));
  }
  console.log('');
}

/**
 * Print results for each test case
 */
export function printTestCaseResults(results: TestCaseResult[]): void {
  console.log(chalk.bold('Test Cases:'));
  console.log('');

  for (const result of results) {
    printTestCaseResult(result);
  }
}

function printTestCaseResult(result: TestCaseResult): void {
  const { testCase, status, jestResult, locations, error } = result;

  // Status icon and color
  let statusIcon: string;
  let statusText: string;

  switch (status) {
    case 'PASS':
      statusIcon = chalk.green('✓');
      statusText = chalk.green('PASS');
      break;
    case 'FAIL':
      statusIcon = chalk.red('✗');
      statusText = chalk.red('FAIL');
      break;
    case 'NOT_FOUND':
      statusIcon = chalk.yellow('?');
      statusText = chalk.yellow('NOT FOUND');
      break;
    case 'ERROR':
      statusIcon = chalk.red('!');
      statusText = chalk.red('ERROR');
      break;
  }

  console.log(`${statusIcon} ${statusText} ${chalk.cyan(testCase.jiraKey)}`);
  console.log(`  ${chalk.gray('Title:')} ${testCase.summary}`);

  if (testCase.labels.length > 0) {
    console.log(`  ${chalk.gray('Labels:')} ${testCase.labels.join(', ')}`);
  }

  // Print locations if available
  if (locations && locations.locations.length > 0) {
    console.log(`  ${chalk.gray('Location(s):')}`);
    for (const loc of locations.locations) {
      console.log(`    ${chalk.blue(formatLocation(loc))}`);
    }
  }

  // Print failure message if failed
  if (status === 'FAIL' && jestResult?.failureMessage) {
    console.log(`  ${chalk.gray('Failure:')}`);
    const snippet = getFailureSnippet(jestResult.failureMessage);
    console.log(chalk.red(`    ${snippet}`));
  }

  // Print error if present
  if (error) {
    console.log(`  ${chalk.red('Error:')} ${error}`);
  }

  console.log('');
}

/**
 * Print the summary line
 */
export function printSummary(results: TestCaseResult[]): void {
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  const notFound = results.filter((r) => r.status === 'NOT_FOUND').length;
  const errors = results.filter((r) => r.status === 'ERROR').length;

  console.log(chalk.gray('─'.repeat(50)));
  console.log(chalk.bold('Summary:'));

  const parts: string[] = [];

  if (passed > 0) {
    parts.push(chalk.green(`${passed} passed`));
  }
  if (failed > 0) {
    parts.push(chalk.red(`${failed} failed`));
  }
  if (notFound > 0) {
    parts.push(chalk.yellow(`${notFound} not found`));
  }
  if (errors > 0) {
    parts.push(chalk.red(`${errors} errors`));
  }

  if (parts.length === 0) {
    console.log(chalk.gray('  No test cases'));
  } else {
    console.log(`  ${parts.join(', ')}`);
  }

  console.log('');
}

/**
 * Print message when no test cases found
 */
export function printNoTestCases(jiraKey: string): void {
  console.log('');
  console.log(chalk.yellow(`No test cases found for ${jiraKey}`));
  console.log('');
}

/**
 * Print dry run command preview
 */
export function printDryRunCommand(command: string): void {
  console.log(chalk.bold('Command that would be executed:'));
  console.log(chalk.cyan(`  ${command}`));
  console.log('');
}

/**
 * Print error message
 */
export function printError(message: string, details?: string): void {
  console.error('');
  console.error(chalk.red.bold('Error:'), message);
  if (details) {
    console.error(chalk.gray(details));
  }
  console.error('');
}

/**
 * Get a concise failure snippet from Jest output
 */
function getFailureSnippet(message: string): string {
  const lines = message.split('\n').filter((l) => l.trim());

  // Find the most relevant error line
  for (const line of lines) {
    if (
      line.includes('Expected') ||
      line.includes('Received') ||
      line.includes('Error:') ||
      line.includes('AssertionError')
    ) {
      return line.trim().slice(0, 120);
    }
  }

  // Fall back to first non-empty line
  return lines[0]?.trim().slice(0, 120) || 'Unknown error';
}
