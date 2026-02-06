/**
 * Jest Test Runner
 * Executes Jest with the specified test name pattern
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface JestRunnerOptions {
  jestCmd: string;
  repoPath: string;
  pattern: string;
  dryRun: boolean;
}

export interface TestResult {
  title: string;
  status: 'passed' | 'failed';
  failureMessage?: string;
  duration?: number;
}

export interface FileCoverageData {
  file: string;
  statements: number;
  branches: number;
  functions: number;
  lines: number;
}

export interface CoverageData {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  files: FileCoverageData[];
  filtered: boolean;
}

export interface JestRunResult {
  success: boolean;
  exitCode: number;
  testResults: TestResult[];
  testFilePaths: string[];
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  coverage?: CoverageData;
  rawOutput: string;
  error?: string;
}

/**
 * Run Jest with the specified test name pattern
 */
export async function runJest(options: JestRunnerOptions): Promise<JestRunResult> {
  const { jestCmd, repoPath, pattern, dryRun } = options;

  if (dryRun) {
    return createDryRunResult(pattern);
  }

  const args = [
    '--testNamePattern',
    pattern,
    '--json',
    '--testLocationInResults',
    '--coverage',
    '--coverageReporters=json-summary',
  ];

  return new Promise((resolve) => {
    const cwd = path.resolve(repoPath);
    let stdout = '';
    let stderr = '';

    // Determine if jestCmd is an npm script or direct command
    const isNpmScript = jestCmd.startsWith('npm ') || jestCmd.startsWith('yarn ') || jestCmd.startsWith('pnpm ');

    let command: string;
    let spawnArgs: string[];

    if (isNpmScript) {
      const parts = jestCmd.split(/\s+/);
      command = parts[0];
      spawnArgs = [...parts.slice(1), '--', ...args];
    } else {
      // Try to find jest in node_modules first
      const localJest = path.join(cwd, 'node_modules', '.bin', jestCmd);
      command = jestCmd;
      spawnArgs = args;

      // Check if we should use local jest
      try {
        require('fs').accessSync(localJest);
        command = localJest;
      } catch {
        // Use global or specified command
      }
    }

    const child = spawn(command, spawnArgs, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      const result = parseJestOutput(stdout, stderr, exitCode ?? 1);
      result.coverage = readCoverageSummary(cwd, result.testFilePaths);
      resolve(result);
    });

    child.on('error', (err) => {
      resolve({
        success: false,
        exitCode: 1,
        testResults: [],
        testFilePaths: [],
        summary: { total: 0, passed: 0, failed: 0 },
        rawOutput: stderr || stdout,
        error: `Failed to run Jest: ${err.message}`,
      });
    });
  });
}

/**
 * Parse Jest JSON output to extract test results
 */
function parseJestOutput(
  stdout: string,
  stderr: string,
  exitCode: number
): JestRunResult {
  const rawOutput = stdout + stderr;

  // Try to extract JSON from output (Jest outputs JSON mixed with other content)
  const jsonMatch = stdout.match(/\{[\s\S]*"numTotalTests"[\s\S]*\}/);

  if (!jsonMatch) {
    return {
      success: exitCode === 0,
      exitCode,
      testResults: [],
      testFilePaths: [],
      summary: { total: 0, passed: 0, failed: 0 },
      rawOutput,
      error: exitCode !== 0 ? 'Failed to parse Jest output' : undefined,
    };
  }

  try {
    const json = JSON.parse(jsonMatch[0]);
    const testResults: TestResult[] = [];
    const testFilePaths: string[] = [];

    for (const testFile of json.testResults || []) {
      if (testFile.testFilePath) {
        testFilePaths.push(testFile.testFilePath);
      }
      for (const assertion of testFile.assertionResults || []) {
        testResults.push({
          title: assertion.title,
          status: assertion.status === 'passed' ? 'passed' : 'failed',
          failureMessage: assertion.failureMessages?.join('\n'),
          duration: assertion.duration,
        });
      }
    }

    return {
      success: json.success === true,
      exitCode,
      testResults,
      testFilePaths,
      summary: {
        total: json.numTotalTests || 0,
        passed: json.numPassedTests || 0,
        failed: json.numFailedTests || 0,
      },
      rawOutput,
    };
  } catch {
    return {
      success: false,
      exitCode,
      testResults: [],
      testFilePaths: [],
      summary: { total: 0, passed: 0, failed: 0 },
      rawOutput,
      error: 'Failed to parse Jest JSON output',
    };
  }
}

/**
 * Create a mock result for dry run mode
 */
function createDryRunResult(pattern: string): JestRunResult {
  return {
    success: true,
    exitCode: 0,
    testResults: [],
    testFilePaths: [],
    summary: { total: 0, passed: 0, failed: 0 },
    rawOutput: `[DRY RUN] Would run Jest with pattern: ${pattern}`,
  };
}

/**
 * Read coverage summary from the json-summary reporter output
 */
function readCoverageSummary(
  cwd: string,
  testFilePaths?: string[]
): CoverageData | undefined {
  const coveragePath = path.join(cwd, 'coverage', 'coverage-summary.json');

  try {
    const raw = fs.readFileSync(coveragePath, 'utf-8');
    const json = JSON.parse(raw);
    const total = json.total;

    if (!total) return undefined;

    // Derive source file names from test file paths
    // e.g. "client.test.ts" → "client.ts", "Button.spec.tsx" → "Button.tsx"
    const relevantSourceFiles = new Set<string>();
    if (testFilePaths && testFilePaths.length > 0) {
      for (const testPath of testFilePaths) {
        const basename = path.basename(testPath);
        const sourceFile = basename.replace(/\.(test|spec)\./, '.');
        relevantSourceFiles.add(sourceFile);
      }
    }

    const filtered = relevantSourceFiles.size > 0;
    const allFiles: FileCoverageData[] = [];
    const matchedFiles: FileCoverageData[] = [];

    for (const [key, value] of Object.entries(json)) {
      if (key === 'total') continue;
      const fileName = path.basename(key);
      const data = value as Record<string, { pct?: number }>;
      const fileData: FileCoverageData = {
        file: fileName,
        statements: data.statements?.pct ?? 0,
        branches: data.branches?.pct ?? 0,
        functions: data.functions?.pct ?? 0,
        lines: data.lines?.pct ?? 0,
      };

      allFiles.push(fileData);
      if (relevantSourceFiles.has(fileName)) {
        matchedFiles.push(fileData);
      }
    }

    // Use matched files if filtering found results, otherwise fall back to all
    const files = filtered && matchedFiles.length > 0 ? matchedFiles : allFiles;

    return {
      statements: total.statements?.pct ?? 0,
      branches: total.branches?.pct ?? 0,
      functions: total.functions?.pct ?? 0,
      lines: total.lines?.pct ?? 0,
      files,
      filtered: filtered && matchedFiles.length > 0,
    };
  } catch {
    return undefined;
  }
}

/**
 * Build the Jest command for display purposes
 */
export function buildJestCommand(options: JestRunnerOptions): string {
  return `${options.jestCmd} --testNamePattern "${options.pattern}"`;
}
