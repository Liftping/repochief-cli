const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { getDeviceId, removeToken } = require('../../utils/device');
const { APIClient } = require('../../utils/api-client');

/**
 * Logout command to revoke authentication
 */
function createLogoutCommand() {
  const command = new Command('logout');
  
  command
    .description('Log out from RepoChief cloud')
    .option('--all-devices', 'Revoke access from all devices')
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
    const deviceId = await getDeviceId();
    
    if (!deviceId) {
      spinner.info('Not logged in');
      return;
    }
    
    // Revoke tokens on server
    const client = new APIClient();
    
    if (options.allDevices) {
      await client.revokeAllTokens();
      spinner.succeed('Logged out from all devices');
    } else {
      await client.revokeDeviceToken(deviceId);
      spinner.succeed('Logged out successfully');
    }
    
    // Remove local token
    await removeToken(deviceId);
    
    console.log(chalk.gray('Local credentials removed'));
    
  } catch (error) {
    spinner.fail('Logout failed');
    
    // Always try to remove local token even if API call fails
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        await removeToken(deviceId);
        console.log(chalk.yellow('Note: Local credentials removed, but server logout may have failed'));
      }
    } catch (localError) {
      // Ignore local removal errors
    }
    
    throw error;
  }
}

module.exports = createLogoutCommand;