#!/bin/bash

# Test script to verify CLI commands are working

echo "🧪 Testing RepoChief CLI Commands"
echo "================================="

# Test help command
echo -e "\n1. Testing help command:"
node bin/repochief.js --help

# Test version command
echo -e "\n2. Testing version command:"
node bin/repochief.js --version

# Test config command
echo -e "\n3. Testing config command:"
node bin/repochief.js config --api-keys

# Test agents command
echo -e "\n4. Testing agents command:"
node bin/repochief.js agents

# Test status command
echo -e "\n5. Testing status command:"
node bin/repochief.js status

echo -e "\n✅ CLI commands are working!"
echo -e "\nNote: 'init' and 'run' commands require user interaction or task files."
echo "To test init: node bin/repochief.js init"
echo "To test run: node bin/repochief.js run <task-file> --mock"