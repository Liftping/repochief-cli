/**
 * Run Command - Execute AI agent orchestration
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');
const { createOrchestrator } = require('@liftping/repochief-core');
const CloudProgressReporter = require('../integrations/CloudProgressReporter');

/**
 * Parse task configuration file
 */
function parseTaskFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`Task file not found: ${filePath}`);
    }
    
    const content = fs.readFileSync(absolutePath, 'utf8');
    const tasks = JSON.parse(content);
    
    // Validate basic structure
    if (!Array.isArray(tasks) && !tasks.tasks) {
      throw new Error('Task file must contain an array of tasks or a tasks property');
    }
    
    return Array.isArray(tasks) ? tasks : tasks.tasks;
  } catch (error) {
    if (error.message.includes('JSON')) {
      throw new Error(`Invalid JSON in task file: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Create output directory
 */
function ensureOutputDir(outputPath) {
  const absolutePath = path.resolve(outputPath);
  if (!fs.existsSync(absolutePath)) {
    fs.mkdirSync(absolutePath, { recursive: true });
  }
  return absolutePath;
}

/**
 * Run command handler
 */
async function runCommand(taskFile, options) {
  const startTime = Date.now();
  let orchestrator;
  
  try {
    // Parse options
    const agentCount = parseInt(options.agents) || 3;
    const budget = parseFloat(options.budget) || 10;
    const mockMode = options.mock || process.env.MOCK_MODE === 'true';
    const outputDir = ensureOutputDir(options.output);
    
    console.log(chalk.blue('\n📋 Task Configuration:'));
    console.log(chalk.gray(`  File: ${taskFile}`));
    console.log(chalk.gray(`  Agents: ${agentCount}`));
    console.log(chalk.gray(`  Budget: $${budget}`));
    console.log(chalk.gray(`  Mode: ${mockMode ? 'Mock (no API costs)' : 'Live'}`));
    console.log(chalk.gray(`  Output: ${outputDir}\n`));
    
    // Check API keys if not in mock mode
    if (!mockMode) {
      const hasOpenAI = !!process.env.OPENAI_API_KEY;
      const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
      const hasGoogle = !!process.env.GOOGLE_API_KEY;
      
      if (!hasOpenAI && !hasAnthropic && !hasGoogle) {
        console.error(chalk.red('❌ No API keys found!'));
        console.log(chalk.yellow('\nPlease set at least one of the following environment variables:'));
        console.log('  - OPENAI_API_KEY');
        console.log('  - ANTHROPIC_API_KEY');
        console.log('  - GOOGLE_API_KEY');
        console.log(chalk.gray('\nOr run with --mock flag to use mock mode\n'));
        process.exit(1);
      }
      
      console.log(chalk.green('✅ API Keys detected:'));
      if (hasOpenAI) console.log(chalk.gray('  - OpenAI'));
      if (hasAnthropic) console.log(chalk.gray('  - Anthropic'));
      if (hasGoogle) console.log(chalk.gray('  - Google AI'));
      console.log();
    }
    
    // Parse tasks
    const spinner = ora('Loading task configuration...').start();
    const tasks = parseTaskFile(taskFile);
    spinner.succeed(`Loaded ${tasks.length} tasks`);
    
    // Create orchestrator
    spinner.start('Initializing orchestrator...');
    orchestrator = createOrchestrator({
      sessionName: `repochief-${Date.now()}`,
      totalBudget: budget,
      mockMode: mockMode,
      outputDir: outputDir,
      useSimpleStore: true  // Use lightweight file storage for MVP
    });
    
    await orchestrator.initialize();
    spinner.succeed('Orchestrator initialized');
    
    // Set up cloud progress reporting
    const progressReporter = CloudProgressReporter.fromEnvironment();
    const connectionTest = await progressReporter.testConnection();
    
    if (connectionTest.success) {
      console.log(chalk.green('✅ Cloud Progress API connected'));
    } else if (progressReporter.enabled) {
      console.log(chalk.yellow('⚠️  Cloud Progress API unavailable (continuing locally)'));
    }
    
    // Create agents based on task requirements
    spinner.start('Creating AI agents...');
    const agentPromises = [];
    
    // Analyze task types to create appropriate agents
    const taskTypes = [...new Set(tasks.map(t => t.type))];
    const { AgentTemplates } = require('@liftping/repochief-core');
    
    // Create at least one agent of each needed type
    if (taskTypes.includes('comprehension') || taskTypes.includes('exploration')) {
      agentPromises.push(orchestrator.createAgent({
        name: 'analyst-1',
        ...AgentTemplates.ARCHITECT
      }));
    }
    
    if (taskTypes.includes('generation')) {
      agentPromises.push(orchestrator.createAgent({
        name: 'developer-1',
        ...AgentTemplates.SENIOR_DEVELOPER
      }));
    }
    
    if (taskTypes.includes('validation') || tasks.some(t => t.type === 'generation' && t.successCriteria)) {
      agentPromises.push(orchestrator.createAgent({
        name: 'qa-1',
        ...AgentTemplates.QA_ENGINEER
      }));
    }
    
    // Add more agents up to the requested count
    while (agentPromises.length < agentCount) {
      agentPromises.push(orchestrator.createAgent({
        name: `developer-${agentPromises.length + 1}`,
        ...AgentTemplates.SENIOR_DEVELOPER
      }));
    }
    
    const agents = await Promise.all(agentPromises);
    spinner.succeed(`Created ${agents.length} AI agents`);
    
    // Queue tasks
    spinner.start('Queueing tasks...');
    for (const task of tasks) {
      await orchestrator.queueTask(task);
    }
    spinner.succeed(`Queued ${tasks.length} tasks`);
    
    // Set up progress monitoring
    const swarmId = `swarm-${Date.now()}`;
    
    if (options.watch) {
      console.log(chalk.blue('\n📊 Real-time Progress:\n'));
    }
    
    // Cloud progress reporting
    orchestrator.on('taskAssigned', ({ task, agent }) => {
      if (options.watch) {
        console.log(chalk.gray(`[${new Date().toISOString()}] Task "${task.id}" assigned to ${agent.name}`));
      }
      
      // Report to cloud (async, non-blocking)
      progressReporter.send({
        swarmId,
        taskId: task.id,
        agentId: agent.name,
        status: 'in_progress',
        progress: 0,
        message: 'Task assigned'
      }).catch(() => {}); // Silent fail for cloud reporting
    });
    
    orchestrator.on('taskCompleted', ({ task, result }) => {
      if (options.watch) {
        console.log(chalk.green(`[${new Date().toISOString()}] ✅ Task "${task.id}" completed`));
      }
      
      // Report to cloud
      progressReporter.send({
        swarmId,
        taskId: task.id,
        status: 'completed',
        progress: 1.0,
        tokensUsed: result.tokensUsed || 0,
        cost: result.cost || 0,
        message: 'Task completed successfully'
      }).catch(() => {});
    });
    
    orchestrator.on('taskFailed', ({ task, error }) => {
      if (options.watch) {
        console.log(chalk.red(`[${new Date().toISOString()}] ❌ Task "${task.id}" failed: ${error.message}`));
      }
      
      // Report to cloud
      progressReporter.send({
        swarmId,
        taskId: task.id,
        status: 'failed',
        progress: 0,
        message: `Task failed: ${error.message.substring(0, 100)}`
      }).catch(() => {});
    });
    
    orchestrator.on('costUpdate', ({ total, cost }) => {
      if (options.watch) {
        console.log(chalk.yellow(`[${new Date().toISOString()}] 💰 Cost update: $${cost.toFixed(4)} (Total: $${total.toFixed(2)})`));
      }
    });
    
    // Start execution
    console.log(chalk.blue('\n🚀 Starting execution...\n'));
    await orchestrator.startExecution();
    
    // Wait for completion
    await orchestrator.waitForCompletion();
    
    // Get results
    const results = orchestrator.getResults();
    const costReport = orchestrator.costTracker.getReport();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    // Save results using orchestrator's save method
    const resultsPath = await orchestrator.saveResults();
    const summaryPath = path.join(outputDir, 'summary.txt');
    
    // Create summary
    const successful = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;
    
    const summary = `
RepoChief Execution Summary
==========================

Session: ${orchestrator.sessionName}
Duration: ${duration}s
Mode: ${mockMode ? 'Mock' : 'Live'}

Tasks:
------
Total: ${results.length}
Successful: ${successful}
Failed: ${failed}

Cost:
-----
Total: $${costReport.costs.total.toFixed(2)}
Input tokens: ${costReport.usage.totalTokens.input.toLocaleString()}
Output tokens: ${costReport.usage.totalTokens.output.toLocaleString()}

Results saved to: ${resultsPath}
`;
    
    fs.writeFileSync(summaryPath, summary);
    
    // Display summary
    console.log(chalk.blue('\n📊 Execution Summary:'));
    console.log(chalk.gray('═══════════════════════════════════════'));
    console.log(chalk.green(`✅ Successful: ${successful}`));
    if (failed > 0) {
      console.log(chalk.red(`❌ Failed: ${failed}`));
    }
    console.log(chalk.yellow(`💰 Total cost: $${costReport.costs.total.toFixed(2)}`));
    console.log(chalk.gray(`⏱️  Duration: ${duration}s`));
    console.log(chalk.gray(`📁 Results saved to: ${outputDir}`));
    console.log();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Execution failed: ${error.message}\n`));
    
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  } finally {
    // Cleanup
    if (orchestrator) {
      try {
        await orchestrator.shutdown();
      } catch (error) {
        // Ignore shutdown errors
      }
    }
  }
}

module.exports = runCommand;