/**
 * Init Command - Initialize a new RepoChief project
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const ora = require('ora');

/**
 * Project templates
 */
const templates = {
  basic: {
    tasks: [
      {
        id: 'analyze-code',
        type: 'comprehension',
        objective: 'Analyze the existing codebase structure',
        context: ['src/', 'README.md'],
        maxTokens: 30000
      },
      {
        id: 'implement-feature',
        type: 'generation',
        objective: 'Implement a new feature based on requirements',
        dependencies: ['analyze-code'],
        successCriteria: [
          'Follow existing code patterns',
          'Include error handling',
          'Add appropriate comments'
        ],
        maxTokens: 50000
      },
      {
        id: 'create-tests',
        type: 'generation',
        objective: 'Create unit tests for the new feature',
        dependencies: ['implement-feature'],
        successCriteria: [
          'Test happy path',
          'Test error cases',
          'Achieve 80% coverage'
        ],
        maxTokens: 40000
      }
    ]
  },
  advanced: {
    tasks: [
      {
        id: 'security-audit',
        type: 'validation',
        objective: 'Perform security audit of the codebase',
        context: ['src/', 'config/'],
        specificChecks: [
          'SQL injection vulnerabilities',
          'XSS vulnerabilities',
          'Authentication flaws',
          'Dependency vulnerabilities'
        ],
        maxTokens: 60000
      },
      {
        id: 'architecture-review',
        type: 'exploration',
        objective: 'Review and document system architecture',
        constraints: [
          'Identify scalability bottlenecks',
          'Suggest improvements',
          'Document current patterns'
        ],
        maxTokens: 80000
      },
      {
        id: 'refactor-code',
        type: 'generation',
        objective: 'Refactor identified problem areas',
        dependencies: ['security-audit', 'architecture-review'],
        successCriteria: [
          'Maintain backward compatibility',
          'Improve code maintainability',
          'Fix security issues',
          'Add comprehensive documentation'
        ],
        maxTokens: 100000
      }
    ]
  }
};

/**
 * Init command handler
 */
