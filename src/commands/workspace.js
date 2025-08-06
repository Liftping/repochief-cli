/**
 * Workspace management commands for RepoChief CLI
 * Multi-tenancy support for project isolation
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { getClient } = require('../auth/AuthManager');
const BaseCommand = require('./BaseCommand');

class WorkspaceCommand extends BaseCommand {
    constructor() {
        super();
        this.commands = {
            list: this.listWorkspaces.bind(this),
            create: this.createWorkspace.bind(this),
            switch: this.switchWorkspace.bind(this),
            info: this.showWorkspaceInfo.bind(this),
            delete: this.deleteWorkspace.bind(this)
        };
    }

    async execute(subcommand, args) {
        if (!subcommand || !this.commands[subcommand]) {
            console.log(chalk.yellow('\nAvailable workspace commands:'));
            console.log('  repochief workspace list           - List all workspaces');
            console.log('  repochief workspace create         - Create a new workspace');
            console.log('  repochief workspace switch         - Switch active workspace');
            console.log('  repochief workspace info           - Show current workspace info');
            console.log('  repochief workspace delete         - Delete a workspace');
            return;
        }

        await this.commands[subcommand](args);
    }

    getActiveOrg() {
        const config = this.loadConfig();
        return config.activeOrganization || '@me';
    }

    async listWorkspaces() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const activeOrg = this.getActiveOrg();

        try {
            const response = await client.get(`/api/v1/orgs/${activeOrg}/workspaces`);
            const workspaces = response.data.workspaces;

            console.log(chalk.cyan('\n📁 Workspaces:\n'));
            
            const config = this.loadConfig();
            const activeWorkspace = config.activeWorkspace;

            workspaces.forEach(ws => {
                const marker = ws.slug === activeWorkspace ? chalk.green('●') : chalk.gray('○');
                console.log(`${marker} ${chalk.bold(ws.name)}`);
                console.log(`  Slug: ${ws.slug}`);
                console.log(`  Projects: ${ws.project_count}`);
                console.log(`  Created: ${new Date(ws.created_at).toLocaleDateString()}`);
                console.log('');
            });

            if (workspaces.length === 0) {
                console.log(chalk.gray('No workspaces found. Create one with: repochief workspace create'));
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to list workspaces:'), error.message);
        }
    }

    async createWorkspace() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const activeOrg = this.getActiveOrg();

        // Check organization limits first
        try {
            const orgResponse = await client.get(`/api/v1/orgs/${activeOrg}`);
            const org = orgResponse.data.organization;
            
            if (org.workspace_count >= org.max_workspaces) {
                console.error(chalk.red(`✗ Workspace limit reached (${org.workspace_count}/${org.max_workspaces})`));
                console.log(chalk.yellow('Upgrade your subscription to create more workspaces'));
                return;
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to check organization limits'));
            return;
        }

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Workspace name:',
                validate: input => input.length > 0
            },
            {
                type: 'input',
                name: 'slug',
                message: 'Workspace slug (URL-friendly):',
                default: (answers) => answers.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                validate: input => /^[a-z0-9-]+$/.test(input)
            },
            {
                type: 'input',
                name: 'description',
                message: 'Description (optional):'
            }
        ]);

        try {
            const response = await client.post(`/api/v1/orgs/${activeOrg}/workspaces`, {
                name: answers.name,
                slug: answers.slug,
                description: answers.description || null
            });

            console.log(chalk.green('\n✓ Workspace created successfully!'));
            console.log(chalk.cyan(`\nWorkspace: ${response.data.workspace.name}`));
            console.log(`Slug: ${response.data.workspace.slug}`);
            console.log(`ID: ${response.data.workspace.id}`);
            
            console.log(chalk.gray('\nSwitch to this workspace with: repochief workspace switch'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to create workspace:'), error.message);
        }
    }

    async switchWorkspace() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const activeOrg = this.getActiveOrg();

        try {
            const response = await client.get(`/api/v1/orgs/${activeOrg}/workspaces`);
            const workspaces = response.data.workspaces;

            if (workspaces.length === 0) {
                console.log(chalk.yellow('No workspaces found. Create one with: repochief workspace create'));
                return;
            }

            const choices = workspaces.map(ws => ({
                name: `${ws.name} (${ws.slug}) - ${ws.project_count} projects`,
                value: ws.slug
            }));

            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'workspace',
                    message: 'Select workspace:',
                    choices
                }
            ]);

            // Store active workspace in config
            const config = this.loadConfig();
            config.activeWorkspace = answer.workspace;
            this.saveConfig(config);

            console.log(chalk.green(`\n✓ Switched to workspace: ${answer.workspace}`));
        } catch (error) {
            console.error(chalk.red('✗ Failed to switch workspace:'), error.message);
        }
    }

    async showWorkspaceInfo() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const config = this.loadConfig();
        const activeOrg = this.getActiveOrg();
        const activeWorkspace = config.activeWorkspace;

        if (!activeWorkspace) {
            console.log(chalk.yellow('No active workspace. Switch to one with: repochief workspace switch'));
            return;
        }

        try {
            const response = await client.get(`/api/v1/orgs/${activeOrg}/workspaces/${activeWorkspace}`);
            const ws = response.data.workspace;

            console.log(chalk.cyan('\n🗂️  Workspace Information:\n'));
            console.log(`Name: ${chalk.bold(ws.name)}`);
            console.log(`Slug: ${ws.slug}`);
            console.log(`Organization: ${ws.organization_name}`);
            console.log(`Created: ${new Date(ws.created_at).toLocaleDateString()}`);
            
            if (ws.description) {
                console.log(`Description: ${ws.description}`);
            }
            
            console.log(`\nStatistics:`);
            console.log(`  Projects: ${ws.project_count}`);
            console.log(`  Scheduled Tasks: ${ws.scheduled_task_count}`);
            console.log(`  Total Tasks Run: ${ws.total_tasks_run}`);
            
            // List recent projects
            if (ws.recent_projects && ws.recent_projects.length > 0) {
                console.log(chalk.cyan('\nRecent Projects:'));
                ws.recent_projects.forEach(proj => {
                    console.log(`  - ${proj.name} (${proj.repository_url})`);
                });
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to get workspace info:'), error.message);
        }
    }

    async deleteWorkspace() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const activeOrg = this.getActiveOrg();

        try {
            const response = await client.get(`/api/v1/orgs/${activeOrg}/workspaces`);
            const workspaces = response.data.workspaces;

            if (workspaces.length === 0) {
                console.log(chalk.yellow('No workspaces found.'));
                return;
            }

            const choices = workspaces
                .filter(ws => !ws.is_default) // Can't delete default workspace
                .map(ws => ({
                    name: `${ws.name} (${ws.slug}) - ${ws.project_count} projects`,
                    value: ws.slug
                }));

            if (choices.length === 0) {
                console.log(chalk.yellow('No deletable workspaces found (default workspace cannot be deleted).'));
                return;
            }

            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'workspace',
                    message: 'Select workspace to delete:',
                    choices
                },
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure? This will delete all projects and data in this workspace.',
                    default: false
                }
            ]);

            if (!answer.confirm) {
                console.log(chalk.gray('Deletion cancelled.'));
                return;
            }

            await client.delete(`/api/v1/orgs/${activeOrg}/workspaces/${answer.workspace}`);
            console.log(chalk.green(`\n✓ Workspace '${answer.workspace}' deleted successfully`));

            // If we deleted the active workspace, clear it
            const config = this.loadConfig();
            if (config.activeWorkspace === answer.workspace) {
                delete config.activeWorkspace;
                this.saveConfig(config);
                console.log(chalk.yellow('Active workspace cleared. Switch to another workspace.'));
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to delete workspace:'), error.message);
        }
    }
}

module.exports = new WorkspaceCommand();