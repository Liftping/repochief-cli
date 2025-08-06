/**
 * Authentication Manager for RepoChief CLI
 * Provides authenticated API client instances
 */

const { APIClient } = require('../utils/api-client');
const { getDeviceId, getToken } = require('../utils/device');
const chalk = require('chalk');

/**
 * Get authenticated API client
 * @returns {Promise<APIClient>} Authenticated API client instance
 */
async function getClient() {
  try {
    const deviceId = await getDeviceId();
    
    if (!deviceId) {
      console.error(chalk.red('\n❌ Not authenticated. Please login first:'));
      console.log(chalk.yellow('   repochief auth login\n'));
      process.exit(1);
    }
    
    const token = await getToken(deviceId);
    if (!token) {
      console.error(chalk.red('\n❌ No valid token found. Please login again:'));
      console.log(chalk.yellow('   repochief auth login\n'));
      process.exit(1);
    }
    
    return new APIClient(token);
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
    const deviceId = await getDeviceId();
    if (!deviceId) return false;
    
    const token = await getToken(deviceId);
    return !!token;
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