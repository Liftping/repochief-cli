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

// Analytics for development acceleration
const { trackCommand, trackError, flushAnalytics } = require('../src/utils/analytics');

// Commands
const runCommand = require('../src/commands/run');
const initCommand = require('../src/commands/init');
const agentsCommand = require('../src/commands/agents');
const statusCommand = require('../src/commands/status');
const authCommand = require('../src/commands/auth');
const doctorCommand = require('../src/commands/doctor');
const predictCommand = require('../src/commands/predict');
const orgCommand = require('../src/commands/org');
const workspaceCommand = require('../src/commands/workspace');
const scheduleCommand = require('../src/commands/schedule');
const deploymentCommand = require('../src/commands/deployment');
const intentCommand = require('../src/commands/intent');
const migrateCommand = require('../src/commands/migrate');
const configCommand = require('../src/commands/config');
const deviceCommand = require('../src/commands/device');

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
  .option('-l, --use-local', 'Use local AI tool execution via adapters')
  .option('--adapter <type>', 'AI adapter to use (claude-code, aider)', 'claude-code')
  .option('--mode <mode>', 'Execution mode (hybrid, adapter, direct-tmux)', 'hybrid')
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

// Organization command - manage organizations
program
  .command('org [subcommand]')
  .description('Manage organizations')
  .action((subcommand, options) => {
    orgCommand.execute(subcommand, options);
  });

// Workspace command - manage workspaces
program
  .command('workspace [subcommand]')
  .alias('ws')
  .description('Manage workspaces')
  .action((subcommand, options) => {
    workspaceCommand.execute(subcommand, options);
  });

// Schedule command - manage scheduled tasks
program
  .command('schedule [subcommand]')
  .description('Manage scheduled tasks')
  .action((subcommand, options) => {
    scheduleCommand.execute(subcommand, options);
  });

// Deployment command - monitor deployments
program.addCommand(deploymentCommand);

// Intent command - manage intents
program
  .command('intent [subcommand]')
  .description('Manage intents (Intent Canvas)')
  .action((subcommand, options) => {
    intentCommand.execute(subcommand, options);
  });

// Migrate command - import/export markdown
program
  .command('migrate [subcommand] [args...]')
  .description('Migrate between markdown and database')
  .action((subcommand, args, options) => {
    migrateCommand.execute(subcommand, { _: args, ...options });
  });

// Demo command - run the TODO API demo
program
  .command('demo')
  .description('Run the TODO API demo (4-agent swarm)')
  .option('-m, --mock', 'Run in mock mode (recommended for first try)')
  .option('-b, --budget <amount>', 'Budget for the demo', '5')
  .action(async (options) => {
    console.log(chalk.yellow('\n🚀 Starting TODO API Demo...\n'));
    
    // Demo functionality for NPM package
    console.log(chalk.blue('\n📦 NPM Package Demo:\n'));
    console.log(chalk.green('✅ RepoCHief is installed and ready to use!'));
    console.log('');
    console.log(chalk.cyan('Get started with:'));
    console.log('  repochief init my-project');
    console.log('  cd my-project');
    console.log('  repochief config --api-keys  # Configure API keys');
    console.log('  repochief run tasks/simple-generation.json');
    console.log('');
    console.log(chalk.yellow('💡 For full demos, see: https://github.com/liftping/repochief-demo-todo'));
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
          { name: '🏢 Manage organizations', value: 'org' },
          { name: '📁 Manage workspaces', value: 'workspace' },
          { name: '🎯 Manage intents (Intent Canvas)', value: 'intent' },
          { name: '⏰ Manage scheduled tasks', value: 'schedule' },
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
  .action(configCommand.execute.bind(configCommand));

// Device command - manage device registration
program.addCommand(deviceCommand());

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
  const startTime = Date.now();
  let commandName = 'unknown';
  let commandSuccess = false;
  
  try {
    // Extract command name from arguments
    const args = process.argv.slice(2);
    commandName = args[0];
    
    // Handle special cases
    if (!commandName || commandName.startsWith('-')) {
      commandName = 'help';
    }
    
    // Track CLI session start
    trackCommand('cli_session_started', { 
      command: commandName,
      args: args.slice(1),
      node_version: process.version,
      cli_version: packageInfo.version
    });
    
    // Skip validation for these commands
    const skipValidation = ['--version', '-v', '--help', '-h'];
    if (!skipValidation.includes(commandName)) {
      // Quick validation for essential commands
      const isValid = await validateForCommand(commandName);
      if (!isValid) {
        trackCommand(commandName, { validation_failed: true }, false, Date.now() - startTime);
        await flushAnalytics();
        process.exit(1);
      }
    }
    
    // Parse commands
    program.parse(process.argv);
    
    // Show help if no command provided
    if (!process.argv.slice(2).length) {
      program.outputHelp();
      commandName = 'help_displayed';
      commandSuccess = true;
    } else {
      commandSuccess = true;
    }
    
    // Track successful command completion
    const duration = Date.now() - startTime;
    trackCommand(commandName, {}, commandSuccess, duration);
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    if (error.code === 'commander.unknownCommand') {
      console.error(chalk.red(`\n❌ Unknown command: ${error.message}`));
      console.log(chalk.yellow('Run "repochief --help" to see available commands\n'));
      trackError(commandName, error, { type: 'unknown_command' });
    } else {
      console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
      trackError(commandName, error, { type: 'general_error' });
    }
    
    trackCommand(commandName, {}, false, duration);
    await flushAnalytics();
    process.exit(1);
  } finally {
    // Ensure analytics are flushed before exit
    await flushAnalytics();
  }
})();