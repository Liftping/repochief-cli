# RepoChief CLI

> Command-line interface for RepoChief - AI Agent Orchestration Engine

RepoChief CLI provides an easy way to orchestrate swarms of AI coding agents from your terminal.

## Installation

```bash
npm install -g @liftping/repochief-cli
```

Or run directly with npx:

```bash
npx @liftping/repochief-cli demo --mock
```

## Quick Start

### 1. Run the Demo

Try the TODO API demo that showcases a 4-agent swarm:

```bash
# Run in mock mode (no API costs)
repochief demo --mock

# Run with real AI models
repochief demo
```

### 2. Initialize a Project

Create a new RepoChief project:

```bash
repochief init my-project
cd my-project
```

### 3. Configure API Keys

Add your API keys to the `.env` file:

```env
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key
GOOGLE_API_KEY=your-google-key
```

### 4. Run Tasks

Execute your AI agent tasks:

```bash
repochief run tasks/default.json
```

## Authentication

RepoChief CLI supports cloud synchronization across multiple devices. First, authenticate with your RepoChief account:

```bash
# Login with OAuth device flow (recommended)
repochief auth login

# Login with Personal Access Token
repochief auth login --token your-pat-token

# Check authentication status
repochief auth status

# Show detailed usage info
repochief auth status --verbose

# Logout
repochief auth logout
```

## Commands

### `repochief auth`

Manage authentication with RepoChief cloud.

Subcommands:
- `login` - Authenticate using OAuth device flow or PAT
- `logout` - Log out from RepoChief cloud
- `status` - Check authentication and sync status

### `repochief run <task-file>`

Execute AI agents with a task configuration file.

Options:
- `-a, --agents <number>` - Number of agents to spawn (default: 3)
- `-b, --budget <amount>` - Total budget in USD (default: 10)
- `-m, --mock` - Run in mock mode (no API calls)
- `-w, --watch` - Watch progress in real-time
- `-o, --output <dir>` - Output directory for results (default: ./output)

Example:
```bash
repochief run tasks/feature-development.json --agents 5 --budget 20 --watch
```

### `repochief init [project-name]`

Initialize a new RepoChief project with templates and configuration.

Options:
- `-n, --name <name>` - Project name
- `-t, --template <type>` - Project template: basic or advanced (default: basic)

### `repochief demo`

Run the TODO API demo to see RepoChief in action.

Options:
- `-m, --mock` - Run in mock mode (recommended for first try)
- `-b, --budget <amount>` - Budget for the demo (default: 5)

### `repochief agents`

List available agent profiles and their capabilities.

Options:
- `-j, --json` - Output in JSON format
- `-c, --create` - Create a new agent profile (coming soon)
- `-e, --edit <name>` - Edit an existing agent profile (coming soon)

### `repochief status`

Check RepoChief system status and recent sessions.

Options:
- `-s, --session <id>` - Check specific session status
- `-c, --costs` - Show cost breakdown
- `-t, --tasks` - Show task progress

### `repochief config`

Manage RepoChief configuration.

Options:
- `--api-keys` - Configure API keys interactively

## Task Configuration

Tasks are defined in JSON files with the following structure:

```json
{
  "tasks": [
    {
      "id": "analyze-code",
      "type": "comprehension",
      "objective": "Analyze the authentication system",
      "context": ["src/auth/", "docs/"],
      "maxTokens": 50000
    },
    {
      "id": "implement-feature",
      "type": "generation",
      "objective": "Add two-factor authentication",
      "dependencies": ["analyze-code"],
      "successCriteria": [
        "SMS-based 2FA",
        "TOTP support",
        "Backward compatibility"
      ],
      "maxTokens": 80000
    }
  ]
}
```

### Task Types

- **comprehension**: Understand existing code/requirements
- **generation**: Create new code/features
- **validation**: Verify correctness/quality
- **exploration**: Research solutions

## Agent Profiles

RepoChief includes pre-configured agent profiles:

- **SENIOR_DEVELOPER**: GPT-4 based, complex tasks
- **QA_ENGINEER**: Testing and validation specialist
- **SECURITY_EXPERT**: Claude-3 based security analysis
- **ARCHITECT**: High-context system design
- **JUNIOR_DEVELOPER**: Cost-effective simple tasks

## Environment Variables

- `OPENAI_API_KEY`: OpenAI API key
- `ANTHROPIC_API_KEY`: Anthropic (Claude) API key
- `GOOGLE_API_KEY`: Google AI API key
- `MOCK_MODE`: Set to "true" for mock mode
- `DEFAULT_MODEL`: Default AI model to use
- `DEBUG`: Enable debug logging
- `REPOCHIEF_API_URL`: Custom API endpoint (default: https://api.repochief.com/v1)
- `REPOCHIEF_TOKEN`: Personal Access Token for CI/CD environments

## Multi-Device Usage

RepoChief CLI supports seamless usage across multiple devices:

### Personal Devices

```bash
# On your work laptop
repochief auth login
# Device name: MacBook Pro - Work

# On your home desktop
repochief auth login
# Device name: Home Desktop - Windows

# Check all connected devices
repochief auth status --verbose
```

### CI/CD Integration

For automated environments, use Personal Access Tokens:

```bash
# Generate PAT from web dashboard
# Then in CI/CD:
export REPOCHIEF_TOKEN="rcp_xxxxxxxxxxxxxxxx"
repochief run tasks/ci-validation.json
```

### Device Management

```bash
# Logout from current device only
repochief auth logout

# Logout from all devices
repochief auth logout --all-devices

# View device-specific usage
repochief auth status --verbose
```

## Examples

### Basic Code Review

```bash
repochief run examples/code-review.json --agents 2 --budget 5
```

### Feature Development

```bash
repochief run examples/feature-dev.json --agents 4 --budget 20 --watch
```

### Security Audit

```bash
repochief run examples/security-audit.json --agents 3 --budget 15
```

## Troubleshooting

### "No API keys found"

Make sure to set up your API keys in the `.env` file or as environment variables.

### "Budget exceeded"

Increase the budget with the `-b` flag or use mock mode for testing.

### "Cannot find repochief-core"

Install the core package:
```bash
npm install @liftping/repochief-core
```

## Security

- Never commit API keys to the repository
- Use environment variables for sensitive configuration
- Report security vulnerabilities to: security@liftping.com

## Contributing

See the main [RepoChief repository](https://github.com/liftping/repochief) for contribution guidelines.

## License

MIT