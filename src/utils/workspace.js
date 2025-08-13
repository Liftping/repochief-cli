const { promises: fs } = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const inquirer = require('inquirer');

// Lazy load keytar to avoid loading errors on systems without libsecret
let keytar;
function getKeytar() {
  if (!keytar) {
    try {
      keytar = require('keytar');
    } catch (error) {
      // keytar not available - will use fallback token storage
      keytar = null;
    }
  }
  return keytar;
}

// Configuration directory
const CONFIG_DIR = path.join(os.homedir(), '.repochief');
const WORKSPACE_FILE = path.join(CONFIG_DIR, 'workspace.json');
const SERVICE_NAME = 'repochief';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const IV_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

/**
 * Get or create workspace ID
 */
async function getOrCreateWorkspaceId(options = {}) {
  await ensureConfigDir();
  
  try {
    const data = await fs.readFile(WORKSPACE_FILE, 'utf8');
    const workspace = JSON.parse(data);
    return workspace.workspaceId;
  } catch (error) {
    // Workspace file doesn't exist, create new workspace
    const workspaceId = `ws_${uuidv4().replace(/-/g, '')}`;
    const workspaceName = await promptForWorkspaceName(options);
    
    const workspaceInfo = {
      workspaceId,
      workspaceName,
      createdAt: new Date().toISOString(),
      metadata: {
        os: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        node: process.version
      }
    };
    
    await fs.writeFile(WORKSPACE_FILE, JSON.stringify(workspaceInfo, null, 2));
    return workspaceId;
  }
}

/**
 * Get workspace ID if exists
 */
async function getWorkspaceId() {
  try {
    const data = await fs.readFile(WORKSPACE_FILE, 'utf8');
    const workspace = JSON.parse(data);
    return workspace.workspaceId;
  } catch (error) {
    return null;
  }
}

/**
 * Get workspace info
 */
async function getWorkspaceInfo() {
  try {
    const data = await fs.readFile(WORKSPACE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Prompt for workspace name
 */
/**
 * Check if running in non-interactive environment
 */
function isNonInteractive() {
  return !process.stdin.isTTY || 
         process.env.CI === 'true' || 
         process.env.REPOCHIEF_AUTO_WORKSPACE === 'true';
}

/**
 * Generate unique default workspace name
 */
function generateDefaultWorkspaceName() {
  const hostname = os.hostname();
  const platform = os.platform();
  const shortHash = crypto.randomBytes(3).toString('hex'); // 6-char hex
  return `${hostname}-${platform}-${shortHash}`;
}

/**
 * Prompt for workspace name with non-interactive fallback
 */
async function promptForWorkspaceName(options = {}) {
  // Check for explicit workspace name from options or environment
  if (options.workspaceName) {
    return options.workspaceName.trim();
  }
  
  if (process.env.REPOCHIEF_WORKSPACE_NAME) {
    return process.env.REPOCHIEF_WORKSPACE_NAME.trim();
  }
  
  // Generate default name for fallback
  const defaultName = generateDefaultWorkspaceName();
  
  // Use auto-generated name if explicitly requested or in non-interactive environment
  if (options.autoWorkspace || isNonInteractive()) {
    return defaultName;
  }
  
  // Interactive prompt with timeout
  try {
    const answers = await Promise.race([
      inquirer.prompt([
        {
          type: 'input',
          name: 'workspaceName',
          message: 'Name this workspace:',
          default: defaultName,
          validate: (input) => {
            if (!input || input.trim().length === 0) {
              return 'Workspace name cannot be empty';
            }
            if (input.length > 255) {
              return 'Workspace name must be less than 255 characters';
            }
            return true;
          }
        }
      ]),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('PROMPT_TIMEOUT')), 30000)
      )
    ]);
    
    return answers.workspaceName.trim();
  } catch (error) {
    if (error.message === 'PROMPT_TIMEOUT') {
      throw new Error(
        'Cannot prompt in this environment. Use --workspace-name <name> or --auto-workspace ' +
        '(or set REPOCHIEF_WORKSPACE_NAME environment variable).'
      );
    }
    throw error;
  }
}

/**
 * Store token securely using OS keychain
 */
async function storeToken(workspaceId, token) {
  const keytarLib = getKeytar();
  if (keytarLib) {
    try {
      await keytarLib.setPassword(SERVICE_NAME, workspaceId, token);
      return;
    } catch (error) {
      // Fallback to encrypted file storage if keychain fails
      console.warn('Keychain access failed, using encrypted file storage');
    }
  }
  
  // Use fallback storage
  await storeTokenFallback(workspaceId, token);
}

/**
 * Get token from secure storage
 */
