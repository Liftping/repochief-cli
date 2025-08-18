#!/usr/bin/env node

/**
 * Link existing workspace to Clerk user
 * This solves the authentication mismatch between CLI OAuth and Dashboard Clerk
 */

const axios = require('axios');

async function linkWorkspaceToClerk() {
  console.log('=== Linking Workspace to Clerk User ===\n');
  
  // Workspace created via CLI OAuth
  const workspaceId = 'ab309c5c-51ea-41a6-ab9d-46c78f776392';
  const apiKey = 'ws_3fb114031b704ef8be345623b0c12985';
  const oauthUserId = 'user_319pM9z021SU2egSyl1xJ3xy4Hp';
  
  // Your Clerk user ID (you'll need to get this from the dashboard)
  // This is a placeholder - you need to replace with actual Clerk user ID
  const clerkUserId = 'user_2XXX...'; // Replace with your actual Clerk user ID
  
  console.log('Current Setup:');
  console.log('- Workspace ID:', workspaceId);
  console.log('- OAuth User ID:', oauthUserId);
  console.log('- API Key:', apiKey);
  console.log('');
  
  console.log('Solution Options:');
  console.log('');
  
  console.log('Option 1: Update database to add Clerk user ID');
  console.log('----------------------------------------');
  console.log('SQL to run in Supabase dashboard:');
  console.log(`
UPDATE workspaces 
SET clerk_user_id = '${clerkUserId}'
WHERE id = '${workspaceId}';
  `);
  console.log('');
  
  console.log('Option 2: Create user mapping table');
  console.log('------------------------------------');
  console.log('SQL to create mapping:');
  console.log(`
-- Create user mapping table
CREATE TABLE IF NOT EXISTS user_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  oauth_user_id TEXT UNIQUE NOT NULL,
  clerk_user_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert mapping
INSERT INTO user_mappings (oauth_user_id, clerk_user_id)
VALUES ('${oauthUserId}', '${clerkUserId}')
ON CONFLICT (oauth_user_id) DO UPDATE 
SET clerk_user_id = EXCLUDED.clerk_user_id;
  `);
  console.log('');
  
  console.log('Option 3: Use the workspace API key directly');
  console.log('--------------------------------------------');
  console.log('The dashboard has been updated to use the API key as fallback.');
  console.log('You can test by visiting: https://app.repochief.com/workspaces');
  console.log('');
  
  // Test if workspace is accessible
  console.log('Testing workspace access with API key...');
  try {
    const response = await axios.get(
      'https://api.repochief.com/functions/v1/workspaces',
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const workspaces = response.data.workspaces || [];
    console.log(`✅ Found ${workspaces.length} workspace(s) using API key`);
    
    if (workspaces.length > 0) {
      console.log('\nWorkspace Details:');
      workspaces.forEach(ws => {
        console.log(`- ${ws.name} (${ws.id})`);
        console.log(`  Type: ${ws.type}`);
        console.log(`  Status: ${ws.status}`);
        console.log(`  Created: ${new Date(ws.created_at).toLocaleDateString()}`);
      });
    }
  } catch (error) {
    console.error('❌ Error accessing workspace:', error.message);
  }
  
  console.log('\n=== Next Steps ===');
  console.log('1. Get your Clerk user ID from the dashboard');
  console.log('   - Sign in to https://app.repochief.com');
  console.log('   - Open browser DevTools Console');
  console.log('   - The user ID will be logged or available in Clerk dashboard');
  console.log('');
  console.log('2. Update the database using one of the options above');
  console.log('');
  console.log('3. Or just use the API key approach (already implemented)');
  console.log('   - The dashboard will use the hardcoded API key as fallback');
  console.log('   - This workspace should appear at https://app.repochief.com/workspaces');
}

linkWorkspaceToClerk();