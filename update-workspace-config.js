const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function updateWorkspaceConfig() {
  console.log('Updating CLI workspace configuration...\n');
  
  const newConfig = {
    workspace_id: 'ab309c5c-51ea-41a6-ab9d-46c78f776392',
    api_key: 'ws_3fb114031b704ef8be345623b0c12985',
    user_id: 'user_319pM9z021SU2egSyl1xJ3xy4Hp',
    name: 'RepoCHief Development Workspace',
    type: 'LOCAL',
    registered_at: new Date().toISOString()
  };
  
  // Update the workspace config file
  const configDir = path.join(os.homedir(), '.repochief');
  const configFile = path.join(configDir, 'workspace.json');
  
  try {
    // Ensure directory exists
    await fs.mkdir(configDir, { recursive: true });
    
    // Write the new configuration
    await fs.writeFile(configFile, JSON.stringify(newConfig, null, 2));
    
    console.log('✅ Workspace configuration updated:');
    console.log('   Config file:', configFile);
    console.log('   Workspace ID:', newConfig.workspace_id);
    console.log('   API Key:', newConfig.api_key);
    console.log('   User ID:', newConfig.user_id);
    
    // Also create an environment file for easy sourcing
    const envContent = `# RepoCHief Workspace Configuration
export REPOCHIEF_WORKSPACE_ID="${newConfig.workspace_id}"
export REPOCHIEF_API_KEY="${newConfig.api_key}"
export REPOCHIEF_USER_ID="${newConfig.user_id}"
export REPOCHIEF_API_URL="https://api.repochief.com/functions/v1"
`;
    
    const envFile = path.join(configDir, 'workspace.env');
    await fs.writeFile(envFile, envContent);
    
    console.log('\n✅ Environment file created:');
    console.log('   File:', envFile);
    console.log('   Source with: source ~/.repochief/workspace.env');
    
    console.log('\n📝 Next steps:');
    console.log('1. The CLI is now configured with the new workspace');
    console.log('2. Visit https://app.repochief.com/workspaces to see your workspace');
    console.log('3. Use the CLI commands to manage intents and tasks');
    
  } catch (error) {
    console.error('Error updating configuration:', error);
  }
}

updateWorkspaceConfig();