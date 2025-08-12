/**
 * Intent management commands for RepoChief CLI
 * Intent Canvas - Vision-to-Implementation Tracking
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { getClient } = require('../auth/AuthManager');
const BaseCommand = require('./BaseCommand');
const Table = require('cli-table3');
const moment = require('moment');

class IntentCommand extends BaseCommand {
    constructor() {
        super();
        this.commands = {
            list: this.listIntents.bind(this),
            create: this.createIntent.bind(this),
            show: this.showIntent.bind(this),
            update: this.updateIntent.bind(this),
            complete: this.completeIntent.bind(this),
            cancel: this.cancelIntent.bind(this),
            task: this.manageTask.bind(this),
            dashboard: this.showDashboard.bind(this),
            files: this.manageFiles.bind(this),
            'add-file': this.addFile.bind(this),
            'list-files': this.listFiles.bind(this),
            'remove-file': this.removeFile.bind(this)
        };
    }

    async execute(subcommand, args) {
        if (!subcommand || !this.commands[subcommand]) {
            console.log(chalk.yellow('\nIntent Canvas - Vision-to-Implementation Tracking\n'));
            console.log(chalk.cyan('Available intent commands:'));
            console.log('  repochief intent list                 - List all intents');
            console.log('  repochief intent create               - Create a new intent');
            console.log('  repochief intent show <id>            - Show intent details');
            console.log('  repochief intent update <id>          - Update intent');
            console.log('  repochief intent complete <id>        - Mark intent as complete');
            console.log('  repochief intent cancel <id>          - Cancel intent');
            console.log('  repochief intent task <intent-id>     - Manage intent tasks');
            console.log('  repochief intent dashboard            - Show intent dashboard');
            console.log('');
            console.log(chalk.cyan('File tracking commands:'));
            console.log('  repochief intent files <intent-id>           - Manage intent files');
            console.log('  repochief intent add-file <intent-id> <path>  - Add file to intent');
            console.log('  repochief intent list-files <intent-id>       - List tracked files');
            console.log('  repochief intent remove-file <intent-id> <path> - Remove file from tracking');
            console.log('');
            console.log(chalk.gray('The Intent Canvas helps track strategic objectives'));
            console.log(chalk.gray('from vision to implementation, solving the bootstrap problem.'));
            return;
        }

        await this.commands[subcommand](args);
    }

    getContext() {
        const config = this.loadConfig();
        return {
            org: config.activeOrganization || '@me',
            workspace: config.activeWorkspace || 'default'
        };
    }

    async listIntents(args) {
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
            const { status, priority, overdue, limit = 20 } = args;
            
            const params = new URLSearchParams();
            if (status) params.append('status', status);
            if (priority) params.append('priority', priority);
            if (overdue) params.append('overdue', 'true');
            params.append('limit', limit);
            
            const intents = await client.getIntents();

            console.log(chalk.cyan('\n🎯 Intent Canvas:\n'));
            
            if (intents.length === 0) {
                console.log(chalk.gray('No intents found. Create one with: repochief intent create'));
                console.log(chalk.gray('Intent Canvas bridges vision documents with implementation tasks.'));
                return;
            }

            const table = new Table({
                head: [
                    chalk.cyan('Objective'),
                    chalk.cyan('Status'),
                    chalk.cyan('Progress'),
                    chalk.cyan('Tasks'),
                    chalk.cyan('Priority'),
                    chalk.cyan('Target')
                ],
                colWidths: [40, 12, 10, 8, 10, 12]
            });

            intents.forEach(intent => {
                const progressBar = this.getProgressBar(50); // Default progress since we don't have stats yet
                const statusColor = this.getStatusColor(intent.status);
                const priorityColor = chalk.yellow; // Default color
                
                const targetDate = moment(intent.created_at).format('MMM DD');
                
                table.push([
                    intent.objective.length > 37 ? intent.objective.substring(0, 34) + '...' : intent.objective,
                    statusColor(intent.status),
                    progressBar,
                    '0/0', // Default task count
                    priorityColor('medium'),
                    targetDate
                ]);
            });

            console.log(table.toString());
            console.log('');
            
            // Summary
            const activeCount = intents.filter(i => ['draft', 'active'].includes(i.status)).length;
            const completedCount = intents.filter(i => i.status === 'completed').length;
            
            console.log(chalk.gray(`Total: ${intents.length} intents (${activeCount} active, ${completedCount} completed)`));
            console.log(chalk.gray('Use "repochief intent show <id>" for details, "repochief intent dashboard" for overview'));

        } catch (error) {
            console.error(chalk.red('✗ Failed to list intents:'), error.message);
        }
    }

    async createIntent() {
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

        console.log(chalk.cyan('\n🎯 Creating New Intent\n'));
        console.log(chalk.gray('An intent represents a strategic objective that bridges'));
        console.log(chalk.gray('high-level vision with concrete implementation tasks.\n'));

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'objective',
                message: 'What is the objective of this intent?',
                validate: input => input.length > 0 || 'Objective is required'
            },
            {
                type: 'input',
                name: 'businessValue',
                message: 'What business value does this intent deliver?',
                validate: input => input.length > 0 || 'Business value is required'
            },
            {
                type: 'input',
                name: 'problem',
                message: 'What problem does this intent solve? (optional):',
            },
            {
                type: 'input',
                name: 'approach',
                message: 'What is your approach to solving this? (optional):',
            },
            {
                type: 'list',
                name: 'priority',
                message: 'Priority level:',
                choices: [
                    { name: 'Critical - Drop everything else', value: 'critical' },
                    { name: 'High - Important for current milestone', value: 'high' },
                    { name: 'Medium - Standard priority', value: 'medium' },
                    { name: 'Low - When time permits', value: 'low' }
                ],
                default: 'medium'
            },
            {
                type: 'list',
                name: 'category',
                message: 'Category:',
                choices: [
                    { name: 'Feature - New functionality', value: 'feature' },
                    { name: 'Bug Fix - Fixing issues', value: 'bugfix' },
                    { name: 'Infrastructure - Platform/tooling', value: 'infrastructure' },
                    { name: 'Refactor - Code improvement', value: 'refactor' },
                    { name: 'Research - Investigation/exploration', value: 'research' }
                ],
                default: 'feature'
            },
            {
                type: 'input',
                name: 'targetCompletion',
                message: 'Target completion date (YYYY-MM-DD, optional):',
                validate: input => {
                    if (!input) return true;
                    const date = new Date(input);
                    return !isNaN(date.getTime()) || 'Invalid date format (use YYYY-MM-DD)';
                }
            },
            {
                type: 'confirm',
                name: 'addTasks',
                message: 'Add initial tasks now?',
                default: true
            }
        ]);

        let tasks = [];
        if (answers.addTasks) {
            console.log(chalk.cyan('\nAdding tasks to intent:'));
            let addMore = true;
            
            while (addMore) {
                const taskAnswers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'description',
                        message: 'Task description:',
                        validate: input => input.length > 0 || 'Task description is required'
                    },
                    {
                        type: 'list',
                        name: 'priority',
                        message: 'Task priority:',
                        choices: ['critical', 'high', 'medium', 'low'],
                        default: 'medium'
                    },
                    {
                        type: 'list',
                        name: 'category',
                        message: 'Task category:',
                        choices: ['backend', 'frontend', 'infrastructure', 'testing', 'documentation', 'general'],
                        default: 'general'
                    }
                ]);
                
                tasks.push(taskAnswers);
                
                const continueAnswer = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'addMore',
                        message: 'Add another task?',
                        default: false
                    }
                ]);
                
                addMore = continueAnswer.addMore;
            }
        }

        try {
            const intentData = {
                objective: answers.objective,
                business_value: answers.businessValue,
                success_metrics: 'Success metrics to be defined',
                hypothesis: answers.approach || 'Initial hypothesis to be refined',
                status: 'draft',
                metadata: {
                    priority: answers.priority,
                    category: answers.category,
                    estimatedEffort: 'medium',
                    tags: [],
                    problem: answers.problem || '',
                    targetCompletion: answers.targetCompletion || null
                }
            };

            const intent = await client.createIntent(intentData);

            console.log(chalk.green('\n✓ Intent created successfully!'));
            console.log(chalk.cyan(`\nIntent: ${intent.objective}`));
            console.log(`ID: ${intent.id}`);
            console.log(`Business Value: ${intent.business_value}`);
            console.log(`Status: ${intent.status}`);
            console.log(`Created: ${moment(intent.created_at).format('YYYY-MM-DD HH:mm')}`);
            
            if (tasks.length > 0) {
                console.log(`Tasks: ${tasks.length} initial tasks (to be implemented)`);
            }
            
            console.log(chalk.gray('\nView details with: repochief intent show ' + intent.id));
            console.log(chalk.gray('Track progress on the dashboard: repochief intent dashboard'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to create intent:'), error.message);
        }
    }

    async showIntent(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent show <id>'));
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
            const intent = await client.getIntent(intentId);

            console.log(chalk.cyan(`\n🎯 Intent: ${intent.objective}\n`));
            
            // Basic info
            console.log(chalk.bold('Basic Information:'));
            console.log(`  ID: ${intent.id}`);
            console.log(`  Status: ${this.getStatusColor(intent.status)(intent.status)}`);
            console.log(`  Business Value: ${intent.businessValue}`);
            console.log(`  Priority: ${this.getPriorityColor(intent.metadata.priority)(intent.metadata.priority)}`);
            console.log(`  Category: ${intent.metadata.category}`);
            
            if (intent.targetCompletion) {
                const isOverdue = intent.stats.isOverdue;
                const targetText = moment(intent.targetCompletion).format('YYYY-MM-DD');
                console.log(`  Target: ${targetText}${isOverdue ? chalk.red(' (OVERDUE)') : ''}`);
            }
            
            console.log(`  Created: ${moment(intent.createdAt).format('YYYY-MM-DD HH:mm')}`);
            console.log(`  Updated: ${moment(intent.updatedAt).format('YYYY-MM-DD HH:mm')}`);
            console.log('');

            // Progress
            const progressBar = this.getProgressBar(intent.stats.progress, 20);
            console.log(chalk.bold('Progress:'));
            console.log(`  ${progressBar} ${intent.stats.progress}%`);
            console.log(`  Tasks: ${intent.stats.completedTasks}/${intent.stats.totalTasks} completed`);
            
            if (intent.stats.activeBlockers > 0) {
                console.log(chalk.red(`  ⚠ ${intent.stats.activeBlockers} active blockers`));
            }
            console.log('');

            // Context
            if (intent.context.problem || intent.context.approach) {
                console.log(chalk.bold('Context:'));
                if (intent.context.problem) {
                    console.log(`  Problem: ${intent.context.problem}`);
                }
                if (intent.context.approach) {
                    console.log(`  Approach: ${intent.context.approach}`);
                }
                console.log('');
            }

            // Tasks
            if (intent.tasks && intent.tasks.length > 0) {
                console.log(chalk.bold('Tasks:'));
                intent.tasks.forEach((task, index) => {
                    const statusIcon = task.status === 'completed' ? chalk.green('✓') : 
                                     task.status === 'in_progress' ? chalk.yellow('⏳') :
                                     task.status === 'cancelled' ? chalk.red('✗') : '○';
                    
                    const priorityColor = this.getPriorityColor(task.priority);
                    console.log(`  ${statusIcon} ${task.description}`);
                    console.log(`    Status: ${task.status} | Priority: ${priorityColor(task.priority)} | Category: ${task.category}`);
                    
                    if (task.dependsOn && task.dependsOn.length > 0) {
                        console.log(`    Depends on: ${task.dependsOn.join(', ')}`);
                    }
                });
                console.log('');
            }

            // Active blockers
            const activeBlockers = intent.blockers.filter(b => b.status === 'active');
            if (activeBlockers.length > 0) {
                console.log(chalk.bold(chalk.red('Active Blockers:')));
                activeBlockers.forEach(blocker => {
                    console.log(chalk.red(`  ⚠ ${blocker.issue}`));
                    console.log(`    Impact: ${blocker.impact}`);
                    if (blocker.solution) {
                        console.log(`    Solution: ${blocker.solution}`);
                    }
                });
                console.log('');
            }

            // Recent learnings
            if (intent.learnings && intent.learnings.length > 0) {
                console.log(chalk.bold('Recent Learnings:'));
                intent.learnings.slice(-3).forEach(learning => {
                    console.log(`  💡 ${learning.learning}`);
                    console.log(`    ${moment(learning.createdAt).format('MMM DD, YYYY')}`);
                });
                console.log('');
            }

            // Recent history
            if (intent.history && intent.history.length > 0) {
                console.log(chalk.bold('Recent Activity:'));
                intent.history.slice(0, 5).forEach(h => {
                    console.log(`  ${moment(h.changedAt).format('MMM DD, HH:mm')} - ${h.description}`);
                });
                console.log('');
            }

            console.log(chalk.gray('Manage tasks: repochief intent task ' + intent.id));
            console.log(chalk.gray('Update intent: repochief intent update ' + intent.id));

        } catch (error) {
            if (error.response?.status === 404) {
                console.error(chalk.red('✗ Intent not found'));
            } else {
                console.error(chalk.red('✗ Failed to show intent:'), error.message);
            }
        }
    }

    async updateIntent(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent update <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        
        try {
            // First get current intent to show current values
            const currentResponse = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}`);
            const current = currentResponse.data.intent;

            console.log(chalk.cyan(`\n🎯 Updating Intent: ${current.objective}\n`));

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'field',
                    message: 'What would you like to update?',
                    choices: [
                        { name: 'Objective', value: 'objective' },
                        { name: 'Business Value', value: 'businessValue' },
                        { name: 'Status', value: 'status' },
                        { name: 'Priority', value: 'priority' },
                        { name: 'Target Completion Date', value: 'targetCompletion' },
                        { name: 'Problem Description', value: 'problem' },
                        { name: 'Approach', value: 'approach' }
                    ]
                }
            ]);

            let updateData = {};

            if (answers.field === 'objective') {
                const newValue = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: 'New objective:',
                    default: current.objective
                }]);
                updateData.objective = newValue.value;
            } else if (answers.field === 'businessValue') {
                const newValue = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: 'New business value:',
                    default: current.businessValue
                }]);
                updateData.businessValue = newValue.value;
            } else if (answers.field === 'status') {
                const newValue = await inquirer.prompt([{
                    type: 'list',
                    name: 'value',
                    message: 'New status:',
                    choices: ['pending', 'in_progress', 'completed', 'cancelled'],
                    default: current.status
                }]);
                updateData.status = newValue.value;
            } else if (answers.field === 'priority') {
                const newValue = await inquirer.prompt([{
                    type: 'list',
                    name: 'value',
                    message: 'New priority:',
                    choices: ['critical', 'high', 'medium', 'low'],
                    default: current.metadata.priority
                }]);
                updateData.metadata = { priority: newValue.value };
            } else if (answers.field === 'targetCompletion') {
                const newValue = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: 'Target completion date (YYYY-MM-DD):',
                    default: current.targetCompletion ? moment(current.targetCompletion).format('YYYY-MM-DD') : ''
                }]);
                updateData.targetCompletion = newValue.value || null;
            } else if (answers.field === 'problem') {
                const newValue = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: 'Problem description:',
                    default: current.context.problem
                }]);
                updateData.context = { problem: newValue.value };
            } else if (answers.field === 'approach') {
                const newValue = await inquirer.prompt([{
                    type: 'input',
                    name: 'value',
                    message: 'Approach description:',
                    default: current.context.approach
                }]);
                updateData.context = { approach: newValue.value };
            }

            await client.put(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}`, updateData);
            console.log(chalk.green('\n✓ Intent updated successfully'));

        } catch (error) {
            if (error.response?.status === 404) {
                console.error(chalk.red('✗ Intent not found'));
            } else {
                console.error(chalk.red('✗ Failed to update intent:'), error.message);
            }
        }
    }

    async completeIntent(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent complete <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        
        try {
            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Mark this intent as completed?',
                    default: true
                },
                {
                    type: 'input',
                    name: 'learnings',
                    message: 'Any learnings to record? (optional):',
                    when: answers => answers.confirm
                }
            ]);

            if (!answers.confirm) {
                console.log(chalk.gray('Cancelled.'));
                return;
            }

            await client.put(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}`, {
                status: 'completed'
            });

            console.log(chalk.green('\n✓ Intent marked as completed!'));
            console.log(chalk.cyan('🎉 Great work on completing this intent.'));

        } catch (error) {
            console.error(chalk.red('✗ Failed to complete intent:'), error.message);
        }
    }

    async cancelIntent(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent cancel <id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        
        try {
            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure you want to cancel this intent?',
                    default: false
                }
            ]);

            if (!answers.confirm) {
                console.log(chalk.gray('Cancelled.'));
                return;
            }

            await client.delete(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}`);
            console.log(chalk.green('\n✓ Intent cancelled'));

        } catch (error) {
            console.error(chalk.red('✗ Failed to cancel intent:'), error.message);
        }
    }

    async manageTask(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent task <intent-id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        
        try {
            const intentResponse = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}`);
            const intent = intentResponse.data.intent;

            console.log(chalk.cyan(`\n📋 Task Management: ${intent.objective}\n`));

            const action = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: 'Add new task', value: 'add' },
                        { name: 'Update task status', value: 'update' },
                        { name: 'List all tasks', value: 'list' }
                    ]
                }
            ]);

            if (action.action === 'add') {
                await this.addTask(client, org, workspace, intentId);
            } else if (action.action === 'update') {
                await this.updateTask(client, org, workspace, intentId, intent.tasks);
            } else if (action.action === 'list') {
                await this.listTasks(intent.tasks);
            }

        } catch (error) {
            console.error(chalk.red('✗ Failed to manage tasks:'), error.message);
        }
    }

    async addTask(client, org, workspace, intentId) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'description',
                message: 'Task description:',
                validate: input => input.length > 0 || 'Task description is required'
            },
            {
                type: 'list',
                name: 'priority',
                message: 'Priority:',
                choices: ['critical', 'high', 'medium', 'low'],
                default: 'medium'
            },
            {
                type: 'list',
                name: 'category',
                message: 'Category:',
                choices: ['backend', 'frontend', 'infrastructure', 'testing', 'documentation', 'general'],
                default: 'general'
            }
        ]);

        try {
            await client.post(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/tasks`, answers);
            console.log(chalk.green('\n✓ Task added successfully'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to add task:'), error.message);
        }
    }

    async updateTask(client, org, workspace, intentId, tasks) {
        if (tasks.length === 0) {
            console.log(chalk.gray('No tasks found. Add a task first.'));
            return;
        }

        const taskChoice = await inquirer.prompt([
            {
                type: 'list',
                name: 'taskId',
                message: 'Select task to update:',
                choices: tasks.map(task => ({
                    name: `${task.description} (${task.status})`,
                    value: task.id
                }))
            }
        ]);

        const statusChoice = await inquirer.prompt([
            {
                type: 'list',
                name: 'status',
                message: 'New status:',
                choices: ['pending', 'in_progress', 'completed', 'cancelled']
            }
        ]);

        try {
            await client.put(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/tasks/${taskChoice.taskId}`, {
                status: statusChoice.status
            });
            console.log(chalk.green('\n✓ Task updated successfully'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to update task:'), error.message);
        }
    }

    async listTasks(tasks) {
        if (tasks.length === 0) {
            console.log(chalk.gray('No tasks found.'));
            return;
        }

        console.log(chalk.bold('Tasks:'));
        tasks.forEach((task, index) => {
            const statusIcon = task.status === 'completed' ? chalk.green('✓') : 
                             task.status === 'in_progress' ? chalk.yellow('⏳') :
                             task.status === 'cancelled' ? chalk.red('✗') : '○';
            
            console.log(`${index + 1}. ${statusIcon} ${task.description}`);
            console.log(`   Status: ${task.status} | Priority: ${task.priority} | Category: ${task.category}`);
        });
    }

    async showDashboard() {
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
            const response = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/dashboard`);
            const data = response.data;

            console.log(chalk.cyan('\n📊 Intent Canvas Dashboard\n'));
            
            // Stats overview
            console.log(chalk.bold('Overview:'));
            console.log(`  Total Intents: ${data.stats.total}`);
            console.log(`  Active: ${data.stats.pending + data.stats.in_progress} (${data.stats.pending} pending, ${data.stats.in_progress} in progress)`);
            console.log(`  Completed: ${data.stats.completed}`);
            
            if (data.stats.overdue > 0) {
                console.log(chalk.red(`  ⚠ Overdue: ${data.stats.overdue}`));
            }
            
            console.log(`  Overall Progress: ${data.stats.overallProgress}%`);
            console.log('');

            // Task stats
            console.log(chalk.bold('Task Statistics:'));
            console.log(`  Total Tasks: ${data.stats.totalTasks}`);
            console.log(`  Completed: ${data.stats.completedTasks}`);
            console.log(`  In Progress: ${data.stats.inProgressTasks}`);
            console.log(`  Pending: ${data.stats.pendingTasks}`);
            
            if (data.stats.activeBlockers > 0) {
                console.log(chalk.red(`  Active Blockers: ${data.stats.activeBlockers}`));
            }
            console.log('');

            // Recent activity
            if (data.recentActivity.length > 0) {
                console.log(chalk.bold('Recent Activity:'));
                data.recentActivity.forEach(intent => {
                    const statusColor = this.getStatusColor(intent.status);
                    console.log(`  ${statusColor(intent.status)} ${intent.objective}`);
                    console.log(`    Updated: ${moment(intent.updatedAt).fromNow()}`);
                });
                console.log('');
            }

            console.log(chalk.gray('Use "repochief intent list" to see all intents'));
            console.log(chalk.gray('Create a new intent with "repochief intent create"'));

        } catch (error) {
            console.error(chalk.red('✗ Failed to get dashboard:'), error.message);
        }
    }

    // Helper methods
    getProgressBar(progress, length = 10) {
        const filled = Math.round((progress / 100) * length);
        const empty = length - filled;
        return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    }

    getStatusColor(status) {
        switch (status) {
            case 'completed': return chalk.green;
            case 'in_progress': return chalk.yellow;
            case 'cancelled': return chalk.red;
            default: return chalk.gray;
        }
    }

    getPriorityColor(priority) {
        switch (priority) {
            case 'critical': return chalk.red.bold;
            case 'high': return chalk.red;
            case 'medium': return chalk.yellow;
            case 'low': return chalk.gray;
            default: return chalk.white;
        }
    }

    // File management methods
    async manageFiles(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent files <intent-id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        
        try {
            const intentResponse = await client.get(`/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}`);
            const intent = intentResponse.data.intent;
            
            console.log(chalk.cyan(`\n📁 File Management: ${intent.objective}\n`));
            
            const action = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'action',
                    message: 'What would you like to do?',
                    choices: [
                        { name: 'Add files to tracking', value: 'add' },
                        { name: 'List all tracked files', value: 'list' },
                        { name: 'Remove file from tracking', value: 'remove' },
                        { name: 'Show file statistics', value: 'stats' }
                    ]
                }
            ]);

            if (action.action === 'add') {
                await this.addFileInteractive(client, org, workspace, intentId);
            } else if (action.action === 'list') {
                await this.listFiles({ _: [intentId] });
            } else if (action.action === 'remove') {
                await this.removeFileInteractive(client, org, workspace, intentId, intent.files);
            } else if (action.action === 'stats') {
                await this.showFileStats(intent.files);
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to manage files:'), error.message);
        }
    }

    async addFile(args) {
        const intentId = args._[0];
        const filePath = args._[1];
        
        if (!intentId || !filePath) {
            console.error(chalk.red('✗ Usage: repochief intent add-file <intent-id> <file-path>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        const operation = args.operation || 'created';
        
        try {
            const response = await client.post(
                `/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/files`,
                {
                    files: [{
                        path: filePath,
                        operation: operation,
                        metadata: args.metadata ? JSON.parse(args.metadata) : {}
                    }]
                }
            );
            
            console.log(chalk.green('✓ File added to tracking'));
            console.log(`  Intent: ${intentId}`);
            console.log(`  File: ${filePath}`);
            console.log(`  Operation: ${operation}`);
            console.log(`  Total files tracked: ${response.data.files.metadata.totalFiles}`);
        } catch (error) {
            console.error(chalk.red('✗ Failed to add file:'), error.message);
        }
    }

    async listFiles(args) {
        const intentId = args._[0];
        if (!intentId) {
            console.error(chalk.red('✗ Please provide an intent ID: repochief intent list-files <intent-id>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        const operation = args.operation;
        
        try {
            let url = `/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/files`;
            if (operation) {
                url += `?operation=${operation}`;
            }
            
            const response = await client.get(url);
            const data = response.data;
            
            console.log(chalk.cyan(`\n📁 Files tracked by intent: ${data.objective}\n`));
            
            if (operation) {
                // Single operation view
                console.log(chalk.bold(`${operation.charAt(0).toUpperCase() + operation.slice(1)} files (${data.count}):`));
                if (data.files.length === 0) {
                    console.log(chalk.gray('  No files'));
                } else {
                    data.files.forEach(file => {
                        console.log(`  📄 ${file}`);
                    });
                }
            } else {
                // All files view
                if (data.files.created.length > 0) {
                    console.log(chalk.bold(`Created files (${data.files.created.length}):`));
                    data.files.created.forEach(file => {
                        console.log(`  ✨ ${chalk.green(file)}`);
                    });
                    console.log('');
                }
                
                if (data.files.modified.length > 0) {
                    console.log(chalk.bold(`Modified files (${data.files.modified.length}):`));
                    data.files.modified.forEach(file => {
                        console.log(`  📝 ${chalk.yellow(file)}`);
                    });
                    console.log('');
                }
                
                if (data.files.deleted.length > 0) {
                    console.log(chalk.bold(`Deleted files (${data.files.deleted.length}):`));
                    data.files.deleted.forEach(file => {
                        console.log(`  🗑️  ${chalk.red(file)}`);
                    });
                    console.log('');
                }
                
                console.log(chalk.gray(`Total files tracked: ${data.files.total}`));
                if (data.metadata.lastUpdated) {
                    console.log(chalk.gray(`Last updated: ${moment(data.metadata.lastUpdated).fromNow()}`));
                }
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to list files:'), error.message);
        }
    }

    async removeFile(args) {
        const intentId = args._[0];
        const filePath = args._[1];
        
        if (!intentId || !filePath) {
            console.error(chalk.red('✗ Usage: repochief intent remove-file <intent-id> <file-path>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const { org, workspace } = this.getContext();
        
        try {
            const response = await client.delete(
                `/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/files`,
                { data: { path: filePath } }
            );
            
            console.log(chalk.green('✓ File removed from tracking'));
            console.log(`  Intent: ${intentId}`);
            console.log(`  File: ${filePath}`);
            console.log(`  Remaining files: ${response.data.files.metadata.totalFiles}`);
        } catch (error) {
            console.error(chalk.red('✗ Failed to remove file:'), error.message);
        }
    }

    async addFileInteractive(client, org, workspace, intentId) {
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'paths',
                message: 'Enter file paths (comma-separated):',
                validate: input => input.trim() ? true : 'Please enter at least one file path'
            },
            {
                type: 'list',
                name: 'operation',
                message: 'Operation type:',
                choices: ['created', 'modified', 'deleted'],
                default: 'created'
            }
        ]);

        const files = answers.paths.split(',').map(path => ({
            path: path.trim(),
            operation: answers.operation
        }));

        try {
            const response = await client.post(
                `/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/files`,
                { files }
            );
            
            console.log(chalk.green(`✓ Added ${files.length} file(s) to tracking`));
            console.log(`  Total files now: ${response.data.files.metadata.totalFiles}`);
        } catch (error) {
            console.error(chalk.red('✗ Failed to add files:'), error.message);
        }
    }

    async removeFileInteractive(client, org, workspace, intentId, files) {
        const allFiles = [
            ...files.created.map(f => ({ path: f, type: 'created' })),
            ...files.modified.map(f => ({ path: f, type: 'modified' })),
            ...files.deleted.map(f => ({ path: f, type: 'deleted' }))
        ];

        if (allFiles.length === 0) {
            console.log(chalk.gray('No files tracked by this intent'));
            return;
        }

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'file',
                message: 'Select file to remove:',
                choices: allFiles.map(f => ({
                    name: `[${f.type}] ${f.path}`,
                    value: f.path
                }))
            }
        ]);

        try {
            await client.delete(
                `/api/v1/orgs/${org}/workspaces/${workspace}/intents/${intentId}/files`,
                { data: { path: answer.file } }
            );
            
            console.log(chalk.green('✓ File removed from tracking'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to remove file:'), error.message);
        }
    }

    async showFileStats(files) {
        console.log(chalk.cyan('\n📊 File Statistics:\n'));
        
        const stats = {
            created: files.created?.length || 0,
            modified: files.modified?.length || 0,
            deleted: files.deleted?.length || 0,
            total: (files.created?.length || 0) + (files.modified?.length || 0) + (files.deleted?.length || 0)
        };

        const table = new Table({
            head: [chalk.cyan('Operation'), chalk.cyan('Count'), chalk.cyan('Percentage')],
            colWidths: [15, 10, 15]
        });

        table.push(
            ['Created', chalk.green(stats.created), `${Math.round((stats.created / stats.total) * 100)}%`],
            ['Modified', chalk.yellow(stats.modified), `${Math.round((stats.modified / stats.total) * 100)}%`],
            ['Deleted', chalk.red(stats.deleted), `${Math.round((stats.deleted / stats.total) * 100)}%`],
            ['─────────', '─────', '─────────'],
            ['Total', chalk.bold(stats.total), '100%']
        );

        console.log(table.toString());

        if (files.metadata?.lastUpdated) {
            console.log(chalk.gray(`\nLast updated: ${moment(files.metadata.lastUpdated).fromNow()}`));
        }
    }
}

module.exports = new IntentCommand();