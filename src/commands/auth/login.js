const { Command } = require('commander');
const chalk = require('chalk');
const open = require('open');
const ora = require('ora');
const { getOrCreateWorkspaceId, storeToken } = require('../../utils/workspace');
const { workspaceFlow } = require('../../utils/oauth');
const { APIClient } = require('../../utils/api-client');

/**
 * Login command for OAuth workspace flow authentication
 */
function createLoginCommand() {
  const command = new Command('login');
  
  command
    .description('Authenticate with RepoChief cloud')
    .option('--token <token>', 'Use a Personal Access Token (PAT) instead of OAuth')
    .option('--no-browser', 'Don\'t automatically open the browser')
    .action(async (options) => {
      try {
        if (options.token) {
          await handleTokenAuth(options.token);
        } else {
          await handleOAuthFlow(options);
        }
      } catch (error) {
        console.error(chalk.red('Authentication failed:'), error.message);
        process.exit(1);
      }
    });

  return command;
}

/**
 * Handle Personal Access Token authentication
 */
async function handleTokenAuth(token) {
  const spinner = ora('Validating token...').start();
  
  try {
    // Get or create workspace ID
    const workspaceId = await getOrCreateWorkspaceId();
    
    // Validate token with API
    const client = new APIClient();
    const response = await client.validateToken(token);
    
    if (response.valid) {
      // Store token securely
      await storeToken(workspaceId, token);
      
      spinner.succeed('Authentication successful!');
      console.log(chalk.green(`✓ Logged in as ${response.user.email}`));
      console.log(chalk.gray(`  Workspace: ${workspaceId}`));
    } else {
      spinner.fail('Invalid token');
      throw new Error('The provided token is invalid or expired');
    }
  } catch (error) {
    spinner.fail('Authentication failed');
    throw error;
  }
}

/**
 * Handle OAuth workspace flow authentication
 */
async function handleOAuthFlow(options) {
  const spinner = ora('Initializing authentication...').start();
  
  try {
    // Start workspace flow (no auth needed for device flow)
    const authData = await workspaceFlow();
    
    spinner.stop();
    
    // Display user instructions
    console.log('');
    console.log(chalk.cyan('To authenticate your CLI device:'));
    console.log('');
    console.log('1. Visit: ' + chalk.bold.white(authData.verification_uri));
    console.log('2. Sign in to your dashboard account ' + chalk.yellow('(required)'));
    console.log('3. Enter code: ' + chalk.bold.green(authData.user_code));
    console.log('');
    console.log(chalk.dim('Note: You must have a RepoCHief account. Sign up at https://app.repochief.com'));
    console.log('');
    
    // Open browser if not disabled
    if (options.browser !== false) {
      const fullUrl = authData.verification_uri_complete || 
                      `${authData.verification_uri}?user_code=${authData.user_code}`;
      await open(fullUrl);
    }
    
    // Poll for completion
    spinner.text = 'Waiting for authentication...';
    spinner.start();
    
    const tokens = await authData.pollForToken();
    
    // Get or create workspace ID after auth succeeds
    const workspaceId = await getOrCreateWorkspaceId();
    
    // Store tokens securely
    await storeToken(workspaceId, tokens.refresh_token);
    
    spinner.succeed('Authentication successful!');
    console.log(chalk.green(`✓ Logged in as ${tokens.user.email}`));
    console.log(chalk.gray(`  Workspace: ${workspaceId}`));
    
    // Show next steps
    console.log('');
    console.log(chalk.cyan('Next steps:'));
    console.log('  • Run', chalk.bold('repochief status'), 'to verify connection');
    console.log('  • Run', chalk.bold('repochief sync'), 'to synchronize your projects');
    
  } catch (error) {
    spinner.fail('Authentication failed');
    throw error;
  }
}

module.exports = createLoginCommand;