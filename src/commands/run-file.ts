/**
 * Run File Command
 * Runs a specific test file and posts coverage to Jira
 */

import * as fs from 'fs';
import * as path from 'path';
import ora from 'ora';
import { loadConfig, ConfigError } from '../config';
import { JiraClient, JiraClientError } from '../jira/client';
import { collectTestCases } from '../jira/collector';
import { runJest } from '../runner/jest';
import {
  printError,
  TestCaseResult,
  TestCaseStatus,
} from '../reporter/terminal';
import { writeJsonReport } from '../reporter/json';
import { EXIT_CODES } from '../cli';
import { postJiraComments } from './run';

export interface RunFileOptions {
  comment: boolean;
  dry: boolean;
}

/**
 * Extract Jira ticket key from test file
 * Looks for patterns like: describe('HOTEL-27752', ...) or describe("HOTEL-27752", ...)
 */
function extractJiraKeyFromFile(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');

    // Match describe('TICKET-123', ...) or describe("TICKET-123", ...)
    const describePattern = /describe\s*\(\s*['"`]([A-Z]+-\d+)['"`]/;
    const match = content.match(describePattern);

    return match ? match[1] : null;
  } catch (err) {
    return null;
  }
}

/**
 * Detect test runner from package.json
 */
function detectTestRunner(startDir: string): { runner: string; command: string } {
  let currentDir = startDir;

  // Walk up to find package.json
  while (currentDir !== path.dirname(currentDir)) {
    const packageJsonPath = path.join(currentDir, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies,
        };

        // Check for test runners
        if (deps['vitest']) {
          return { runner: 'vitest', command: 'vitest run' };
        }
        if (deps['jest'] || deps['@jest/core']) {
          return { runner: 'jest', command: 'jest' };
        }
        if (deps['mocha']) {
          return { runner: 'mocha', command: 'mocha' };
        }
      } catch {
        // Continue searching
      }
    }

    currentDir = path.dirname(currentDir);
  }

  // Default to jest
  return { runner: 'jest', command: 'jest' };
}

/**
 * Run a specific test file and post results to Jira
 */
export async function runFileCommand(
  testFilePath: string,
  options: RunFileOptions
): Promise<number> {
  try {
    // Resolve absolute path
    const absolutePath = path.resolve(testFilePath);

    if (!fs.existsSync(absolutePath)) {
      printError('File not found', absolutePath);
      return EXIT_CODES.CONFIG_ERROR;
    }

    console.log('');
    console.log(`🧪 JIRA Test Runner (File Mode)`);
    console.log(`Test file: ${path.basename(absolutePath)}`);

    // Extract Jira key from file
    const jiraKey = extractJiraKeyFromFile(absolutePath);

    if (!jiraKey) {
      printError(
        'No Jira ticket found in test file',
        'Add a describe block with a Jira ticket key (e.g., describe(\'HOTEL-27752\', ...))'
      );
      return EXIT_CODES.CONFIG_ERROR;
    }

    console.log(`Jira ticket: ${jiraKey}`);

    // Detect test runner
    const testDir = path.dirname(absolutePath);
    const { runner, command } = detectTestRunner(testDir);
    console.log(`Test runner: ${runner}`);
    console.log('');

    // Find repo root (where package.json is)
    let repoRoot = testDir;
    while (repoRoot !== path.dirname(repoRoot)) {
      if (fs.existsSync(path.join(repoRoot, 'package.json'))) {
        break;
      }
      repoRoot = path.dirname(repoRoot);
    }

    // Run tests - use the specific test file instead of just the pattern
    const testSpinner = ora('Running tests...').start();
    const jestResult = await runJest({
      jestCmd: `${command} ${absolutePath}`,
      repoPath: repoRoot,
      pattern: jiraKey,
      dryRun: options.dry,
    });

    testSpinner.succeed(`${jestResult.summary.total} tests ran — ${jestResult.summary.passed} passed · ${jestResult.summary.failed} failed`);
    console.log('');

    // Load Jira config
    const config = loadConfig();
    const client = new JiraClient(config.jira);

    // Fetch Jira ticket
    const jiraSpinner = ora(`Fetching Jira ticket ${jiraKey}...`).start();
    const collectorResult = await collectTestCases(client, jiraKey, {
      linkType: 'is tested by',
      platform: 'all',
    });

    jiraSpinner.succeed(`Found ${collectorResult.testCases.length} subtasks in ${jiraKey}`);
    console.log('');

    // Derive component file name from test file
    const testFileName = path.basename(absolutePath);
    const componentFileName = testFileName.replace(/\.(test|spec)\./, '.');

    console.log(`Looking for coverage of: ${componentFileName}`);
    console.log('');

    // Filter coverage to only show the component being tested
    if (jestResult.coverage) {
      jestResult.coverage.componentFiles = jestResult.coverage.componentFiles.filter(
        f => f.file === componentFileName
      );
      jestResult.coverage.files = jestResult.coverage.files.filter(
        f => f.file === componentFileName
      );
    }

    // Build test case results (compare subtasks with test results)
    const testCaseResults: TestCaseResult[] = collectorResult.testCases.map((testCase) => {
      const matchingResult = jestResult.testResults.find(
        (r) => r.title === testCase.summary
      );

      let status: TestCaseStatus;
      if (!matchingResult) {
        status = 'NOT_FOUND';
      } else if (matchingResult.status === 'passed') {
        status = 'PASS';
      } else {
        status = 'FAIL';
      }

      return {
        testCase,
        status,
        jestResult: matchingResult,
      };
    });

    // Post to Jira
    if (options.comment) {
      const postSpinner = ora(`Posting results to Jira...`).start();
      await postJiraComments(
        client,
        jiraKey,
        testCaseResults,
        jestResult.coverage,
        'ticket-key',
        jestResult.summary
      );
      postSpinner.succeed(`Posted coverage and results to ${jiraKey}`);
    }

    // Write JSON report
    await writeJsonReport({
      jiraKey,
      parentSummary: collectorResult.parentIssue.summary,
      platform: 'all',
      linkType: 'is tested by',
      matchMode: 'ticket-key',
      testCaseResults,
      isDryRun: options.dry,
      outputPath: '.jira-test-report.json',
    });

    console.log('');
    console.log(`✓ Report saved to .jira-test-report.json`);
    console.log('');

    // Exit code
    const hasFailures = jestResult.summary.failed > 0;
    return hasFailures ? EXIT_CODES.TEST_FAILURE : EXIT_CODES.SUCCESS;

  } catch (err) {
    if (err instanceof ConfigError) {
      printError('Configuration error', err.message);
      return EXIT_CODES.CONFIG_ERROR;
    }

    if (err instanceof JiraClientError) {
      printError('Jira API error', err.message);
      return EXIT_CODES.JIRA_ERROR;
    }

    printError(
      'Unexpected error',
      err instanceof Error ? err.message : String(err)
    );
    return EXIT_CODES.CONFIG_ERROR;
  }
}
