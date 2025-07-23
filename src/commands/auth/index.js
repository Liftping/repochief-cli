const { Command } = require('commander');
const createLoginCommand = require('./login');
const createLogoutCommand = require('./logout');
const createStatusCommand = require('./status');

/**
 * Create auth command group
 */
function createAuthCommand() {
  const command = new Command('auth');
  
  command
    .description('Manage authentication with RepoChief cloud');
  
  // Add subcommands
  command.addCommand(createLoginCommand());
  command.addCommand(createLogoutCommand());
  command.addCommand(createStatusCommand());
  
  return command;
}

module.exports = createAuthCommand;