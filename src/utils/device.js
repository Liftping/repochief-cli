/**
 * Device utilities for RepoChief CLI
 * Manages device identification and token storage
 */

const os = require('os');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Try to load keytar, but fall back if not available
let keytar;
try {
  keytar = require('keytar');
} catch (err) {
  console.warn('Keytar not available, using file-based token storage');
  keytar = null;
}

const SERVICE_NAME = 'repochief-cli';
const CONFIG_DIR = path.join(os.homedir(), '.repochief');
const DEVICE_FILE = path.join(CONFIG_DIR, 'device.json');

/**
 * Get or create a unique device ID
 * @returns {Promise<string>} Device ID
 */
async function getDeviceId() {
  try {
    // Ensure config directory exists
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    
    // Check if device ID already exists
    try {
      const data = await fs.readFile(DEVICE_FILE, 'utf8');
      const config = JSON.parse(data);
      if (config.deviceId) {
        return config.deviceId;
      }
    } catch (err) {
      // File doesn't exist or is invalid, create new ID
    }
    
    // Generate new device ID
    const deviceId = crypto.randomBytes(16).toString('hex');
    const deviceInfo = {
      deviceId,
      hostname: os.hostname(),
      platform: os.platform(),
      createdAt: new Date().toISOString()
    };
    
    await fs.writeFile(DEVICE_FILE, JSON.stringify(deviceInfo, null, 2));
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    return null;
  }
}

/**
 * Get device information
 * @returns {Promise<Object>} Device information
 */
async function getDeviceInfo() {
  try {
    const data = await fs.readFile(DEVICE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version
    };
  }
}

/**
 * Store authentication token securely
 * @param {string} deviceId - Device ID
 * @param {string} token - Authentication token
 * @returns {Promise<void>}
 */
async function setToken(deviceId, token) {
  if (keytar) {
    try {
      await keytar.setPassword(SERVICE_NAME, deviceId, token);
      return;
    } catch (error) {
      // Fall through to file storage
    }
  }
  
  // Fallback to file storage
  const tokenFile = path.join(CONFIG_DIR, '.token');
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(tokenFile, JSON.stringify({ deviceId, token }), { mode: 0o600 });
}

/**
 * Retrieve authentication token
 * @param {string} deviceId - Device ID
 * @returns {Promise<string|null>} Token or null if not found
 */
async function getToken(deviceId) {
  if (keytar) {
    try {
      const token = await keytar.getPassword(SERVICE_NAME, deviceId);
      if (token) return token;
    } catch (error) {
      // Fall through to file storage
    }
  }
  
  // Try file storage fallback
  try {
    const tokenFile = path.join(CONFIG_DIR, '.token');
    const data = await fs.readFile(tokenFile, 'utf8');
    const stored = JSON.parse(data);
    if (stored.deviceId === deviceId) {
      return stored.token;
    }
  } catch (err) {
    // No token found
  }
  
  return null;
}

/**
 * Remove authentication token
 * @param {string} deviceId - Device ID
 * @returns {Promise<void>}
 */
async function removeToken(deviceId) {
  if (keytar) {
    try {
      await keytar.deletePassword(SERVICE_NAME, deviceId);
    } catch (error) {
      // Ignore keytar errors
    }
  }
  
  // Also remove file storage
  try {
    const tokenFile = path.join(CONFIG_DIR, '.token');
    await fs.unlink(tokenFile);
  } catch (err) {
    // Ignore if file doesn't exist
  }
}

/**
 * Clear all device data
 * @returns {Promise<void>}
 */
async function clearDevice() {
  try {
    const deviceId = await getDeviceId();
    if (deviceId) {
      await removeToken(deviceId);
    }
    await fs.unlink(DEVICE_FILE);
  } catch (err) {
    // Ignore errors
  }
}

module.exports = {
  getDeviceId,
  getDeviceInfo,
  setToken,
  getToken,
  removeToken,
  clearDevice
};