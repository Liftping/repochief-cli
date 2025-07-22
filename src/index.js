/**
 * RepoChief CLI - Main entry point
 */

module.exports = {
  // Export commands for programmatic usage
  commands: {
    run: require('./commands/run'),
    init: require('./commands/init'),
    agents: require('./commands/agents'),
    status: require('./commands/status')
  },
  
  // Version info
  version: require('../package.json').version
};