/**
 * RepoChief CLI - Main entry point
 */

module.exports = {
  // Export commands for programmatic usage
  commands: {
    run: require('./commands/run'),
    init: require('./commands/init'),
    agents: require('./commands/agents'),
    status: require('./commands/status'),
    auth: require('./commands/auth')
  },
  
  // Version info
  version: require('../package.json').version,
  
  // Export utilities for programmatic usage
  utils: {
    device: require('./utils/device'),
    oauth: require('./utils/oauth'),
    APIClient: require('./utils/api-client').APIClient
  }
};