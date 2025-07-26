#!/usr/bin/env node

/**
 * RepoChief CLI
 * 
 * Command-line interface for orchestrating AI coding agents
 */

const { program } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const packageInfo = require('../package.json');

// Load environment variables
require('dotenv').config();

// System requirements check
const { validateForCommand } = require('../src/utils/system-check');

// Commands
const runCommand = require('../src/commands/run');
const initCommand = require('../src/commands/init');
const agentsCommand = require('../src/commands/agents');
const statusCommand = require('../src/commands/status');
const authCommand = require('../src/commands/auth');
const doctorCommand = require('../src/commands/doctor');
const predictCommand = require('../src/commands/predict');

// Prediction integration
const { wrapWithPrediction } = require('../src/integrations/prediction');

// ASCII Art Banner
const banner = `
╔═══════════════════════════════════════╗
║  ____                  ____ _     _   ║
║ |  _ \\ ___ _ __   ___ / ___| |__ (_) ║
║ | |_) / _ \\ '_ \\ / _ | |   | '_ \\| | ║
║ |  _ <  __/ |_) | (_) | |___| | | | | ║
║ |_| \\_\\___| .__/ \\___/\\____|_| |_|_| ║
║           |_|                         ║
║    AI Agent Orchestration Engine      ║
╚═══════════════════════════════════════╝
`;

// Display banner
console.log(chalk.cyan(banner));

