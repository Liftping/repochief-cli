const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');
const inquirer = require('inquirer');
const semver = require('semver');

class DependencyService {
  constructor() {
    this.packageManager = this.detectPackageManager();
    this.cacheFile = path.join(process.env.HOME || process.env.USERPROFILE, '.repochief', '.dep-cache.json');
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
  }

  detectPackageManager() {
    try {
      // Check for lock files in current directory
      const cwd = process.cwd();
      
      if (require('fs').existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
        return 'pnpm';
      }
      if (require('fs').existsSync(path.join(cwd, 'yarn.lock'))) {
        return 'yarn';
      }
      if (require('fs').existsSync(path.join(cwd, 'package-lock.json'))) {
        return 'npm';
      }
      
      // Default to npm if no lock file found
      return 'npm';
    } catch (error) {
      return 'npm';
    }
  }

  async checkNodeVersion() {
    const currentVersion = process.version;
    const requiredVersion = '>=18.0.0';
    
    if (!semver.satisfies(currentVersion, requiredVersion)) {
      return {
        status: 'error',
        message: `Node.js ${requiredVersion} required (found ${currentVersion})`,
        fix: 'Visit https://nodejs.org to install Node.js 18 or higher'
      };
    }
    
    return { status: 'ok', version: currentVersion };
  }

  async checkTmux() {
    try {
      const version = execSync('tmux -V', { encoding: 'utf8' }).trim();
      return { status: 'ok', version };
    } catch (error) {
      const platform = process.platform;
      let fix = 'Visit https://github.com/tmux/tmux/wiki/Installing';
      
      if (platform === 'darwin') {
        fix = 'Install with: brew install tmux';
      } else if (platform === 'linux') {
        fix = 'Install with: sudo apt-get install tmux (Ubuntu/Debian) or sudo yum install tmux (RHEL/CentOS)';
      } else if (platform === 'win32') {
        fix = 'Use WSL2 and install tmux: sudo apt-get install tmux';
      }
      
      return {
        status: 'error',
        message: 'tmux is required for RepoChief orchestration',
        fix
      };
    }
  }

  async checkKeychain() {
    try {
      // Try to load keytar - it may fail on systems without libsecret
      let keytar;
      try {
        keytar = require('keytar');
      } catch (loadError) {
        // keytar couldn't load - likely missing system dependencies
        return {
          status: 'warning',
          message: 'OS keychain not available (missing system library), using fallback token storage',
          available: false
        };
      }
      
      // Test if we can access the keychain
      await keytar.findCredentials('repochief-test');
      return { status: 'ok', available: true };
    } catch (error) {
      return {
        status: 'warning',
        message: 'OS keychain not available, using fallback token storage',
        available: false
      };
    }
  }

  async checkPackageManager() {
    try {
      const version = execSync(`${this.packageManager} --version`, { encoding: 'utf8' }).trim();
      return { status: 'ok', manager: this.packageManager, version };
    } catch (error) {
      return {
        status: 'error',
        message: `Package manager ${this.packageManager} not found`,
        fix: 'Install Node.js which includes npm'
      };
    }
  }

  async checkDependencies(dependencies) {
    const results = {};
    
    try {
      // Read package.json to check installed packages
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies
      };
      
      for (const dep of dependencies) {
        if (allDeps[dep]) {
          results[dep] = { status: 'ok', version: allDeps[dep] };
        } else {
          // Check if it's installed globally or in node_modules
          try {
            const modulePath = require.resolve(dep);
            results[dep] = { status: 'ok', version: 'installed' };
          } catch {
            results[dep] = { status: 'missing' };
          }
        }
      }
      
      // Return 'ok' if all dependencies are found
      const allOk = Object.values(results).every(r => r.status === 'ok');
      return allOk ? 'ok' : results;
    } catch (error) {
      return 'error';
    }
  }

  async installPackages(packages, options = {}) {
    const { prompt = true, dev = false, global = false } = options;
    
    if (prompt && !options.skipPrompt) {
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: `Install ${packages.join(', ')}?`,
        default: true
      }]);
      
      if (!confirm) {
        return { status: 'cancelled' };
      }
    }
    
    try {
      // Build install command
      let command = this.packageManager;
      
      if (this.packageManager === 'npm') {
        command += ' install';
        if (global) command += ' -g';
        if (dev) command += ' --save-dev';
      } else if (this.packageManager === 'yarn') {
        command += ' add';
        if (global) command = 'yarn global add';
        if (dev) command += ' --dev';
      } else if (this.packageManager === 'pnpm') {
        command += ' add';
        if (global) command += ' -g';
        if (dev) command += ' --save-dev';
      }
      
      command += ' ' + packages.join(' ');
      
      console.log(chalk.cyan(`Running: ${command}`));
      execSync(command, { stdio: 'inherit' });
      
      return { status: 'success', packages };
    } catch (error) {
      return {
        status: 'error',
        message: `Failed to install packages: ${error.message}`
      };
    }
  }

  async checkOptionalDependencies() {
    const optional = {
      '@liftping/repochief-quality-gates': {
        description: 'Code quality validation',
        features: ['ESLint integration', 'Test coverage', 'Security scanning']
      },
      '@liftping/repochief-cloud-sync': {
        description: 'Multi-device synchronization',
        features: ['Cloud backup', 'Settings sync', 'Usage tracking']
      }
    };
    
    const results = {};
    
    for (const [pkg, info] of Object.entries(optional)) {
      const status = await this.checkDependencies([pkg]);
      results[pkg] = {
        ...info,
        installed: status === 'ok'
      };
    }
    
    return results;
  }

  async getCacheStatus() {
    try {
      const cache = JSON.parse(await fs.readFile(this.cacheFile, 'utf8'));
      const age = Date.now() - cache.timestamp;
      
      if (age < this.cacheTimeout) {
        return { valid: true, data: cache.data, age };
      }
    } catch {
      // Cache doesn't exist or is invalid
    }
    
    return { valid: false };
  }

  async saveCache(data) {
    try {
      const cacheDir = path.dirname(this.cacheFile);
      await fs.mkdir(cacheDir, { recursive: true });
      
      await fs.writeFile(this.cacheFile, JSON.stringify({
        timestamp: Date.now(),
        data
      }, null, 2));
    } catch {
      // Ignore cache write errors
    }
  }

  async checkAll(useCache = true) {
    // Check cache first
    if (useCache) {
      const cache = await this.getCacheStatus();
      if (cache.valid) {
        return cache.data;
      }
    }
    
    const results = {
      system: {
        node: await this.checkNodeVersion(),
        tmux: await this.checkTmux(),
        packageManager: await this.checkPackageManager(),
        keychain: await this.checkKeychain()
      },
      required: {
        '@liftping/repochief-core': await this.checkDependencies(['@liftping/repochief-core'])
      },
      optional: await this.checkOptionalDependencies(),
      timestamp: new Date().toISOString()
    };
    
    // Save to cache
    await this.saveCache(results);
    
    return results;
  }

  hasErrors(results) {
    // Check system requirements
    for (const check of Object.values(results.system)) {
      if (check.status === 'error') {
        return true;
      }
    }
    
    // Check required dependencies
    if (results.required['@liftping/repochief-core'] !== 'ok') {
      return true;
    }
    
    return false;
  }

  hasWarnings(results) {
    for (const check of Object.values(results.system)) {
      if (check.status === 'warning') {
        return true;
      }
    }
    return false;
  }
}

module.exports = DependencyService;