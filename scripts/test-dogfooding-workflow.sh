#!/bin/bash

# RepoCHief Dogfooding Workflow Test
# This script tests the complete end-to-end workflow of using RepoCHief to develop RepoCHief

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "  RepoCHief Dogfooding Test - End-to-End Workflow"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test results
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test a command
test_command() {
    local description="$1"
    local command="$2"
    
    echo -n "Testing: $description... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Command: $command"
        ((FAILED_TESTS++))
        return 1
    fi
}

# Function to test with output
test_with_output() {
    local description="$1"
    local command="$2"
    
    echo ""
    echo "Testing: $description"
    echo "────────────────────────────────────────"
    
    if eval "$command"; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED_TESTS++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED_TESTS++))
        return 1
    fi
    echo ""
}

echo "📋 Phase 1: CLI Authentication"
echo "────────────────────────────────────────"

# Test auth status (should fail if not logged in)
echo -n "1. Check initial auth status... "
if repochief auth status 2>&1 | grep -q "Not authenticated"; then
    echo -e "${GREEN}✓ Correctly not authenticated${NC}"
    ((PASSED_TESTS++))
else
    echo -e "${YELLOW}⚠ May already be authenticated${NC}"
fi

# Test auth workflow
echo ""
echo "To complete authentication test:"
echo "1. Run: repochief auth login"
echo "2. Follow the browser flow"
echo "3. Run: repochief auth status"
echo ""

echo "📋 Phase 2: Dashboard Integration"
echo "────────────────────────────────────────"
echo ""
echo "To test dashboard integration:"
echo "1. Open: https://beta.repochief.com"
echo "2. Login with same credentials"
echo "3. Check organization/workspace access"
echo ""

echo "📋 Phase 3: Intent Creation"
echo "────────────────────────────────────────"

# Test intent CLI commands
test_command "Intent help command" "repochief intent --help"
test_command "Intent list command" "repochief intent list --json"

echo ""
echo "To create a development intent:"
echo "$ repochief intent create \\"
echo "    --objective \"Implement task approval workflow\" \\"
echo "    --business-value \"Prevent unauthorized AI task execution\" \\"
echo "    --tasks \"Design approval UI,Add approval API,Test workflow\""
echo ""

echo "📋 Phase 4: Task Execution"
echo "────────────────────────────────────────"

# Test running a task
test_with_output "Run dogfooding tasks in mock mode" \
    "repochief run examples/repochief-dogfooding-tasks.json --mock --output dogfood-test"

echo "📋 Phase 5: Multi-Device Sync"
echo "────────────────────────────────────────"
echo ""
echo "To test multi-device sync:"
echo "1. Start a task on this device"
echo "2. Login on another device with: repochief auth login"
echo "3. Run: repochief intent list"
echo "4. Verify same intents appear"
echo ""

echo "📋 Phase 6: Cost Tracking"
echo "────────────────────────────────────────"

# Check if cost report exists
if [ -f "dogfood-test/results.json" ]; then
    echo "Checking cost tracking in results..."
    if grep -q "\"cost\":" dogfood-test/results.json; then
        echo -e "${GREEN}✓ Cost tracking data found${NC}"
        ((PASSED_TESTS++))
    else
        echo -e "${RED}✗ No cost tracking data${NC}"
        ((FAILED_TESTS++))
    fi
else
    echo -e "${YELLOW}⚠ No results file to check${NC}"
fi

echo ""
echo "📋 Phase 7: Quality Gates"
echo "────────────────────────────────────────"

# Test quality gates
test_command "Quality gates available" "ls ../repochief-quality-gates/src/gates/"

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  Test Results"
echo "═══════════════════════════════════════════════════════════════"
echo -e "  ${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "  ${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 All automated tests passed!${NC}"
    echo ""
    echo "Next steps for manual testing:"
    echo "1. Complete authentication flow"
    echo "2. Create an intent via CLI"
    echo "3. View it in the dashboard"
    echo "4. Execute a real development task"
    echo "5. Verify cloud sync works"
else
    echo -e "${RED}⚠️  Some tests failed. Fix these before proceeding.${NC}"
fi

echo ""
echo "To run the complete dogfooding workflow:"
echo "$ repochief run examples/repochief-dogfooding-tasks.json --interactive"
echo ""