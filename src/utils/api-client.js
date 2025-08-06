const axios = require('axios');
const { getDeviceId, getToken, storeToken } = require('./device');

// API configuration
const API_BASE_URL = process.env.REPOCHIEF_API_URL || 'https://api.repochief.com/api';
const API_TIMEOUT = 30000; // 30 seconds

/**
 * API Client with automatic token management
 */
class APIClient {
  constructor(token = null) {
    this.token = token;
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `RepoChief-CLI/${process.env.npm_package_version || '1.0.0'}`
      }
    });
    
    // Request interceptor to add auth token
    this.axios.interceptors.request.use(
      async (config) => {
        const authToken = await this.getAuthToken();
        if (authToken) {
          config.headers.Authorization = `Bearer ${authToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor to handle token refresh
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.handleTokenRefresh();
            return this.axios(originalRequest);
          } catch (refreshError) {
            // Refresh failed, user needs to login again
            const authError = new Error('Authentication expired. Please login again.');
            authError.code = 'UNAUTHORIZED';
            throw authError;
          }
        }
        
        return Promise.reject(error);
      }
    );
  }
  
  /**
   * Get auth token (from constructor or storage)
   */
  async getAuthToken() {
    if (this.token) return this.token;
    
    const deviceId = await getDeviceId();
    if (!deviceId) return null;
    
    // Try to get access token from memory/cache
    if (this.accessToken && this.accessTokenExpiry > Date.now()) {
      return this.accessToken;
    }
    
    // Get refresh token from storage
    const refreshToken = await getToken(deviceId);
    return refreshToken;
  }
  
  /**
   * Handle token refresh
   */
  async handleTokenRefresh() {
    const deviceId = await getDeviceId();
    if (!deviceId) throw new Error('Not authenticated');
    
    const refreshToken = await getToken(deviceId);
    if (!refreshToken) throw new Error('No refresh token available');
    
    // Import here to avoid circular dependency
    const { refreshAccessToken } = require('./oauth');
    
    // Refresh the token
    const tokens = await refreshAccessToken(refreshToken);
    
    // Store new refresh token if rotated
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      await storeToken(deviceId, tokens.refresh_token);
    }
    
    // Cache access token in memory
    this.accessToken = tokens.access_token;
    this.accessTokenExpiry = Date.now() + (tokens.expires_in * 1000);
    
    return tokens.access_token;
  }
  
  /**
   * HTTP methods
   */
  async get(path, params = {}) {
    const response = await this.axios.get(path, { params });
    return response.data;
  }
  
  async post(path, data = {}) {
    const response = await this.axios.post(path, data);
    return response.data;
  }
  
  async put(path, data = {}) {
    const response = await this.axios.put(path, data);
    return response.data;
  }
  
  async patch(path, data = {}) {
    const response = await this.axios.patch(path, data);
    return response.data;
  }
  
  async delete(path) {
    const response = await this.axios.delete(path);
    return response.data;
  }
  
  /**
   * API methods
   */
  async validateToken(token) {
    // Temporarily use provided token
    const client = new APIClient(token);
    return await client.get('/auth/validate');
  }
  
  async getStatus() {
    return await this.get('/user/status');
  }
  
  async revokeDeviceToken(deviceId) {
    return await this.post('/auth/revoke', { device_id: deviceId });
  }
  
  async revokeAllTokens() {
    return await this.post('/auth/revoke', { all_devices: true });
  }
  
  async getDevices() {
    return await this.get('/devices');
  }
  
  async registerDevice(deviceInfo) {
    return await this.post('/devices', deviceInfo);
  }
  
  async updateDevice(deviceId, updates) {
    return await this.patch(`/devices/${deviceId}`, updates);
  }
  
  async deleteDevice(deviceId) {
    return await this.delete(`/devices/${deviceId}`);
  }
  
  async syncPull(lastSyncAt = null) {
    return await this.post('/sync/pull', { last_sync_at: lastSyncAt });
  }
  
  async syncPush(data) {
    return await this.post('/sync/push', data);
  }
  
  async getUsage(deviceId = null) {
    const params = deviceId ? { device_id: deviceId } : {};
    return await this.get('/usage', params);
  }
}

module.exports = { APIClient };