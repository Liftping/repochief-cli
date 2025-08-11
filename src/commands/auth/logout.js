const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { getWorkspaceId, removeToken } = require('../../utils/workspace');
const { APIClient } = require('../../utils/api-client');

/**
 * Logout command to revoke authentication
 */
function createLogoutCommand() {
  const command = new Command('logout');
  
  command
    .description('Log out from RepoChief cloud')
    .option('--all-workspaces', 'Revoke access from all workspaces')
    .action(async (options) => {
      try {
        await handleLogout(options);
      } catch (error) {
        console.error(chalk.red('Logout failed:'), error.message);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handle logout process
 */
async function handleLogout(options) {
  const spinner = ora('Logging out...').start();
  
  try {
    const workspaceId = await getWorkspaceId();
    
    if (!workspaceId) {
      spinner.info('Not logged in');
      return;
    }
    
    // Revoke tokens on server
    const client = new APIClient();
    
    if (options.allWorkspaces) {
      await client.revokeAllTokens();
      spinner.succeed('Logged out from all workspaces');
    } else {
      await client.revokeWorkspaceToken(workspaceId);
      spinner.succeed('Logged out successfully');
    }
    
    // Remove local token
    await removeToken(workspaceId);
    
    console.log(chalk.gray('Local credentials removed'));
    
  } catch (error) {
    spinner.fail('Logout failed');
    
    // Always try to remove local token even if API call fails
    try {
      const workspaceId = await getWorkspaceId();
      if (workspaceId) {
        await removeToken(workspaceId);
        console.log(chalk.yellow('Note: Local credentials removed, but server logout may have failed'));
      }
    } catch (localError) {
      // Ignore local removal errors
    }
    
    throw error;
  }
}

module.exports = createLogoutCommand;