// Configure CLI
program
  .name('repochief')
  .description('CLI for orchestrating AI coding agents')
  .version(packageInfo.version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help for command');

// Run command - main execution
program
  .command('run <task-file>')
  .description('Run AI agents with a task configuration file')
  .option('-a, --agents <number>', 'Number of agents to spawn', '3')
  .option('-b, --budget <amount>', 'Total budget in USD', '10')
  .option('-m, --mock', 'Run in mock mode (no API calls)')
  .option('-w, --watch', 'Watch progress in real-time')
  .option('-o, --output <dir>', 'Output directory for results', './output')
  .action(wrapWithPrediction(runCommand, 'run'));

// Init command - setup project
program
  .command('init')
  .description('Initialize a new RepoChief project')
  .option('-n, --name <name>', 'Project name')
  .option('-t, --template <type>', 'Project template (basic|advanced)', 'basic')
  .action(initCommand);

// Agents command - manage agent profiles
program
  .command('agents')
  .description('List available agent profiles')
  .option('-c, --create', 'Create a new agent profile')
  .option('-e, --edit <name>', 'Edit an existing agent profile')
  .option('-j, --json', 'Output in JSON format')
  .action(agentsCommand);

// Status command - check system status
program
  .command('status')
  .description('Check RepoChief system status')
  .option('-s, --session <id>', 'Check specific session status')
  .option('-c, --costs', 'Show cost breakdown')
  .option('-t, --tasks', 'Show task progress')
  .action(statusCommand);

// Auth command - manage authentication
program.addCommand(authCommand());

// Demo command - run the TODO API demo
program
  .command('demo')
  .description('Run the TODO API demo (4-agent swarm)')
  .option('-m, --mock', 'Run in mock mode (recommended for first try)')
  .option('-b, --budget <amount>', 'Budget for the demo', '5')
  .action(async (options) => {
    console.log(chalk.yellow('\n🚀 Starting TODO API Demo...\n'));
    
    // Load and run the demo
    try {
      const demoPath = path.join(__dirname, '../../repochief-core/demo.js');
      
      // Set environment for demo
      if (options.mock) {
        process.env.MOCK_MODE = 'true';
        console.log(chalk.gray('Running in mock mode - no API costs\n'));
      }
      
      if (options.budget) {
        process.env.DEMO_BUDGET = options.budget;
      }
      
      // Check if demo exists
      if (!fs.existsSync(demoPath)) {
        throw new Error('Demo file not found. Please ensure repochief-core is installed.');
      }
      
      // Run the demo
      require(demoPath);
    } catch (error) {
      console.error(chalk.red(`\n❌ Demo failed: ${error.message}\n`));
      console.log(chalk.yellow('Tip: Run "npm install" in packages/repochief-core first\n'));
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive mode')
  .action(async () => {
    const inquirer = require('inquirer');
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🔐 Authenticate with cloud', value: 'auth' },
          { name: '🚀 Run TODO API demo', value: 'demo' },
          { name: '📄 Initialize new project', value: 'init' },
          { name: '🤖 Manage agent profiles', value: 'agents' },
          { name: '📊 Check system status', value: 'status' },
          { name: '🩺 Run system diagnostics', value: 'doctor' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);
    
    if (answers.action === 'exit') {
      console.log(chalk.gray('\nGoodbye! 👋\n'));
      process.exit(0);
    }
    
    // Redirect to appropriate command
    console.log(chalk.yellow(`\nRun: repochief ${answers.action} --help\n`));
  });

// Config command - manage configuration
program
  .command('config')
  .description('Manage RepoChief configuration')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .option('-g, --get <key>', 'Get a configuration value')
  .option('-l, --list', 'List all configuration')
  .option('--api-keys', 'Configure API keys interactively')
  .action(async (options) => {
    if (options.apiKeys) {
      const inquirer = require('inquirer');
      console.log(chalk.yellow('\n🔐 API Key Configuration\n'));
      
      const answers = await inquirer.prompt([
        {
          type: 'list',
          name: 'provider',
          message: 'Which API key would you like to configure?',
          choices: ['OpenAI', 'Anthropic', 'Google AI', 'All', 'Cancel']
        }
      ]);
      
      if (answers.provider !== 'Cancel') {
        console.log(chalk.gray('\nAdd the following to your .env file:'));
        
        if (answers.provider === 'OpenAI' || answers.provider === 'All') {
          console.log('OPENAI_API_KEY=your-openai-key-here');
        }
        if (answers.provider === 'Anthropic' || answers.provider === 'All') {
          console.log('ANTHROPIC_API_KEY=your-anthropic-key-here');
        }
        if (answers.provider === 'Google AI' || answers.provider === 'All') {
          console.log('GOOGLE_API_KEY=your-google-key-here');
        }
        
        console.log(chalk.gray('\nFor more information, see: https://github.com/liftping/repochief#api-keys\n'));
      }
    } else {
      console.log(chalk.yellow('Configuration management coming soon!\n'));
    }
  });

// Doctor command - system diagnostics
program
  .command('doctor')
  .description('Check RepoChief system health and dependencies')
  .option('-v, --verbose', 'Show detailed information')
  .action(doctorCommand);

// Predict command - show predictions for commands
program
  .command('predict <command-name>')
  .description('Show predictions for a command before running it')
  .option('--args <args>', 'Command arguments (space-separated)')
  .option('-a, --agents <number>', 'Number of agents (for run command)')
  .option('-b, --budget <amount>', 'Budget amount (for run command)')
  .option('-m, --mock', 'Mock mode flag (for run command)')
  .option('-w, --watch', 'Watch mode flag (for run command)')
  .option('-o, --output <dir>', 'Output directory (for run command)')
  .option('--stats', 'Show prediction system statistics')
  .action(predictCommand);

// Error handling
program.exitOverride();

// Main CLI entry point
(async () => {
  try {
    // Extract command name from arguments
    const args = process.argv.slice(2);
    let commandName = args[0];
    
    // Handle special cases
    if (!commandName || commandName.startsWith('-')) {
      commandName = 'help';
    }
    
    // Skip validation for these commands
    const skipValidation = ['--version', '-v', '--help', '-h'];
    if (!skipValidation.includes(commandName)) {
      // Quick validation for essential commands
      const isValid = await validateForCommand(commandName);
      if (!isValid) {
        process.exit(1);
      }
    }
    
    // Parse commands
    program.parse(process.argv);
    
    // Show help if no command provided
    if (!process.argv.slice(2).length) {
      program.outputHelp();
      process.exit(0);
    }
  } catch (error) {
    if (error.code === 'commander.unknownCommand') {
      console.error(chalk.red(`\n❌ Unknown command: ${error.message}`));
      console.log(chalk.yellow('Run "repochief --help" to see available commands\n'));
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    }
    process.exit(1);
  }
})();