async function initCommand(options) {
  try {
    console.log(chalk.blue('\n🚀 RepoChief Project Initialization\n'));
    
    // Gather project information
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Project name:',
        default: options.name || path.basename(process.cwd()),
        validate: (input) => input.trim().length > 0 || 'Project name is required'
      },
      {
        type: 'list',
        name: 'template',
        message: 'Select a project template:',
        choices: [
          { name: 'Basic - Simple code analysis and feature development', value: 'basic' },
          { name: 'Advanced - Security audit and architecture review', value: 'advanced' },
          { name: 'Custom - Start with an empty configuration', value: 'custom' }
        ],
        default: options.template || 'basic'
      },
      {
        type: 'confirm',
        name: 'createEnv',
        message: 'Create .env file for API keys?',
        default: true
      },
      {
        type: 'confirm',
        name: 'setupApiKeys',
        message: 'Would you like to configure API keys now?',
        default: true,
        when: (answers) => answers.createEnv
      }
    ]);
    
    const projectDir = path.join(process.cwd(), answers.name);
    
    // Check if directory exists
    if (fs.existsSync(projectDir)) {
      const overwrite = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: `Directory "${answers.name}" already exists. Overwrite?`,
          default: false
        }
      ]);
      
      if (!overwrite.overwrite) {
        console.log(chalk.yellow('\nInitialization cancelled.\n'));
        return;
      }
    }
    
    // Create project structure
    const spinner = ora('Creating project structure...').start();
    
    // Create directories
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'tasks'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'output'), { recursive: true });
    fs.mkdirSync(path.join(projectDir, 'agents'), { recursive: true });
    
    // Create task configuration
    let taskConfig;
    if (answers.template === 'custom') {
      taskConfig = {
        name: answers.name,
        description: 'RepoChief task configuration',
        tasks: []
      };
    } else {
      taskConfig = {
        name: answers.name,
        description: `RepoChief ${answers.template} project`,
        ...templates[answers.template]
      };
    }
    
    fs.writeFileSync(
      path.join(projectDir, 'tasks', 'default.json'),
      JSON.stringify(taskConfig, null, 2)
    );
    
    // Create .env file
    let keyAnswers; // Declare in outer scope
    if (answers.createEnv) {
      let apiKeys = {
        openai: 'your-openai-api-key-here',
        anthropic: 'your-anthropic-api-key-here',
        google: 'your-google-api-key-here'
      };
      
      // Interactive API key setup
      if (answers.setupApiKeys) {
        console.log(chalk.blue('\n🔐 API Key Setup\n'));
        console.log(chalk.gray('Leave blank to skip any key\n'));
        
        keyAnswers = await inquirer.prompt([
          {
            type: 'password',
            name: 'openaiKey',
            message: 'OpenAI API Key (sk-...):',
            mask: '*',
            validate: (input) => {
              if (!input) return true; // Allow empty
              if (input.startsWith('sk-') && input.length > 20) return true;
              return 'Invalid OpenAI key format (should start with sk-)';
            }
          },
          {
            type: 'password',
            name: 'anthropicKey',
            message: 'Anthropic API Key (sk-ant-...):',
            mask: '*',
            validate: (input) => {
              if (!input) return true; // Allow empty
              if (input.startsWith('sk-ant-') && input.length > 20) return true;
              return 'Invalid Anthropic key format (should start with sk-ant-)';
            }
          },
          {
            type: 'confirm',
            name: 'testKeys',
            message: 'Would you like to test the API keys?',
            default: true,
            when: (answers) => answers.openaiKey || answers.anthropicKey
          }
        ]);
        
        if (keyAnswers.openaiKey) apiKeys.openai = keyAnswers.openaiKey;
        if (keyAnswers.anthropicKey) apiKeys.anthropic = keyAnswers.anthropicKey;
        
        // Test API keys if requested
        if (keyAnswers.testKeys) {
          spinner.text = 'Testing API keys...';
          spinner.start();
          
          try {
            // Import the AI client for testing
            const { getAIModelClient } = require('@liftping/repochief-core/src/api/AIModelClient');
            
            // Set env vars temporarily for testing
            if (keyAnswers.openaiKey) process.env.OPENAI_API_KEY = keyAnswers.openaiKey;
            if (keyAnswers.anthropicKey) process.env.ANTHROPIC_API_KEY = keyAnswers.anthropicKey;
            
            const client = getAIModelClient({ mockMode: false });
            const health = await client.healthCheck();
            
            spinner.stop();
            
            if (keyAnswers.openaiKey) {
              console.log(chalk.green(`✅ OpenAI: ${health.openai ? 'Connected' : 'Failed - ' + health.openaiError}`));
            }
            if (keyAnswers.anthropicKey) {
              console.log(chalk.green(`✅ Anthropic: ${health.anthropic ? 'Connected' : 'Failed - ' + health.anthropicError}`));
            }
            console.log();
            
          } catch (error) {
            spinner.stop();
            console.log(chalk.yellow('⚠️  Could not test API keys. You can test them later with: repochief status\n'));
          }
        }
      }
      
      const envContent = `# RepoChief API Keys
# Get your API keys from:
# - OpenAI: https://platform.openai.com/api-keys
# - Anthropic: https://console.anthropic.com/
# - Google AI: https://makersuite.google.com/app/apikey

OPENAI_API_KEY=${apiKeys.openai}
ANTHROPIC_API_KEY=${apiKeys.anthropic}
GOOGLE_API_KEY=${apiKeys.google}

# Optional: Set default model
# DEFAULT_MODEL=gpt-4o

# Optional: Set mock mode for testing
# MOCK_MODE=true
`;
      
      fs.writeFileSync(path.join(projectDir, '.env'), envContent);
      
      // Create .env.example with placeholders
      const exampleContent = envContent
        .replace(apiKeys.openai, 'your-openai-api-key-here')
        .replace(apiKeys.anthropic, 'your-anthropic-api-key-here')
        .replace(apiKeys.google, 'your-google-api-key-here');
      
      fs.writeFileSync(path.join(projectDir, '.env.example'), exampleContent);
    }
    
    // Create .gitignore
    const gitignoreContent = `# Environment variables
.env
.env.local

# Output files
output/
*.log

# Dependencies
node_modules/

# OS files
.DS_Store
Thumbs.db

# RepoChief
.repochief/
*.db
`;
    
    fs.writeFileSync(path.join(projectDir, '.gitignore'), gitignoreContent);
    
    // Create README
    const readmeContent = `# ${answers.name}

A RepoChief AI agent orchestration project.

## Setup

1. Install RepoChief CLI:
   \`\`\`bash
   npm install -g @liftping/repochief-cli
   \`\`\`

2. Configure API keys:
   - Copy \`.env.example\` to \`.env\`
   - Add your API keys

3. Run tasks:
   \`\`\`bash
   repochief run tasks/default.json
   \`\`\`

## Project Structure

- \`tasks/\` - Task configuration files
- \`output/\` - Generated results
- \`agents/\` - Custom agent profiles

## Task Configuration

Edit \`tasks/default.json\` to customize your AI agent tasks.

## Learn More

- [RepoChief Documentation](https://github.com/liftping/repochief)
- [Task Configuration Guide](https://github.com/liftping/repochief/docs/tasks.md)
`;
    
    fs.writeFileSync(path.join(projectDir, 'README.md'), readmeContent);
    
    // Create example custom agent
    if (answers.template !== 'custom') {
      const customAgent = {
        name: 'domain-expert',
        role: 'code_generator',
        model: 'gpt-4o',
        capabilities: ['generation', 'comprehension', 'refactoring'],
        constraints: {
          maxContextTokens: 80000,
          temperature: 0.7,
          preferredLanguages: ['JavaScript', 'TypeScript'],
          specializations: ['Your domain here']
        }
      };
      
      fs.writeFileSync(
        path.join(projectDir, 'agents', 'domain-expert.json'),
        JSON.stringify(customAgent, null, 2)
      );
    }
    
    spinner.succeed('Project created successfully!');
    
    // Display next steps
    console.log(chalk.green('\n✅ Project initialized!\n'));
    console.log(chalk.blue('Next steps:'));
    console.log(chalk.gray(`1. cd ${answers.name}`));
    if (answers.createEnv) {
      if (!answers.setupApiKeys || (!keyAnswers?.openaiKey && !keyAnswers?.anthropicKey)) {
        console.log(chalk.gray('2. Edit .env and add your API keys'));
        console.log(chalk.gray('3. Run: repochief demo --mock  (to test without API costs)'));
        console.log(chalk.gray('4. Run: repochief run tasks/default.json'));
      } else {
        console.log(chalk.gray('2. Run: repochief demo  (your API keys are configured!)'));
        console.log(chalk.gray('3. Run: repochief run tasks/default.json'));
        console.log(chalk.gray('Tip: Use --mock flag to avoid API costs during testing'));
      }
    } else {
      console.log(chalk.gray('2. Create .env file with your API keys'));
      console.log(chalk.gray('3. Run: repochief run tasks/default.json'));
    }
    console.log();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Initialization failed: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = initCommand;