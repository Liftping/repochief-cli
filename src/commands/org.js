/**
 * Organization management commands for RepoChief CLI
 * Multi-tenancy support for SaaS operations
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const { getClient } = require('../auth/AuthManager');
const BaseCommand = require('./BaseCommand');

class OrgCommand extends BaseCommand {
    constructor() {
        super();
        this.commands = {
            list: this.listOrganizations.bind(this),
            create: this.createOrganization.bind(this),
            switch: this.switchOrganization.bind(this),
            info: this.showOrganizationInfo.bind(this),
            members: this.listMembers.bind(this),
            invite: this.inviteMember.bind(this)
        };
    }

    async execute(subcommand, args) {
        if (!subcommand || !this.commands[subcommand]) {
            console.log(chalk.yellow('\nAvailable organization commands:'));
            console.log('  repochief org list                 - List all your organizations');
            console.log('  repochief org create               - Create a new organization');
            console.log('  repochief org switch               - Switch active organization');
            console.log('  repochief org info                 - Show current organization info');
            console.log('  repochief org members              - List organization members');
            console.log('  repochief org invite <email>       - Invite member to organization');
            return;
        }

        await this.commands[subcommand](args);
    }

    async listOrganizations() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        try {
            const response = await client.get('/api/v1/organizations');
            const orgs = response.data.organizations;

            console.log(chalk.cyan('\n📋 Your Organizations:\n'));
            
            orgs.forEach(org => {
                const marker = org.is_active ? chalk.green('●') : chalk.gray('○');
                const tier = chalk.yellow(`[${org.subscription_tier}]`);
                console.log(`${marker} ${chalk.bold(org.name)} ${tier}`);
                console.log(`  Slug: ${org.slug}`);
                console.log(`  Role: ${org.role}`);
                console.log(`  Workspaces: ${org.workspace_count}/${org.max_workspaces}`);
                console.log('');
            });

            if (orgs.length === 0) {
                console.log(chalk.gray('No organizations found. Create one with: repochief org create'));
            }
        } catch (error) {
            console.error(chalk.red('✗ Failed to list organizations:'), error.message);
        }
    }

    async createOrganization() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'name',
                message: 'Organization name:',
                validate: input => input.length > 0
            },
            {
                type: 'input',
                name: 'slug',
                message: 'Organization slug (URL-friendly):',
                default: (answers) => answers.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                validate: input => /^[a-z0-9-]+$/.test(input)
            },
            {
                type: 'list',
                name: 'tier',
                message: 'Subscription tier:',
                choices: [
                    { name: 'Free (3 workspaces, 10 projects)', value: 'free' },
                    { name: 'Pro (10 workspaces, 50 projects)', value: 'pro' },
                    { name: 'Business (unlimited)', value: 'business' }
                ],
                default: 'free'
            }
        ]);

        try {
            const response = await client.post('/api/v1/organizations', {
                name: answers.name,
                slug: answers.slug,
                subscription_tier: answers.tier
            });

            console.log(chalk.green('\n✓ Organization created successfully!'));
            console.log(chalk.cyan(`\nOrganization: ${response.data.organization.name}`));
            console.log(`Slug: ${response.data.organization.slug}`);
            console.log(`ID: ${response.data.organization.id}`);
            
            // Create default workspace
            console.log(chalk.gray('\nCreating default workspace...'));
            await client.post(`/api/v1/orgs/${answers.slug}/workspaces`, {
                name: 'Default',
                slug: 'default'
            });
            
            console.log(chalk.green('✓ Default workspace created'));
            console.log(chalk.gray('\nSwitch to this organization with: repochief org switch'));
        } catch (error) {
            console.error(chalk.red('✗ Failed to create organization:'), error.message);
        }
    }

    async switchOrganization() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        try {
            const response = await client.get('/api/v1/organizations');
            const orgs = response.data.organizations;

            if (orgs.length === 0) {
                console.log(chalk.yellow('No organizations found. Create one with: repochief org create'));
                return;
            }

            const choices = orgs.map(org => ({
                name: `${org.name} (${org.slug}) - ${org.subscription_tier}`,
                value: org.slug
            }));

            const answer = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'org',
                    message: 'Select organization:',
                    choices
                }
            ]);

            // Store active organization in config
            const config = this.loadConfig();
            config.activeOrganization = answer.org;
            this.saveConfig(config);

            console.log(chalk.green(`\n✓ Switched to organization: ${answer.org}`));
        } catch (error) {
            console.error(chalk.red('✗ Failed to switch organization:'), error.message);
        }
    }

    async showOrganizationInfo() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const config = this.loadConfig();
        const activeOrg = config.activeOrganization || '@me';

        try {
            const response = await client.get(`/api/v1/orgs/${activeOrg}`);
            const org = response.data.organization;

            console.log(chalk.cyan('\n🏢 Organization Information:\n'));
            console.log(`Name: ${chalk.bold(org.name)}`);
            console.log(`Slug: ${org.slug}`);
            console.log(`Tier: ${chalk.yellow(org.subscription_tier)}`);
            console.log(`Created: ${new Date(org.created_at).toLocaleDateString()}`);
            console.log(`\nLimits:`);
            console.log(`  Workspaces: ${org.workspace_count}/${org.max_workspaces}`);
            console.log(`  Projects: ${org.project_count}/${org.max_projects}`);
            console.log(`  Scheduled Tasks: ${org.scheduled_task_count}/${org.max_scheduled_tasks}`);
            console.log(`  API Calls Today: ${org.api_calls_today}/${org.max_api_calls_per_day}`);
        } catch (error) {
            console.error(chalk.red('✗ Failed to get organization info:'), error.message);
        }
    }

    async listMembers() {
        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const config = this.loadConfig();
        const activeOrg = config.activeOrganization || '@me';

        try {
            const response = await client.get(`/api/v1/orgs/${activeOrg}/members`);
            const members = response.data.members;

            console.log(chalk.cyan('\n👥 Organization Members:\n'));
            
            members.forEach(member => {
                const roleColor = member.role === 'owner' ? chalk.red : 
                                member.role === 'admin' ? chalk.yellow : chalk.gray;
                console.log(`${chalk.bold(member.email)} - ${roleColor(member.role)}`);
                console.log(`  Joined: ${new Date(member.joined_at).toLocaleDateString()}`);
                console.log('');
            });
        } catch (error) {
            console.error(chalk.red('✗ Failed to list members:'), error.message);
        }
    }

    async inviteMember(args) {
        const email = args._[0];
        if (!email) {
            console.error(chalk.red('✗ Please provide an email: repochief org invite <email>'));
            return;
        }

        const client = await getClient();
        if (!client) {
            console.error(chalk.red('✗ Please login first: repochief auth login'));
            return;
        }

        const config = this.loadConfig();
        const activeOrg = config.activeOrganization || '@me';

        const answer = await inquirer.prompt([
            {
                type: 'list',
                name: 'role',
                message: 'Select role for new member:',
                choices: ['member', 'admin'],
                default: 'member'
            }
        ]);

        try {
            await client.post(`/api/v1/orgs/${activeOrg}/members`, {
                email,
                role: answer.role
            });

            console.log(chalk.green(`\n✓ Invitation sent to ${email}`));
        } catch (error) {
            console.error(chalk.red('✗ Failed to invite member:'), error.message);
        }
    }
}

module.exports = new OrgCommand();