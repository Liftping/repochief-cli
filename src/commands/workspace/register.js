const chalk = require('chalk');
const ora = require('ora');
const os = require('os');
const { APIClient } = require('../../utils/api-client');
const { getWorkspaceInfo, getToken } = require('../../utils/workspace');

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
    
    // Create authenticated client
    const client = new APIClient(token);
    
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
    
    // Register with cloud
    const response = await client.post('/workspaces/register-cli', registrationData);
    
    spinner.succeed('Workspace registered successfully!');
    
    console.log(chalk.green('\n✓ Workspace Details:'));
    console.log(`  ID: ${chalk.cyan(response.workspace.id)}`);
    console.log(`  Name: ${chalk.cyan(response.workspace.name)}`);
    console.log(`  API Key: ${chalk.yellow(response.workspace.api_key)}`);
    console.log(`  Status: ${chalk.green(response.workspace.status)}`);
    
    // Show next steps
    console.log(chalk.cyan('\nNext steps:'));
    console.log('  • Run', chalk.bold('repochief workspace status'), 'to verify connection');
    console.log('  • Run', chalk.bold('repochief intent create'), 'to create your first intent');
    console.log('  • Visit', chalk.bold('https://app.repochief.com'), 'to view in dashboard');
    
    return response.workspace;
    
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