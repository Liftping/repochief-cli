const chalk = require('chalk');
const ora = require('ora');
const DependencyService = require('./dependency-service');

async function checkSystemRequirements(options = {}) {
  const { silent = false, skipCache = false } = options;
  const depService = new DependencyService();
  
  if (!silent) {
    const spinner = ora('Checking system requirements...').start();
    
    try {
      const results = await depService.checkAll(!skipCache);
      spinner.stop();
      
      if (depService.hasErrors(results)) {
        displayErrors(results);
        return { success: false, results };
      }
      
      if (depService.hasWarnings(results)) {
        displayWarnings(results);
      }
      
      return { success: true, results };
    } catch (error) {
      spinner.fail('Failed to check system requirements');
      console.error(chalk.red(error.message));
      return { success: false, error };
    }
  } else {
    // Silent mode - just return results
    try {
      const results = await depService.checkAll(!skipCache);
      return {
        success: !depService.hasErrors(results),
        results
      };
    } catch (error) {
      return { success: false, error };
    }
  }
}

function displayErrors(results) {
  console.error(chalk.red.bold('\n⚠️  Missing Requirements:\n'));
  
  // System errors
  for (const [name, check] of Object.entries(results.system)) {
    if (check.status === 'error') {
      console.error(chalk.red(`  ✗ ${name}: ${check.message}`));
      if (check.fix) {
        console.error(chalk.gray(`    Fix: ${check.fix}\n`));
      }
    }
  }
  
  // Required dependency errors
  if (results.required['@liftping/repochief-core'] !== 'ok') {
    console.error(chalk.red('  ✗ @liftping/repochief-core: Required dependency not found'));
    console.error(chalk.gray('    Fix: Run npm install @liftping/repochief-core\n'));
  }
  
  console.log(chalk.yellow('Run "repochief doctor" for detailed diagnostics\n'));
}

function displayWarnings(results) {
  console.warn(chalk.yellow.bold('\n⚠️  Warnings:\n'));
  
  for (const [name, check] of Object.entries(results.system)) {
    if (check.status === 'warning') {
      console.warn(chalk.yellow(`  ⚠ ${name}: ${check.message}\n`));
    }
  }
}

async function validateForCommand(commandName) {
  // Some commands don't need all requirements
  const lightCommands = ['help', 'version', 'doctor', 'auth', 'config'];
  
  if (lightCommands.includes(commandName)) {
    // Only check Node.js version for these commands
    const depService = new DependencyService();
    const nodeCheck = await depService.checkNodeVersion();
    
    if (nodeCheck.status === 'error') {
      console.error(chalk.red(`\n${nodeCheck.message}`));
      console.error(chalk.gray(`Fix: ${nodeCheck.fix}\n`));
      return false;
    }
    return true;
  }
  
  // Full check for other commands
  const { success } = await checkSystemRequirements();
  return success;
}

async function checkSingleDependency(name) {
  const depService = new DependencyService();
  
  switch (name) {
    case 'node':
      return await depService.checkNodeVersion();
    case 'tmux':
      return await depService.checkTmux();
    case 'keychain':
      return await depService.checkKeychain();
    case 'packageManager':
      return await depService.checkPackageManager();
    default:
      // Check npm dependency
      const result = await depService.checkDependencies([name]);
      return result === 'ok' 
        ? { status: 'ok' }
        : { status: 'error', message: `${name} not found` };
  }
}

module.exports = {
  checkSystemRequirements,
  validateForCommand,
  checkSingleDependency
};