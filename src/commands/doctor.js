const chalk = require('chalk');
const ora = require('ora');
const path = require('path');
const DependencyService = require('../utils/dependency-service');
const { checkAuthStatus } = require('../utils/api-client');
const os = require('os');
const { version: cliVersion } = require('../../package.json');

async function doctor(options = {}) {
  console.log(chalk.bold.cyan('\n🩺 RepoChief Doctor\n'));
  console.log(chalk.gray('Checking your RepoChief installation...\n'));
  
  const depService = new DependencyService();
  const results = {
    system: {},
    dependencies: {},
    optional: {},
    auth: {},
    environment: {}
  };
  
  // System Information
  console.log(chalk.bold('System Information:'));
  console.log(`  Platform: ${os.platform()} ${os.arch()}`);
  console.log(`  OS Version: ${os.release()}`);
  console.log(`  Node.js: ${process.version}`);
  console.log(`  RepoChief CLI: v${cliVersion}`);
  console.log();
  
  // Check system requirements
  const spinner = ora('Checking system requirements...').start();
  
  try {
    const allChecks = await depService.checkAll(false); // Skip cache for doctor command
    results.system = allChecks.system;
    results.required = allChecks.required;
    results.optional = allChecks.optional;
    spinner.succeed('System requirements checked');
  } catch (error) {
    spinner.fail('Failed to check system requirements');
    console.error(chalk.red(error.message));
  }
  
  // Display system checks
  console.log(chalk.bold('\nSystem Requirements:'));
  displayCheckResults(results.system);
  
  // Display required dependencies
  console.log(chalk.bold('\nRequired Dependencies:'));
  for (const [pkg, status] of Object.entries(results.required)) {
    if (status === 'ok') {
      console.log(chalk.green(`  ✓ ${pkg}`));
    } else {
      console.log(chalk.red(`  ✗ ${pkg} - Not installed`));
      console.log(chalk.gray(`    Run: npm install ${pkg}`));
    }
  }
  
  // Display optional dependencies
  console.log(chalk.bold('\nOptional Features:'));
  for (const [pkg, info] of Object.entries(results.optional)) {
    if (info.installed) {
      console.log(chalk.green(`  ✓ ${info.description} (${pkg})`));
    } else {
      console.log(chalk.gray(`  ○ ${info.description} (${pkg})`));
      if (options.verbose) {
        info.features.forEach(feature => {
          console.log(chalk.gray(`    - ${feature}`));
        });
      }
    }
  }
  
  // Check authentication status
  console.log(chalk.bold('\nAuthentication:'));
  try {
    const authStatus = await checkAuthStatus();
    if (authStatus.authenticated) {
      console.log(chalk.green(`  ✓ Authenticated as ${authStatus.email || authStatus.deviceId}`));
      if (authStatus.deviceName) {
        console.log(chalk.gray(`    Device: ${authStatus.deviceName}`));
      }
    } else {
      console.log(chalk.yellow('  ⚠ Not authenticated'));
      console.log(chalk.gray('    Run: repochief auth login'));
    }
  } catch (error) {
    console.log(chalk.yellow('  ⚠ Could not check authentication status'));
    if (options.verbose) {
      console.log(chalk.gray(`    ${error.message}`));
    }
  }
  
  // Environment checks
  console.log(chalk.bold('\nEnvironment:'));
  const envChecks = {
    'API Keys': checkApiKeys(),
    'Config Directory': checkConfigDir(),
    'Cloud API': process.env.REPOCHIEF_API_URL || 'https://api.repochief.com (default)'
  };
  
  for (const [name, value] of Object.entries(envChecks)) {
    if (typeof value === 'object' && value.status) {
      if (value.status === 'ok') {
        console.log(chalk.green(`  ✓ ${name}: ${value.message}`));
      } else {
        console.log(chalk.yellow(`  ⚠ ${name}: ${value.message}`));
      }
    } else {
      console.log(`  • ${name}: ${value}`);
    }
  }
  
  // Summary
  console.log(chalk.bold('\nSummary:'));
  const hasErrors = depService.hasErrors(results);
  const hasWarnings = depService.hasWarnings(results);
  
  if (hasErrors) {
    console.log(chalk.red('  ✗ Some requirements are missing. Please fix the errors above.'));
  } else if (hasWarnings) {
    console.log(chalk.yellow('  ⚠ Everything works, but there are some warnings.'));
  } else {
    console.log(chalk.green('  ✓ All systems operational!'));
  }
  
  // Tips
  if (options.verbose || hasErrors) {
    console.log(chalk.bold('\nTips:'));
    if (!results.system.tmux || results.system.tmux.status === 'error') {
      console.log('  • tmux is required for AI agent orchestration');
      console.log('  • Without tmux, RepoChief cannot manage multiple agent sessions');
    }
    if (!results.optional['@liftping/repochief-cloud-sync'].installed) {
      console.log('  • Install cloud-sync for multi-device support');
      console.log('    npm install @liftping/repochief-cloud-sync');
    }
  }
  
  console.log();
}

function displayCheckResults(checks) {
  for (const [name, check] of Object.entries(checks)) {
    if (check.status === 'ok') {
      let message = `  ✓ ${name}`;
      if (check.version) {
        message += `: ${check.version}`;
      }
      console.log(chalk.green(message));
    } else if (check.status === 'warning') {
      console.log(chalk.yellow(`  ⚠ ${name}: ${check.message}`));
    } else if (check.status === 'error') {
      console.log(chalk.red(`  ✗ ${name}: ${check.message}`));
      if (check.fix) {
        console.log(chalk.gray(`    Fix: ${check.fix}`));
      }
    }
  }
}

function checkApiKeys() {
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;
  
  if (hasOpenAI && hasAnthropic) {
    return { status: 'ok', message: 'Both OpenAI and Anthropic configured' };
  } else if (hasOpenAI || hasAnthropic) {
    const configured = hasOpenAI ? 'OpenAI' : 'Anthropic';
    return { status: 'ok', message: `${configured} configured` };
  } else {
    return { status: 'warning', message: 'No AI API keys configured' };
  }
}

function checkConfigDir() {
  const configDir = path.join(os.homedir(), '.repochief');
  try {
    if (require('fs').existsSync(configDir)) {
      return { status: 'ok', message: configDir };
    } else {
      return { status: 'warning', message: 'Not initialized' };
    }
  } catch {
    return { status: 'warning', message: 'Cannot check' };
  }
}

module.exports = doctor;