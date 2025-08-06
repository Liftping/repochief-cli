/**
 * Context management for RepoChief CLI
 * Manages organization and workspace context for commands
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const chalk = require('chalk');

// Context storage path
const CONTEXT_FILE = path.join(os.homedir(), '.repochief', 'context.json');

/**
 * Default context structure
 */
const DEFAULT_CONTEXT = {
  organization: '@me',  // Personal organization
  workspace: 'default', // Default workspace
  apiUrl: process.env.REPOCHIEF_API_URL || 'https://api.repochief.com'
};

/**
 * Ensure context directory exists
 */
async function ensureContextDir() {
  const dir = path.dirname(CONTEXT_FILE);
  try {
    await fs.access(dir);
  } catch (error) {
    await fs.mkdir(dir, { recursive: true });
  }
}

/**
 * Get current context
 * @returns {Promise<Object>} Current context
 */
async function getCurrentContext() {
  try {
    await ensureContextDir();
    const data = await fs.readFile(CONTEXT_FILE, 'utf8');
    const context = JSON.parse(data);
    
    // Ensure all required fields exist
    return {
      ...DEFAULT_CONTEXT,
      ...context
    };
  } catch (error) {
    // Context file doesn't exist or is invalid, return defaults
    return { ...DEFAULT_CONTEXT };
  }
}

/**
 * Set current context
 * @param {Object} newContext - New context to set
 * @returns {Promise<void>}
 */
async function setCurrentContext(newContext) {
  try {
    await ensureContextDir();
    const currentContext = await getCurrentContext();
    const updatedContext = { ...currentContext, ...newContext };
    
    await fs.writeFile(CONTEXT_FILE, JSON.stringify(updatedContext, null, 2));
    
    console.log(chalk.green(`✅ Context updated:`));
    console.log(`   Organization: ${updatedContext.organization}`);
    console.log(`   Workspace: ${updatedContext.workspace}`);
  } catch (error) {
    console.error(chalk.red(`❌ Failed to save context: ${error.message}`));
    throw error;
  }
}

/**
 * Switch organization
 * @param {string} orgId - Organization ID
 * @returns {Promise<void>}
 */
async function switchOrganization(orgId) {
  await setCurrentContext({ 
    organization: orgId,
    workspace: 'default' // Reset to default workspace
  });
}

/**
 * Switch workspace  
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<void>}
 */
async function switchWorkspace(workspaceId) {
  await setCurrentContext({ workspace: workspaceId });
}

/**
 * Get context for display
 * @returns {Promise<string>} Formatted context string
 */
async function getContextString() {
  const context = await getCurrentContext();
  return `${context.organization}/${context.workspace}`;
}

/**
 * Validate context exists and user has access
 * @returns {Promise<boolean>} True if context is valid
 */
async function validateContext() {
  try {
    const context = await getCurrentContext();
    const { getApiClient } = require('./api');
    
    const client = await getApiClient();
    
    // Try to access the organization/workspace
    const url = `/api/v1/orgs/${context.organization}/workspaces/${context.workspace}`;
    await client.get(url);
    
    return true;
  } catch (error) {
    console.warn(chalk.yellow(`⚠️ Context validation failed: ${error.message}`));
    return false;
  }
}

module.exports = {
  getCurrentContext,
  setCurrentContext,
  switchOrganization,
  switchWorkspace,
  getContextString,
  validateContext,
  DEFAULT_CONTEXT
};