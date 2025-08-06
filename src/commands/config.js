/**
 * RepoCHief Configuration Command
 * Manages user configuration including API keys
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const ConfigManager = require('@liftping/repochief-core/src/config/ConfigManager');

class ConfigCommand {
    constructor() {
        this.configManager = new ConfigManager();
    }

    async execute(options = {}) {
        try {
            await this.configManager.initialize();

            if (options.apiKeys) {
                return await this.configureAPIKeys();
            } else if (options.set) {
                return await this.setValue(options.set);
            } else if (options.get) {
                return await this.getValue(options.get);
            } else if (options.list) {
                return await this.listConfiguration();
            } else {
                return await this.showConfigMenu();
            }
        } catch (error) {
            console.error(chalk.red(`\n❌ Configuration error: ${error.message}\n`));
            process.exit(1);
        }
    }

    async showConfigMenu() {
        console.log(chalk.cyan('\n🔧 RepoCHief Configuration\n'));

        const choices = [
            { name: '🔐 Configure API Keys', value: 'api-keys' },
            { name: '📊 View Current Configuration', value: 'list' },
            { name: '🎛️ Mock Mode Settings', value: 'mock-mode' },
            { name: '💰 Budget Configuration', value: 'budget' },
            { name: '🧪 Test API Connections', value: 'test-apis' },
            { name: '📤 Export Configuration', value: 'export' },
            { name: '❌ Exit', value: 'exit' }
        ];

        const { action } = await inquirer.prompt([
            {
                type: 'list',
                name: 'action',
                message: 'What would you like to configure?',
                choices
            }
        ]);

        switch (action) {
            case 'api-keys':
                return await this.configureAPIKeys();
            case 'list':
                return await this.listConfiguration();
            case 'mock-mode':
                return await this.configureMockMode();
            case 'budget':
                return await this.configureBudget();
            case 'test-apis':
                return await this.testAPIConnections();
            case 'export':
                return await this.exportConfiguration();
            case 'exit':
                console.log(chalk.gray('\nConfiguration unchanged. Goodbye! 👋\n'));
                return;
        }
    }

    async configureAPIKeys() {
        console.log(chalk.cyan('\n🔐 API Key Configuration\n'));

        const currentKeys = await this.configManager.getAPIKeys();
        const hasKeys = Object.keys(currentKeys).length > 0;

        if (hasKeys) {
            console.log(chalk.green('Current API keys configured:'));
            for (const [provider, key] of Object.entries(currentKeys)) {
                const masked = key ? `${key.substring(0, 8)}...` : 'Not set';
                console.log(chalk.gray(`  ${provider}: ${masked}`));
            }
            console.log();
        }

        const { configureWhat } = await inquirer.prompt([
            {
                type: 'list',
                name: 'configureWhat',
                message: 'What would you like to do?',
                choices: [
                    { name: '🔧 Configure all API keys', value: 'all' },
                    { name: '🎯 Configure specific provider', value: 'specific' },
                    { name: '🗑️ Remove API keys', value: 'remove' },
                    { name: '🧪 Test current keys', value: 'test' },
                    { name: '↩️ Back to main menu', value: 'back' }
                ]
            }
        ]);

        switch (configureWhat) {
            case 'all':
                return await this.configureAllKeys();
            case 'specific':
                return await this.configureSpecificKey();
            case 'remove':
                return await this.removeKeys();
            case 'test':
                return await this.testAPIConnections();
            case 'back':
                return await this.showConfigMenu();
        }
    }

    async configureAllKeys() {
        console.log(chalk.yellow('\n📝 Enter your API keys (leave blank to skip):\n'));

        const questions = [
            {
                type: 'password',
                name: 'openai',
                message: 'OpenAI API Key:',
                mask: '*',
                validate: (input) => !input || input.startsWith('sk-') || 'OpenAI keys start with "sk-"'
            },
            {
                type: 'password',
                name: 'anthropic',
                message: 'Anthropic API Key:',
                mask: '*',
                validate: (input) => !input || input.startsWith('sk-ant-') || 'Anthropic keys start with "sk-ant-"'
            },
            {
                type: 'password',
                name: 'google',
                message: 'Google AI API Key:',
                mask: '*'
            }
        ];

        const answers = await inquirer.prompt(questions);

        // Filter out empty keys
        const apiKeys = {};
        for (const [provider, key] of Object.entries(answers)) {
            if (key && key.trim()) {
                apiKeys[provider] = key.trim();
            }
        }

        if (Object.keys(apiKeys).length === 0) {
            console.log(chalk.yellow('\nNo API keys provided. Configuration unchanged.\n'));
            return;
        }

        // Save the keys
        const saved = await this.configManager.setAPIKeys(apiKeys);
        if (saved) {
            console.log(chalk.green('\n✅ API keys saved successfully!\n'));
            
            // Disable mock mode if keys were configured
            await this.configManager.setMockMode(false);
            console.log(chalk.blue('📱 Mock mode disabled - RepoCHief will now use real APIs\n'));

            // Offer to test the keys
            const { testKeys } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'testKeys',
                    message: 'Test the API keys now?',
                    default: true
                }
            ]);

            if (testKeys) {
                await this.testAPIConnections();
            }
        } else {
            console.log(chalk.red('\n❌ Failed to save API keys\n'));
        }
    }

    async configureSpecificKey() {
        const { provider } = await inquirer.prompt([
            {
                type: 'list',
                name: 'provider',
                message: 'Which provider would you like to configure?',
                choices: [
                    { name: '🤖 OpenAI (GPT models)', value: 'openai' },
                    { name: '🔮 Anthropic (Claude models)', value: 'anthropic' },
                    { name: '🌟 Google AI (Gemini models)', value: 'google' }
                ]
            }
        ]);

        const currentKey = await this.configManager.getAPIKey(provider);
        if (currentKey) {
            console.log(chalk.gray(`Current key: ${currentKey.substring(0, 8)}...\n`));
        }

        const { apiKey } = await inquirer.prompt([
            {
                type: 'password',
                name: 'apiKey',
                message: `Enter ${provider} API key:`,
                mask: '*'
            }
        ]);

        if (!apiKey || !apiKey.trim()) {
            console.log(chalk.yellow('\nNo API key provided. Configuration unchanged.\n'));
            return;
        }

        const saved = await this.configManager.setAPIKey(provider, apiKey.trim());
        if (saved) {
            console.log(chalk.green(`\n✅ ${provider} API key saved successfully!\n`));
            
            // Test the key
            const { testKey } = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'testKey',
                    message: 'Test the API key now?',
                    default: true
                }
            ]);

            if (testKey) {
                await this.testSingleAPI(provider);
            }
        } else {
            console.log(chalk.red('\n❌ Failed to save API key\n'));
        }
    }

    async removeKeys() {
        const currentKeys = await this.configManager.getAPIKeys();
        const providers = Object.keys(currentKeys).filter(key => currentKeys[key]);

        if (providers.length === 0) {
            console.log(chalk.yellow('\nNo API keys currently configured.\n'));
            return;
        }

        const { keysToRemove } = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'keysToRemove',
                message: 'Which API keys would you like to remove?',
                choices: providers.map(provider => ({ name: provider, value: provider }))
            }
        ]);

        if (keysToRemove.length === 0) {
            console.log(chalk.yellow('\nNo keys selected for removal.\n'));
            return;
        }

        const { confirm } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: `Remove ${keysToRemove.join(', ')} API key(s)?`,
                default: false
            }
        ]);

        if (confirm) {
            for (const provider of keysToRemove) {
                await this.configManager.setAPIKey(provider, null);
            }
            console.log(chalk.green('\n✅ API keys removed successfully!\n'));
        } else {
            console.log(chalk.yellow('\nRemoval cancelled.\n'));
        }
    }

    async testAPIConnections() {
        console.log(chalk.cyan('\n🧪 Testing API Connections\n'));

        const apiKeys = await this.configManager.getAPIKeys();
        const providers = Object.keys(apiKeys).filter(key => apiKeys[key]);

        if (providers.length === 0) {
            console.log(chalk.yellow('No API keys configured to test.\n'));
            return;
        }

        for (const provider of providers) {
            console.log(chalk.gray(`Testing ${provider}...`));
            const result = await this.configManager.testAPIKey(provider);
            
            if (result.valid) {
                console.log(chalk.green(`  ✅ ${provider}: Connected successfully`));
                if (result.note) {
                    console.log(chalk.gray(`     ${result.note}`));
                }
            } else {
                console.log(chalk.red(`  ❌ ${provider}: ${result.error}`));
            }
        }
        console.log();
    }

    async testSingleAPI(provider) {
        console.log(chalk.cyan(`\n🧪 Testing ${provider} API...\n`));
        
        const result = await this.configManager.testAPIKey(provider);
        
        if (result.valid) {
            console.log(chalk.green(`✅ ${provider} API: Connected successfully\n`));
        } else {
            console.log(chalk.red(`❌ ${provider} API: ${result.error}\n`));
        }
    }

    async configureMockMode() {
        const currentMockMode = await this.configManager.isMockMode();
        
        console.log(chalk.cyan('\n🎭 Mock Mode Configuration\n'));
        console.log(chalk.gray(`Current mode: ${currentMockMode ? 'Mock (no API calls)' : 'Production (real API calls)'}\n`));

        const { mockMode } = await inquirer.prompt([
            {
                type: 'list',
                name: 'mockMode',
                message: 'Select mode:',
                choices: [
                    { name: '🎭 Mock Mode (safe, no costs, for testing)', value: true },
                    { name: '🚀 Production Mode (real APIs, costs money)', value: false }
                ],
                default: currentMockMode
            }
        ]);

        if (mockMode !== currentMockMode) {
            await this.configManager.setMockMode(mockMode);
            
            if (mockMode) {
                console.log(chalk.green('\n✅ Mock mode enabled - no API costs will be incurred\n'));
            } else {
                const apiKeys = await this.configManager.getAPIKeys();
                if (Object.keys(apiKeys).length === 0) {
                    console.log(chalk.yellow('\n⚠️ Production mode enabled but no API keys configured!'));
                    console.log(chalk.gray('Configure API keys first to avoid errors.\n'));
                } else {
                    console.log(chalk.green('\n✅ Production mode enabled - RepoCHief will use real APIs\n'));
                }
            }
        } else {
            console.log(chalk.gray('\nMode unchanged.\n'));
        }
    }

    async configureBudget() {
        const currentBudget = await this.configManager.getBudgetConfig();
        
        console.log(chalk.cyan('\n💰 Budget Configuration\n'));
        console.log(chalk.gray('Current budget limits:'));
        console.log(chalk.gray(`  Total: $${currentBudget.totalBudget}`));
        console.log(chalk.gray(`  Daily: $${currentBudget.dailyBudget}`));
        console.log(chalk.gray(`  Per Task: $${currentBudget.perTaskBudget}\n`));

        const questions = [
            {
                type: 'number',
                name: 'totalBudget',
                message: 'Total budget limit ($):',
                default: currentBudget.totalBudget,
                validate: (input) => input > 0 || 'Budget must be greater than 0'
            },
            {
                type: 'number',
                name: 'dailyBudget',
                message: 'Daily budget limit ($):',
                default: currentBudget.dailyBudget,
                validate: (input) => input > 0 || 'Budget must be greater than 0'
            },
            {
                type: 'number',
                name: 'perTaskBudget',
                message: 'Per-task budget limit ($):',
                default: currentBudget.perTaskBudget,
                validate: (input) => input > 0 || 'Budget must be greater than 0'
            }
        ];

        const answers = await inquirer.prompt(questions);

        await this.configManager.set('totalBudget', answers.totalBudget);
        await this.configManager.set('dailyBudget', answers.dailyBudget);
        await this.configManager.set('perTaskBudget', answers.perTaskBudget);

        console.log(chalk.green('\n✅ Budget configuration saved!\n'));
    }

    async setValue(keyValue) {
        const [key, value] = keyValue.split('=');
        if (!key || value === undefined) {
            console.log(chalk.red('\n❌ Invalid format. Use: config --set key=value\n'));
            return;
        }

        await this.configManager.set(key, value);
        console.log(chalk.green(`\n✅ Set ${key} = ${value}\n`));
    }

    async getValue(key) {
        const value = await this.configManager.get(key);
        if (value !== undefined) {
            console.log(chalk.gray(`${key}: ${value}`));
        } else {
            console.log(chalk.yellow(`${key}: Not set`));
        }
        console.log();
    }

    async listConfiguration() {
        console.log(chalk.cyan('\n📋 Current Configuration\n'));

        const config = await this.configManager.exportConfig(false);
        
        // System info
        console.log(chalk.blue('System:'));
        console.log(chalk.gray(`  Version: ${config.version || 'Unknown'}`));
        console.log(chalk.gray(`  Mock Mode: ${config.mockMode ? 'Enabled' : 'Disabled'}`));
        console.log(chalk.gray(`  Cloud API: ${config.cloudApiUrl || 'Not set'}`));
        console.log();

        // API Keys
        console.log(chalk.blue('API Keys:'));
        if (config.apiKeys && Object.keys(config.apiKeys).length > 0) {
            for (const [provider, status] of Object.entries(config.apiKeys)) {
                console.log(chalk.gray(`  ${provider}: ${status}`));
            }
        } else {
            console.log(chalk.gray('  No API keys configured'));
        }
        console.log();

        // Budget
        console.log(chalk.blue('Budget Limits:'));
        console.log(chalk.gray(`  Total: $${config.totalBudget || 100}`));
        console.log(chalk.gray(`  Daily: $${config.dailyBudget || 50}`));
        console.log(chalk.gray(`  Per Task: $${config.perTaskBudget || 10}`));
        console.log();

        // Performance
        console.log(chalk.blue('Performance:'));
        console.log(chalk.gray(`  Max Agents: ${config.maxConcurrentAgents || 10}`));
        console.log(chalk.gray(`  Tasks per Agent: ${config.maxTasksPerAgent || 3}`));
        console.log(chalk.gray(`  Task Timeout: ${(config.taskTimeoutMs || 300000) / 1000}s`));
        console.log();
    }

    async exportConfiguration() {
        const config = await this.configManager.exportConfig(false);
        
        console.log(chalk.cyan('\n📤 Configuration Export\n'));
        console.log(JSON.stringify(config, null, 2));
        console.log();
    }
}

module.exports = new ConfigCommand();