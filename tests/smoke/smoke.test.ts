/**
 * Smoke tests for jira-test CLI
 * Runs the CLI with mocked Jira data to verify end-to-end flow
 */

import { spawn, SpawnOptions } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { sampleIssueWithTestCases, createMockSearchResponse } from '../mocks/jira-responses';

const CLI_PATH = path.join(__dirname, '../../bin/jira-test.js');
const REPORT_PATH = path.join(__dirname, '../../.jira-test-report.json');

// Mock server to simulate Jira API
let mockServer: http.Server;
let mockServerPort: number;

function startMockServer(): Promise<number> {
  return new Promise((resolve) => {
    mockServer = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'application/json');

      // Handle API version detection
      if (req.url?.includes('/rest/api/3/myself')) {
        res.writeHead(200);
        res.end(JSON.stringify({ accountId: 'mock-user' }));
        return;
      }

      // Handle issue fetch
      if (req.url?.includes('/rest/api/3/issue/HOTEL-27735')) {
        res.writeHead(200);
        res.end(JSON.stringify(sampleIssueWithTestCases));
        return;
      }

      // Handle issue with no test cases
      if (req.url?.includes('/rest/api/3/issue/EMPTY-1')) {
        res.writeHead(200);
        res.end(JSON.stringify({
          key: 'EMPTY-1',
          id: '999',
          fields: {
            summary: 'Empty issue',
            labels: [],
            subtasks: [],
            issuelinks: [],
          },
        }));
        return;
      }

      // Handle search for linked issues
      if (req.url?.includes('/rest/api/3/search')) {
        const searchResponse = createMockSearchResponse([
          {
            key: 'HOTEL-27740',
            id: '40',
            fields: {
              summary: 'should validate guest information',
              labels: [],
            },
          },
          {
            key: 'HOTEL-27741',
            id: '41',
            fields: {
              summary: 'should send confirmation email',
              labels: [],
            },
          },
        ]);
        res.writeHead(200);
        res.end(JSON.stringify(searchResponse));
        return;
      }

      // 404 for unknown requests
      res.writeHead(404);
      res.end(JSON.stringify({ errorMessages: ['Not found'] }));
    });

    mockServer.listen(0, () => {
      const address = mockServer.address();
      if (address && typeof address === 'object') {
        mockServerPort = address.port;
        resolve(mockServerPort);
      }
    });
  });
}

function stopMockServer(): Promise<void> {
  return new Promise((resolve) => {
    if (mockServer) {
      mockServer.close(() => resolve());
    } else {
      resolve();
    }
  });
}

function runCli(
  args: string[],
  env: Record<string, string> = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const spawnEnv = {
      ...process.env,
      ...env,
      NODE_ENV: 'test',
    };

    const options: SpawnOptions = {
      cwd: path.join(__dirname, '../..'),
      env: spawnEnv,
      shell: true,
    };

    const child = spawn('node', [CLI_PATH, ...args], options);

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 });
    });
  });
}

describe('jira-test CLI smoke tests', () => {
  beforeAll(async () => {
    await startMockServer();
  });

  afterAll(async () => {
    await stopMockServer();
    // Clean up report file if exists
    try {
      fs.unlinkSync(REPORT_PATH);
    } catch {
      // Ignore if doesn't exist
    }
  });

  describe('run command with --dry', () => {
    it('should run in dry mode and produce report', async () => {
      const result = await runCli(
        ['run', 'HOTEL-27735', '--dry', '--report-json', REPORT_PATH],
        {
          JIRA_BASE_URL: `http://localhost:${mockServerPort}`,
          JIRA_EMAIL: 'test@example.com',
          JIRA_API_TOKEN: 'test-token',
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('HOTEL-27735');
      expect(result.stdout).toContain('DRY RUN');

      // Verify report was created
      expect(fs.existsSync(REPORT_PATH)).toBe(true);

      const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf-8'));
      expect(report.version).toBe('1.0');
      expect(report.input.jiraKey).toBe('HOTEL-27735');
      expect(report.isDryRun).toBe(true);
      expect(report.testCases.length).toBeGreaterThan(0);
    });

    it('should handle platform filtering', async () => {
      const result = await runCli(
        ['run', 'HOTEL-27735', '--dry', '--platform', 'web'],
        {
          JIRA_BASE_URL: `http://localhost:${mockServerPort}`,
          JIRA_EMAIL: 'test@example.com',
          JIRA_API_TOKEN: 'test-token',
        }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Platform filter: web');
    });
  });

  describe('run command with no test cases', () => {
    it('should exit 0 with message when issue has no test cases', async () => {
      const result = await runCli(['run', 'EMPTY-1', '--dry'], {
        JIRA_BASE_URL: `http://localhost:${mockServerPort}`,
        JIRA_EMAIL: 'test@example.com',
        JIRA_API_TOKEN: 'test-token',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No test cases found');
    });
  });

  describe('configuration errors', () => {
    it('should exit 2 when JIRA_BASE_URL is missing', async () => {
      const result = await runCli(['run', 'TEST-1', '--dry'], {
        // No JIRA_BASE_URL
        JIRA_EMAIL: 'test@example.com',
        JIRA_API_TOKEN: 'test-token',
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('JIRA_BASE_URL');
    });

    it('should exit 2 when auth is missing', async () => {
      const result = await runCli(['run', 'TEST-1', '--dry'], {
        JIRA_BASE_URL: `http://localhost:${mockServerPort}`,
        // No auth
      });

      expect(result.exitCode).toBe(2);
      expect(result.stderr).toContain('authentication');
    });
  });

  describe('help output', () => {
    it('should display help with --help', async () => {
      const result = await runCli(['--help'], {});

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('jira-test');
      expect(result.stdout).toContain('run');
    });

    it('should display run command help', async () => {
      const result = await runCli(['run', '--help'], {});

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('--platform');
      expect(result.stdout).toContain('--link-type');
      expect(result.stdout).toContain('--dry');
      expect(result.stdout).toContain('--locate');
    });
  });
});
