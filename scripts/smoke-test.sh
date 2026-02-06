#!/bin/bash
#
# Smoke test script for jira-test CLI
# Runs the CLI in dry mode using mocked Jira data
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== jira-test Smoke Test ==="
echo ""

# Check if built
if [ ! -d "$PROJECT_ROOT/dist" ]; then
    echo "Error: dist/ directory not found. Run 'npm run build' first."
    exit 1
fi

# Run smoke tests via Jest
echo "Running smoke tests..."
cd "$PROJECT_ROOT"
npm run test:smoke

echo ""
echo "=== Smoke Test Complete ==="
