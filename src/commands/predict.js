/**
 * Predict Command - Show predictions for CLI commands
 */

const chalk = require('chalk');
const { initializePrediction } = require('../integrations/prediction');

/**
 * Predict command handler
 */
async function predictCommand(commandName, options) {
  try {
    console.log(chalk.blue(`\n📊 Analyzing command: ${commandName}\n`));
    
    // Initialize prediction system
    const predictionSystem = await initializePrediction();
    
    if (!predictionSystem) {
      console.log(chalk.yellow('⚠️  Prediction system unavailable'));
      console.log(chalk.gray('   Predictions require the AI Orchestration components\n'));
      return;
    }
    
    // Parse command arguments and options
    const args = options.args ? options.args.split(' ').filter(Boolean) : [];
    const cmdOptions = {};
    
    // Parse common options from the command line
    if (options.agents) cmdOptions.agents = parseInt(options.agents);
    if (options.budget) cmdOptions.budget = parseFloat(options.budget);
    if (options.mock) cmdOptions.mock = true;
    if (options.watch) cmdOptions.watch = true;
    if (options.output) cmdOptions.output = options.output;
    
    // Get prediction
    const prediction = await predictionSystem.getCommandPrediction(commandName, args, cmdOptions);
    
    if (!prediction) {
      console.log(chalk.yellow('⚠️  No prediction available for this command\n'));
      return;
    }
    
    // Display prediction
    console.log(chalk.cyan('🔮 Prediction Results:'));
    console.log(chalk.gray('══════════════════════════════════════'));
    
    console.log(chalk.white(`Duration: ${formatDuration(prediction.duration)}`));
    
    if (prediction.cost > 0) {
      const costColor = prediction.cost > 1 ? 'red' : prediction.cost > 0.1 ? 'yellow' : 'gray';
      console.log(chalk[costColor](`Cost: ${formatCost(prediction.cost)}`));
    }
    
    console.log(chalk.gray(`Success Probability: ${Math.round(prediction.successProbability * 100)}%`));
    console.log(chalk.gray(`Confidence: ${Math.round(prediction.confidence * 100)}%`));
    
    if (prediction.pattern) {
      console.log(chalk.gray(`Pattern: ${prediction.pattern}`));
    }
    
    if (prediction.basedOnSimilarTasks > 0) {
      console.log(chalk.gray(`Based on ${prediction.basedOnSimilarTasks} similar executions`));
    } else {
      console.log(chalk.gray('Based on heuristic estimation'));
    }
    
    if (prediction.fromCache) {
      console.log(chalk.gray('(cached result)'));
    }
    
    // Warnings
    if (prediction.cost > 1) {
      console.log(chalk.red('\n⚠️  High cost command - consider using --mock flag first'));
    }
    
    if (prediction.duration > 120000) { // 2 minutes
      console.log(chalk.yellow('\n⏰ Long-running command - consider using --watch flag'));
    }
    
    // Get complexity analysis if available
    if (predictionSystem.analyzeCommand) {
      try {
        console.log(chalk.cyan('\n🧠 Complexity Analysis:'));
        console.log(chalk.gray('══════════════════════════════════════'));
        
        const complexity = await predictionSystem.analyzeCommand(commandName, args, cmdOptions);
        
        console.log(chalk.white(`Category: ${complexity.category}`));
        console.log(chalk.gray(`Score: ${complexity.score.toFixed(1)}`));
        console.log(chalk.gray(`Analysis Confidence: ${Math.round(complexity.confidence * 100)}%`));
        
        if (complexity.recommendations && complexity.recommendations.length > 0) {
          console.log(chalk.cyan('\n💡 Recommendations:'));
          complexity.recommendations.forEach(rec => {
            console.log(chalk.gray(`   • ${rec}`));
          });
        }
        
      } catch (error) {
        // Complexity analysis failed, but that's okay
      }
    }
    
    // Show system statistics if requested
    if (options.stats && predictionSystem.getStatistics) {
      try {
        console.log(chalk.cyan('\n📈 System Statistics:'));
        console.log(chalk.gray('══════════════════════════════════════'));
        
        const stats = predictionSystem.getStatistics();
        
        if (stats.predictions) {
          console.log(chalk.gray(`Historical Tasks: ${stats.predictions.historicalTasks}`));
          console.log(chalk.gray(`Patterns Detected: ${stats.predictions.patterns}`));
          console.log(chalk.gray(`Cache Hit Rate: ${Math.round(stats.predictions.cacheHitRate * 100)}%`));
        }
        
        if (stats.cli) {
          console.log(chalk.gray(`Commands Wrapped: ${stats.cli.commandsWrapped}`));
          console.log(chalk.gray(`Predictions Generated: ${stats.cli.predictionsGenerated}`));
          console.log(chalk.gray(`Learning Updates: ${stats.cli.learningUpdates}`));
        }
        
      } catch (error) {
        // Statistics failed, but that's okay
      }
    }
    
    console.log();
    
  } catch (error) {
    console.error(chalk.red(`\n❌ Prediction failed: ${error.message}\n`));
    
    if (error.stack && process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
    
    process.exit(1);
  }
}

/**
 * Format duration for display
 */
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format cost for display
 */
function formatCost(cost) {
  if (cost === 0) return '$0';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(3)}`;
}

module.exports = predictCommand;