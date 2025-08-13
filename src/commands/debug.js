const chalk = require('chalk');
const ora = require('ora');
const { APIClient } = require('../utils/api-client');
const { getWorkspaceInfo, getToken } = require('../utils/workspace');
const { getHeartbeatManager } = require('../utils/heartbeat');

/**
 * Debug connection and configuration
 */
class DebugCommand {
  async execute(args) {
    console.log(chalk.cyan('🔍 RepoCHief Connection Diagnostics\n'));
    
    // Check workspace configuration
    await this.checkWorkspace();
    
    // Check authentication
    await this.checkAuth();
    
    // Check API connectivity
    await this.checkAPI();
    
    // Check heartbeat
    await this.checkHeartbeat();
    
    // Check Edge Functions
    await this.checkEdgeFunctions();
    
    console.log(chalk.cyan('\n✅ Diagnostics complete'));
  }
  
  async checkWorkspace() {
    console.log(chalk.bold('1. Workspace Configuration:'));
    
    try {
      const workspaceInfo = await getWorkspaceInfo();
      
      if (workspaceInfo) {
        console.log(chalk.green('  ✓ Workspace found'));
        console.log(`    ID: ${workspaceInfo.workspaceId}`);
        console.log(`    Name: ${workspaceInfo.workspaceName}`);
        console.log(`    Created: ${workspaceInfo.createdAt}`);
      } else {
        console.log(chalk.yellow('  ⚠ No workspace configured'));
        console.log(chalk.gray('    Run: repochief auth login'));
      }
    } catch (error) {
      console.log(chalk.red('  ✗ Error reading workspace:'), error.message);
    }
  }
  
  async checkAuth() {
    console.log(chalk.bold('\n2. Authentication:'));
    
    try {
      const workspaceInfo = await getWorkspaceInfo();
      if (!workspaceInfo) {
        console.log(chalk.yellow('  ⚠ No workspace to check auth'));
        return;
      }
      
      const token = await getToken(workspaceInfo.workspaceId);
      
      if (token) {
        console.log(chalk.green('  ✓ Token found'));
        console.log(`    Type: ${token.startsWith('ws_') ? 'API Key' : 'OAuth Token'}`);
        console.log(`    Length: ${token.length} chars`);
        
        // Validate token
        const client = new APIClient(token);
        try {
          const validation = await client.get('/auth/validate');
          console.log(chalk.green('  ✓ Token is valid'));
          console.log(`    User: ${validation.user_id}`);
        } catch (error) {
          console.log(chalk.red('  ✗ Token validation failed:'), error.message);
        }
      } else {
        console.log(chalk.yellow('  ⚠ No authentication token'));
        console.log(chalk.gray('    Run: repochief auth login'));
      }
    } catch (error) {
      console.log(chalk.red('  ✗ Error checking auth:'), error.message);
    }
  }
  
  async checkAPI() {
    console.log(chalk.bold('\n3. API Connectivity:'));
    
    const apiUrl = process.env.REPOCHIEF_API_URL || 'https://kpmanucrhhvkiimjgint.supabase.co/functions/v1';
    console.log(`  Endpoint: ${apiUrl}`);
    
    const spinner = ora('  Testing connection...').start();
    
    try {
      const client = new APIClient();
      const start = Date.now();
      
      // Test basic connectivity
      const response = await client.get('/auth');
      const latency = Date.now() - start;
      
      spinner.succeed(`Connection successful (${latency}ms)`);
      
      if (response.message) {
        console.log(`    Response: ${response.message}`);
      }
      
      // Test each endpoint
      const endpoints = response.endpoints || [];
      if (endpoints.length > 0) {
        console.log(`    Available endpoints: ${endpoints.length}`);
        endpoints.forEach(ep => {
          console.log(`      - ${ep}`);
        });
      }
      
    } catch (error) {
      spinner.fail('Connection failed');
      console.log(chalk.red('    Error:'), error.message);
      
      if (error.code === 'ENOTFOUND') {
        console.log(chalk.yellow('    ⚠ DNS resolution failed'));
      } else if (error.code === 'ETIMEDOUT') {
        console.log(chalk.yellow('    ⚠ Connection timeout'));
      } else if (error.response) {
        console.log(`    Status: ${error.response.status}`);
      }
    }
  }
  
  async checkHeartbeat() {
    console.log(chalk.bold('\n4. Heartbeat Status:'));
    
    const heartbeat = getHeartbeatManager();
    const status = heartbeat.getStatus();
    
    if (status.connected) {
      console.log(chalk.green('  ✓ Heartbeat active'));
      console.log(`    Workspace: ${status.workspaceId}`);
      console.log(`    Uptime: ${Math.floor(status.uptime)}s`);
      console.log(`    Retries: ${status.retryCount}`);
    } else {
      console.log(chalk.yellow('  ⚠ Heartbeat not running'));
      
      // Try to start it
      console.log(chalk.gray('  Attempting to start heartbeat...'));
      
      try {
        const started = await heartbeat.start();
        if (started) {
          console.log(chalk.green('  ✓ Heartbeat started successfully'));
          
          // Stop it after test
          setTimeout(() => heartbeat.stop(), 1000);
        }
      } catch (error) {
        console.log(chalk.red('  ✗ Failed to start heartbeat:'), error.message);
      }
    }
  }
  
  async checkEdgeFunctions() {
    console.log(chalk.bold('\n5. Edge Functions:'));
    
    const functions = [
      { name: 'auth', path: '/auth' },
      { name: 'workspaces', path: '/workspaces' },
      { name: 'intents', path: '/intents' }
    ];
    
    for (const func of functions) {
      try {
        const client = new APIClient();
        const start = Date.now();
        
        // Just check if function responds
        await client.get(func.path).catch(err => {
          // We expect 404 or 401, but that means function is running
          if (err.response && (err.response.status === 404 || err.response.status === 401)) {
            return { status: 'responding' };
          }
          throw err;
        });
        
        const latency = Date.now() - start;
        console.log(chalk.green(`  ✓ ${func.name}: OK (${latency}ms)`));
        
      } catch (error) {
        console.log(chalk.red(`  ✗ ${func.name}: Failed`));
        
        if (error.response) {
          console.log(`    Status: ${error.response.status}`);
        } else {
          console.log(`    Error: ${error.message}`);
        }
      }
    }
  }
}

module.exports = DebugCommand;