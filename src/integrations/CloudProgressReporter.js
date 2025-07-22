/**
 * Cloud Progress Reporter
 * Sends metadata-only progress updates to RepoChief Cloud Progress API
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

class CloudProgressReporter {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || process.env.REPOCHIEF_CLOUD_API_URL || 'http://localhost:3001';
        this.apiKey = options.apiKey || process.env.REPOCHIEF_API_KEY;
        this.enabled = options.enabled !== false && !!this.apiUrl;
        this.timeout = options.timeout || 5000; // 5 second timeout
        this.retryAttempts = options.retryAttempts || 3;
        
        if (!this.enabled) {
            console.warn('CloudProgressReporter: Disabled (no API URL configured)');
        }
    }

    /**
     * Send progress update to cloud API (metadata only)
     */
    async send(progressData) {
        if (!this.enabled) {
            return { success: false, reason: 'disabled' };
        }

        // Sanitize data - ensure no code/prompts are included
        const sanitizedData = this.sanitizeProgressData(progressData);

        try {
            const result = await this.makeRequest(sanitizedData);
            return { success: true, data: result };
        } catch (error) {
            console.error('CloudProgressReporter: Failed to send progress:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send multiple progress updates in batch
     */
    async sendBatch(progressUpdates) {
        if (!this.enabled) {
            return { success: false, reason: 'disabled' };
        }

        const results = await Promise.allSettled(
            progressUpdates.map(update => this.send(update))
        );

        const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failed = results.length - successful;

        return {
            success: failed === 0,
            total: results.length,
            successful,
            failed
        };
    }

    /**
     * Test connection to cloud API
     */
    async testConnection() {
        if (!this.enabled) {
            return { success: false, reason: 'disabled' };
        }

        try {
            const url = new URL('/health', this.apiUrl);
            const result = await this.makeHttpRequest('GET', url.href, null, 3000);
            return { 
                success: true, 
                status: result.status,
                version: result.version 
            };
        } catch (error) {
            return { 
                success: false, 
                error: error.message 
            };
        }
    }

    /**
     * Sanitize progress data to ensure privacy
     */
    sanitizeProgressData(data) {
        const sanitized = {
            swarmId: data.swarmId,
            taskId: data.taskId,
            agentId: data.agentId || null,
            status: data.status,
            progress: typeof data.progress === 'number' ? data.progress : 0,
            tokensUsed: typeof data.tokensUsed === 'number' ? data.tokensUsed : 0,
            cost: typeof data.cost === 'number' ? data.cost : 0,
            timestamp: data.timestamp || Date.now()
        };

        // Optional message (but not code/prompts)
        if (data.message && typeof data.message === 'string' && data.message.length < 200) {
            sanitized.message = data.message;
        }

        // Remove any potentially sensitive fields
        const sensitiveFields = [
            'code', 'prompt', 'response', 'content', 'output', 
            'result', 'payload', 'context', 'instructions'
        ];

        sensitiveFields.forEach(field => {
            if (sanitized[field]) {
                delete sanitized[field];
            }
        });

        return sanitized;
    }

    /**
     * Make HTTP request with retry logic
     */
    async makeRequest(data, attempt = 1) {
        try {
            const url = new URL('/api/progress', this.apiUrl);
            const result = await this.makeHttpRequest('POST', url.href, data, this.timeout);
            return result;
        } catch (error) {
            if (attempt < this.retryAttempts) {
                const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                console.warn(`CloudProgressReporter: Attempt ${attempt} failed, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this.makeRequest(data, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Make HTTP request (Node.js built-in)
     */
    makeHttpRequest(method, url, data, timeout) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const postData = data ? JSON.stringify(data) : null;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'RepoChief-CLI/0.1.0'
                },
                timeout: timeout
            };

            if (this.apiKey) {
                options.headers['x-repochief-key'] = this.apiKey;
            }

            if (postData) {
                options.headers['Content-Length'] = Buffer.byteLength(postData);
            }

            const req = httpModule.request(options, (res) => {
                let responseBody = '';

                res.on('data', (chunk) => {
                    responseBody += chunk;
                });

                res.on('end', () => {
                    try {
                        const result = responseBody ? JSON.parse(responseBody) : {};
                        
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(result);
                        } else {
                            reject(new Error(`HTTP ${res.statusCode}: ${result.error || responseBody}`));
                        }
                    } catch (parseError) {
                        reject(new Error(`Invalid JSON response: ${responseBody}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`Request failed: ${error.message}`));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error(`Request timeout (${timeout}ms)`));
            });

            if (postData) {
                req.write(postData);
            }

            req.end();
        });
    }

    /**
     * Create progress reporter from environment
     */
    static fromEnvironment() {
        return new CloudProgressReporter({
            apiUrl: process.env.REPOCHIEF_CLOUD_API_URL,
            apiKey: process.env.REPOCHIEF_API_KEY,
            enabled: process.env.REPOCHIEF_CLOUD_ENABLED !== 'false'
        });
    }
}

module.exports = CloudProgressReporter;