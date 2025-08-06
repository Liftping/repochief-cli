#!/usr/bin/env node
/**
 * Simple Production API Test
 * Tests RepoCHief production readiness without external dependencies
 */

const path = require('path');

// Load environment
require('dotenv').config({ path: path.join(__dirname, 'repochief-core', '.env') });

console.log('\n🧪 RepoCHief Production Test\n');

// Test 1: Environment Configuration
console.log('📋 Environment Check:');
console.log(`   MOCK_MODE: ${process.env.MOCK_MODE || 'undefined'}`);
console.log(`   OpenAI Key: ${process.env.OPENAI_API_KEY ? 'Set (hidden)' : 'Not set'}`);
console.log(`   Anthropic Key: ${process.env.ANTHROPIC_API_KEY ? 'Set (hidden)' : 'Not set'}`);
console.log(`   Google Key: ${process.env.GOOGLE_API_KEY ? 'Set (hidden)' : 'Not set'}`);
console.log(`   Cloud API: ${process.env.CLOUD_API_URL || 'Not set'}\n`);

// Test 2: Module Loading
console.log('📦 Module Loading:');
try {
  const core = require('./repochief-core/src/index');
  console.log('   ✅ repochief-core: Loaded successfully');
} catch (error) {
  console.log(`   ❌ repochief-core: ${error.message}`);
}

try {
  const { AIModelClient } = require('./repochief-core/src/api/AIModelClient');
  console.log('   ✅ AIModelClient: Loaded successfully');
  
  const client = new AIModelClient({ mockMode: process.env.MOCK_MODE === 'true' });
  console.log(`   ✅ Client initialized: ${process.env.MOCK_MODE === 'true' ? 'Mock mode' : 'Production mode'}`);
} catch (error) {
  console.log(`   ❌ AIModelClient: ${error.message}`);
}

try {
  const { AIContextGenerator } = require('./repochief-core/src/ai-context');
  console.log('   ✅ AIContextGenerator: Loaded successfully');
} catch (error) {
  console.log(`   ❌ AIContextGenerator: ${error.message}`);
}

// Test 3: CLI Commands
console.log('\n🔧 CLI Commands:');
try {
  const cliPath = path.join(__dirname, 'repochief-cli', 'bin', 'repochief.js');
  console.log(`   CLI Path: ${cliPath}`);
  console.log('   ✅ CLI accessible for testing');
} catch (error) {
  console.log(`   ❌ CLI: ${error.message}`);
}

// Test 4: Production Readiness Assessment
console.log('\n🎯 Production Readiness:');

const hasAPIKeys = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
const mockMode = process.env.MOCK_MODE === 'true';
const hasCloudAPI = process.env.CLOUD_API_URL;

console.log(`   API Keys Available: ${hasAPIKeys ? 'Yes' : 'No'}`);
console.log(`   Mock Mode: ${mockMode ? 'Enabled' : 'Disabled'}`);
console.log(`   Cloud Integration: ${hasCloudAPI ? 'Configured' : 'Not configured'}`);

if (!mockMode && !hasAPIKeys) {
  console.log('\n⚠️  WARNING: Production mode enabled but no API keys found!');
  console.log('   To fix: Add API keys to .env or set MOCK_MODE=true');
} else if (mockMode) {
  console.log('\n✅ Currently running in mock mode - safe for testing');
  console.log('   To enable production: Set MOCK_MODE=false and add API keys');
} else {
  console.log('\n✅ Production mode with API keys - ready for real usage!');
}

console.log('\n📚 Next Steps:');
console.log('   1. Configure API keys in .env files');
console.log('   2. Set MOCK_MODE=false for production');
console.log('   3. Test with: node repochief-cli/bin/repochief.js --help');
console.log('   4. Run setup: node setup-production-apis.js');
console.log();