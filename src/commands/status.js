/**
 * Status Command - Check system and session status
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

/**
 * Check API key status
 */
function checkApiKeys() {
  const keys = {
    OpenAI: !!process.env.OPENAI_API_KEY,
    Anthropic: !!process.env.ANTHROPIC_API_KEY,
    'Google AI': !!process.env.GOOGLE_API_KEY
  };
  
  const configured = Object.entries(keys).filter(([_, has]) => has).length;
  
  return { keys, configured };
}

/**
 * Get recent sessions from output directories
 */
function getRecentSessions(limit = 5) {
  const sessions = [];
  const outputDirs = ['./output', './repochief-output', '../output'];
  
  for (const dir of outputDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        const resultFiles = files.filter(f => f.endsWith('results.json'));
        
        for (const file of resultFiles) {
          try {
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            const data = JSON.parse(content);
            sessions.push({
              path: path.join(dir, file),
              ...data
            });
          } catch (e) {
            // Skip invalid files
          }
        }
      } catch (e) {
        // Skip inaccessible directories
      }
    }
  }
  
  // Sort by timestamp and limit
  return sessions
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, limit);
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Status command handler
 */
async function statusCommand(options) {
  try {
    console.log(chalk.blue('\n🔍 RepoChief System Status\n'));
    
    // Check environment
    console.log(chalk.yellow('Environment:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    // Node.js version
    console.log(`Node.js: ${chalk.green(process.version)}`);
    
    // RepoChief CLI version
    const cliPackage = require('../../package.json');
    console.log(`RepoChief CLI: ${chalk.green(`v${cliPackage.version}`)}`);
    
    // RepoChief Core version
    try {
      const corePackage = require('@liftping/repochief-core/package.json');
      console.log(`RepoChief Core: ${chalk.green(`v${corePackage.version}`)}`);
    } catch (e) {
      console.log(`RepoChief Core: ${chalk.red('Not installed')}`);
    }
    
    // API Keys
    console.log(chalk.yellow('\nAPI Keys:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const { keys, configured } = checkApiKeys();
    Object.entries(keys).forEach(([provider, hasKey]) => {
      console.log(`${provider}: ${hasKey ? chalk.green('✅ Configured') : chalk.gray('❌ Not configured')}`);
    });
    
    if (configured === 0) {
      console.log(chalk.red('\n⚠️  No API keys configured!'));
      console.log(chalk.gray('Run "repochief config --api-keys" to set up API keys'));
    }
    
    // Mode
    const mockMode = process.env.MOCK_MODE === 'true';
    console.log(`\nMode: ${mockMode ? chalk.yellow('Mock (no API costs)') : chalk.green('Live')}`);
    
    // Sessions
    if (!options.session) {
      console.log(chalk.yellow('\nRecent Sessions:'));
      console.log(chalk.gray('─'.repeat(40)));
      
      const sessions = getRecentSessions();
      
      if (sessions.length === 0) {
        console.log(chalk.gray('No recent sessions found'));
      } else {
        sessions.forEach((session, index) => {
          const successful = session.tasks.filter(t => t.status === 'completed').length;
          const failed = session.tasks.filter(t => t.status === 'failed').length;
          const date = new Date(session.timestamp).toLocaleString();
          
          console.log(`\n${index + 1}. ${chalk.blue(session.session || 'Unknown')}`);
          console.log(`   Date: ${chalk.gray(date)}`);
          console.log(`   Tasks: ${chalk.green(successful)} succeeded, ${failed > 0 ? chalk.red(failed) : '0'} failed`);
          console.log(`   Cost: ${chalk.yellow(`$${session.cost.costs.total.toFixed(2)}`)}`);
          console.log(`   Duration: ${chalk.gray(session.duration)}s`);
        });
      }
      
      console.log(chalk.gray('\nTip: Use "repochief status -s <session-id>" to see session details'));
    }
    
    // Specific session details
    if (options.session) {
      console.log(chalk.yellow(`\nSession Details: ${options.session}`));
      console.log(chalk.gray('─'.repeat(40)));
      
      // Find session
      const sessions = getRecentSessions(20);
      const session = sessions.find(s => s.session === options.session);
      
      if (!session) {
        console.error(chalk.red(`\nSession "${options.session}" not found\n`));
        return;
      }
      
      // Basic info
      console.log(`\nTimestamp: ${new Date(session.timestamp).toLocaleString()}`);
      console.log(`Duration: ${session.duration}s`);
      
      // Tasks
      if (options.tasks || (!options.costs && !options.tasks)) {
        console.log(chalk.yellow('\nTasks:'));
        session.tasks.forEach((task, index) => {
          const icon = task.status === 'completed' ? '✅' : '❌';
          console.log(`${index + 1}. ${icon} ${task.taskId || task.id}`);
          if (task.error) {
            console.log(`   ${chalk.red(task.error)}`);
          }
        });
      }
      
      // Costs
      if (options.costs || (!options.costs && !options.tasks)) {
        console.log(chalk.yellow('\nCost Breakdown:'));
        console.log(`Total: ${chalk.green(`$${session.cost.costs.total.toFixed(2)}`)}`);
        console.log(`Input tokens: ${session.cost.usage.totalTokens.input.toLocaleString()}`);
        console.log(`Output tokens: ${session.cost.usage.totalTokens.output.toLocaleString()}`);
        
        if (session.cost.breakdown && session.cost.breakdown.byModel) {
          console.log(chalk.gray('\nBy Model:'));
          Object.entries(session.cost.breakdown.byModel).forEach(([model, cost]) => {
            console.log(`  ${model}: $${cost.toFixed(2)}`);
          });
        }
      }
    }
    
    // System resources
    console.log(chalk.yellow('\n\nSystem Resources:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const usage = process.memoryUsage();
    console.log(`Memory: ${formatBytes(usage.heapUsed)} / ${formatBytes(usage.heapTotal)}`);
    console.log(`CPU: ${process.cpuUsage().user / 1000}ms user, ${process.cpuUsage().system / 1000}ms system`);
    
    console.log();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Error: ${error.message}\n`));
    process.exit(1);
  }
}

module.exports = statusCommand;