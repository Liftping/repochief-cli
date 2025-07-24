/**
 * Prediction Integration for RepoChief CLI
 * 
 * Integrates the prediction system to provide cost/time estimates
 */

const chalk = require('chalk');

let predictionSystem = null;
let isInitialized = false;

/**
 * Initialize prediction system if available
 */
async function initializePrediction() {
  if (isInitialized) return predictionSystem;
  
  try {
    // Check if prediction package is available
    const { 
      DataCollector,
      CLIEventAdapter,
      FeatureExtractor,
      PredictionService 
    } = require('@liftping/repochief-prediction');
    
    // Check required environment
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const postgresUrl = process.env.DATABASE_URL;
    
    if (!postgresUrl) {
      console.log(chalk.gray('⚡ Prediction system unavailable (no DATABASE_URL)'));
      return null;
    }
    
    // Initialize components
    const collector = new DataCollector({ redisUrl });
    const featureExtractor = new FeatureExtractor();
    const predictionService = new PredictionService(postgresUrl);
    
    // Create CLI adapter
    const adapter = new CLIEventAdapter(collector, featureExtractor, {
      mode: 'shadow',
      sampling: {
        rate: 1.0,
        alwaysCollect: ['run', 'test', 'deploy'],
        neverCollect: ['status', 'list', 'help']
      },
      privacy: {
        enablePIIDetection: true,
        enableAnonymization: true
      }
    });
    
    predictionSystem = {
      adapter,
      predictionService,
      collector,
      wrapCommand: (fn, name) => adapter.wrapCommand(fn, name)
    };
    
    isInitialized = true;
    console.log(chalk.green('✨ Prediction system initialized'));
    
    return predictionSystem;
    
  } catch (error) {
    // Prediction package not available or initialization failed
    if (error.code !== 'MODULE_NOT_FOUND') {
      console.error(chalk.yellow('⚠️  Prediction system error:'), error.message);
    }
    return null;
  }
}

/**
 * Get command prediction
 */
async function getCommandPrediction(commandName, args, options) {
  const system = await initializePrediction();
  if (!system) return null;
  
  try {
    // Determine complexity
    let complexity = 'simple';
    if (args.length > 2 || Object.keys(options).length > 3) {
      complexity = 'moderate';
    }
    if (options.agents > 5 || options.budget > 50) {
      complexity = 'complex';
    }
    
    // Get prediction
    const prediction = await system.predictionService.predictCommand(
      commandName,
      complexity,
      options
    );
    
    return {
      duration: prediction.estimatedDuration,
      cost: prediction.estimatedCost,
      confidence: prediction.confidence,
      displayDuration: formatDuration(prediction.estimatedDuration),
      displayCost: formatCost(prediction.estimatedCost)
    };
    
  } catch (error) {
    // Silent fail for predictions
    return null;
  }
}

/**
 * Show prediction to user
 */
function showPrediction(prediction) {
  if (!prediction) return;
  
  console.log(chalk.cyan('\n📊 Command Prediction:'));
  console.log(chalk.gray(`   Estimated time: ${prediction.displayDuration}`));
  
  if (prediction.cost > 0) {
    console.log(chalk.gray(`   Estimated cost: ${prediction.displayCost}`));
  }
  
  console.log(chalk.gray(`   Confidence: ${Math.round(prediction.confidence * 100)}%`));
  
  if (prediction.cost > 1) {
    console.log(chalk.yellow('   ⚠️  This command may incur significant costs'));
  }
  
  console.log();
}

/**
 * Wrap command with prediction
 */
function wrapWithPrediction(commandFn, commandName) {
  return async function wrappedCommand(...args) {
    // Initialize if needed
    const system = await initializePrediction();
    
    if (system) {
      // Use prediction adapter wrapper
      const wrapped = system.wrapCommand(commandFn, commandName);
      return wrapped.apply(this, args);
    } else {
      // Fallback to original command
      return commandFn.apply(this, args);
    }
  };
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
  return `$${cost.toFixed(2)}`;
}

module.exports = {
  initializePrediction,
  getCommandPrediction,
  showPrediction,
  wrapWithPrediction,
  formatDuration,
  formatCost
};