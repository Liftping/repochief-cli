/**
 * Prediction Integration for RepoChief CLI
 * 
 * Integrates the AI Orchestration Prediction system to provide cost/time estimates
 * using the CoreEventAdapter and FeatureExtractor components.
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
    // Try to use the core repochief components first
    const DataCollector = require('../../repochief/src/collectors/DataCollector');
    const FeatureExtractor = require('../../repochief/src/features/FeatureExtractor');
    const CLIEventAdapter = require('../../repochief/src/cli/CLIEventAdapter');
    
    console.log(chalk.gray('⚡ Initializing prediction system...'));
    
    // Initialize components with minimal configuration
    const collector = new DataCollector({
      storage: 'local',
      batchSize: 50,
      flushInterval: 30000, // 30 seconds
      validation: true
    });
    
    const featureExtractor = new FeatureExtractor({
      enableComplexityAnalysis: true,
      enableContextAnalysis: true,
      enablePatternMatching: true,
      enableCostPrediction: true
    });
    
    // Create CLI adapter with appropriate sampling
    const adapter = new CLIEventAdapter(collector, featureExtractor, {
      mode: process.env.CLI_PREDICTION_MODE || 'shadow',
      enablePredictions: true,
      sampling: {
        rate: 1.0,
        alwaysCollect: ['run', 'demo'],
        neverCollect: ['status', 'help', '--help', '-h', '--version', '-v']
      },
      privacy: {
        enablePIIDetection: true,
        enableAnonymization: true
      }
    });
    
    predictionSystem = {
      adapter,
      collector,
      featureExtractor,
      wrapCommand: (fn, name) => adapter.wrapCommand(fn, name),
      getCommandPrediction: (name, args, options) => adapter.getCommandPrediction(name, args, options),
      analyzeCommand: (name, args, options) => adapter.analyzeCommand(name, args, options),
      getStatistics: () => adapter.getStatistics()
    };
    
    isInitialized = true;
    console.log(chalk.green('✨ AI Orchestration Prediction system initialized'));
    
    return predictionSystem;
    
  } catch (error) {
    // Core components not available, try legacy prediction package
    try {
      const { 
        DataCollector,
        CLIEventAdapter,
        FeatureExtractor 
      } = require('@liftping/repochief-prediction');
      
      console.log(chalk.gray('⚡ Using legacy prediction package...'));
      
      // Check required environment for legacy package
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
      const postgresUrl = process.env.DATABASE_URL;
      
      if (!postgresUrl) {
        console.log(chalk.gray('⚡ Prediction system unavailable (no DATABASE_URL for legacy package)'));
        return null;
      }
      
      // Initialize legacy components
      const collector = new DataCollector({ redisUrl });
      const featureExtractor = new FeatureExtractor();
      
      const adapter = new CLIEventAdapter(collector, featureExtractor, {
        mode: 'shadow',
        sampling: {
          rate: 1.0,
          alwaysCollect: ['run', 'demo'],
          neverCollect: ['status', 'help', '--help']
        }
      });
      
      predictionSystem = {
        adapter,
        collector,
        featureExtractor,
        wrapCommand: (fn, name) => adapter.wrapCommand(fn, name)
      };
      
      isInitialized = true;
      console.log(chalk.green('✨ Legacy prediction system initialized'));
      
      return predictionSystem;
      
    } catch (legacyError) {
      // Neither core nor legacy package available
      if (error.code !== 'MODULE_NOT_FOUND' && legacyError.code !== 'MODULE_NOT_FOUND') {
        console.error(chalk.yellow('⚠️  Prediction system error:'), error.message);
      }
      return null;
    }
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