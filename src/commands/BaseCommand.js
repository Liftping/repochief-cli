/**
 * Base command class for RepoChief CLI
 * Provides common functionality for all commands
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class BaseCommand {
    constructor() {
        this.configPath = path.join(os.homedir(), '.repochief', 'config.json');
    }

    /**
     * Load configuration from disk
     */
    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const content = fs.readFileSync(this.configPath, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.error('Error loading config:', error.message);
        }
        return {};
    }

    /**
     * Save configuration to disk
     */
    saveConfig(config) {
        try {
            const dir = path.dirname(this.configPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        } catch (error) {
            console.error('Error saving config:', error.message);
        }
    }

    /**
     * Get active context (organization and workspace)
     */
    getActiveContext() {
        const config = this.loadConfig();
        return {
            organization: config.activeOrganization || '@me',
            workspace: config.activeWorkspace,
            apiUrl: config.apiUrl || process.env.REPOCHIEF_API_URL || 'https://api.repochief.com'
        };
    }

    /**
     * Execute command - must be implemented by subclasses
     */
    async execute(subcommand, args) {
        throw new Error('Execute method must be implemented by subclass');
    }
}

module.exports = BaseCommand;