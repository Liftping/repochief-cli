const { APIClient } = require('./api-client');

// OAuth configuration
const CLIENT_ID = 'repochief-cli';
const SCOPES = ['read', 'write', 'offline_access'];
const POLL_INTERVAL = 5000; // 5 seconds
const MAX_POLL_TIME = 300000; // 5 minutes

/**
 * OAuth 2.0 Workspace Flow implementation
 */
async function workspaceFlow() {
  const client = new APIClient();
  
  // Step 1: Request device code
  const deviceCodeResponse = await requestDeviceCode(client);
  
  // Step 2: Return auth data with poll function
  return {
    ...deviceCodeResponse,
    pollForToken: () => pollForToken(client, deviceCodeResponse)
  };
}

/**
 * Request device code from authorization server
 */
async function requestDeviceCode(client) {
  try {
    const response = await client.post('/auth/device', {
      client_id: CLIENT_ID,
      scope: SCOPES.join(' ')
    });
    
    return {
      device_code: response.device_code,
      user_code: response.user_code,
      verification_uri: response.verification_uri,
      verification_uri_complete: response.verification_uri_complete,
      expires_in: response.expires_in,
      interval: response.interval || 5
    };
  } catch (error) {
    throw new Error(`Failed to initiate device flow: ${error.message}`);
  }
}

/**
 * Poll for token after user authorization
 */
async function pollForToken(client, deviceCodeResponse) {
  const { device_code, interval = 5, expires_in } = deviceCodeResponse;
  const pollInterval = interval * 1000; // Convert to milliseconds
  const expiresAt = Date.now() + (expires_in * 1000);
  
  return new Promise((resolve, reject) => {
    const poll = async () => {
      // Check if code has expired
      if (Date.now() > expiresAt) {
        reject(new Error('Device code expired. Please try again.'));
        return;
      }
      
      try {
        const response = await client.post('/auth/token', {
          device_code,
          client_id: CLIENT_ID,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
        });
        
        // Success! User has authorized
        resolve({
          access_token: response.access_token,
          refresh_token: response.refresh_token,
          token_type: response.token_type || 'Bearer',
          expires_in: response.expires_in,
          scope: response.scope,
          user: response.user,
          user_id: response.user_id  // Now returns Clerk user ID
        });
        
      } catch (error) {
        if (error.response?.status === 400) {
          const errorCode = error.response.data?.error;
          
          switch (errorCode) {
            case 'authorization_pending':
              // User hasn't authorized yet, continue polling
              setTimeout(poll, pollInterval);
              break;
              
            case 'slow_down':
              // Increase polling interval
              setTimeout(poll, pollInterval * 2);
              break;
              
            case 'access_denied':
              reject(new Error('Access denied by user'));
              break;
              
            case 'expired_token':
              reject(new Error('Device code expired'));
              break;
              
            default:
              reject(new Error(`Authorization failed: ${errorCode || 'Unknown error'}`));
          }
        } else {
          // Network or server error, retry with backoff
          setTimeout(poll, Math.min(pollInterval * 2, 30000));
        }
      }
    };
    
    // Start polling
    setTimeout(poll, pollInterval);
  });
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken(refreshToken) {
  const client = new APIClient();
  
  try {
    const response = await client.post('/auth/refresh', {
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      grant_type: 'refresh_token'
    });
    
    return {
      access_token: response.access_token,
      refresh_token: response.refresh_token || refreshToken, // New refresh token if rotated
      token_type: response.token_type || 'Bearer',
      expires_in: response.expires_in
    };
  } catch (error) {
    if (error.response?.status === 401) {
      throw new Error('Refresh token expired. Please login again.');
    }
    throw new Error(`Failed to refresh token: ${error.message}`);
  }
}

/**
 * Validate Personal Access Token
 */
async function validatePAT(token) {
  const client = new APIClient(token);
  
  try {
    const response = await client.get('/auth/validate');
    return {
      valid: true,
      user: response.user,
      scopes: response.scopes,
      workspace: response.workspace
    };
  } catch (error) {
    if (error.response?.status === 401) {
      return { valid: false };
    }
    throw error;
  }
}

module.exports = {
  workspaceFlow,
  refreshAccessToken,
  validatePAT
};