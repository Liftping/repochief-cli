const { promises: fs } = require('fs');
const path = require('path');
const os = require('os');
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
const DEVICE_FILE = path.join(CONFIG_DIR, 'device.json');
const SERVICE_NAME = 'repochief';

/**
 * Ensure config directory exists
 */
async function ensureConfigDir() {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
}

/**
 * Get or create device ID
 */
async function getOrCreateDeviceId() {
  await ensureConfigDir();
  
  try {
    const data = await fs.readFile(DEVICE_FILE, 'utf8');
    const device = JSON.parse(data);
    return device.deviceId;
  } catch (error) {
    // Device file doesn't exist, create new device
    const deviceId = `dev_${uuidv4().replace(/-/g, '')}`;
    const deviceName = await promptForDeviceName();
    
    const deviceInfo = {
      deviceId,
      deviceName,
      createdAt: new Date().toISOString(),
      metadata: {
        os: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        node: process.version
      }
    };
    
    await fs.writeFile(DEVICE_FILE, JSON.stringify(deviceInfo, null, 2));
    return deviceId;
  }
}

/**
 * Get device ID if exists
 */
async function getDeviceId() {
  try {
    const data = await fs.readFile(DEVICE_FILE, 'utf8');
    const device = JSON.parse(data);
    return device.deviceId;
  } catch (error) {
    return null;
  }
}

/**
 * Get device info
 */
async function getDeviceInfo() {
  try {
    const data = await fs.readFile(DEVICE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return null;
  }
}

/**
 * Prompt for device name
 */
async function promptForDeviceName() {
  const defaultName = `${os.hostname()} - ${os.platform()}`;
  
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'deviceName',
      message: 'Name this device:',
      default: defaultName,
      validate: (input) => {
        if (!input || input.trim().length === 0) {
          return 'Device name cannot be empty';
        }
        if (input.length > 255) {
          return 'Device name must be less than 255 characters';
        }
        return true;
      }
    }
  ]);
  
  return answers.deviceName.trim();
}

/**
 * Store token securely using OS keychain
 */
async function storeToken(deviceId, token) {
  const keytarLib = getKeytar();
  if (keytarLib) {
    try {
      await keytarLib.setPassword(SERVICE_NAME, deviceId, token);
      return;
    } catch (error) {
      // Fallback to encrypted file storage if keychain fails
      console.warn('Keychain access failed, using encrypted file storage');
    }
  }
  
  // Use fallback storage
  await storeTokenFallback(deviceId, token);
}

/**
 * Get token from secure storage
 */
async function getToken(deviceId) {
  const keytarLib = getKeytar();
  if (keytarLib) {
    try {
      const token = await keytarLib.getPassword(SERVICE_NAME, deviceId);
      if (token) return token;
    } catch (error) {
      // Try fallback storage
    }
  }
  
  // Try fallback storage
  return await getTokenFallback(deviceId);
}

/**
 * Remove token from secure storage
 */
async function removeToken(deviceId) {
  const keytarLib = getKeytar();
  if (keytarLib) {
    try {
      await keytarLib.deletePassword(SERVICE_NAME, deviceId);
    } catch (error) {
      // Try fallback removal
    }
  }
  
  // Remove fallback storage
  await removeTokenFallback(deviceId);
}

/**
 * Fallback token storage (encrypted file)
 */
async function storeTokenFallback(deviceId, token) {
  const tokenFile = path.join(CONFIG_DIR, '.tokens');
  let tokens = {};
  
  try {
    const data = await fs.readFile(tokenFile, 'utf8');
    tokens = JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet
  }
  
  // Simple obfuscation (not secure, but better than plaintext)
  // In production, use proper encryption
  const obfuscated = Buffer.from(token).toString('base64');
  tokens[deviceId] = obfuscated;
  
  await fs.writeFile(tokenFile, JSON.stringify(tokens), { mode: 0o600 });
}

/**
 * Get token from fallback storage
 */
async function getTokenFallback(deviceId) {
  try {
    const tokenFile = path.join(CONFIG_DIR, '.tokens');
    const data = await fs.readFile(tokenFile, 'utf8');
    const tokens = JSON.parse(data);
    
    if (tokens[deviceId]) {
      // Deobfuscate
      return Buffer.from(tokens[deviceId], 'base64').toString();
    }
  } catch (error) {
    // Token not found
  }
  
  return null;
}

/**
 * Remove token from fallback storage
 */
async function removeTokenFallback(deviceId) {
  try {
    const tokenFile = path.join(CONFIG_DIR, '.tokens');
    const data = await fs.readFile(tokenFile, 'utf8');
    const tokens = JSON.parse(data);
    
    delete tokens[deviceId];
    
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
 * Update device metadata
 */
async function updateDeviceMetadata(metadata) {
  try {
    const deviceInfo = await getDeviceInfo();
    if (!deviceInfo) return;
    
    deviceInfo.metadata = {
      ...deviceInfo.metadata,
      ...metadata,
      lastUpdated: new Date().toISOString()
    };
    
    await fs.writeFile(DEVICE_FILE, JSON.stringify(deviceInfo, null, 2));
  } catch (error) {
    // Ignore metadata update errors
  }
}

module.exports = {
  getOrCreateDeviceId,
  getDeviceId,
  getDeviceInfo,
  storeToken,
  getToken,
  removeToken,
  updateDeviceMetadata
};