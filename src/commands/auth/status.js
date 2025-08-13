const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { getWorkspaceId, getWorkspaceInfo, getToken } = require('../../utils/workspace');
const { APIClient } = require('../../utils/api-client');
const { refreshAccessToken } = require('../../utils/oauth');

/**
 * Status command to check authentication status
 */
function createStatusCommand() {
  const command = new Command('status');
  
  command
    .description('Check authentication and sync status')
    .option('--verbose', 'Show detailed information')
    .action(async (options) => {
      try {
        await handleStatus(options);
      } catch (error) {
        console.error(chalk.red('Status check failed:'), error.message);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handle status check
 */
async function handleStatus(options) {
  const spinner = ora('Checking status...').start();
  
  try {
    const workspaceId = await getWorkspaceId();
    
    if (!workspaceId) {
      spinner.stop();
      console.log(chalk.yellow('⚠ Not authenticated'));
      console.log('');
      console.log('Run', chalk.bold('repochief auth login'), 'to authenticate');
      return;
    }
    
    // Get local workspace info
    const workspaceInfo = await getWorkspaceInfo();
    
    // Get refresh token and exchange for access token
    const refreshToken = await getToken(workspaceId);
    if (!refreshToken) {
      spinner.stop();
      console.log(chalk.yellow('⚠ Authentication token not found'));
      console.log('Run', chalk.bold('repochief auth login'), 'to authenticate');
      return;
    }
    
    // Get access token
    let validationData;
    try {
      const tokens = await refreshAccessToken(refreshToken);
      const client = new APIClient(tokens.access_token);
      validationData = await client.validateToken(tokens.access_token);
    } catch (error) {
      // Token might be expired or invalid
      spinner.stop();
      console.log(chalk.yellow('⚠ Authentication expired'));
      console.log('Run', chalk.bold('repochief auth login'), 'to re-authenticate');
      return;
    }
    
    spinner.stop();
    
    // Display status
    console.log(chalk.green('✓ Authenticated'));
    console.log('');
    
    if (validationData.user_email) {
      console.log(chalk.bold('Account:'));
      console.log(`  Email: ${validationData.user_email}`);
      console.log('');
    }
    
    console.log(chalk.bold('Workspace:'));
    console.log(`  ID: ${workspaceInfo.workspaceId}`);
    console.log(`  Name: ${workspaceInfo.workspaceName}`);
    console.log(`  Created: ${new Date(workspaceInfo.createdAt).toLocaleDateString()}`);
    
    if (workspaceInfo.metadata) {
      console.log('');
      console.log(chalk.bold('System Info:'));
      console.log(`  Platform: ${workspaceInfo.metadata.os}`);
      console.log(`  Architecture: ${workspaceInfo.metadata.arch}`);
      console.log(`  Hostname: ${workspaceInfo.metadata.hostname}`);
      console.log(`  Node Version: ${workspaceInfo.metadata.node}`);
    }
    
    if (options.verbose) {
      console.log('');
      console.log(chalk.gray('Note: Usage metrics and sync status will be available in future updates'));
    }
    
  } catch (error) {
    spinner.fail('Status check failed');
    
    if (error.code === 'UNAUTHORIZED' || error.message.includes('expired')) {
      console.log(chalk.yellow('Authentication expired. Please login again.'));
      console.log('Run', chalk.bold('repochief auth login'));
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.log(chalk.red('Cannot connect to RepoCHief API'));
      console.log('Please check your internet connection');
    } else {
      console.log(chalk.red('Error:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
    }
  }
}

// Removed formatBytes function - not needed for MVP

module.exports = createStatusCommand;