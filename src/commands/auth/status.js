const { Command } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const { getDeviceId, getDeviceInfo } = require('../../utils/device');
const { APIClient } = require('../../utils/api-client');

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
    const deviceId = await getDeviceId();
    
    if (!deviceId) {
      spinner.stop();
      console.log(chalk.yellow('⚠ Not authenticated'));
      console.log('');
      console.log('Run', chalk.bold('repochief auth login'), 'to authenticate');
      return;
    }
    
    // Get local device info
    const deviceInfo = await getDeviceInfo();
    
    // Check API connection
    const client = new APIClient();
    const status = await client.getStatus();
    
    spinner.stop();
    
    // Display status
    console.log(chalk.green('✓ Authenticated'));
    console.log('');
    console.log(chalk.bold('Account:'));
    console.log(`  Email: ${status.user.email}`);
    console.log(`  Plan: ${status.user.plan || 'Free'}`);
    console.log('');
    
    console.log(chalk.bold('Device:'));
    console.log(`  ID: ${deviceInfo.deviceId}`);
    console.log(`  Name: ${deviceInfo.deviceName}`);
    console.log(`  Registered: ${new Date(deviceInfo.createdAt).toLocaleDateString()}`);
    console.log('');
    
    console.log(chalk.bold('Sync Status:'));
    console.log(`  Last sync: ${status.lastSync ? new Date(status.lastSync).toLocaleString() : 'Never'}`);
    console.log(`  Projects synced: ${status.projectCount || 0}`);
    console.log('');
    
    if (options.verbose) {
      console.log(chalk.bold('Usage This Month:'));
      console.log(`  API calls: ${status.usage.apiCalls || 0}`);
      console.log(`  AI tokens: ${status.usage.aiTokens || 0}`);
      console.log(`  Storage: ${formatBytes(status.usage.storage || 0)}`);
      console.log('');
      
      console.log(chalk.bold('Connected Devices:'));
      for (const device of status.devices || []) {
        const current = device.id === deviceId ? ' (current)' : '';
        console.log(`  • ${device.name} - Last seen: ${new Date(device.lastSeenAt).toLocaleString()}${current}`);
      }
    }
    
  } catch (error) {
    spinner.fail('Status check failed');
    
    if (error.code === 'UNAUTHORIZED') {
      console.log(chalk.yellow('Authentication expired. Please login again.'));
      console.log('Run', chalk.bold('repochief auth login'));
    } else {
      throw error;
    }
  }
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

module.exports = createStatusCommand;