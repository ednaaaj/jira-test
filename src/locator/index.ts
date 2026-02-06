/**
 * Test Locator Module
 * Finds test definitions in the codebase by title
 * Uses ripgrep if available, falls back to pure Node.js scanning
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { escapeRegex } from '../matcher/regex';

export interface TestLocation {
  file: string;
  line: number;
  column?: number;
  match: string;
}

export interface LocatorResult {
  title: string;
  locations: TestLocation[];
  error?: string;
}

export interface LocatorOptions {
  repoPath: string;
  titles: string[];
}

/**
 * Locate test definitions for given titles
 */
export async function locateTests(
  options: LocatorOptions
): Promise<LocatorResult[]> {
  const { repoPath, titles } = options;

  const results: LocatorResult[] = [];

  for (const title of titles) {
    try {
      const locations = await findTestLocations(repoPath, title);
      results.push({ title, locations });
    } catch (err) {
      results.push({
        title,
        locations: [],
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}

/**
 * Find locations of a specific test title in the codebase
 */
async function findTestLocations(
  repoPath: string,
  title: string
): Promise<TestLocation[]> {
  // Try ripgrep first (faster)
  const hasRipgrep = await checkRipgrepAvailable();

  if (hasRipgrep) {
    return findWithRipgrep(repoPath, title);
  }

  // Fall back to Node.js scanning
  return findWithNode(repoPath, title);
}

/**
 * Check if ripgrep is available
 */
async function checkRipgrepAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('rg', ['--version'], { shell: true });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

/**
 * Find test locations using ripgrep
 */
async function findWithRipgrep(
  repoPath: string,
  title: string
): Promise<TestLocation[]> {
  return new Promise((resolve, reject) => {
    const escapedTitle = escapeRegex(title);
    // Match it("title") or test("title") with various quote styles
    const pattern = `(it|test)\\s*\\(\\s*["'\`]${escapedTitle}["'\`]`;

    const args = [
      '--line-number',
      '--column',
      '--no-heading',
      '--type',
      'js',
      '--type',
      'ts',
      '--type-add',
      'tsx:*.tsx',
      '--type',
      'tsx',
      '--type-add',
      'jsx:*.jsx',
      '--type',
      'jsx',
      pattern,
      repoPath,
    ];

    let stdout = '';
    let stderr = '';

    const child = spawn('rg', args, { shell: true });

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        // code 1 means no matches (not an error)
        if (stderr) {
          reject(new Error(`ripgrep error: ${stderr}`));
          return;
        }
      }

      const locations = parseRipgrepOutput(stdout, repoPath);
      resolve(locations);
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Parse ripgrep output into TestLocation objects
 */
export function parseRipgrepOutput(
  output: string,
  repoPath: string
): TestLocation[] {
  if (!output.trim()) {
    return [];
  }

  const locations: TestLocation[] = [];
  const lines = output.trim().split('\n');

  for (const line of lines) {
    // Format: file:line:column:match
    const match = line.match(/^(.+?):(\d+):(\d+):(.*)$/);
    if (match) {
      const [, filePath, lineNum, colNum, matchText] = match;
      const relativePath = path.relative(repoPath, filePath);

      locations.push({
        file: relativePath || filePath,
        line: parseInt(lineNum, 10),
        column: parseInt(colNum, 10),
        match: matchText.trim(),
      });
    }
  }

  return locations;
}

/**
 * Find test locations using pure Node.js (fallback)
 */
async function findWithNode(
  repoPath: string,
  title: string
): Promise<TestLocation[]> {
  const locations: TestLocation[] = [];
  const testFilePattern = /\.(test|spec)\.(js|ts|jsx|tsx)$/;
  const escapedTitle = escapeRegex(title);
  const regex = new RegExp(`(it|test)\\s*\\(\\s*["'\`]${escapedTitle}["'\`]`);

  async function scanDir(dir: string): Promise<void> {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip node_modules and hidden directories
      if (entry.name.startsWith('.') || entry.name === 'node_modules') {
        continue;
      }

      if (entry.isDirectory()) {
        await scanDir(fullPath);
      } else if (testFilePattern.test(entry.name)) {
        await scanFile(fullPath);
      }
    }
  }

  async function scanFile(filePath: string): Promise<void> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = regex.exec(line);

      if (match) {
        const relativePath = path.relative(repoPath, filePath);
        locations.push({
          file: relativePath,
          line: i + 1,
          column: match.index + 1,
          match: line.trim(),
        });
      }
    }
  }

  await scanDir(repoPath);
  return locations;
}

/**
 * Format location for display
 */
export function formatLocation(location: TestLocation): string {
  return `${location.file}:${location.line}`;
}
