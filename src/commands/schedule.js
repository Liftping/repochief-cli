/**
 * Schedule management commands for RepoChief CLI
 * Phase 1 Revenue Features - Scheduled Tasks
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { getClient } = require('../auth/AuthManager');
const BaseCommand = require('./BaseCommand');
const cron = require('node-cron');

class ScheduleCommand extends BaseCommand {
    constructor() {
        super();
        this.commands = {
            list: this.listSchedules.bind(this),
            create: this.createSchedule.bind(this),
            delete: this.deleteSchedule.bind(this),
            pause: this.pauseSchedule.bind(this),
            resume: this.resumeSchedule.bind(this),
            runs: this.listRuns.bind(this),
            templates: this.listTemplates.bind(this)
        };
    }

    async execute(subcommand, args) {
        if (!subcommand || !this.commands[subcommand]) {
            console.log(chalk.yellow('\nAvailable schedule commands:'));
            console.log('  repochief schedule list            - List all scheduled tasks');
            console.log('  repochief schedule create          - Create a new scheduled task');
            console.log('  repochief schedule delete <id>     - Delete a scheduled task');
            console.log('  repochief schedule pause <id>      - Pause a scheduled task');
            console.log('  repochief schedule resume <id>     - Resume a scheduled task');
            console.log('  repochief schedule runs <id>       - List runs for a schedule');
            console.log('  repochief schedule templates       - List available analysis templates');
            return;
        }

        await this.commands[subcommand](args);
    }

    getContext() {
        const config = this.loadConfig();
        return {
            org: config.activeOrganization || '@me',
            workspace: config.activeWorkspace
        };
    }

    async listSchedules() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        if (!workspace) {
            console.error(chalk.red('✗ Please select a workspace first: repochief workspace switch'));
            return;
        }

        try {
            const response = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/schedules`);
            const schedules = response.data.schedules;

            console.log(chalk.cyan('\n⏰ Scheduled Tasks:\n'));
            
            if (schedules.length === 0) {
                console.log(chalk.gray('No scheduled tasks found. Create one with: repochief schedule create'));
                return;
            }

            schedules.forEach(schedule => {
                const status = schedule.is_active ? chalk.green('✓ Active') : chalk.yellow('⏸ Paused');
                const nextRun = schedule.next_run ? new Date(schedule.next_run).toLocaleString() : 'N/A';
                
                console.log(`${chalk.bold(schedule.name)} ${status}`);
                console.log(`  ID: ${schedule.id}`);
                console.log(`  Template: ${chalk.cyan(schedule.template)}`);
                console.log(`  Schedule: ${schedule.cron_expression} (${schedule.human_readable})`);
                console.log(`  Next Run: ${nextRun}`);
                console.log(`  Runs: ${schedule.run_count} total, ${schedule.success_count} successful`);
                
                if (schedule.project_name) {
                    console.log(`  Project: ${schedule.project_name}`);
                }
                
                console.log('');
            });

            // Show usage summary
            const activeCount = schedules.filter(s => s.is_active).length;
            console.log(chalk.gray(`Total: ${schedules.length} schedules (${activeCount} active)`));
        } catch (error) {
            console.error(chalk.red('✗ Failed to list schedules:'), error.message);
        }
    }

    async createSchedule() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        if (!workspace) {
            console.error(chalk.red('✗ Please select a workspace first: repochief workspace switch'));
            return;
        }

        // Check limits first
        try {
            const orgResponse = await client.get(`/api/v1/orgs/${org}`);
            const orgData = orgResponse.data.organization;
            
            if (orgData.scheduled_task_count >= orgData.max_scheduled_tasks) {
                console.error(chalk.red(`✗ Scheduled task limit reached (${orgData.scheduled_task_count}/${orgData.max_scheduled_tasks})`));
                console.log(chalk.yellow('Upgrade your subscription to create more scheduled tasks'));
                return;
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to check organization limits'));
            return;
        }

        // Get available projects
        let projects = [];
        try {
            const projResponse = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/projects`);
            projects = projResponse.data.projects;
            
            if (projects.length === 0) {
                console.error(chalk.red('✗ No projects found. Create a project first with: repochief init'));
                return;
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to list projects'));
            return;
        }

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Schedule name:',
                validate: input => input.length > 0
            },
            {
                type: 'list',
                name: 'template',
                message: 'Analysis template:',
                choices: [
                    { name: 'Security Audit - Comprehensive vulnerability analysis ($3-5/night)', value: 'security-audit' },
                    { name: 'Code Quality - Maintainability and quality report ($4-7/night)', value: 'code-quality' },
                    { name: 'Technical Debt - Debt identification and prioritization ($5-8/night)', value: 'tech-debt' },
                    { name: 'Dependency Updates - Update and vulnerability check ($2-4/night)', value: 'dependency-update' }
                ]
            },
            {
                type: 'list',
                name: 'project_id',
                message: 'Select project:',
                choices: projects.map(p => ({ name: `${p.name} (${p.repository_url})`, value: p.id }))
            },
            {
                type: 'list',
                name: 'schedule_preset',
                message: 'Schedule frequency:',
                choices: [
                    { name: 'Daily at 9 AM', value: '0 9 * * *' },
                    { name: 'Daily at midnight', value: '0 0 * * *' },
                    { name: 'Weekly on Monday at 9 AM', value: '0 9 * * 1' },
                    { name: 'Every 3 days at 9 AM', value: '0 9 */3 * *' },
                    { name: 'Monthly on the 1st at 9 AM', value: '0 9 1 * *' },
                    { name: 'Custom cron expression', value: 'custom' }
                ]
            }
        ]);

        let cronExpression = answers.schedule_preset;
        if (cronExpression === 'custom') {
            const customAnswer = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'cron',
                    message: 'Enter cron expression (e.g., "0 9 * * *" for daily at 9 AM):',
                    validate: input => {
                        if (cron.validate(input)) {
                            return true;
                        }
                        return 'Invalid cron expression. Format: minute hour day month weekday';
                    }
                }
            ]);
            cronExpression = customAnswer.cron;
        }

        // Template-specific config
        let templateConfig = {};
        if (answers.template === 'code-quality') {
            const configAnswers = await inquirer.prompt([
                {
                    type: 'number',
                    name: 'complexityThreshold',
                    message: 'Complexity threshold (default 10):',
                    default: 10
                },
                {
                    type: 'number',
                    name: 'coverageThreshold',
                    message: 'Coverage threshold % (default 80):',
                    default: 80
                }
            ]);
            templateConfig = configAnswers;
        }

        try {
            const response = await client.post(`/api/v1/orgs/${org}/workspaces/${workspace}/schedules`, {
                name: answers.name,
                template: answers.template,
                project_id: answers.project_id,
                cron_expression: cronExpression,
                config: templateConfig,
                is_active: true
            });

            const schedule = response.data.schedule;
            console.log(chalk.green('\n✓ Scheduled task created successfully!'));
            console.log(chalk.cyan(`\nSchedule: ${schedule.name}`));
            console.log(`ID: ${schedule.id}`);
            console.log(`Template: ${schedule.template}`);
            console.log(`Schedule: ${schedule.cron_expression}`);
            console.log(`Next Run: ${new Date(schedule.next_run).toLocaleString()}`);
            
            console.log(chalk.gray('\nThe task will run automatically according to the schedule.'));
            console.log(chalk.gray('View runs with: repochief schedule runs ' + schedule.id));
        } catch (error) {
            console.error(chalk.red('✗ Failed to create schedule:'), error.message);
        }
    }

    async deleteSchedule(args) {
        const scheduleId = args._[0];
        if (!scheduleId) {
            console.error(chalk.red('✗ Please provide a schedule ID: repochief schedule delete <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        if (!workspace) {
            console.error(chalk.red('✗ Please select a workspace first: repochief workspace switch'));
            return;
        }

        const answer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'confirm',
                message: 'Are you sure you want to delete this scheduled task?',
                default: false
            }
        ]);

        if (!answer.confirm) {
            console.log(chalk.gray('Deletion cancelled.'));
            return;
        }

        try {
            await client.delete(`/api/v1/orgs/${org}/workspaces/${workspace}/schedules/${scheduleId}`);
            console.log(chalk.green('\n✓ Scheduled task deleted successfully'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to delete schedule:'), error.message);
        }
    }

    async pauseSchedule(args) {
        const scheduleId = args._[0];
        if (!scheduleId) {
            console.error(chalk.red('✗ Please provide a schedule ID: repochief schedule pause <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        if (!workspace) {
            console.error(chalk.red('✗ Please select a workspace first: repochief workspace switch'));
            return;
        }

        try {
            await client.patch(`/api/v1/orgs/${org}/workspaces/${workspace}/schedules/${scheduleId}`, {
                is_active: false
            });
            console.log(chalk.green('\n✓ Scheduled task paused'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to pause schedule:'), error.message);
        }
    }

    async resumeSchedule(args) {
        const scheduleId = args._[0];
        if (!scheduleId) {
            console.error(chalk.red('✗ Please provide a schedule ID: repochief schedule resume <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        if (!workspace) {
            console.error(chalk.red('✗ Please select a workspace first: repochief workspace switch'));
            return;
        }

        try {
            await client.patch(`/api/v1/orgs/${org}/workspaces/${workspace}/schedules/${scheduleId}`, {
                is_active: true
            });
            console.log(chalk.green('\n✓ Scheduled task resumed'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to resume schedule:'), error.message);
        }
    }

    async listRuns(args) {
        const scheduleId = args._[0];
        if (!scheduleId) {
            console.error(chalk.red('✗ Please provide a schedule ID: repochief schedule runs <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        if (!workspace) {
            console.error(chalk.red('✗ Please select a workspace first: repochief workspace switch'));
            return;
        }

        try {
            const response = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/schedules/${scheduleId}/runs`);
            const runs = response.data.runs;

            console.log(chalk.cyan('\n📊 Schedule Runs:\n'));
            
            if (runs.length === 0) {
                console.log(chalk.gray('No runs yet. The schedule will run according to its cron expression.'));
                return;
            }

            runs.forEach(run => {
                const status = run.status === 'completed' ? chalk.green('✓') : 
                             run.status === 'failed' ? chalk.red('✗') : 
                             chalk.yellow('⏳');
                
                console.log(`${status} Run at ${new Date(run.started_at).toLocaleString()}`);
                console.log(`  Status: ${run.status}`);
                console.log(`  Duration: ${run.duration_seconds}s`);
                
                if (run.error) {
                    console.log(`  Error: ${chalk.red(run.error)}`);
                }
                
                if (run.summary) {
                    console.log(`  Summary: ${run.summary}`);
                }
                
                console.log('');
            });
        } catch (error) {
            console.error(chalk.red('✗ Failed to list runs:'), error.message);
        }
    }

    async listTemplates() {
        console.log(chalk.cyan('\n📋 Available Analysis Templates:\n'));
        
        console.log(chalk.bold('Security Audit'));
        console.log('  Comprehensive security vulnerability analysis');
        console.log('  - npm audit, OWASP checks, dependency scanning');
        console.log('  - Severity scoring and remediation guidance');
        console.log('  - Estimated cost: $3-5/night');
        console.log('');
        
        console.log(chalk.bold('Code Quality Report'));
        console.log('  Code quality and maintainability analysis');
        console.log('  - Complexity metrics, code coverage');
        console.log('  - Linting, code smells, duplication');
        console.log('  - Estimated cost: $4-7/night');
        console.log('');
        
        console.log(chalk.bold('Technical Debt Analysis'));
        console.log('  Technical debt identification and prioritization');
        console.log('  - TODO/FIXME scanning, outdated patterns');
        console.log('  - Debt scoring and ROI analysis');
        console.log('  - Estimated cost: $5-8/night');
        console.log('');
        
        console.log(chalk.bold('Dependency Updates'));
        console.log('  Dependency update and vulnerability analysis');
        console.log('  - Outdated package detection');
        console.log('  - Breaking change analysis');
        console.log('  - Estimated cost: $2-4/night');
        console.log('');
        
        console.log(chalk.gray('Create a scheduled task with: repochief schedule create'));
    }
}

module.exports = new ScheduleCommand();