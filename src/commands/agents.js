/**
 * Agents Command - List and manage agent profiles
 */

const chalk = require('chalk');
const { AgentTemplates } = require('@liftping/repochief-core');

/**
 * Format agent for display
 */
function formatAgent(name, agent) {
  const lines = [
    chalk.blue(`\n${name}`),
    chalk.gray('─'.repeat(40)),
    `Role: ${chalk.yellow(agent.role)}`,
    `Model: ${chalk.cyan(agent.model)}`,
    `Capabilities: ${chalk.green(agent.capabilities.join(', '))}`,
    `Max Tokens: ${chalk.magenta(agent.constraints.maxContextTokens.toLocaleString())}`,
    `Temperature: ${chalk.gray(agent.constraints.temperature)}`
  ];
  
  if (agent.constraints.preferredLanguages) {
    lines.push(`Languages: ${chalk.blue(agent.constraints.preferredLanguages.join(', '))}`);
  }
  
  if (agent.constraints.specializations) {
    lines.push(`Specializations: ${chalk.green(agent.constraints.specializations.join(', '))}`);
  }
  
  return lines.join('\n');
}

/**
 * Agents command handler
 */
async function agentsCommand(options) {
  try {
    // List mode
    if (!options.create && !options.edit) {
      console.log(chalk.blue('\n🤖 Available Agent Profiles\n'));
      
      const agents = Object.entries(AgentTemplates);
      
      if (options.json) {
        // JSON output
        const output = {};
        agents.forEach(([name, profile]) => {
          output[name] = profile;
        });
        console.log(JSON.stringify(output, null, 2));
      } else {
        // Formatted output
        agents.forEach(([name, profile]) => {
          console.log(formatAgent(name, profile));
        });
        
        console.log(chalk.gray('\n─'.repeat(40)));
        console.log(chalk.gray(`\nTotal: ${agents.length} agent profiles`));
        console.log(chalk.yellow('\nTip: Use these profiles when creating agents in your orchestrator'));
        console.log(chalk.gray('Example: orchestrator.createAgent({ name: "my-dev", ...AgentTemplates.SENIOR_DEVELOPER })\n'));
      }
      
      return;
    }
    
    // Create mode
    if (options.create) {
      console.log(chalk.yellow('\n🚧 Agent creation wizard coming soon!\n'));
      console.log(chalk.gray('For now, create custom agents by editing JSON files in your project\'s agents/ directory.\n'));
      
      // Show example
      console.log(chalk.blue('Example custom agent (save as agents/my-expert.json):'));
      console.log(chalk.gray(JSON.stringify({
        name: 'my-expert',
        role: 'code_generator',
        model: 'gpt-4o',
        capabilities: ['generation', 'comprehension', 'debugging'],
        constraints: {
          maxContextTokens: 100000,
          temperature: 0.7,
          preferredLanguages: ['Python', 'JavaScript'],
          specializations: ['machine-learning', 'data-science']
        }
      }, null, 2)));
      console.log();
      
      return;
    }
    
    // Edit mode
    if (options.edit) {
      const agentName = options.edit.toUpperCase().replace(/-/g, '_');
      
      if (!AgentTemplates[agentName]) {
        console.error(chalk.red(`\n❌ Agent profile "${options.edit}" not found\n`));
        console.log(chalk.yellow('Available profiles:'));
        Object.keys(AgentTemplates).forEach(name => {
          console.log(chalk.gray(`  - ${name.toLowerCase().replace(/_/g, '-')}`));
        });
        console.log();
        return;
      }
      
      console.log(chalk.yellow('\n🚧 Agent editing coming soon!\n'));
      console.log(chalk.gray('For now, you can create a custom agent based on this profile:\n'));
      
      const agent = AgentTemplates[agentName];
      console.log(chalk.blue(`Original ${agentName} profile:`));
      console.log(chalk.gray(JSON.stringify(agent, null, 2)));
      console.log();
      
      return;
    }
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = agentsCommand;