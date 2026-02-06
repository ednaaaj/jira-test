#!/usr/bin/env node

/**
 * jira-test CLI entry point
 *
 * This script loads the compiled TypeScript code and runs the CLI.
 * For development, run: npm run build && node bin/jira-test.js
 * For production: npx jira-test or npm install -g jira-test
 */

// Load environment variables from .env file if present (for local development)
try {
  require('dotenv').config();
} catch {
  // dotenv is optional
}

const { createCli } = require('../dist/cli');

const program = createCli();
program.parse(process.argv);
