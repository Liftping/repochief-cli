const axios = require('axios');
const { getWorkspaceId, getToken, storeToken } = require('./workspace');

// API configuration
const API_BASE_URL = process.env.REPOCHIEF_API_URL || 'https://kpmanucrhhvkiimjgint.supabase.co/functions/v1';
const API_TIMEOUT = 30000; // 30 seconds

// Supabase anon key for public API calls
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwbWFudWNyaGh2a2lpbWpnaW50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NTUxMTUsImV4cCI6MjA3MDUzMTExNX0.eE5e0dmR8omxy4I1PBM8ug_FhTR7wYLK6V4r0BXzpcQ';

/**
 * API Client with automatic token management
 */
class APIClient {
  constructor(token = null, options = {}) {
    this.token = token;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    this.axios = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': `RepoChief-CLI/${process.env.npm_package_version || '1.0.0'}`
      }
    });
    
    // Define public endpoints that don't need user auth
    this.publicEndpoints = [
      '/auth/device',
      '/auth/token', 
      '/auth/authorize',
      '/auth/refresh'
    ];
    
    // Request interceptor to add auth token
    this.axios.interceptors.request.use(
      async (config) => {
        // Always add Supabase anon key headers for Edge Function access
        config.headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
        config.headers['apikey'] = SUPABASE_ANON_KEY;
        
        // Check if this is a public endpoint
        const isPublicEndpoint = this.publicEndpoints.some(endpoint => 
          config.url?.includes(endpoint)
        );
        
        // Add user auth token if available and not a public endpoint
        if (!isPublicEndpoint) {
          const authToken = await this.getAuthToken();
          if (authToken) {
            // Use x-api-key header for Supabase Edge Functions
            config.headers['x-api-key'] = authToken;
          }
        }
        return config;
      },
      (error) => Promise.reject(error)
    );
    
    // Response interceptor to handle token refresh and retries
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        
        // Initialize retry count
        originalRequest._retryCount = originalRequest._retryCount || 0;
        
        // Only try to refresh if we have a token and it's not a public endpoint
        const isPublicEndpoint = this.publicEndpoints.some(endpoint => 
          originalRequest.url?.includes(endpoint)
        );
        
        // Handle 401 - try token refresh
        if (error.response?.status === 401 && !originalRequest._retry && !isPublicEndpoint) {
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
        
        // Handle network errors and 5xx errors with retry
        const shouldRetry = !error.response || 
                          (error.response.status >= 500 && error.response.status < 600) ||
                          error.code === 'ECONNABORTED' ||
                          error.code === 'ENOTFOUND' ||
                          error.code === 'ETIMEDOUT';
        
        if (shouldRetry && originalRequest._retryCount < this.maxRetries) {
          originalRequest._retryCount++;
          
          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, originalRequest._retryCount - 1);
          
          await new Promise(resolve => setTimeout(resolve, delay));
          
          return this.axios(originalRequest);
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
    
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) return null;
    
    // Check if we have a cached access token
    if (this.accessToken) {
      // Proactively refresh if token expires within 5 minutes
      const fiveMinutes = 5 * 60 * 1000;
      if (this.accessTokenExpiry && this.accessTokenExpiry - Date.now() < fiveMinutes) {
        // Token is about to expire, refresh proactively
        try {
          const refreshToken = await getToken(workspaceId);
          if (refreshToken) {
            await this.handleTokenRefresh();
            return this.accessToken;
          }
        } catch (error) {
          // Refresh failed, return null
          return null;
        }
      }
      
      // Token is still valid
      if (this.accessTokenExpiry > Date.now()) {
        return this.accessToken;
      }
    }
    
    // Don't try to refresh on initial auth - just return null
    // The auth flow will handle getting the initial tokens
    return null;
  }
  
  /**
   * Handle token refresh
   */
  async handleTokenRefresh() {
    const workspaceId = await getWorkspaceId();
    if (!workspaceId) throw new Error('Not authenticated');
    
    const refreshToken = await getToken(workspaceId);
    if (!refreshToken) throw new Error('No refresh token available');
    
    // Import here to avoid circular dependency
    const { refreshAccessToken } = require('./oauth');
    
    // Refresh the token
    const tokens = await refreshAccessToken(refreshToken);
    
    // Store new refresh token if rotated
    if (tokens.refresh_token && tokens.refresh_token !== refreshToken) {
      await storeToken(workspaceId, tokens.refresh_token);
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
  
  async revokeWorkspaceToken(workspaceId) {
    return await this.post('/auth/revoke', { device_id: workspaceId });
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
  
  async updateDevice(workspaceId, updates) {
    return await this.patch(`/devices/${workspaceId}`, updates);
  }
  
  async deleteDevice(workspaceId) {
    return await this.delete(`/devices/${workspaceId}`);
  }
  
  async syncPull(lastSyncAt = null) {
    return await this.post('/sync/pull', { last_sync_at: lastSyncAt });
  }
  
  async syncPush(data) {
    return await this.post('/sync/push', data);
  }
  
  async getUsage(workspaceId = null) {
    const params = workspaceId ? { device_id: workspaceId } : {};
    return await this.get('/usage', params);
  }

  // Intent management methods for Supabase Edge Functions
  async getIntents() {
    return await this.get('/intents');
  }

  async getIntent(id) {
    return await this.get(`/intents/${id}`);
  }

  async createIntent(intentData) {
    return await this.post('/intents', intentData);
  }

  async updateIntent(id, updates) {
    return await this.put(`/intents/${id}`, updates);
  }

  async deleteIntent(id) {
    return await this.delete(`/intents/${id}`);
  }

  // Workspace registration for CLI
  async registerWorkspace(userData) {
    return await this.post('/workspaces/register-cli', userData);
  }

  async getWorkspace() {
    return await this.get('/workspaces');
  }

  async updateWorkspace(updates) {
    return await this.put('/workspaces', updates);
  }
}

module.exports = { APIClient };