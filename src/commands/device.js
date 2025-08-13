/**
 * Device Command - Register and manage local devices for cloud task execution
 * 
 * This enables hybrid cloud-local execution by registering the current workspace
 * as a device that can execute tasks scheduled from the cloud dashboard.
 */

const chalk = require('chalk');
const ora = require('ora');
const inquirer = require('inquirer');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const { getDeviceId, getDeviceInfo, setToken, getToken, clearDevice } = require('../utils/device');
const { getWorkspaceAuth } = require('../auth/AuthManager');
const { APIClient } = require('../utils/api-client');

/**
 * Detect installed AI tools on the system
 */
async function detectCapabilities() {
  const capabilities = [];
  const tools = [];
  
  // Check for Claude Code
  try {
    await execAsync('which claude-code');
    capabilities.push('claude-code');
    tools.push({ name: 'Claude Code', version: 'latest', type: 'claude-code' });
  } catch (e) {
    // Claude Code not found
  }
  
  // Check for Aider
  try {
    const { stdout } = await execAsync('aider --version 2>/dev/null');
    const version = stdout.trim().split(' ')[1] || 'unknown';
    capabilities.push('aider');
    tools.push({ name: 'Aider', version, type: 'aider' });
  } catch (e) {
    // Aider not found
  }
  
  // Check for tmux (required for orchestration)
  try {
    await execAsync('which tmux');
    capabilities.push('tmux');
  } catch (e) {
    console.warn(chalk.yellow('⚠️  tmux not found - required for AI tool orchestration'));
  }
  
  // Check for git
  try {
    await execAsync('which git');
    capabilities.push('git');
  } catch (e) {
    // Git not found
  }
  
  return { capabilities, tools };
}

/**
 * Register device subcommand
 */
