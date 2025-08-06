/**
 * API utilities for RepoChief CLI
 * Provides API client instances and helpers
 */

const { getClient } = require('../auth/AuthManager');

/**
 * Get authenticated API client instance
 * @returns {Promise<APIClient>} Authenticated API client
 */
async function getApiClient() {
  return await getClient();
}

/**
 * Get public API client instance (no authentication required)
 * @returns {APIClient} Public API client
 */
function getPublicApiClient() {
  const { APIClient } = require('./api-client');
  return new APIClient();
}

module.exports = {
  getApiClient,
  getPublicApiClient
};