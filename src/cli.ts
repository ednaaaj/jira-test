/**
 * CLI Entry Point
 * Defines commands and options for jira-test
 */

import { Command } from 'commander';
import { runCommand } from './commands/run';
import { runFileCommand } from './commands/run-file';
import { Platform } from './jira/types';

export const EXIT_CODES = {
  SUCCESS: 0,
  TEST_FAILURE: 1,
  CONFIG_ERROR: 2,
  JIRA_ERROR: 3,
} as const;

export interface RunOptions {
  platform: Platform;
  linkType: string;
  mode: string;
  dry: boolean;
  locate: boolean;
  jestCmd: string;
  repo: string;
  reportJson: string;
  comment: boolean;
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('jira-test')
    .description(
      'CLI tool that connects Jira issues to automated tests and runs them locally'
    )
    .version('1.0.0');

  // Default command: smart detection (file path or Jira key)
  program
    .argument('<target>', 'Test file path or Jira ticket key (e.g., calculator.test.ts or HOTEL-27752)')
    .option('--no-comment', 'Disable posting comments to Jira after test run')
    .option('--dry', 'Print what would run without executing tests', false)
    .action(async (target: string, options: { comment: boolean; dry: boolean }) => {
      // Detect if target is a file path or Jira key
      const isFilePath = target.endsWith('.ts') || target.endsWith('.tsx') ||
                         target.endsWith('.js') || target.endsWith('.jsx') ||
                         target.includes('/') || target.includes('\\');

      if (isFilePath) {
        const exitCode = await runFileCommand(target, options);
        process.exit(exitCode);
      } else {
        // Legacy mode: Jira key with full options
        const fullOptions: RunOptions = {
          platform: 'all',
          linkType: 'is tested by',
          mode: 'ticket-key',
          dry: options.dry,
          locate: false,
          jestCmd: 'jest',
          repo: process.cwd(),
          reportJson: '.jira-test-report.json',
          comment: options.comment,
        };
        const exitCode = await runCommand(target, fullOptions);
        process.exit(exitCode);
      }
    });

  // Legacy command for backwards compatibility
  program
    .command('run <jiraKey>')
    .description('Run tests mapped from a Jira ticket (legacy mode)')
    .option('--platform <platform>', 'Platform filter: web, mobile, or all', 'all')
    .option('--link-type <type>', 'Jira link type name for test case links', 'is tested by')
    .option('--mode <mode>', 'Matching mode: "ticket-key" or "title"', 'ticket-key')
    .option('--dry', 'Print what would run without executing tests', false)
    .option('--locate', 'Find and display file locations for matching test titles', false)
    .option('--jest-cmd <command>', 'Jest command to run', 'jest')
    .option('--repo <path>', 'Repository root path', process.cwd())
    .option('--report-json <path>', 'Output JSON report path', '.jira-test-report.json')
    .option('--no-comment', 'Disable posting comments to Jira after test run')
    .action(async (jiraKey: string, options: RunOptions) => {
      const exitCode = await runCommand(jiraKey, options);
      process.exit(exitCode);
    });

  return program;
}

export function parsePlatform(value: string): Platform {
  const normalized = value.toLowerCase();
  if (normalized === 'web' || normalized === 'mobile' || normalized === 'all') {
    return normalized;
  }
  throw new Error(
    `Invalid platform: ${value}. Must be one of: web, mobile, all`
  );
}
