/**
 * Clerk Authentication for RepoCHief CLI
 * Handles device flow and token management
 */

const { createClerkClient } = require('@clerk/backend');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const open = require('open');

class ClerkAuthManager {
    constructor() {
        this.configDir = path.join(os.homedir(), '.repochief');
        this.tokenFile = path.join(this.configDir, 'clerk-auth.json');
        this.clerk = null;
        
        // Initialize Clerk client if secret key is available
        if (process.env.CLERK_SECRET_KEY) {
            this.clerk = createClerkClient({
                secretKey: process.env.CLERK_SECRET_KEY
            });
        }
    }

    /**
     * Start device flow authentication
     */
    async startDeviceFlow() {
        console.log('🔐 Starting Clerk authentication...\n');
        
        // For now, we'll use a browser-based flow
        // In production, this would use Clerk's device flow API
        const authUrl = process.env.CLERK_AUTH_URL || 'https://app.repochief.com/cli-auth';
        
        console.log('Please visit this URL to authenticate:');
        console.log(`\n  ${authUrl}\n`);
        
        console.log('Or scan this QR code:');
        // TODO: Generate QR code
        
        // Try to open browser automatically
        try {
            await open(authUrl);
            console.log('✅ Browser opened automatically');
        } catch (error) {
            console.log('⚠️  Please open the URL manually in your browser');
        }
        
        // Poll for token (in production, this would poll Clerk's API)
        console.log('\nWaiting for authentication...');
        return this.pollForToken();
    }

    /**
     * Poll for authentication completion
     */
    async pollForToken() {
        // In production, this would poll Clerk's device flow endpoint
        // For now, we'll simulate with a local file check
        
        const maxAttempts = 60; // 5 minutes
        const interval = 5000; // 5 seconds
        
        for (let i = 0; i < maxAttempts; i++) {
            // Check if token file was created by the web auth flow
            if (await fs.pathExists(this.tokenFile)) {
                const tokenData = await fs.readJson(this.tokenFile);
                if (tokenData.token) {
                    console.log('✅ Authentication successful!');
                    return tokenData;
                }
            }
            
            // Show progress
            process.stdout.write('.');
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        
        throw new Error('Authentication timeout - please try again');
    }

    /**
     * Save authentication token
     */
    async saveToken(tokenData) {
        await fs.ensureDir(this.configDir);
        await fs.writeJson(this.tokenFile, {
            ...tokenData,
            timestamp: new Date().toISOString()
        }, { spaces: 2 });
    }

    /**
     * Load saved authentication token
     */
    async loadToken() {
        try {
            if (await fs.pathExists(this.tokenFile)) {
                return await fs.readJson(this.tokenFile);
            }
        } catch (error) {
            console.error('Error loading token:', error);
        }
        return null;
    }

    /**
     * Verify if current token is valid
     */
    async verifyToken(token) {
        if (!this.clerk) {
            // Fallback to API verification
            return this.verifyTokenViaAPI(token);
        }
        
        try {
            // Verify with Clerk SDK
            const verification = await this.clerk.verifyToken(token);
            return verification.status === 'verified';
        } catch (error) {
            console.error('Token verification error:', error);
            return false;
        }
    }

    /**
     * Verify token via API call
     */
    async verifyTokenViaAPI(token) {
        try {
            const response = await fetch(`${process.env.REPOCHIEF_API_URL || 'https://api.repochief.com'}/api/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get current authentication status
     */
    async getAuthStatus() {
        const tokenData = await this.loadToken();
        
        if (!tokenData) {
            return { authenticated: false };
        }
        
        // Check if token is still valid
        const isValid = await this.verifyToken(tokenData.token);
        
        if (!isValid) {
            // Token expired or invalid
            await this.clearAuth();
            return { authenticated: false };
        }
        
        return {
            authenticated: true,
            user: tokenData.user,
            organization: tokenData.organization
        };
    }

    /**
     * Clear authentication
     */
    async clearAuth() {
        try {
            await fs.remove(this.tokenFile);
            console.log('✅ Logged out successfully');
        } catch (error) {
            console.error('Error clearing auth:', error);
        }
    }

    /**
     * Get authentication headers for API requests
     */
    async getAuthHeaders() {
        const tokenData = await this.loadToken();
        
        if (!tokenData || !tokenData.token) {
            throw new Error('Not authenticated. Please run: repochief auth login');
        }
        
        return {
            'Authorization': `Bearer ${tokenData.token}`,
            'X-Organization-ID': tokenData.organization?.id
        };
    }

    /**
     * Switch organization
     */
    async switchOrganization(orgId) {
        const tokenData = await this.loadToken();
        
        if (!tokenData) {
            throw new Error('Not authenticated');
        }
        
        // Update organization in saved token
        tokenData.organization = { id: orgId };
        await this.saveToken(tokenData);
        
        console.log('✅ Switched organization');
    }
}

module.exports = ClerkAuthManager;