async function registerDevice(options) {
  const spinner = ora('Detecting device capabilities...').start();
  
  try {
    // Get workspace authentication
    const workspaceAuth = await getWorkspaceAuth();
    if (!workspaceAuth || !workspaceAuth.workspace) {
      spinner.fail('Not authenticated to a workspace');
      console.log(chalk.yellow('\nPlease run "repochief auth login" first'));
      return;
    }
    
    // Get or create device ID
    const deviceId = await getDeviceId();
    const deviceInfo = await getDeviceInfo();
    
    // Detect capabilities
    const { capabilities, tools } = await detectCapabilities();
    spinner.succeed('Device capabilities detected');
    
    // Display detected tools
    console.log(chalk.blue('\n📦 Detected AI Tools:'));
    if (tools.length > 0) {
      tools.forEach(tool => {
        console.log(chalk.gray(`  • ${tool.name} (${tool.version})`));
      });
    } else {
      console.log(chalk.yellow('  No AI tools detected'));
      console.log(chalk.gray('  Install Claude Code or Aider to enable local execution'));
    }
    
    // Prompt for device name if not provided
    let deviceName = options.name;
    if (!deviceName) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Device name:',
          default: `${os.hostname()}-${os.platform()}`,
          validate: input => input.length > 0
        }
      ]);
      deviceName = answers.name;
    }
    
    // Prepare device registration data
    const deviceData = {
      deviceId,
      name: deviceName,
      hostname: deviceInfo.hostname || os.hostname(),
      platform: deviceInfo.platform || os.platform(),
      arch: deviceInfo.arch || os.arch(),
      nodeVersion: deviceInfo.nodeVersion || process.version,
      capabilities,
      tools,
      workspaceId: workspaceAuth.workspace.id
    };
    
    spinner.start('Registering device with cloud...');
    
    // Create API client with workspace API key
    const apiClient = new APIClient(workspaceAuth.apiKey);
    
    // Call device registration endpoint
    const response = await apiClient.post('/devices/register', deviceData);
    
    if (response.error) {
      spinner.fail(`Registration failed: ${response.error}`);
      return;
    }
    
    // Store device token securely
    await setToken(deviceId, response.deviceToken);
    
    spinner.succeed('Device registered successfully');
    
    // Display registration info
    console.log(chalk.green('\n✅ Device Registration Complete'));
    console.log(chalk.gray('═══════════════════════════════════════'));
    console.log(chalk.blue('Device ID:'), deviceId);
    console.log(chalk.blue('Device Name:'), deviceName);
    console.log(chalk.blue('Workspace:'), workspaceAuth.workspace.slug);
    console.log(chalk.blue('Capabilities:'), capabilities.join(', ') || 'none');
    
    console.log(chalk.gray('\n📡 This device can now receive tasks from the cloud'));
    console.log(chalk.gray('Start the polling service with: repochief device poll'));
    
  } catch (error) {
    spinner.fail('Device registration failed');
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

/**
 * List registered devices
 */
async function listDevices() {
  const spinner = ora('Fetching registered devices...').start();
  
  try {
    // Get workspace authentication
    const workspaceAuth = await getWorkspaceAuth();
    if (!workspaceAuth || !workspaceAuth.workspace) {
      spinner.fail('Not authenticated to a workspace');
      console.log(chalk.yellow('\nPlease run "repochief auth login" first'));
      return;
    }
    
    // Create API client with workspace API key
    const apiClient = new APIClient(workspaceAuth.apiKey);
    
    // Fetch devices from cloud
    const response = await apiClient.get('/devices');
    
    if (response.error) {
      spinner.fail(`Failed to fetch devices: ${response.error}`);
      return;
    }
    
    spinner.succeed(`Found ${response.devices.length} registered devices`);
    
    if (response.devices.length === 0) {
      console.log(chalk.yellow('\nNo devices registered yet'));
      console.log(chalk.gray('Run "repochief device register" to register this device'));
      return;
    }
    
    // Display devices
    console.log(chalk.blue('\n📱 Registered Devices:'));
    console.log(chalk.gray('═══════════════════════════════════════'));
    
    const currentDeviceId = await getDeviceId();
    
    response.devices.forEach(device => {
      const isCurrent = device.deviceId === currentDeviceId;
      const marker = isCurrent ? chalk.green(' (current)') : '';
      
      console.log(`\n${chalk.bold(device.name)}${marker}`);
      console.log(chalk.gray(`  ID: ${device.deviceId}`));
      console.log(chalk.gray(`  Platform: ${device.platform} (${device.arch})`));
      console.log(chalk.gray(`  Capabilities: ${device.capabilities?.join(', ') || 'none'}`));
      console.log(chalk.gray(`  Status: ${device.status || 'offline'}`));
      console.log(chalk.gray(`  Last Seen: ${device.lastSeen || 'never'}`));
    });
    
  } catch (error) {
    spinner.fail('Failed to list devices');
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

/**
 * Remove device registration
 */
async function removeDevice(options) {
  try {
    const deviceId = options.deviceId || await getDeviceId();
    
    // Confirm removal
    if (!options.force) {
      const answers = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Remove device ${deviceId} from cloud?`,
          default: false
        }
      ]);
      
      if (!answers.confirm) {
        console.log(chalk.gray('Device removal cancelled'));
        return;
      }
    }
    
    const spinner = ora('Removing device...').start();
    
    // Get workspace authentication
    const workspaceAuth = await getWorkspaceAuth();
    if (!workspaceAuth || !workspaceAuth.workspace) {
      spinner.fail('Not authenticated to a workspace');
      return;
    }
    
    // Create API client with workspace API key
    const apiClient = new APIClient(workspaceAuth.apiKey);
    
    // Call device removal endpoint
    const response = await apiClient.delete(`/devices/${deviceId}`);
    
    if (response.error) {
      spinner.fail(`Removal failed: ${response.error}`);
      return;
    }
    
    // Clear local device data
    await clearDevice();
    
    spinner.succeed('Device removed successfully');
    console.log(chalk.gray('\nThis device will no longer receive tasks from the cloud'));
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

/**
 * Poll for tasks (long-running process)
 */
async function pollForTasks(options) {
  console.log(chalk.blue('🔄 Starting device polling service...'));
  
  try {
    // Get device ID and token
    const deviceId = await getDeviceId();
    const deviceToken = await getToken(deviceId);
    
    if (!deviceToken) {
      console.log(chalk.red('❌ Device not registered'));
      console.log(chalk.yellow('Run "repochief device register" first'));
      return;
    }
    
    // Get workspace authentication
    const workspaceAuth = await getWorkspaceAuth();
    if (!workspaceAuth || !workspaceAuth.workspace) {
      console.log(chalk.red('❌ Not authenticated to a workspace'));
      return;
    }
    
    console.log(chalk.gray(`Device ID: ${deviceId}`));
    console.log(chalk.gray(`Workspace: ${workspaceAuth.workspace.slug}`));
    console.log(chalk.gray('Press Ctrl+C to stop polling\n'));
    
    // Polling configuration
    const pollInterval = options.interval || 30000; // 30 seconds default
    let consecutiveErrors = 0;
    const maxErrors = 5;
    
    // Create API client with workspace API key
    const apiClient = new APIClient(workspaceAuth.apiKey);
    
    // Import orchestrator for task execution
    const { AIAgentOrchestratorV2 } = require('@liftping/repochief-core');
    
    // Create orchestrator instance
    const orchestrator = new AIAgentOrchestratorV2({
      sessionName: `device-${deviceId}`,
      executionMode: 'adapter',
      useLocalExecution: true,
      adapterType: 'claude-code' // Default to Claude Code
    });
    
    await orchestrator.initialize();
    
    // Polling loop
    const poll = async () => {
      try {
        // Check for pending tasks
        const response = await apiClient.get(`/devices/${deviceId}/tasks/pending`);
        
        if (response.error) {
          consecutiveErrors++;
          console.error(chalk.yellow(`⚠️  Poll error: ${response.error}`));
          
          if (consecutiveErrors >= maxErrors) {
            console.error(chalk.red('❌ Too many consecutive errors, stopping'));
            process.exit(1);
          }
          
          return;
        }
        
        consecutiveErrors = 0; // Reset error counter
        
        if (response.task) {
          console.log(chalk.green(`\n📋 New task received: ${response.task.id}`));
          console.log(chalk.gray(`  Type: ${response.task.type}`));
          console.log(chalk.gray(`  Objective: ${response.task.objective}`));
          
          // Update task status to running
          await apiClient.put(`/tasks/${response.task.id}/status`, {
            status: 'running',
            deviceId
          });
          
          try {
            // Execute task via orchestrator
            const agent = await orchestrator.createAgent({
              name: `device-agent-${response.task.id}`,
              useAdapter: true,
              adapterType: response.task.adapterType || 'claude-code'
            });
            
            await orchestrator.queueTask(response.task);
            await orchestrator.startExecution();
            await orchestrator.waitForCompletion();
            
            const results = orchestrator.getResults();
            const taskResult = results.find(r => r.taskId === response.task.id);
            
            // Report completion
            await apiClient.put(`/tasks/${response.task.id}/status`, {
              status: taskResult?.status === 'completed' ? 'completed' : 'failed',
              deviceId,
              result: taskResult?.result || { error: 'Task execution failed' }
            });
            
            console.log(chalk.green(`✅ Task ${response.task.id} completed`));
            
          } catch (taskError) {
            console.error(chalk.red(`❌ Task execution failed: ${taskError.message}`));
            
            // Report failure
            await apiClient.put(`/tasks/${response.task.id}/status`, {
              status: 'failed',
              deviceId,
              error: taskError.message
            });
          }
        }
        
        // Send heartbeat
        await apiClient.put(`/devices/${deviceId}/heartbeat`, {
          status: 'online',
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(chalk.red(`❌ Polling error: ${error.message}`));
        consecutiveErrors++;
      }
    };
    
    // Start polling
    poll(); // Initial poll
    const pollTimer = setInterval(poll, pollInterval);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n⏹️  Stopping polling service...'));
      clearInterval(pollTimer);
      
      // Update device status to offline
      try {
        await apiClient.put(`/devices/${deviceId}/heartbeat`, {
          status: 'offline',
          timestamp: new Date().toISOString()
        });
      } catch (e) {
        // Ignore errors during shutdown
      }
      
      await orchestrator.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}`));
    
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
}

/**
 * Main device command handler
 */
function deviceCommand() {
  const { Command } = require('commander');
  const command = new Command('device');
  
  command
    .description('Register and manage devices for cloud task execution');
  
  // Register subcommand
  command
    .command('register')
    .description('Register this device with the cloud')
    .option('-n, --name <name>', 'Device name')
    .action(registerDevice);
  
  // List subcommand
  command
    .command('list')
    .alias('ls')
    .description('List registered devices')
    .action(listDevices);
  
  // Remove subcommand
  command
    .command('remove [deviceId]')
    .alias('rm')
    .description('Remove device registration')
    .option('-f, --force', 'Skip confirmation')
    .action(removeDevice);
  
  // Poll subcommand
  command
    .command('poll')
    .description('Start polling for tasks from cloud')
    .option('-i, --interval <ms>', 'Polling interval in milliseconds', '30000')
    .action(pollForTasks);
  
  // Default action - show help
  command.action(() => {
    command.help();
  });
  
  return command;
}

module.exports = deviceCommand;