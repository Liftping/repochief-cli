const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const { APIClient } = require('../../utils/api-client');
const { getWorkspaceInfo, getToken, storeToken } = require('../../utils/workspace');
const BaseCommand = require('../BaseCommand');

/**
 * Register workspace with cloud
 */
async function registerWorkspace() {
  const spinner = ora('Registering workspace with cloud...').start();
  
  try {
    // Get workspace info
    const workspaceInfo = await getWorkspaceInfo();
    if (!workspaceInfo) {
      spinner.fail('No workspace found. Please run "repochief auth login" first');
      return;
    }
    
    // Get auth token
    const token = await getToken(workspaceInfo.workspaceId);
    if (!token) {
      spinner.fail('Not authenticated. Please run "repochief auth login" first');
      return;
    }
    
    // Validate token and get user ID first
    const tempClient = new APIClient(token);
    const validation = await tempClient.validateToken();
    
    if (!validation.valid || !validation.user_id) {
      spinner.fail('Token validation failed');
      return;
    }
    
    // Create API client for registration
    const client = new APIClient();
    
    // Prepare registration data
    const registrationData = {
      name: workspaceInfo.workspaceName || `${os.hostname()} - ${os.platform()}`,
      type: 'LOCAL', // LOCAL, CODESPACES, CLOUD_SERVER, CI_CD
      metadata: {
        ...workspaceInfo.metadata,
        cliVersion: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname()
      }
    };
    
    // Register with cloud - manually add x-user-id header
    const response = await client.axios.post('/workspaces/register-cli', registrationData, {
      headers: {
        'x-user-id': validation.user_id
      }
    });
    
    spinner.succeed('Workspace registered successfully!');
    
    console.log(chalk.green('\n✓ Workspace Details:'));
    console.log(`  ID: ${chalk.cyan(response.data.workspace.id)}`);
    console.log(`  Name: ${chalk.cyan(response.data.workspace.name)}`);
    console.log(`  API Key: ${chalk.yellow(response.data.workspace.api_key)}`);
    console.log(`  Status: ${chalk.green(response.data.workspace.status)}`);
    
    // Show next steps
    // Store the workspace API key as the token for this workspace
    await storeToken(workspaceInfo.workspaceId, response.data.workspace.api_key);
    
    // Set this as the active workspace for local CLI operations  
    const baseCommand = new BaseCommand();
    const config = baseCommand.loadConfig();
    config.activeWorkspace = response.data.workspace.id; // Use workspace ID as active workspace
    baseCommand.saveConfig(config);
    
    console.log(chalk.cyan('\nNext steps:'));
    console.log('  • Run', chalk.bold('repochief workspace status'), 'to verify connection');
    console.log('  • Run', chalk.bold('repochief intent create'), 'to create your first intent');
    console.log('  • Visit', chalk.bold('https://app.repochief.com'), 'to view in dashboard');
    
    return response.data.workspace;
    
  } catch (error) {
    spinner.fail('Failed to register workspace');
    
    if (error.response?.status === 409) {
      console.error(chalk.yellow('Workspace already registered. Use "repochief workspace status" to check connection.'));
    } else {
      console.error(chalk.red('Error:'), error.message);
    }
    
    throw error;
  }
}

module.exports = registerWorkspace;