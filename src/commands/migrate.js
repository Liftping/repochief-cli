/**
 * Migration Command - Import/export between markdown and database
 * Part of Phase 2: Roadmap Synchronization
 */

const chalk = require('chalk');
const path = require('path');
const fs = require('fs').promises;
const inquirer = require('inquirer');
const { MigrationManager } = require('@liftping/repochief-core/src/migration');

class MigrateCommand {
  constructor() {
    this.db = null;
    this.migrationManager = null;
  }

  async execute(subcommand, args) {
    // Initialize database connection
    await this.initDatabase();
    
    const commands = {
      'import-yaml': this.importYAML.bind(this),
      'import-markdown': this.importMarkdown.bind(this),
      'import-all': this.importAll.bind(this),
      'generate': this.generate.bind(this),
      'sync': this.sync.bind(this),
      'verify': this.verify.bind(this),
      'backup': this.backup.bind(this),
      'status': this.status.bind(this)
    };

    if (!subcommand || !commands[subcommand]) {
      this.showHelp();
      return;
    }

    try {
      await commands[subcommand](args);
    } catch (error) {
      console.error(chalk.red('✗ Migration failed:'), error.message);
      process.exit(1);
    }
  }

  async initDatabase() {
    // Migration command requires local development setup
    console.log(chalk.yellow('ℹ Migration command is only available in development setup'));
    console.log(chalk.gray('This command requires repochief-cloud-api to be installed locally'));
    process.exit(0);
  }

  showHelp() {
    console.log(chalk.cyan('\n📚 RepoCHief Migration Commands\n'));
    console.log('Import data into database:');
    console.log('  repochief migrate import-yaml <file>         - Import YAML intent file');
    console.log('  repochief migrate import-markdown <dir>      - Import markdown documentation');
    console.log('  repochief migrate import-all <dir>           - Import all supported files');
    console.log('');
    console.log('Export data from database:');
    console.log('  repochief migrate generate roadmap           - Generate ROADMAP.md');
    console.log('  repochief migrate generate status            - Generate STATUS.md');
    console.log('  repochief migrate generate all               - Generate all documentation');
    console.log('');
    console.log('Synchronization:');
    console.log('  repochief migrate sync                       - Bidirectional sync');
    console.log('  repochief migrate verify                     - Verify data integrity');
    console.log('  repochief migrate backup                     - Create backup');
    console.log('  repochief migrate status                     - Show migration status');
    console.log('');
    console.log(chalk.gray('Examples:'));
    console.log(chalk.gray('  repochief migrate import-yaml .repochief/current-intent.yaml'));
    console.log(chalk.gray('  repochief migrate generate all'));
    console.log(chalk.gray('  repochief migrate sync --output ./docs/generated'));
  }

  async importYAML(args) {
    const filePath = args._[0];
    if (!filePath) {
      console.error(chalk.red('✗ Please provide a YAML file path'));
      return;
    }

    try {
      // Check if file exists
      await fs.access(filePath);
      
      console.log(chalk.cyan(`\n📄 Importing YAML file: ${filePath}\n`));
      
      const intent = await this.migrationManager.importYAML(filePath);
      
      if (intent) {
        console.log(chalk.green(`\n✅ Successfully imported intent: ${intent.objective}`));
        this.showImportStats();
      }
    } catch (error) {
      console.error(chalk.red(`✗ Failed to import ${filePath}:`), error.message);
    }
  }

  async importMarkdown(args) {
    const dirPath = args._[0] || '.';
    
    console.log(chalk.cyan(`\n📁 Importing markdown from: ${dirPath}\n`));
    
    const results = await this.migrationManager.importMarkdown(dirPath);
    
    console.log(chalk.green(`\n✅ Imported ${results.length} items from markdown`));
    this.showImportStats();
  }

  async importAll(args) {
    const dirPath = args._[0] || '.';
    
    console.log(chalk.cyan(`\n🔄 Importing all files from: ${dirPath}\n`));
    
    await this.migrationManager.importAll(dirPath);
    
    console.log(chalk.green('\n✅ Import completed'));
    this.showImportStats();
  }

  async generate(args) {
    const type = args._[0] || 'all';
    const outputDir = args.output || path.join(process.cwd(), 'docs', 'generated');
    
    console.log(chalk.cyan(`\n📤 Generating ${type} documentation...\n`));
    
    let results;
    
    switch (type) {
      case 'roadmap':
        results = await this.migrationManager.generator.generateRoadmap();
        console.log(chalk.green(`✅ Generated: ${results.path}`));
        console.log(`   Phases: ${results.phases}`);
        break;
        
      case 'status':
        results = await this.migrationManager.generator.generateStatus();
        console.log(chalk.green(`✅ Generated: ${results.path}`));
        console.log(`   Active intents: ${results.intents}`);
        console.log(`   Active blockers: ${results.blockers}`);
        break;
        
      case 'all':
        results = await this.migrationManager.exportAll(outputDir);
        console.log(chalk.green('\n✅ Generated all documentation:'));
        Object.entries(results).forEach(([type, result]) => {
          if (result.path) {
            console.log(`   - ${type}: ${result.path}`);
          }
        });
        break;
        
      default:
        console.error(chalk.red(`✗ Unknown generation type: ${type}`));
        console.log('Valid types: roadmap, status, all');
    }
  }

