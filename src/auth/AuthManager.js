/**
 * Authentication Manager for RepoChief CLI
 * Provides authenticated API client instances
 * 
 * Updated to use workspace-based authentication for consistency
 * with auth commands (login/logout/status)
 */

const { APIClient } = require('../utils/api-client');
const { getWorkspaceId, getToken } = require('../utils/workspace');
const { getDeviceId, getToken: getDeviceToken } = require('../utils/device');
const chalk = require('chalk');

/**
 * Get authenticated API client
 * @returns {Promise<APIClient>} Authenticated API client instance
 */
async function getClient() {
  try {
    // Try workspace-based authentication first (primary system)
    const workspaceId = await getWorkspaceId();
    
    if (workspaceId) {
      const token = await getToken(workspaceId);
      if (token) {
        return new APIClient(token);
      }
    }
    
    // Fallback to legacy device-based authentication for backward compatibility
    const deviceId = await getDeviceId();
    if (deviceId) {
      const deviceToken = await getDeviceToken(deviceId);
      if (deviceToken) {
        console.warn(chalk.yellow('⚠️  Using legacy device authentication. Consider running: repochief auth login'));
        return new APIClient(deviceToken);
      }
    }
    
    // No authentication found
    console.error(chalk.red('\n❌ No valid token found. Please login first:'));
    console.log(chalk.yellow('   repochief auth login\n'));
    process.exit(1);
  } catch (error) {
    console.error(chalk.red(`\n❌ Authentication error: ${error.message}`));
    console.log(chalk.yellow('Try logging in again: repochief auth login\n'));
    process.exit(1);
  }
}

/**
 * Get API client without authentication (for public endpoints)
 * @returns {APIClient} Unauthenticated API client instance
 */
function getPublicClient() {
  return new APIClient();
}

/**
 * Check if user is authenticated
 * @returns {Promise<boolean>} True if authenticated
 */
async function isAuthenticated() {
  try {
    // Check workspace-based authentication first
    const workspaceId = await getWorkspaceId();
    if (workspaceId) {
      const token = await getToken(workspaceId);
      if (token) return true;
    }
    
    // Fallback to legacy device-based authentication
    const deviceId = await getDeviceId();
    if (deviceId) {
      const deviceToken = await getDeviceToken(deviceId);
      if (deviceToken) return true;
    }
    
    return false;
  } catch (error) {
    return false;
  }
}

/**
 * Validate current authentication
 * @returns {Promise<boolean>} True if valid
 */
async function validateAuth() {
  try {
    const client = await getClient();
    await client.validateToken();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  getClient,
  getPublicClient,
  isAuthenticated,
  validateAuth
};