async function getToken(workspaceId) {
  const keytarLib = getKeytar();
  if (keytarLib) {
    try {
      const token = await keytarLib.getPassword(SERVICE_NAME, workspaceId);
      if (token) return token;
    } catch (error) {
      // Try fallback storage
    }
  }
  
  // Try fallback storage
  return await getTokenFallback(workspaceId);
}

/**
 * Remove token from secure storage
 */
async function removeToken(workspaceId) {
  const keytarLib = getKeytar();
  if (keytarLib) {
    try {
      await keytarLib.deletePassword(SERVICE_NAME, workspaceId);
    } catch (error) {
      // Try fallback removal
    }
  }
  
  // Remove fallback storage
  await removeTokenFallback(workspaceId);
}

/**
 * Get or create encryption key derived from machine ID
 */
function getEncryptionKey() {
  // Use machine-specific data as key material
  const machineId = `${os.hostname()}-${os.platform()}-${os.arch()}-${os.homedir()}`;
  // Add a fixed salt for RepoCHief
  const salt = crypto.createHash('sha256').update('repochief-cli-token-encryption').digest();
  // Derive key using PBKDF2
  return crypto.pbkdf2Sync(machineId, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt token using AES-256-GCM
 */
function encryptToken(token) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(token, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const tag = cipher.getAuthTag();
  
  // Combine salt, iv, tag, and encrypted data
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt token using AES-256-GCM
 */
function decryptToken(encryptedData) {
  const data = Buffer.from(encryptedData, 'base64');
  
  if (data.length < SALT_LENGTH + IV_LENGTH + TAG_LENGTH) {
    throw new Error('Invalid encrypted data');
  }
  
  const salt = data.slice(0, SALT_LENGTH);
  const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = data.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const encrypted = data.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}

/**
 * Fallback token storage (encrypted file)
 */
async function storeTokenFallback(workspaceId, token) {
  await ensureConfigDir(); // Ensure directory exists
  
  const tokenFile = path.join(CONFIG_DIR, '.tokens');
  let tokens = {};
  
  try {
    const data = await fs.readFile(tokenFile, 'utf8');
    tokens = JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet
  }
  
  // Encrypt token using AES-256-GCM
  const encrypted = encryptToken(token);
  tokens[workspaceId] = encrypted;
  
  await fs.writeFile(tokenFile, JSON.stringify(tokens), { mode: 0o600 });
}

/**
 * Get token from fallback storage
 */
async function getTokenFallback(workspaceId) {
  try {
    const tokenFile = path.join(CONFIG_DIR, '.tokens');
    const data = await fs.readFile(tokenFile, 'utf8');
    const tokens = JSON.parse(data);
    
    if (tokens[workspaceId]) {
      try {
        // Try to decrypt with new encryption
        return decryptToken(tokens[workspaceId]);
      } catch (error) {
        // Fallback for old base64 tokens (migration path)
        try {
          const decoded = Buffer.from(tokens[workspaceId], 'base64').toString();
          // If it's a valid token (starts with expected format), migrate it
          if (decoded && (decoded.startsWith('sbp_') || decoded.includes('.'))) {
            // Re-save with proper encryption
            await storeTokenFallback(workspaceId, decoded);
            return decoded;
          }
        } catch (legacyError) {
          // Not a legacy token either
        }
        throw error; // Re-throw original decryption error
      }
    }
  } catch (error) {
    // Token not found or decryption failed
  }
  
  return null;
}

/**
 * Remove token from fallback storage
 */
async function removeTokenFallback(workspaceId) {
  try {
    const tokenFile = path.join(CONFIG_DIR, '.tokens');
    const data = await fs.readFile(tokenFile, 'utf8');
    const tokens = JSON.parse(data);
    
    delete tokens[workspaceId];
    
    if (Object.keys(tokens).length === 0) {
      // Remove file if no tokens left
      await fs.unlink(tokenFile);
    } else {
      await fs.writeFile(tokenFile, JSON.stringify(tokens), { mode: 0o600 });
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Update workspace metadata
 */
async function updateWorkspaceMetadata(metadata) {
  try {
    const workspaceInfo = await getWorkspaceInfo();
    if (!workspaceInfo) return;
    
    workspaceInfo.metadata = {
      ...workspaceInfo.metadata,
      ...metadata,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(WORKSPACE_FILE, JSON.stringify(workspaceInfo, null, 2));
  } catch (error) {
    // Ignore metadata update errors
  }
}

module.exports = {
  getOrCreateWorkspaceId,
  getWorkspaceId,
  getWorkspaceInfo,
  storeToken,
  getToken,
  removeToken,
  updateWorkspaceMetadata
};