/**
 * Run Command Implementation
 * Orchestrates the test run flow
 */

import { randomUUID } from 'crypto';
import { loadConfig, ConfigError } from '../config';
import { JiraClient, JiraClientError } from '../jira/client';
import { collectTestCases } from '../jira/collector';
import { Platform } from '../jira/types';
import { createTestPattern } from '../matcher';
import { runJest, buildJestCommand, JestRunResult, CoverageData } from '../runner/jest';
import { locateTests, LocatorResult } from '../locator';
import {
  printHeader,
  printWarnings,
  printTestCaseResults,
  printSummary,
  printNoTestCases,
  printDryRunCommand,
  printError,
  TestCaseResult,
  TestCaseStatus,
} from '../reporter/terminal';
import { writeJsonReport } from '../reporter/json';
import { EXIT_CODES, RunOptions, parsePlatform } from '../cli';

export async function runCommand(
  jiraKey: string,
  options: RunOptions
): Promise<number> {
  try {
    // Validate platform option
    let platform: Platform;
    try {
      platform = parsePlatform(options.platform);
    } catch (err) {
      printError(err instanceof Error ? err.message : String(err));
      return EXIT_CODES.CONFIG_ERROR;
    }

    // Load configuration
    const config = loadConfig();

    // Create Jira client
    const client = new JiraClient(config.jira);

    // Collect test cases from Jira
    const collectorResult = await collectTestCases(client, jiraKey, {
      linkType: options.linkType,
      platform,
    });

    // Handle no test cases
    if (collectorResult.testCases.length === 0) {
      printNoTestCases(jiraKey);

      await writeJsonReport({
        jiraKey,
        parentSummary: collectorResult.parentIssue.summary,
        platform,
        linkType: options.linkType,
        matchMode: options.mode,
        testCaseResults: [],
        isDryRun: options.dry,
        outputPath: options.reportJson,
      });

      return EXIT_CODES.SUCCESS;
    }

    // Create test pattern
    const matchResult = createTestPattern(collectorResult.testCases, {
      mode: options.mode as 'title',
    });

    // Print header
    printHeader({
      jiraKey,
      parentSummary: collectorResult.parentIssue.summary,
      platform,
      testCaseResults: [],
      skippedByPlatform: collectorResult.skippedByPlatform,
      isDryRun: options.dry,
      warnings: matchResult.warnings,
    });

    // Print warnings
    printWarnings(matchResult.warnings);

    // Locate tests if requested
    let locationResults: Map<string, LocatorResult> | undefined;
    if (options.locate) {
      const titles = collectorResult.testCases.map((tc) => tc.summary);
      const locatorResults = await locateTests({
        repoPath: options.repo,
        titles,
      });
      locationResults = new Map(locatorResults.map((r) => [r.title, r]));
    }

    // Dry run mode
    if (options.dry) {
      const command = buildJestCommand({
        jestCmd: options.jestCmd,
        repoPath: options.repo,
        pattern: matchResult.pattern,
        dryRun: true,
      });
      printDryRunCommand(command);

      // Build results for dry run (all NOT_FOUND since we don't run tests)
      const testCaseResults: TestCaseResult[] = collectorResult.testCases.map(
        (testCase) => ({
          testCase,
          status: 'NOT_FOUND' as TestCaseStatus,
          locations: locationResults?.get(testCase.summary),
        })
      );

      printTestCaseResults(testCaseResults);
      printSummary(testCaseResults);

      await writeJsonReport({
        jiraKey,
        parentSummary: collectorResult.parentIssue.summary,
        platform,
        linkType: options.linkType,
        matchMode: options.mode,
        testCaseResults,
        isDryRun: true,
        outputPath: options.reportJson,
      });

      return EXIT_CODES.SUCCESS;
    }

    // Run Jest
    const jestResult = await runJest({
      jestCmd: options.jestCmd,
      repoPath: options.repo,
      pattern: matchResult.pattern,
      dryRun: false,
    });

    // Map Jest results to test cases
    const testCaseResults = mapResultsToTestCases(
      collectorResult.testCases,
      jestResult,
      locationResults
    );

    // Print results
    printTestCaseResults(testCaseResults);
    printSummary(testCaseResults);

    // Post comments to Jira
    if (options.comment) {
      await postJiraComments(client, jiraKey, testCaseResults, jestResult.coverage);
    }

    // Write JSON report
    await writeJsonReport({
      jiraKey,
      parentSummary: collectorResult.parentIssue.summary,
      platform,
      linkType: options.linkType,
      matchMode: options.mode,
      testCaseResults,
      isDryRun: false,
      outputPath: options.reportJson,
    });

    // Determine exit code
    const hasFailures = testCaseResults.some(
      (r) => r.status === 'FAIL' || r.status === 'ERROR'
    );

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

/**
 * Post comments to Jira for test results
 */
async function postJiraComments(
  client: JiraClient,
  parentKey: string,
  testCaseResults: TestCaseResult[],
  coverage?: CoverageData
): Promise<void> {
  // Post comment on each passing subtask
  for (const result of testCaseResults) {
    if (result.status === 'PASS') {
      const duration = result.jestResult?.duration
        ? `${result.jestResult.duration}ms`
        : 'N/A';

      const comment = [
        `✅ Test Passed`,
        `Test: "${result.testCase.summary}"`,
        `Duration: ${duration}`,
        `Run by: jira-test CLI`,
      ].join('\n');

      try {
        await client.addComment(result.testCase.jiraKey, comment);
      } catch (err) {
        console.error(
          `Warning: Failed to post comment on ${result.testCase.jiraKey}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // Post rich summary comment on parent ticket
  const textBody = buildParentCommentText(testCaseResults, coverage);
  const adfBody = buildParentCommentAdf(testCaseResults, coverage);

  try {
    await client.addComment(parentKey, textBody, adfBody);
  } catch (err) {
    console.error(
      `Warning: Failed to post summary comment on ${parentKey}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Plain text builder (v2 / DC / Server fallback)
// ---------------------------------------------------------------------------

function buildParentCommentText(
  testCaseResults: TestCaseResult[],
  coverage?: CoverageData
): string {
  const passed = testCaseResults.filter((r) => r.status === 'PASS').length;
  const failed = testCaseResults.filter((r) => r.status === 'FAIL').length;
  const notFound = testCaseResults.filter((r) => r.status === 'NOT_FOUND').length;
  const total = testCaseResults.length;

  const lines: string[] = [
    `🧪 Test Run Summary`,
    `${total} subtasks tested — ${passed} passed · ${failed} failed · ${notFound} not found`,
    '',
    'Test Results:',
  ];

  for (const r of testCaseResults) {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    const dur = r.jestResult?.duration ? `${r.jestResult.duration}ms` : '-';
    lines.push(`  ${icon} ${r.testCase.jiraKey} — "${r.testCase.summary}" (${dur})`);
  }

  if (coverage) {
    // Component Coverage - show files directly related to tests
    if (coverage.componentFiles.length > 0) {
      lines.push('');
      lines.push('Component Coverage:');
      for (const f of coverage.componentFiles) {
        lines.push(`  ${f.file} — Stmts: ${f.statements}% | Branch: ${f.branches}% | Funcs: ${f.functions}% | Lines: ${f.lines}%`);
      }
    }

    // Overall Coverage - show all files or summary
    lines.push('');
    lines.push('Overall Coverage:');
    if (!coverage.filtered) {
      lines.push(`  All files — Stmts: ${coverage.statements}% | Branch: ${coverage.branches}% | Funcs: ${coverage.functions}% | Lines: ${coverage.lines}%`);
    }
    for (const f of coverage.files) {
      lines.push(`  ${f.file} — Stmts: ${f.statements}% | Branch: ${f.branches}% | Funcs: ${f.functions}% | Lines: ${f.lines}%`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// ADF (Atlassian Document Format) builder for Jira Cloud (v3)
// ---------------------------------------------------------------------------

function buildParentCommentAdf(
  testCaseResults: TestCaseResult[],
  coverage?: CoverageData
): unknown {
  const passed = testCaseResults.filter((r) => r.status === 'PASS').length;
  const failed = testCaseResults.filter((r) => r.status === 'FAIL').length;
  const notFound = testCaseResults.filter((r) => r.status === 'NOT_FOUND').length;
  const total = testCaseResults.length;

  const panelType = failed > 0 ? 'error' : notFound > 0 ? 'warning' : 'success';

  const content: unknown[] = [];

  // Title
  content.push(adfHeading(3, '🧪 Test Run Summary'));

  // Summary panel
  content.push(
    adfPanel(panelType, [
      adfParagraph([
        adfText(`${total} subtasks tested`, [{ type: 'strong' }]),
        adfText('  —  '),
        adfText(`${passed} passed`, [{ type: 'strong' }, { type: 'textColor', attrs: { color: '#36b37e' } }]),
        adfText('  ·  '),
        adfText(`${failed} failed`, failed > 0 ? [{ type: 'strong' }, { type: 'textColor', attrs: { color: '#ff5630' } }] : []),
        adfText('  ·  '),
        adfText(`${notFound} not found`, notFound > 0 ? [{ type: 'textColor', attrs: { color: '#ff991f' } }] : []),
      ]),
    ])
  );

  // Test results table
  content.push(adfHeading(4, 'Test Results'));

  const testTableHeader = adfTableRow(
    [
      adfTableHeaderCell([adfParagraph([adfText('Subtask', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Test Name', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Status', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Duration', [{ type: 'strong' }])])]),
    ]
  );

  const testTableRows = testCaseResults.map((r) => {
    let statusColor: string;
    let statusLabel: string;
    switch (r.status) {
      case 'PASS':
        statusColor = 'green';
        statusLabel = 'PASSED';
        break;
      case 'FAIL':
        statusColor = 'red';
        statusLabel = 'FAILED';
        break;
      case 'NOT_FOUND':
        statusColor = 'yellow';
        statusLabel = 'NOT FOUND';
        break;
      default:
        statusColor = 'red';
        statusLabel = 'ERROR';
    }

    const duration = r.jestResult?.duration ? `${r.jestResult.duration}ms` : '-';

    return adfTableRow([
      adfTableCell([adfParagraph([adfText(r.testCase.jiraKey)])]),
      adfTableCell([adfParagraph([adfText(r.testCase.summary)])]),
      adfTableCell([adfParagraph([adfStatus(statusLabel, statusColor)])]),
      adfTableCell([adfParagraph([adfText(duration)])]),
    ]);
  });

  content.push(adfTable([testTableHeader, ...testTableRows]));

  // Coverage tables
  if (coverage) {
    content.push(adfRule());

    const coverageHeader = adfTableRow([
      adfTableHeaderCell([adfParagraph([adfText('File', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Statements', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Branches', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Functions', [{ type: 'strong' }])])]),
      adfTableHeaderCell([adfParagraph([adfText('Lines', [{ type: 'strong' }])])]),
    ]);

    // Component Coverage - files directly tested
    if (coverage.componentFiles.length > 0) {
      content.push(adfHeading(4, '🎯 Component Coverage'));
      content.push(adfParagraph([adfText('Coverage for components directly tested by this ticket:', [])]));

      const componentRows: unknown[] = [];
      for (const f of coverage.componentFiles) {
        componentRows.push(adfTableRow([
          adfTableCell([adfParagraph([adfText(f.file, [{ type: 'code' }])])]),
          adfTableCell([adfParagraph([adfColoredPct(f.statements)])]),
          adfTableCell([adfParagraph([adfColoredPct(f.branches)])]),
          adfTableCell([adfParagraph([adfColoredPct(f.functions)])]),
          adfTableCell([adfParagraph([adfColoredPct(f.lines)])]),
        ]));
      }
      content.push(adfTable([coverageHeader, ...componentRows]));
    }

    // Overall Coverage
    content.push(adfHeading(4, '📊 Overall Coverage'));

    const overallRows: unknown[] = [];

    if (!coverage.filtered) {
      overallRows.push(adfTableRow([
        adfTableCell([adfParagraph([adfText('All files', [{ type: 'strong' }])])]),
        adfTableCell([adfParagraph([adfColoredPct(coverage.statements)])]),
        adfTableCell([adfParagraph([adfColoredPct(coverage.branches)])]),
        adfTableCell([adfParagraph([adfColoredPct(coverage.functions)])]),
        adfTableCell([adfParagraph([adfColoredPct(coverage.lines)])]),
      ]));
    }

    for (const f of coverage.files) {
      overallRows.push(adfTableRow([
        adfTableCell([adfParagraph([adfText(f.file, [{ type: 'code' }])])]),
        adfTableCell([adfParagraph([adfColoredPct(f.statements)])]),
        adfTableCell([adfParagraph([adfColoredPct(f.branches)])]),
        adfTableCell([adfParagraph([adfColoredPct(f.functions)])]),
        adfTableCell([adfParagraph([adfColoredPct(f.lines)])]),
      ]));
    }

    content.push(adfTable([coverageHeader, ...overallRows]));
  }

  return adfDoc(content);
}

// ---------------------------------------------------------------------------
// ADF node helpers
// ---------------------------------------------------------------------------

function adfDoc(content: unknown[]): unknown {
  return { version: 1, type: 'doc', content };
}

function adfHeading(level: number, text: string): unknown {
  return { type: 'heading', attrs: { level }, content: [adfText(text)] };
}

function adfParagraph(content: unknown[]): unknown {
  return { type: 'paragraph', content };
}

function adfText(text: string, marks?: unknown[]): unknown {
  const node: Record<string, unknown> = { type: 'text', text };
  if (marks && marks.length > 0) node.marks = marks;
  return node;
}

function adfStatus(text: string, color: string): unknown {
  return { type: 'status', attrs: { text, color, localId: randomUUID(), style: '' } };
}

function adfPanel(panelType: string, content: unknown[]): unknown {
  return { type: 'panel', attrs: { panelType }, content };
}

function adfRule(): unknown {
  return { type: 'rule' };
}

function adfTable(rows: unknown[]): unknown {
  return { type: 'table', attrs: { isNumberColumnEnabled: false, layout: 'default' }, content: rows };
}

function adfTableRow(cells: unknown[]): unknown {
  return { type: 'tableRow', content: cells };
}

function adfTableHeaderCell(content: unknown[]): unknown {
  return { type: 'tableHeader', content };
}

function adfTableCell(content: unknown[]): unknown {
  return { type: 'tableCell', content };
}

function adfColoredPct(pct: number): unknown {
  const color = pct >= 80 ? '#36b37e' : pct >= 50 ? '#ff991f' : '#ff5630';
  return adfText(`${pct}%`, [{ type: 'strong' }, { type: 'textColor', attrs: { color } }]);
}

/**
 * Map Jest results to test cases
 */
function mapResultsToTestCases(
  testCases: Array<{
    jiraKey: string;
    summary: string;
    labels: string[];
    source: 'subtask' | 'linked';
  }>,
  jestResult: JestRunResult,
  locationResults?: Map<string, LocatorResult>
): TestCaseResult[] {
  return testCases.map((testCase) => {
    // Find matching Jest result by title (exact match)
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
      locations: locationResults?.get(testCase.summary),
    };
  });
}