  async sync(args) {
    const markdownDir = args._[0] || '.';
    const outputDir = args.output || path.join(markdownDir, 'generated');
    
    // Confirm before sync
    const answers = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'This will sync database with markdown files. Continue?',
        default: true
      },
      {
        type: 'list',
        name: 'conflictResolution',
        message: 'How should conflicts be resolved?',
        choices: [
          { name: 'Database wins (recommended)', value: 'database-wins' },
          { name: 'File wins', value: 'file-wins' },
          { name: 'Merge', value: 'merge' }
        ],
        when: (answers) => answers.confirm
      }
    ]);
    
    if (!answers.confirm) {
      console.log(chalk.yellow('⚠️ Sync cancelled'));
      return;
    }
    
    console.log(chalk.cyan('\n🔄 Starting synchronization...\n'));
    
    // Update conflict resolution
    this.migrationManager.options.conflictResolution = answers.conflictResolution;
    
    const results = await this.migrationManager.sync(markdownDir, {
      outputDir,
      importFirst: true,
      exportAfter: true
    });
    
    console.log(chalk.green('\n✅ Synchronization completed\n'));
    
    // Show results
    console.log('Import results:');
    console.log(`  Intents: ${results.imported.intents}`);
    console.log(`  Tasks: ${results.imported.tasks}`);
    console.log(`  Blockers: ${results.imported.blockers}`);
    console.log(`  Learnings: ${results.imported.learnings}`);
    
    console.log('\nExport results:');
    console.log(`  Files generated: ${results.exported.files}`);
    
    if (results.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️ Errors encountered:'));
      results.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    if (results.verification.valid) {
      console.log(chalk.green('\n✅ Data integrity verified'));
    } else {
      console.log(chalk.yellow('\n⚠️ Data integrity issues:'));
      results.verification.issues.forEach(issue => {
        console.log(`  - ${issue.message}`);
      });
    }
  }

  async verify() {
    console.log(chalk.cyan('\n🔍 Verifying data integrity...\n'));
    
    const verification = await this.migrationManager.verify();
    
    if (verification.valid) {
      console.log(chalk.green('✅ All data verified successfully'));
    } else {
      console.log(chalk.yellow('⚠️ Issues found:'));
      verification.issues.forEach(issue => {
        console.log(`  - [${issue.type}] ${issue.message}`);
      });
    }
  }

  async backup() {
    console.log(chalk.cyan('\n💾 Creating backup...\n'));
    
    const backupPath = await this.migrationManager.backup();
    
    console.log(chalk.green(`✅ Backup created: ${backupPath}`));
  }

  async status() {
    console.log(chalk.cyan('\n📊 Migration Status\n'));
    
    // Get counts from database
    const stats = await this.getDbStats();
    
    console.log('Database contents:');
    console.log(`  Intents: ${stats.intents}`);
    console.log(`  Tasks: ${stats.tasks}`);
    console.log(`  Blockers: ${stats.blockers}`);
    console.log(`  Learnings: ${stats.learnings}`);
    
    // Check for generated files
    const generatedDir = path.join(process.cwd(), 'docs', 'generated');
    try {
      const files = await fs.readdir(generatedDir);
      console.log(`\nGenerated files: ${files.length}`);
      files.forEach(file => {
        console.log(`  - ${file}`);
      });
    } catch {
      console.log('\nNo generated files found');
    }
    
    // Show last import stats
    if (this.migrationManager.stats.imported.intents > 0) {
      console.log('\nLast import:');
      console.log(`  Intents: ${this.migrationManager.stats.imported.intents}`);
      console.log(`  Tasks: ${this.migrationManager.stats.imported.tasks}`);
    }
  }

  showImportStats() {
    const stats = this.migrationManager.stats;
    
    console.log(chalk.cyan('\n📊 Import Statistics:'));
    console.log(`  Intents imported: ${stats.imported.intents}`);
    console.log(`  Tasks imported: ${stats.imported.tasks}`);
    console.log(`  Blockers imported: ${stats.imported.blockers}`);
    console.log(`  Learnings imported: ${stats.imported.learnings}`);
    
    if (stats.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️ Errors:'));
      stats.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
  }

  async getDbStats() {
    return new Promise((resolve) => {
      const stats = { intents: 0, tasks: 0, blockers: 0, learnings: 0 };
      
      this.db.db.get('SELECT COUNT(*) as count FROM intents', (err, row) => {
        stats.intents = row?.count || 0;
        
        this.db.db.get('SELECT COUNT(*) as count FROM intent_tasks', (err, row) => {
          stats.tasks = row?.count || 0;
          
          this.db.db.get('SELECT COUNT(*) as count FROM intent_blockers', (err, row) => {
            stats.blockers = row?.count || 0;
            
            this.db.db.get('SELECT COUNT(*) as count FROM intent_learnings', (err, row) => {
              stats.learnings = row?.count || 0;
              resolve(stats);
            });
          });
        });
      });
    });
  }
}

module.exports = new MigrateCommand();