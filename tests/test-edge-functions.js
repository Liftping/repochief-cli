#!/usr/bin/env node

/**
 * Test CLI with new Supabase Edge Functions
 */

const { APIClient } = require('../src/utils/api-client');

async function testEdgeFunctions() {
  console.log('🧪 Testing CLI with Supabase Edge Functions\n');
  
  // Create API client with fake API key for testing
  const client = new APIClient('test-api-key');
  
  try {
    // Test 1: List intents (should fail with authentication error)
    console.log('1. Testing getIntents()...');
    try {
      const intents = await client.getIntents();
      console.log('✅ getIntents() - Success:', intents.length, 'intents');
    } catch (error) {
      console.log('⚠️  getIntents() - Expected auth error:', error.message);
    }
    
    // Test 2: Create intent (should fail with authentication error)
    console.log('\n2. Testing createIntent()...');
    try {
      const intentData = {
        objective: 'Test Intent from CLI',
        business_value: 'Testing the new API integration',
        success_metrics: 'CLI can communicate with Edge Functions',
        hypothesis: 'The CLI will work with new backend',
        status: 'draft'
      };
      
      const intent = await client.createIntent(intentData);
      console.log('✅ createIntent() - Success:', intent.id);
    } catch (error) {
      console.log('⚠️  createIntent() - Expected auth error:', error.message);
    }
    
    // Test 3: Register workspace (should work)
    console.log('\n3. Testing registerWorkspace()...');
    try {
      const workspaceData = {
        name: 'Test CLI Workspace',
        type: 'DEVELOPMENT',
        metadata: {
          cli_version: '1.0.0',
          test: true
        }
      };
      
      const response = await client.registerWorkspace(workspaceData);
      console.log('✅ registerWorkspace() - Success:', response.workspace_id);
    } catch (error) {
      console.log('⚠️  registerWorkspace() - Error:', error.message);
    }
    
    console.log('\n✨ Edge Functions connectivity test completed!');
    console.log('📝 Next steps:');
    console.log('   1. Fix Edge Function routing issues');
    console.log('   2. Update authentication flow');
    console.log('   3. Test with real API keys');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run tests
testEdgeFunctions();