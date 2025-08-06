/**
 * Deployment monitoring commands
 * Track deployment status for RepoCHief packages
 */

const { Command } = require('commander');
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const { getApiClient } = require('../utils/api');
const { getCurrentContext } = require('../utils/context');

const deploymentCommand = new Command('deployment')
    .description('Monitor and verify deployments')
    .alias('deploy');

/**
 * deployment status - Show deployment status for all packages
 */
deploymentCommand
    .command('status')
    .description('Show deployment status for RepoCHief packages')
    .option('-p, --package <name>', 'Filter by package name')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
        const spinner = ora('Fetching deployment status...').start();
        
        try {
            const client = await getApiClient();
            const context = await getCurrentContext();
            
            const url = `/api/v1/orgs/${context.organization}/workspaces/${context.workspace}/deployments/status`;
            const params = options.package ? { package: options.package } : {};
            
            const response = await client.get(url, { params });
            const data = response.data;
            
            spinner.stop();
            
            if (options.json) {
                console.log(JSON.stringify(data, null, 2));
                return;
            }
            
            // Display summary
            console.log(chalk.bold('\n📊 Deployment Status Summary\n'));
            console.log(`Total Packages: ${data.summary.total}`);
            console.log(`✅ Successful: ${chalk.green(data.summary.successful)}`);
            console.log(`❌ Failed: ${chalk.red(data.summary.failed)}`);
            console.log(`⏳ Pending: ${chalk.yellow(data.summary.pending)}`);
            
            // Display services
            if (data.services && data.services.length > 0) {
                console.log(chalk.bold('\n🚀 Service Deployments (Coolify)\n'));
                
                const serviceTable = new Table({
                    head: ['Package', 'Status', 'Version', 'Platform', 'Last Check'],
                    style: { head: ['cyan'] }
                });
                
                for (const service of data.services) {
                    const statusEmoji = service.status === 'success' ? '✅' : '❌';
                    const statusColor = service.status === 'success' ? chalk.green : chalk.red;
                    
                    serviceTable.push([
                        service.packageName,
                        `${statusEmoji} ${statusColor(service.status)}`,
                        service.version || 'N/A',
                        service.platform || 'coolify',
                        new Date(service.timestamp).toLocaleString()
                    ]);
                }
                
                console.log(serviceTable.toString());
            }
            
            // Display libraries
            if (data.libraries && data.libraries.length > 0) {
                console.log(chalk.bold('\n📦 Library Deployments (npm)\n'));
                
                const libTable = new Table({
                    head: ['Package', 'Status', 'Version', 'Platform', 'Last Check'],
                    style: { head: ['cyan'] }
                });
                
                for (const lib of data.libraries) {
                    const statusEmoji = lib.status === 'success' ? '✅' : '❌';
                    const statusColor = lib.status === 'success' ? chalk.green : chalk.red;
                    
                    libTable.push([
                        lib.packageName,
                        `${statusEmoji} ${statusColor(lib.status)}`,
                        lib.version || 'N/A',
                        lib.platform || 'npm',
                        new Date(lib.timestamp).toLocaleString()
                    ]);
                }
                
                console.log(libTable.toString());
            }
            
        } catch (error) {
            spinner.fail('Failed to fetch deployment status');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

/**
 * deployment verify - Verify deployment for a specific package
 */
deploymentCommand
    .command('verify <package>')
    .description('Verify deployment status for a package')
    .option('--health-check <url>', 'Health check URL for service deployments')
    .option('--script <cmd>', 'Verification script for library deployments')
    .option('--timeout <seconds>', 'Timeout in seconds', '300')
    .action(async (packageName, options) => {
        const spinner = ora(`Verifying deployment for ${packageName}...`).start();
        
        try {
            const client = await getApiClient();
            const context = await getCurrentContext();
            
            const response = await client.post(
                `/api/v1/orgs/${context.organization}/workspaces/${context.workspace}/deployments/verify`,
                {
                    packageName,
                    healthCheckUrl: options.healthCheck,
                    verificationScript: options.script
                }
            );
            
            const result = response.data;
            
            if (result.status === 'success') {
                spinner.succeed(`${packageName} deployed successfully!`);
                if (result.version) {
                    console.log(chalk.green(`Version: ${result.version}`));
                }
            } else {
                spinner.fail(`${packageName} deployment failed`);
                if (result.logs) {
                    console.log(chalk.red('\nError logs:'));
                    console.log(result.logs);
                }
            }
            
        } catch (error) {
            spinner.fail('Verification failed');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

/**
 * deployment diagnose - Submit logs for AI diagnostics
 */
deploymentCommand
    .command('diagnose <package>')
    .description('Analyze deployment logs with AI')
    .option('-f, --file <path>', 'Read logs from file')
    .option('-p, --platform <name>', 'Deployment platform (coolify, vercel, npm, etc.)')
    .action(async (packageName, options) => {
        const spinner = ora('Analyzing deployment logs...').start();
        
        try {
            let logs = '';
            
            if (options.file) {
                const fs = require('fs').promises;
                logs = await fs.readFile(options.file, 'utf-8');
            } else {
                // Read from stdin
                console.log(chalk.yellow('\nPaste deployment logs (Ctrl+D when done):\n'));
                spinner.stop();
                
                const chunks = [];
                for await (const chunk of process.stdin) {
                    chunks.push(chunk);
                }
                logs = Buffer.concat(chunks).toString();
                
                spinner.start('Analyzing logs...');
            }
            
            const client = await getApiClient();
            const context = await getCurrentContext();
            
            const response = await client.post(
                `/api/v1/orgs/${context.organization}/workspaces/${context.workspace}/deployments/${packageName}/logs`,
                {
                    logs,
                    platform: options.platform,
                    requestDiagnostics: true
                }
            );
            
            spinner.stop();
            
            const { diagnostics } = response.data;
            
            if (diagnostics && diagnostics.errors.length > 0) {
                console.log(chalk.bold('\n🔍 Deployment Issues Found:\n'));
                
                diagnostics.errors.forEach((error, i) => {
                    console.log(chalk.red(`${i + 1}. ${error}`));
                });
                
                console.log(chalk.bold('\n💡 Suggested Fixes:\n'));
                
                diagnostics.suggestions.forEach((suggestion, i) => {
                    console.log(chalk.green(`${i + 1}. ${suggestion}`));
                });
                
                console.log(chalk.gray(`\nConfidence: ${diagnostics.confidence}%`));
            } else {
                console.log(chalk.yellow('\nNo specific issues detected in the logs.'));
                console.log('Consider checking:');
                console.log('- Environment variables');
                console.log('- Network connectivity');
                console.log('- Resource limits');
            }
            
        } catch (error) {
            spinner.fail('Analysis failed');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

/**
 * deployment report - Generate deployment report
 */
deploymentCommand
    .command('report')
    .description('Generate deployment status report')
    .option('--format <type>', 'Output format (text, json, markdown)', 'text')
    .action(async (options) => {
        const spinner = ora('Generating deployment report...').start();
        
        try {
            const client = await getApiClient();
            const context = await getCurrentContext();
            
            const response = await client.get(
                `/api/v1/orgs/${context.organization}/workspaces/${context.workspace}/deployments/report`
            );
            
            const report = response.data;
            spinner.stop();
            
            if (options.format === 'json') {
                console.log(JSON.stringify(report, null, 2));
                return;
            }
            
            if (options.format === 'markdown') {
                console.log('# RepoCHief Deployment Report\n');
                console.log(`Generated: ${report.generated}\n`);
                console.log('## Summary\n');
                console.log(`- Total Packages: ${report.summary.total}`);
                console.log(`- Healthy: ${report.summary.healthy}`);
                console.log(`- Failing: ${report.summary.failing}`);
                console.log('\n## Package Status\n');
                console.log('| Package | Status | Version | Platform | Last Check |');
                console.log('|---------|--------|---------|----------|------------|');
                
                for (const pkg of report.packages) {
                    const emoji = pkg.status === 'success' ? '✅' : '❌';
                    console.log(`| ${pkg.name} | ${emoji} ${pkg.status} | ${pkg.version || 'N/A'} | ${pkg.platform} | ${pkg.lastCheck} |`);
                }
                
                if (report.recommendations.length > 0) {
                    console.log('\n## Recommendations\n');
                    for (const rec of report.recommendations) {
                        console.log(`- **${rec.severity}**: ${rec.message}`);
                        if (rec.packages) {
                            console.log(`  Affected: ${rec.packages.join(', ')}`);
                        }
                    }
                }
                
                return;
            }
            
            // Text format (default)
            console.log(chalk.bold('\n📊 RepoCHief Deployment Report\n'));
            console.log(`Generated: ${new Date(report.generated).toLocaleString()}\n`);
            
            console.log(chalk.bold('Summary:'));
            console.log(`  Total Packages: ${report.summary.total}`);
            console.log(`  ✅ Healthy: ${chalk.green(report.summary.healthy)}`);
            console.log(`  ❌ Failing: ${chalk.red(report.summary.failing)}`);
            
            if (report.recommendations.length > 0) {
                console.log(chalk.bold('\n⚠️  Recommendations:\n'));
                
                for (const rec of report.recommendations) {
                    const color = rec.severity === 'high' ? chalk.red : chalk.yellow;
                    console.log(color(`• ${rec.message}`));
                    if (rec.packages) {
                        console.log(`  Packages: ${rec.packages.join(', ')}`);
                    }
                }
            }
            
        } catch (error) {
            spinner.fail('Failed to generate report');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

module.exports = deploymentCommand;