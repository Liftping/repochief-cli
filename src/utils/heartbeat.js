const { APIClient } = require('./api-client');
const { getWorkspaceInfo, getToken } = require('./workspace');
const EventEmitter = require('events');

/**
 * Workspace heartbeat manager
 * Sends periodic heartbeats to keep workspace connection alive
 */
class HeartbeatManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.interval = options.interval || 30000; // 30 seconds default
    this.retryInterval = options.retryInterval || 60000; // 1 minute retry
    this.maxRetries = options.maxRetries || 3;
    this.timer = null;
    this.retryCount = 0;
    this.workspaceId = null;
    this.apiKey = null;
  }
  
  /**
   * Start heartbeat
   */
  async start() {
    // Get workspace info
    const workspaceInfo = await getWorkspaceInfo();
    if (!workspaceInfo) {
      this.emit('error', new Error('No workspace found'));
      return false;
    }
    
    // Get auth token
    const token = await getToken(workspaceInfo.workspaceId);
    if (!token) {
      this.emit('error', new Error('Not authenticated'));
      return false;
    }
    
    this.workspaceId = workspaceInfo.workspaceId;
    this.client = new APIClient(token);
    
    // Send initial heartbeat
    await this.sendHeartbeat();
    
    // Start periodic heartbeat
    this.timer = setInterval(() => {
      this.sendHeartbeat().catch(error => {
        this.emit('error', error);
      });
    }, this.interval);
    
    this.emit('started');
    return true;
  }
  
  /**
   * Stop heartbeat
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      this.emit('stopped');
    }
  }
  
  /**
   * Send heartbeat to server
   */
  async sendHeartbeat() {
    try {
      // Get workspace API key from storage or registration
      const response = await this.client.post(`/workspaces/${this.workspaceId}/heartbeat`, {
        status: 'active',
        metadata: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid
        }
      });
      
      if (response.success) {
        this.retryCount = 0;
        this.emit('heartbeat', response);
        
        // Store API key if returned
        if (response.api_key) {
          this.apiKey = response.api_key;
        }
      }
      
      return response;
      
    } catch (error) {
      this.retryCount++;
      
      if (this.retryCount >= this.maxRetries) {
        this.emit('disconnected', error);
        this.stop();
      } else {
        this.emit('retry', { count: this.retryCount, error });
        
        // Schedule retry with backoff
        setTimeout(() => {
          this.sendHeartbeat().catch(err => {
            this.emit('error', err);
          });
        }, this.retryInterval * this.retryCount);
      }
      
      throw error;
    }
  }
  
  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.timer !== null,
      workspaceId: this.workspaceId,
      retryCount: this.retryCount,
      uptime: this.timer ? process.uptime() : 0
    };
  }
}

// Singleton instance
let heartbeatInstance = null;

/**
 * Get or create heartbeat manager
 */
function getHeartbeatManager() {
  if (!heartbeatInstance) {
    heartbeatInstance = new HeartbeatManager();
  }
  return heartbeatInstance;
}

module.exports = {
  HeartbeatManager,
  getHeartbeatManager
};