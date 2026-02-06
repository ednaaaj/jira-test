# jira-test

A CLI tool that connects Jira issues to automated tests and runs them locally.

Given a Jira ticket key, this tool fetches all related test case issues, matches them to Jest tests by title, runs the tests, and outputs a clear pass/fail report.

## Features

- **Jira Integration**: Fetches test cases from subtasks and linked issues
- **Smart Matching**: Matches Jira test case titles to Jest `it()` / `test()` blocks
- **Platform Filtering**: Filter tests by `platform:web` or `platform:mobile` labels
- **Code Location**: Optionally find where tests are defined in your codebase
- **Flexible Auth**: Supports both Jira Cloud and Jira Data Center/Server
- **JSON Reports**: Generates structured reports for CI/CD integration
- **No Plugins Required**: Works with standard Jira without Xray/Zephyr

## Installation

```bash
# Install globally
npm install -g jira-test

# Or use npx
npx jira-test run TICKET-123

# Or install locally in your project
npm install --save-dev jira-test
```

## Quick Start

1. Set up environment variables:

```bash
# For Jira Cloud
export JIRA_BASE_URL="https://your-domain.atlassian.net"
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-api-token"

# For Jira Data Center/Server
export JIRA_BASE_URL="https://jira.your-company.com"
export JIRA_PAT="your-personal-access-token"
```

2. Run tests for a Jira ticket:

```bash
jira-test run TICKET-1
```

## Usage

### Basic Command

```bash
jira-test run <JIRA_KEY>
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--platform <web\|mobile\|all>` | Filter test cases by platform label | `all` |
| `--link-type <name>` | Jira link type for test case links | `"is tested by"` |
| `--mode <mode>` | Matching mode (currently only `title`) | `title` |
| `--dry` | Preview what would run without executing | `false` |
| `--locate` | Show file:line locations for matching tests | `false` |
| `--jest-cmd <command>` | Jest command to run | `jest` |
| `--repo <path>` | Repository root path | current directory |
| `--report-json <path>` | JSON report output path | `.jira-test-report.json` |

### Examples

```bash
# Run all test cases for a ticket
jira-test run TICKET-1

# Preview without running (dry run)
jira-test run TICKET-1 --dry

# Show file locations for each test
jira-test run TICKET-1 --locate

# Use custom Jest command
jira-test run TICKET-1 --jest-cmd "npm test --"

# Use custom link type
jira-test run TICKET-1 --link-type "tested by"

# Output report to custom path
jira-test run TICKET-1 --report-json ./reports/test-report.json
```

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | All matched tests passed (or no test cases found) |
| `1` | One or more matched tests failed |
| `2` | Configuration error (missing env vars, invalid options) |
| `3` | Jira API error (auth failed, issue not found) |

## Environment Variables

### Required

- `JIRA_BASE_URL`: Your Jira instance URL
  - Jira Cloud: `https://your-domain.atlassian.net`
  - Jira Server: `https://jira.your-company.com`

### Authentication (one of these sets)

**Jira Cloud:**
- `JIRA_EMAIL`: Your Atlassian account email
- `JIRA_API_TOKEN`: API token from https://id.atlassian.com/manage-profile/security/api-tokens

**Jira Data Center/Server:**
- `JIRA_PAT`: Personal Access Token from your Jira profile settings

## How It Works

### 1. Collect Test Cases

The tool fetches test cases from two sources:

- **Subtasks** of the specified Jira issue
- **Linked issues** where the link type matches `--link-type` (default: "is tested by")

### 2. Platform Filtering

Test cases can be filtered by platform using Jira labels:

- `platform:web` - Web-specific tests
- `platform:mobile` - Mobile-specific tests

When filtering:
- `--platform web`: Includes tests with `platform:web` OR no platform label
- `--platform mobile`: Includes tests with `platform:mobile` OR no platform label
- `--platform all`: Includes all tests

### 3. Match to Jest Tests

The tool matches Jira test case **summaries** (titles) to Jest test names:

```javascript
// Jira test case summary: "should calculate total price correctly"
// Matches this Jest test:
it("should calculate total price correctly", () => {
  // test code
});
```

### 4. Run Tests

Jest is executed with `--testNamePattern` using exact matching patterns:

```bash
jest --testNamePattern "^should calculate total price correctly$"
```

### 5. Report Results

Terminal output shows:
- Status for each test case (PASS / FAIL / NOT FOUND)
- Failure snippets for failed tests
- Summary with totals

JSON report includes full details for CI/CD integration.

## Assumptions & Conventions

This MVP makes the following assumptions:

1. **Test titles match Jira summaries exactly**: The Jira test case summary must exactly match the Jest `it()` or `test()` title.

2. **Platform labels use specific format**: `platform:web` and `platform:mobile` (case-insensitive).

3. **Jest is available**: The tool runs Jest via the command line. Ensure Jest is installed in your project or specify a custom command.

4. **Link type naming**: By default, looks for "is tested by" links. Configure with `--link-type` if your Jira uses different naming.

## Troubleshooting

### "JIRA_BASE_URL environment variable is required"

Set the environment variable:
```bash
export JIRA_BASE_URL="https://your-domain.atlassian.net"
```

### "Jira authentication not configured"

Set authentication environment variables:

**For Jira Cloud:**
```bash
export JIRA_EMAIL="your-email@company.com"
export JIRA_API_TOKEN="your-token"
```

**For Jira Server:**
```bash
export JIRA_PAT="your-personal-access-token"
```

### "Failed to connect to Jira API"

1. Check your `JIRA_BASE_URL` is correct
2. Verify your API token or PAT is valid
3. Ensure you have permission to view the issue

### "No test cases found"

The issue may not have:
- Subtasks
- Linked issues with the correct link type

Check the issue in Jira and verify link types.

### Tests marked "NOT FOUND"

The Jest test title doesn't exactly match the Jira summary. Ensure:
- Exact character matching (including spaces, punctuation)
- No extra whitespace in Jira summaries
- Test files are in the Jest test path

### "Failed to run Jest"

1. Ensure Jest is installed: `npm install --save-dev jest`
2. Check your `--jest-cmd` is correct
3. Verify tests run manually: `npx jest`

## API Compatibility

The tool auto-detects and supports:

- **Jira Cloud** (REST API v3)
- **Jira Data Center/Server** (REST API v2)

Detection happens automatically on first request.

## Development

```bash
# Clone the repo
git clone https://github.com/your-username/jira-test.git
cd jira-test

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run smoke tests only
npm run test:smoke

# Link for local development
npm link
```

## License

MIT
